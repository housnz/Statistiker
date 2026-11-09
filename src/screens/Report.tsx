import { useMemo } from 'preact/hooks';
import { db } from '../db';
import type { Action, Match, Player } from '../model';
import { distribution } from '../model';
import { PlayerStats, pctLabel, setSummary, statsByPlayer, teamStats } from '../stats';
import { fmtDate, go, team, useLive, words } from '../state';
import { setsWon } from './Home';
import { DIST_COLORS } from './Scout';

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

  const byPlayer = useMemo(() => statsByPlayer(actions), [actions]);
  const tot = useMemo(() => teamStats(actions), [actions]);
  const W = words();
  if (!match) return <div class="page">Lade …</div>;

  const sets = match.sets.filter((s) => s.final || actions.some((a) => a.set === s.nr));
  const sums = sets.map((s) => setSummary(s.nr, s.final, actions.filter((a) => a.set === s.nr)));
  const [won, lost] = setsWon(match);
  const oppErr = actions.filter((a) => a.element === 'opp' && (a.result === 'SE' || a.result === 'F')).length;
  const missing = sums.reduce((n, s) => n + Math.max(0, s.missing), 0);

  const rows = players.filter((p) => byPlayer.has(p.id!)).map((p) => ({ p, s: byPlayer.get(p.id!)! }));
  const top = [...rows].sort((a, b) => b.s.points - a.s.points)[0];
  const recPos = tot.recP + tot.recG;
  const dist = distribution(actions);

  return (
    <div class="page">
      <div class="topbar">
        <button class="btn" onClick={() => go({ name: 'home' })}>‹ Zurück</button>
        <div>
          <div class="small muted">Spielauswertung {team.value?.name}</div>
          <h1>Matchstatistik gegen {match.opponent}</h1>
        </div>
        <div class="spacer" />
        {!match.finished && <button class="btn" onClick={() => go({ name: 'scout', matchId })}>Weiter erfassen</button>}
        <button class="btn" disabled title="kommt im nächsten Schritt">PDF</button>
        <button class="btn" disabled title="kommt im nächsten Schritt">Excel</button>
      </div>

      <div class="row" style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 40, fontWeight: 800 }}>{won}:{lost}</span>
        <div class="setchips">
          {sums.map((s) => <span class="setchip">{s.final ? `${s.final[0]}:${s.final[1]}` : `Satz ${s.nr} läuft`}</span>)}
        </div>
        <span class="muted">{fmtDate(match.date)}{match.place ? ` · ${match.place}` : ''}</span>
      </div>

      <div class="kpis">
        <Kpi l={W.top} v={top ? `${top.s.points}` : '0'} s={top ? top.p.name : ''} />
        <Kpi l="Kill-Quote" v={pctLabel(tot.attK, tot.att)} s={`${tot.attK} Punkte aus ${tot.att} Angriffen`} />
        <Kpi l="Asse" v={`${tot.srvA}`} s={`${tot.srvE} Aufschlagfehler bei ${tot.srv} Aufschlägen`} />
        <Kpi l="Annahme positiv" v={pctLabel(recPos, tot.rec)} s={`${tot.recP} perfekt, ${tot.recG} gut, ${tot.recE} Fehler`} />
        <Kpi l="Blockpunkte" v={`${tot.blkK}`} s={`${tot.blkT} gute Touches`} />
        <Kpi l="Eigene Fehler" v={`${tot.errors}`} s="Angriff, Aufschlag, Annahme, Block, Sonstiges" />
        <Kpi l="Fehler des Gegners" v={`${oppErr}`} s="Aufschlag und sonstige" />
        <Kpi l="Nicht notiert" v={`${missing}`} s={missing ? 'eigene Punkte ohne Eintrag' : 'alle Sätze gehen auf'} />
      </div>

      <div class="card" style={{ marginBottom: 16 }}>
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
      </div>

      <div class="card" style={{ marginBottom: 16 }}>
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
      </div>

      <div class="grid2">
        <div class="card">
          <h2>Zuspielverteilung</h2>
          <div class="distbar" style={{ height: 34 }}>
            {(['p4', 'p3', 'p2', 'back'] as const).map((k) =>
              dist[k] ? <div style={{ width: `${(dist[k] / dist.total) * 100}%`, background: DIST_COLORS[k] }}>{dist[k]}</div> : null,
            )}
          </div>
          <p class="small muted">über 4: {pctLabel(dist.p4, dist.total)} · über 3: {pctLabel(dist.p3, dist.total)} · über 2: {pctLabel(dist.p2, dist.total)} · hinten: {pctLabel(dist.back, dist.total)}</p>
        </div>
        <div class="card">
          <h2>So wurde gezählt</h2>
          <p class="small muted" style={{ margin: 0 }}>
            Punkte = Angriffspunkte + Asse + Blockpunkte. Fehler = Angriff (Fehler und geblockt) + Aufschlagfehler + Annahmefehler + Blockfehler + sonstige Fehler. Bilanz = Punkte minus Fehler.
            Kill-Quote = Angriffspunkte / Angriffe. Effizienz = (Punkte − Fehler − geblockt) / Angriffe. Annahme positiv = perfekt + gut.
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({ l, v, s }: { l: string; v: string; s: string }) {
  return <div class="kpi"><div class="l">{l}</div><div class="v">{v}</div><div class="s">{s}</div></div>;
}

function PRow({ name, s, total }: { name: string; s: PlayerStats; total?: boolean }) {
  const eff = s.att ? `${Math.round(((s.attK - s.attE - s.attB) / s.att) * 100)} %` : '·';
  return (
    <tr class={total ? 'total' : ''}>
      <td>{name}</td>
      <td>{s.points}</td><td>{s.errors}</td><td>{s.balance > 0 ? `+${s.balance}` : s.balance}</td>
      <td>{s.att}</td><td>{s.attK}</td><td>{s.attB}</td><td>{s.attE}</td><td>{pctLabel(s.attK, s.att)}</td><td>{eff}</td>
      <td>{s.srv}</td><td>{s.srvA}</td><td>{s.srvE}</td>
      <td>{s.rec}</td><td>{pctLabel(s.recP + s.recG, s.rec)}</td><td>{s.recE}</td>
      <td>{s.blkK}</td><td>{s.blkT}</td><td>{s.blkE}</td>
      <td>{s.othE}</td>
    </tr>
  );
}
