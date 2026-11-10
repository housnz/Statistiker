// Profi-Auswertung: Sideout und Break pro Läufer, Angriffsphasen, Zielzonen, Zuspiel, Abwehr, Videoszenen.
import { useMemo, useState } from 'preact/hooks';
import { Action, EL, ElementKey, INPUT_ELEMENTS, Match, Player, describeAction, effectOf } from '../model';
import { proStats, replaySet, zoneStats } from '../rally';
import { bil, pctLabel, statsByPlayer } from '../stats';
import { words } from '../state';
import { VideoPlayer, fmtTime, seekTo, video } from '../video';
import { DIST_COLORS } from './Scout';

const pctN = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function ProReport({ match, actions, players }: { match: Match; actions: Action[]; players: Player[] }) {
  const W = words();
  const pmap = useMemo(() => new Map(players.map((p) => [p.id!, p])), [players]);
  const ps = useMemo(() => proStats(match.sets, actions, pmap), [match, actions, pmap]);
  const byPlayer = useMemo(() => statsByPlayer(actions), [actions]);
  const attZ = zoneStats(actions, 'att');
  const srvZ = zoneStats(actions, 'srv');
  const setters = players.filter((p) => (byPlayer.get(p.id!)?.set ?? 0) > 0);
  const diggers = players.filter((p) => (byPlayer.get(p.id!)?.dig ?? 0) > 0);
  const phase = (x: { all: number; k: number; b: number; e: number }) => ({
    ...x, kill: pctLabel(x.k, x.all), eff: pctLabel(x.k - x.e - x.b, x.all),
  });
  const aRec = phase(ps.attAfterRec);
  const aTr = phase(ps.attTransition);

  return (
    <>
      <div class="kick" style={{ marginTop: 10 }}>Profi-Auswertung</div>
      {ps.missingLineup.length > 0 && (
        <p>Für Satz {ps.missingLineup.join(', ')} fehlt die Aufstellung. Läufer-Werte sind dort nicht vollständig.</p>
      )}

      <div class="kpis">
        <div class="kpi"><span class="kick">Sideout</span><span class="v">{pctLabel(ps.sideout.won, ps.sideout.all)}</span><span class="s">{ps.sideout.won} von {ps.sideout.all} Ballwechseln mit Annahme</span></div>
        <div class="kpi"><span class="kick">Break</span><span class="v">{pctLabel(ps.breakp.won, ps.breakp.all)}</span><span class="s">{ps.breakp.won} von {ps.breakp.all} Ballwechseln mit eigenem Aufschlag</span></div>
        <div class="kpi"><span class="kick">First-Ball-Sideout</span><span class="v">{pctLabel(ps.fbso.won, ps.fbso.all)}</span><span class="s">Punkt mit dem ersten Angriff nach der Annahme</span></div>
        <div class="kpi"><span class="kick">Ballwechsel</span><span class="v">{ps.rallies}</span><span class="s">erfasst in {match.sets.filter((s) => actions.some((a) => a.set === s.nr)).length} Sätzen</span></div>
      </div>

      <div class="two">
        <section class="panel">
          <h2>Sideout und Break pro Läufer</h2>
          <p>Läufer = Position der Zuspielerin. Balken: Anteil gewonnener Ballwechsel.</p>
          <div class="rotgrid h"><span>LÄUFER</span><span>SIDEOUT</span><span /><span>BREAK</span><span /><span>+/−</span></div>
          {ps.perRot.map((r) => (
            <div class="rotgrid">
              <b class="cond" style={{ fontSize: 22 }}>{r.rot}</b>
              <span class="num">{r.soWon}/{r.soAll}</span>
              <Bar v={pctN(r.soWon, r.soAll)} color="#3b82f6" />
              <span class="num">{r.bpWon}/{r.bpAll}</span>
              <Bar v={pctN(r.bpWon, r.bpAll)} color="#14b8a6" />
              <span class="num">{bil(r.won - r.lost)}</span>
            </div>
          ))}
        </section>

        <section class="panel">
          <h2>Angriff nach Annahme und im Konter</h2>
          <table class="data">
            <thead><tr><th /><th>Angriffe</th><th>Punkte</th><th>geblockt</th><th>Fehler</th><th>Kill</th><th>Eff.</th></tr></thead>
            <tbody>
              <tr><td>nach Annahme</td><td>{aRec.all}</td><td>{aRec.k}</td><td>{aRec.b}</td><td>{aRec.e}</td><td>{aRec.kill}</td><td>{aRec.eff}</td></tr>
              <tr><td>Konter</td><td>{aTr.all}</td><td>{aTr.k}</td><td>{aTr.b}</td><td>{aTr.e}</td><td>{aTr.kill}</td><td>{aTr.eff}</td></tr>
            </tbody>
          </table>
          <h2 style={{ marginTop: 8 }}>Verteilung des ersten Angriffs nach der Annahme</h2>
          <DistRow label="nach guter Annahme" d={ps.distAfterGoodRec} />
          <DistRow label="nach schwacher Annahme" d={ps.distAfterBadRec} />
          <p>Gute Annahme = perfekt oder gut. Schwach = ok oder schlecht.</p>
        </section>
      </div>

      <div class="two">
        <section class="panel">
          <h2>Zielzonen</h2>
          <div class="zpair">
            <ZoneCourt title="Angriff" data={attZ.zones} ptLabel="Punkte" />
            <ZoneCourt title="Aufschlag" data={srvZ.zones} ptLabel="Asse" />
          </div>
          <p>Gegnerfeld von unserer Seite gesehen, Netz unten. Zahl = Anzahl, darunter Punkte bzw. Asse. {attZ.without + srvZ.without > 0 ? `${attZ.without + srvZ.without} ${attZ.without + srvZ.without === 1 ? 'Aktion' : 'Aktionen'} ohne Zone.` : ''}</p>
        </section>

        <section class="panel">
          <h2>Zuspiel</h2>
          {setters.length ? (
            <table class="data">
              <thead><tr><th>{W.one}</th><th>Zuspiele</th><th>gut angreifbar</th><th>eingeschränkt</th><th>nicht angreifbar</th><th>Fehler</th></tr></thead>
              <tbody>
                {setters.map((p) => {
                  const s = byPlayer.get(p.id!)!;
                  return <tr><td>{p.number ?? ''} {p.name}</td><td>{s.set}</td><td>{pctLabel(s.setG, s.set)}</td><td>{s.setL}</td><td>{s.setN}</td><td>{s.setE}</td></tr>;
                })}
              </tbody>
            </table>
          ) : <p>Noch keine Zuspiele erfasst.</p>}
          <h2 style={{ marginTop: 8 }}>Abwehr</h2>
          {diggers.length ? (
            <table class="data">
              <thead><tr><th>{W.one}</th><th>Abwehr</th><th>gut</th><th>ok</th><th>Fehler (vermeidbar)</th><th>unhaltbar</th><th>gut %</th></tr></thead>
              <tbody>
                {diggers.map((p) => {
                  const s = byPlayer.get(p.id!)!;
                  return <tr><td>{p.number ?? ''} {p.name}</td><td>{s.dig}</td><td>{s.digG}</td><td>{s.digO}</td><td>{s.digE}</td><td>{s.digU}</td><td>{pctLabel(s.digG, s.dig)}</td></tr>;
                })}
              </tbody>
            </table>
          ) : <p>Noch keine Abwehraktionen erfasst.</p>}
          <p>Fehler (vermeidbar) zählen als eigene Fehler. Unhaltbare Bälle zählen als Punkt des Gegners, nicht als Fehler.</p>
        </section>
      </div>

      <Scenes match={match} actions={actions} players={players} pmap={pmap} />
    </>
  );
}

