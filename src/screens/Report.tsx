// Auswertung im Stil "Anzeigetafel" (Vorschlag A): dunkel, große Zahlen.
import { useEffect, useMemo } from 'preact/hooks';
import { db } from '../db';
import type { Action, Match, Player } from '../model';
import { distribution } from '../model';
import { PlayerStats, bil, pctLabel, setSummary, statsByPlayer, teamStats } from '../stats';
import { fmtDate, go, team, useLive, words } from '../state';
import { setsWon } from './Home';
import { DIST_COLORS } from './Scout';
import { ProReport } from './ProReport';
import { exportPdf, exportXlsx } from '../exporting';

const SEG = { att: '#23a55a', srv: '#8fdcaa', blk: '#14b8a6', opp: '#7d8aa0' };

export function Report({ matchId }: { matchId: number }) {
  const match = useLive(() => db.matches.get(matchId), [matchId], undefined as Match | undefined);
  const actions = useLive(() => db.actions.where('matchId').equals(matchId).sortBy('seq'), [matchId], [] as Action[]);
  const players = useLive(
    async () => {
      const m = await db.matches.get(matchId);
      if (!m) return [];
      return ((await db.players.bulkGet(m.playerIds)).filter(Boolean) as Player[]).sort((a, b) => a.order - b.order);
    },
    [matchId],
    [] as Player[],
  );

  // Die Auswertung ist immer dunkel: auch der Seitenhintergrund.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#0f131a';
    return () => { document.body.style.background = prev; };
  }, []);

  const byPlayer = useMemo(() => statsByPlayer(actions), [actions]);
  const tot = useMemo(() => teamStats(actions), [actions]);
  const W = words();
  if (!match) return <div class="rep">Lade …</div>;

  const sets = match.sets.filter((s) => s.final || actions.some((a) => a.set === s.nr));
  const sums = sets.map((s) => setSummary(s.nr, s.final, actions.filter((a) => a.set === s.nr)));
  const [won, lost] = setsWon(match);
  const oppErr = actions.filter((a) => a.element === 'opp' && (a.result === 'SE' || a.result === 'F')).length;
  const missing = sums.reduce((n, s) => n + Math.max(0, s.missing), 0);

  const rows = players.filter((p) => byPlayer.has(p.id!)).map((p) => ({ p, s: byPlayer.get(p.id!)! }));
  const top = [...rows].sort((a, b) => b.s.points - a.s.points)[0];
  const recPos = tot.recP + tot.recG;
  const dist = distribution(actions);
  const scale = Math.max(25, ...sums.map((s) => (s.final ? Math.max(s.final[0], s.final[1]) : s.counted[0])));
  const one = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;

  return (
    <div class="rep">
      <header>
        <button class="rbtn2" onClick={() => go({ name: 'home' })} aria-label="Zurück">‹</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span class="kick">Spielauswertung {team.value?.name}</span>
          <h1>Matchstatistik gegen {match.opponent}</h1>
        </div>
        <div style={{ flex: 1 }} />
        {!match.finished && <button class="rbtn2" onClick={() => go({ name: 'scout', matchId })}>Weiter erfassen</button>}
        <button class="rbtn2" onClick={() => exportXlsx(matchId)}>Excel</button>
        <button class="rbtn2 red" onClick={() => exportPdf(matchId)}>PDF erstellen</button>
      </header>

      <div class="result">
        <span class="big">{won} : {lost}</span>
        {sums.map((s) => <span class="chipset">{s.final ? `${s.final[0]}:${s.final[1]}` : `Satz ${s.nr} läuft`}</span>)}
        <span style={{ color: 'var(--r-muted)', fontSize: 15 }}>{fmtDate(match.date)}{match.place ? ` · ${match.place}` : ''}</span>
      </div>

      <div class="kpis">
        <Kpi l={W.top} v={top ? `${top.s.points}` : '0'} s={top ? top.p.name : ''} />
        <Kpi l="Kill-Quote" v={pctLabel(tot.attK, tot.att)} s={`${one(tot.attK, 'Punkt', 'Punkte')} aus ${one(tot.att, 'Angriff', 'Angriffen')}`} />
        <Kpi l="Asse" v={`${tot.srvA}`} s={`${tot.srvE} Fehler bei ${one(tot.srv, 'Aufschlag', 'Aufschlägen')}`} />
        <Kpi l="Annahme positiv" v={pctLabel(recPos, tot.rec)} s={`${tot.recP} perfekt, ${tot.recG} gut, ${tot.recE} Fehler`} />
        <Kpi l="Blockpunkte" v={`${tot.blkK}`} s={`${tot.blkT} gute Touches`} />
        <Kpi l="Eigene Fehler" v={`${tot.errors}`} s={`Angriff, Aufschlag, Annahme, Block, Sonstiges${match.mode === 'profi' ? ', Zuspiel, Abwehr' : ''}`} />
        <Kpi l="Fehler des Gegners" v={`${oppErr}`} s="Aufschlag und sonstige" />
        <Kpi l="Nicht notiert" v={`${missing}`} s={missing ? 'eigene Punkte ohne Eintrag' : 'alle Sätze gehen auf'} />
      </div>

      <div class="two">
        <section class="panel">
          <h2>Satz für Satz: woher die Punkte kamen</h2>
          {sums.map((s) => {
            const o = s.ownPoints;
            const parts: [number, string, boolean?][] = [[o.att, SEG.att], [o.srv, SEG.srv], [o.blk, SEG.blk], [o.oppSrv + o.oppF, SEG.opp], [Math.max(0, s.missing), '', true]];
            const used = parts.reduce((n, [v]) => n + v, 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div class="seglbl">
                  <b>Satz {s.nr}</b>
                  <span style={{ color: 'var(--r-muted)' }}>{s.final ? `${s.final[0]}:${s.final[1]}` : 'läuft'}{s.missing > 0 ? ` · ${s.missing} nicht notiert` : ''}</span>
                </div>
                <div class="setbar">
                  {parts.filter(([v]) => v > 0).map(([v, c, dashed]) => (
                    <div style={{ flex: `${v} 0 0`, ...(dashed ? { border: '2px dashed #9aa6b8' } : { background: c }) }} />
                  ))}
                  {scale - used > 0 && <div style={{ flex: `${scale - used} 0 0` }} />}
                </div>
              </div>
            );
          })}
          <div class="lgd" style={{ marginTop: 'auto' }}>
            <span><i style={{ background: SEG.att }} />Angriff</span>
            <span><i style={{ background: SEG.srv }} />Ass</span>
            <span><i style={{ background: SEG.blk }} />Block</span>
            <span><i style={{ background: SEG.opp }} />Gegnerfehler</span>
            <span><i style={{ border: '2px dashed #9aa6b8', boxSizing: 'border-box' }} />nicht notiert</span>
          </div>
        </section>

        <section class="panel" style={{ gap: 4 }}>
          <h2 style={{ marginBottom: 6 }}>Punkte und Fehler pro {W.one}</h2>
          <div class="ptab h"><span>NAME</span><span>PKT</span><span>FEHLER</span><span>BILANZ</span><span>KILL</span><span>ASSE</span><span>ANNAHME</span></div>
          {rows.map(({ p, s }) => (
            <div class="ptab">
              <b>{p.number != null ? `${p.number} ` : ''}{p.name}</b>
              <span>{s.points}</span><span>{s.errors}</span>
              <span class="bil">{bil(s.balance)}</span>
              <span>{pctLabel(s.attK, s.att)}</span><span>{s.srvA}</span><span>{pctLabel(s.recP + s.recG, s.rec)}</span>
            </div>
          ))}
          {!rows.length && <p>Noch keine Aktionen erfasst.</p>}
        </section>
      </div>

      {match.mode === 'profi' && <ProReport match={match} actions={actions} players={players} />}

      <section class="panel">
        <h2>Die Sätze in Zahlen</h2>
        <div class="scroll-x">
          <table class="data">
            <thead><tr><th>Satz</th><th>Ergebnis</th><th>Angriff</th><th>Asse</th><th>Block</th><th>Gegnerfehler</th><th>nicht notiert</th><th>eigene Fehler</th><th>vom Gegner erspielt</th></tr></thead>
            <tbody>
              {sums.map((s) => (
                <tr>
                  <td>Satz {s.nr}</td>
                  <td>{s.final ? `${s.final[0]}:${s.final[1]}` : `${s.counted[0]}:${s.counted[1]}`}</td>
                  <td>{s.ownPoints.att}</td><td>{s.ownPoints.srv}</td><td>{s.ownPoints.blk}</td>
                  <td>{s.ownPoints.oppSrv + s.ownPoints.oppF}</td>
                  <td>{s.missing}</td><td>{s.ownErrors}</td><td>{s.oppEarned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>Alle Werte pro {W.one}</h2>
        <div class="scroll-x">
          <table class="data">
            <thead>
              <tr>
                <th />
                <th class="grp" colSpan={3}>Gesamt</th>
                <th class="grp" colSpan={6}>Angriff</th>
                <th class="grp" colSpan={3}>Aufschlag</th>
                <th class="grp" colSpan={3}>Annahme</th>
                <th class="grp" colSpan={3}>Block</th>
                <th class="grp">Sonst.</th>
              </tr>
              <tr>
                <th>{W.one}</th>
                <th>Pkt</th><th>Fehler</th><th>Bilanz</th>
                <th>Ges.</th><th>Pkt</th><th>geb.</th><th>Fehler</th><th>Kill</th><th>Eff.</th>
                <th>Ges.</th><th>Ass</th><th>Fehler</th>
                <th>Ges.</th><th>positiv</th><th>Fehler</th>
                <th>Pkt</th><th>Touch</th><th>Fehler</th>
                <th>Fehler</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, s }) => <PRow name={`${p.number ?? ''} ${p.name}`} s={s} />)}
              <PRow name="Team" s={tot} total />
            </tbody>
          </table>
        </div>
      </section>

      <div class="two">
        <section class="panel">
          <h2>Zuspielverteilung</h2>
          <div class="distbar">
            {(['p4', 'p3', 'p2', 'back'] as const).map((k) =>
              dist[k] ? <div style={{ flex: `${dist[k]} 0 0`, background: DIST_COLORS[k] }}>{dist[k]}</div> : null,
            )}
          </div>
          <p>über 4: {pctLabel(dist.p4, dist.total)} · über 3: {pctLabel(dist.p3, dist.total)} · über 2: {pctLabel(dist.p2, dist.total)} · hinten: {pctLabel(dist.back, dist.total)}</p>
        </section>
        <section class="panel">
          <h2>So wurde gezählt</h2>
          <p>
            Punkte = Angriffspunkte + Asse + Blockpunkte. Fehler = Angriff (Fehler und geblockt) + Aufschlagfehler + Annahmefehler + Blockfehler + sonstige Fehler{match.mode === 'profi' ? ' + Zuspielfehler + vermeidbare Abwehrfehler' : ''}. Bilanz = Punkte minus Fehler.
            Kill-Quote = Angriffspunkte / Angriffe. Effizienz = (Punkte minus Fehler minus geblockt) / Angriffe. Annahme positiv = perfekt + gut.
          </p>
        </section>
      </div>
    </div>
  );
}

function Kpi({ l, v, s }: { l: string; v: string; s: string }) {
  return <div class="kpi"><span class="kick">{l}</span><span class="v">{v}</span><span class="s">{s}</span></div>;
}

function PRow({ name, s, total }: { name: string; s: PlayerStats; total?: boolean }) {
  const eff = pctLabel(s.attK - s.attE - s.attB, s.att);
  return (
    <tr class={total ? 'total' : ''}>
      <td>{name}</td>
      <td>{s.points}</td><td>{s.errors}</td><td>{bil(s.balance)}</td>
      <td>{s.att}</td><td>{s.attK}</td><td>{s.attB}</td><td>{s.attE}</td><td>{pctLabel(s.attK, s.att)}</td><td>{eff}</td>
      <td>{s.srv}</td><td>{s.srvA}</td><td>{s.srvE}</td>
      <td>{s.rec}</td><td>{pctLabel(s.recP + s.recG, s.rec)}</td><td>{s.recE}</td>
      <td>{s.blkK}</td><td>{s.blkT}</td><td>{s.blkE}</td>
      <td>{s.othE}</td>
    </tr>
  );
}