function Bar({ v, color }: { v: number; color: string }) {
  return (
    <div class="hbar" role="img" aria-label={`${v} Prozent`}>
      <div style={{ width: `${v}%`, background: color }} />
      <span>{v} %</span>
    </div>
  );
}

function DistRow({ label, d }: { label: string; d: Record<'p4' | 'p3' | 'p2' | 'back', number> }) {
  const total = d.p4 + d.p3 + d.p2 + d.back;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 14 }}>{label} <span style={{ color: 'var(--r-muted)' }}>({total})</span></span>
      <div class="distbar" style={{ height: 26 }}>
        {(['p4', 'p3', 'p2', 'back'] as const).map((k) => d[k] ? <div style={{ flex: `${d[k]} 0 0`, background: DIST_COLORS[k] }}>{k === 'back' ? 'h' : k.slice(1)} · {d[k]}</div> : null)}
        {!total && <div style={{ flex: 1, background: '#212937', color: 'var(--r-muted)' }}>keine Daten</div>}
      </div>
    </div>
  );
}

function ZoneCourt({ title, data, ptLabel }: { title: string; data: Record<number, { all: number; pts: number; err: number }>; ptLabel: string }) {
  const max = Math.max(1, ...Object.values(data).map((z) => z.all));
  return (
    <div class="zcourt">
      <b>{title}</b>
      <div class="zgrid">
        {[1, 6, 5, 2, 3, 4].map((z) => {
          const v = data[z];
          return (
            <div class="zcell" style={{ background: `rgba(59, 130, 246, ${0.12 + (v.all / max) * 0.6})` }}>
              <span class="zn">{z}</span>
              <span class="zv">{v.all}</span>
              <span class="zs">{v.pts} {v.pts === 1 ? ptLabel.replace(/e$/, '') : ptLabel}</span>
            </div>
          );
        })}
      </div>
      <div class="znet">Netz</div>
    </div>
  );
}

/** Szenen im Video: filtern und anspringen. */
function Scenes({ match, actions, players, pmap }: { match: Match; actions: Action[]; players: Player[]; pmap: Map<number, Player> }) {
  const W = words();
  const [pid, setPid] = useState<string>('');
  const [el, setEl] = useState<string>('');
  const [res, setRes] = useState<string>('');
  const withTime = actions.filter((a) => a.vt != null && a.element !== 'sub');
  const scoreAt = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of match.sets) {
      const st = replaySet(s, actions.filter((a) => a.set === s.nr), pmap);
      for (const r of st.rallies) for (const a of r.actions) m.set(a.id!, `Satz ${s.nr} · Stand danach ${r.score[0]}:${r.score[1]} · Läufer ${r.rot || '?'}`);
    }
    return m;
  }, [match, actions, pmap]);
  const list = withTime.filter((a) =>
    (!pid || String(a.playerId) === pid) && (!el || a.element === el) &&
    (!res || (res === 'point' || res === 'error' ? effectOf(a) === res : a.result === res)));
  const elDef = el ? EL[el as ElementKey] : null;

  return (
    <section class="panel" id="szenen">
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <h2>Szenen im Video</h2>
        <span style={{ color: 'var(--r-muted)', fontSize: 14 }}>{withTime.length} Aktionen mit Videozeit</span>
      </div>
      {!withTime.length ? (
        <p>Für dieses Spiel gibt es noch keine Videozeiten. Sie entstehen, wenn beim Erfassen im Profi-Modus ein Video läuft.</p>
      ) : (
        <div class="scenes">
          <div class="svid">
            <VideoPlayer expected={match.video?.name} />
          </div>
          <div class="slist">
            <div class="row" style={{ gap: 6 }}>
              <select id="sc-player" value={pid} onChange={(e) => setPid((e.target as HTMLSelectElement).value)}>
                <option value="">alle {W.many}</option>
                {players.map((p) => <option value={String(p.id)}>{p.number ?? ''} {p.name}</option>)}
              </select>
              <select id="sc-el" value={el} onChange={(e) => { setEl((e.target as HTMLSelectElement).value); setRes(''); }}>
                <option value="">alle Elemente</option>
                {INPUT_ELEMENTS.map((e) => <option value={e.key}>{e.label}</option>)}
                <option value="opp">Gegner</option>
              </select>
              <select id="sc-res" value={res} onChange={(e) => setRes((e.target as HTMLSelectElement).value)}>
                <option value="">alle Ergebnisse</option>
                <option value="point">nur Punkte</option>
                <option value="error">nur Fehler</option>
                {elDef?.results.map((r) => <option value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div class="slines">
              {list.map((a) => (
                <button class="sline" disabled={!video.value} onClick={() => seekTo(a.vt!)}>
                  <span class="num t">{fmtTime(a.vt)}</span>
                  <span class="d">{describeAction(a, pmap.get(a.playerId!))}<br /><span>{scoreAt.get(a.id!) ?? ''}</span></span>
                </button>
              ))}
              {!list.length && <p>Keine passende Szene.</p>}
            </div>
            {!video.value && <p>Öffne links das Video, dann springt ein Tipp auf eine Zeile zur Szene (3 Sekunden vorher).</p>}
          </div>
        </div>
      )}
    </section>
  );
}
