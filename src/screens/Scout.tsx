import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../db';
import {
  Action, EL, ELEMENTS, ElementKey, Match, Player, describeAction, distribution, effectOf, liveScore,
} from '../model';
import { prefs } from '../prefs';
import { setSummary } from '../stats';
import { go, toast, useLive, words } from '../state';
import { Court } from './Court';

interface Draft {
  editId?: number;
  playerId: number | 'opp' | null;
  element: ElementKey | null;
  result: string | null;
  pos?: number;
  to?: number;
  noZone?: boolean; // Profi: Zielzone bewusst weggelassen
  dirty?: boolean; // beim Korrigieren: erst speichern, wenn etwas geändert wurde
  steps?: Step[]; // Reihenfolge der Eingaben, für "Rückgängig" in kleinen Schritten
}

type Step = 'player' | 'element' | 'result' | 'pos' | 'to' | 'noZone';

const EMPTY: Draft = { playerId: null, element: null, result: null, steps: [] };

/** Schritt ans Ende der Liste setzen (doppelte vorher entfernen). */
function push(steps: Step[] | undefined, k: Step, drop: Step[] = []): Step[] {
  return [...(steps ?? []).filter((x) => x !== k && !drop.includes(x)), k];
}

/** Gespeicherte Aktion wieder in eine Eingabe verwandeln (mit allen Schritten). */
function draftFrom(a: Action, profi: boolean, editId?: number): Draft {
  const steps: Step[] = ['player'];
  if (a.playerId != null) steps.push('element');
  steps.push('result');
  if (a.pos != null) steps.push('pos');
  if (a.to != null) steps.push('to');
  const noZone = profi && a.to == null && !!EL[a.element]?.zones?.to && !(a.element === 'srv' && a.result === 'E');
  if (noZone) steps.push('noZone');
  return { editId, playerId: a.playerId ?? 'opp', element: a.element, result: a.result, pos: a.pos, to: a.to, noZone, steps };
}

/** Letzte Eingabe zurücknehmen. */
function stepBack(d: Draft): Draft {
  const steps = [...(d.steps ?? [])];
  const last = steps.pop();
  const n: Draft = { ...d, steps, dirty: true };
  if (last === 'player') {
    if (d.playerId === 'opp') n.element = null, n.result = null;
    n.playerId = null;
  } else if (last === 'element') {
    n.element = null; n.result = null; n.pos = undefined; n.to = undefined; n.noZone = false;
  } else if (last === 'result') n.result = null;
  else if (last === 'pos') n.pos = undefined;
  else if (last === 'to') n.to = undefined;
  else if (last === 'noZone') n.noZone = false;
  return n;
}

export const DIST_COLORS = { p4: '#2563eb', p3: '#0d9488', p2: '#9333ea', back: '#ea580c' };

/** Was für diese Aktion noch fehlt. */
function needs(d: Draft, profi: boolean) {
  const el = d.element ? EL[d.element] : null;
  const pos = !!el?.positions && d.pos == null;
  const to = profi && !!el?.zones?.to && d.to == null && !d.noZone && d.result != null && !(d.element === 'srv' && d.result === 'E');
  return { pos, to };
}

export function Scout({ matchId }: { matchId: number }) {
  const match = useLive(() => db.matches.get(matchId), [matchId], undefined as Match | undefined);
  const players = useLive(
    async () => {
      const m = await db.matches.get(matchId);
      if (!m) return [];
      const ps = await db.players.bulkGet(m.playerIds);
      return (ps.filter(Boolean) as Player[]).sort((a, b) => a.order - b.order);
    },
    [matchId],
    [] as Player[],
  );
  const actions = useLive(
    () => db.actions.where('matchId').equals(matchId).sortBy('seq'),
    [matchId],
    [] as Action[],
  );
  const [d, setD] = useState<Draft>(EMPTY);
  const [endDialog, setEndDialog] = useState(false);
  const [distScope, setDistScope] = useState<'set' | 'match'>('set');

  const setNr = match?.currentSet ?? 1;
  const profi = match?.mode === 'profi';
  const setActions = useMemo(() => actions.filter((a) => a.set === setNr), [actions, setNr]);
  const score = liveScore(setActions);
  const pmap = useMemo(() => new Map(players.map((p) => [p.id!, p])), [players]);

  const visible = ELEMENTS.filter((e) => e.key !== 'opp' && (!e.profiOnly || profi) && !prefs.value.hidden.includes(e.key));

  // Speichern, sobald alles Nötige gewählt ist.
  useEffect(() => {
    if (!match || d.playerId == null || !d.element || !d.result) return;
    if (d.editId != null && !d.dirty) return;
    const n = needs(d, profi);
    if (n.pos || n.to) return;
    commit(d);
  }, [d]);

  async function commit(x: Draft) {
    const base = {
      playerId: x.playerId === 'opp' ? null : (x.playerId as number),
      element: x.element!, result: x.result!,
      pos: x.pos, to: x.to,
    };
    if (x.editId != null) {
      await db.actions.update(x.editId, { ...base, pos: base.pos ?? undefined, to: base.to ?? undefined });
      toast('Korrigiert');
    } else {
      const last = actions[actions.length - 1];
      await db.actions.add({ ...base, matchId, set: setNr, seq: (last?.seq ?? 0) + 1, ts: Date.now() });
    }
    setD(EMPTY);
  }

  const pickPlayer = (id: number | 'opp') => {
    if (id === 'opp') setD({ ...d, dirty: true, playerId: 'opp', element: 'opp', result: null, pos: undefined, to: undefined, noZone: false, steps: ['player'] });
    else if (d.element === 'opp') setD({ ...d, dirty: true, playerId: id, element: null, result: null, steps: ['player'] });
    else setD({ ...d, dirty: true, playerId: id, steps: push(d.steps, 'player') });
  };
  const pickElement = (k: ElementKey) => {
    const drop: Step[] = ['result', 'pos', 'to', 'noZone'];
    if (d.playerId === 'opp') setD({ ...d, dirty: true, playerId: null, element: k, result: null, pos: undefined, to: undefined, noZone: false, steps: ['element'] });
    else setD({ ...d, dirty: true, element: k, result: null, pos: undefined, to: undefined, noZone: false, steps: push(d.steps, 'element', drop) });
  };
  const pickResult = (r: string) => setD({ ...d, dirty: true, result: r, steps: push(d.steps, 'result') });
  const pickPos = (z: number) => setD({ ...d, dirty: true, pos: z, steps: push(d.steps, 'pos') });
  const pickTo = (z: number) => setD({ ...d, dirty: true, to: z, noZone: false, steps: push(d.steps, 'to', ['noZone']) });
  const pickNoZone = () => setD({ ...d, dirty: true, noZone: true, to: undefined, steps: push(d.steps, 'noZone', ['to']) });

  const draftEmpty = !d.steps?.length && d.playerId == null && !d.element;

  /** Rückgängig in kleinen Schritten: erst die laufende Eingabe Schritt für Schritt,
   *  dann die zuletzt gespeicherte Aktion zurückholen (ohne ihren letzten Schritt). */
  const undo = async () => {
    if (!draftEmpty) {
      const n = stepBack(d);
      const empty = !n.steps?.length;
      setD(empty ? EMPTY : n);
      return;
    }
    const last = setActions[setActions.length - 1];
    if (!last) return;
    await db.actions.delete(last.id!);
    setD(stepBack(draftFrom(last, profi)));
    toast(`Zurückgeholt: ${describeAction(last, pmap.get(last.playerId!))}`);
  };

  const startEdit = (a: Action) => setD(draftFrom(a, profi, a.id));
  const deleteEdit = async () => {
    if (d.editId == null) return;
    await db.actions.delete(d.editId);
    toast('Gelöscht');
    setD(EMPTY);
  };

  if (!match) return <div class="page">Lade …</div>;

  const el = d.element ? EL[d.element] : null;
  const n = needs(d, profi);
  const dist = distribution(distScope === 'set' ? setActions : actions);

  const pick = `${words().one} antippen`;
  let hint = pick;
  if (d.playerId != null && !d.element) hint = 'Element wählen';
  else if (d.element && !d.result) hint = 'Ergebnis wählen';
  else if (n.pos) hint = d.element === 'rec' ? 'Annahmeposition auf dem Feld antippen' : 'Angriffsposition auf dem Feld antippen';
  else if (n.to) hint = 'Zielzone im gegnerischen Feld antippen';
  else if (d.playerId == null && d.element) hint = pick;

  const ownZones = el?.positions ?? [];
  const oppActive = profi && !!el?.zones?.to && !(d.element === 'srv' && d.result === 'E');

  return (
    <div class="scout">
      <div class="sbar">
        <button class="btn" onClick={() => go({ name: 'home' })} aria-label="Zur Startseite">‹</button>
        <div class="title">
          <b>gegen {match.opponent}</b>
          <span class="small muted">{profi ? 'Profi' : 'Simpel'} · {match.sets.filter((s) => s.final).map((s) => `${s.final![0]}:${s.final![1]}`).join('  ') || 'erster Satz'}</span>
        </div>
        <div class="score" data-testid="score">
          <div><div class="setlbl">Wir</div><div class="num">{score[0]}</div></div>
          <div class="sep">:</div>
          <div><div class="setlbl">Gegner</div><div class="num">{score[1]}</div></div>
          <div class="seg" style={{ marginLeft: 10 }}>
            {match.sets.map((s) => (
              <button class={s.nr === setNr ? 'on' : ''} onClick={() => { db.matches.update(matchId, { currentSet: s.nr }); setD(EMPTY); }}>
                Satz {s.nr}
              </button>
            ))}
          </div>
        </div>
        <button class="btn" onClick={undo} disabled={draftEmpty && !setActions.length} title="Einen Schritt zurück">↶ Schritt zurück</button>
        <button class="btn accent" onClick={() => setEndDialog(true)}>Satz beenden</button>
      </div>

      <div class="sbody">
        {/* Links: Spielerinnen */}
        <div class="col">
          <div class="players">
            {players.map((p) => (
              <button class={`pbtn ${d.playerId === p.id ? 'on' : ''}`} onClick={() => pickPlayer(p.id!)}>
                <span class="nr">{p.number ?? '·'}</span>
                <span class="nm">{p.name}</span>
              </button>
            ))}
            <button class={`pbtn opp ${d.playerId === 'opp' ? 'on' : ''}`} onClick={() => pickPlayer('opp')}>Gegner</button>
          </div>
        </div>

        {/* Mitte: Element und Ergebnis */}
        <div class="col">
          <div class={`step ${d.editId != null ? 'editing' : ''}`}>
            <h3>
              <span>{d.editId != null ? 'Aktion korrigieren' : 'Element'}</span>
              {d.editId != null && <span style={{ color: 'var(--text)' }}>Satz {actions.find((a) => a.id === d.editId)?.set}</span>}
            </h3>
            <div class="els">
              {visible.map((e) => (
                <button class={`ebtn ${d.element === e.key ? 'on' : ''}`} onClick={() => pickElement(e.key)} disabled={d.playerId === 'opp'}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div class={`step ${d.editId != null ? 'editing' : ''}`}>
            <h3><span>{el ? el.label : 'Ergebnis'}</span></h3>
            {el ? (
              <div class="res">
                {el.results.map((r) => (
                  <button class={`rbtn ${r.tone} ${d.result === r.key ? 'on' : ''}`} onClick={() => pickResult(r.key)}>{r.label}</button>
                ))}
              </div>
            ) : (
              <div class="hint">{hint}</div>
            )}
            <div class="pending" style={{ marginTop: 8 }}>
              <span class="muted small">{hint === pick && !d.element ? '' : hint}</span>
              <span style={{ flex: 1 }} />
              {(n.to) && <button class="btn" onClick={pickNoZone}>ohne Zone</button>}
              {d.editId != null && <button class="btn danger" onClick={deleteEdit}>Löschen</button>}
              {(d.playerId != null || d.element) && <button class="btn ghost" onClick={() => setD(EMPTY)}>Abbrechen</button>}
            </div>
          </div>
          <div class="step" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <h3><span>Verlauf Satz {setNr}</span><span>antippen zum Korrigieren</span></h3>
            <div class="history">
              {[...setActions].reverse().map((a, i, arr) => {
                const sc = liveScore(arr.slice(i).reverse());
                const eff = effectOf(a);
                const color = eff === 'point' ? 'var(--good)' : eff === 'error' ? 'var(--bad)' : eff === 'opppoint' ? 'var(--low)' : 'var(--mid)';
                return (
                  <button class={`hitem ${d.editId === a.id ? 'sel' : ''}`} onClick={() => startEdit(a)}>
                    <span class="dot" style={{ background: color }} />
                    <span>{describeAction(a, pmap.get(a.playerId!))}</span>
                    <span class="sc">{sc[0]}:{sc[1]}</span>
                  </button>
                );
              })}
              {!setActions.length && <div class="hint">Noch keine Aktionen in diesem Satz.</div>}
            </div>
          </div>
        </div>

        {/* Rechts: Feld und Zuspielverteilung */}
        <div class="col right">
          <div class="step court-wrap">
            <h3><span>{profi ? 'Feld · oben Gegner' : 'Position'}</span><span>Netz</span></h3>
            <Court
              ownZones={ownZones}
              ownValue={d.pos}
              onOwn={pickPos}
              askOwn={n.pos && !!d.result}
              showOpp={profi}
              oppActive={oppActive}
              oppValue={d.to}
              onOpp={pickTo}
              askOpp={n.to && !n.pos}
            />
          </div>
          <div class="step dist" data-testid="dist">
            <h3>
              <span>Zuspielverteilung ({dist.total} Angriffe)</span>
              <span class="seg" style={{ padding: 2 }}>
                <button style={{ minHeight: 28, padding: '0 8px' }} class={distScope === 'set' ? 'on' : ''} onClick={() => setDistScope('set')}>Satz</button>
                <button style={{ minHeight: 28, padding: '0 8px' }} class={distScope === 'match' ? 'on' : ''} onClick={() => setDistScope('match')}>Spiel</button>
              </span>
            </h3>
            <div class="distbar">
              {(['p4', 'p3', 'p2', 'back'] as const).map((k) =>
                dist[k] ? <div style={{ width: `${(dist[k] / dist.total) * 100}%`, background: DIST_COLORS[k] }}>{dist[k]}</div> : null,
              )}
            </div>
            <div class="distlegend">
              <span><i style={{ background: DIST_COLORS.p4 }} />über 4: {dist.p4}</span>
              <span><i style={{ background: DIST_COLORS.p3 }} />über 3: {dist.p3}</span>
              <span><i style={{ background: DIST_COLORS.p2 }} />über 2: {dist.p2}</span>
              <span><i style={{ background: DIST_COLORS.back }} />hinten: {dist.back}</span>
            </div>
          </div>
        </div>
      </div>

      {endDialog && <EndSetDialog match={match} setActions={setActions} onClose={() => setEndDialog(false)} />}
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div class="stepper">
      <button onClick={() => onChange(Math.max(0, value - 1))} aria-label="weniger">−</button>
      <span class="v">{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="mehr">+</button>
    </div>
  );
}

function EndSetDialog({ match, setActions, onClose }: { match: Match; setActions: Action[]; onClose: () => void }) {
  const nr = match.currentSet;
  const existing = match.sets.find((s) => s.nr === nr)?.final;
  const live = liveScore(setActions);
  const [us, setUs] = useState(existing?.[0] ?? live[0]);
  const [them, setThem] = useState(existing?.[1] ?? live[1]);
  const sum = setSummary(nr, [us, them], setActions);
  const own = sum.ownPoints;
  const ownTotal = own.att + own.srv + own.blk + own.oppSrv + own.oppF;
  const isLast = nr === match.sets[match.sets.length - 1].nr;

  const save = async (next: 'next' | 'finish' | 'stay') => {
    const sets = match.sets.map((s) => (s.nr === nr ? { ...s, final: [us, them] as [number, number] } : s));
    let currentSet = nr;
    let finished = match.finished;
    if (next === 'next') {
      if (isLast) sets.push({ nr: nr + 1, final: null });
      currentSet = nr + 1;
    }
    if (next === 'finish') finished = true;
    await db.matches.update(match.id!, { sets, currentSet, finished });
    onClose();
    if (next === 'finish') go({ name: 'report', matchId: match.id! });
  };

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog">
        <h2>Satz {nr} beenden</h2>
        <p class="muted" style={{ marginTop: 0 }}>Endstand eintippen. Die App prüft, ob die erfassten Punkte dazu passen.</p>
        <div class="row" style={{ justifyContent: 'space-around', margin: '14px 0' }}>
          <div style={{ textAlign: 'center' }}><div class="setlbl muted small"><b>Wir</b></div><Stepper value={us} onChange={setUs} /></div>
          <div style={{ textAlign: 'center' }}><div class="setlbl muted small"><b>Gegner</b></div><Stepper value={them} onChange={setThem} /></div>
        </div>
        <div class={`check ${sum.missing !== 0 ? 'warn' : ''}`} data-testid="check">
          Erfasste eigene Punkte: <b>{ownTotal}</b> ({own.att} Angriff, {own.srv} Ass, {own.blk} Block, {own.oppSrv + own.oppF} Gegnerfehler).<br />
          {sum.missing === 0 && <>Das passt genau zum Endstand {us}:{them}.</>}
          {sum.missing > 0 && <><b>{sum.missing} {sum.missing === 1 ? 'Punkt' : 'Punkte'} nicht notiert.</b> In der Auswertung steht das als „nicht notiert“.</>}
          {sum.missing < 0 && <><b>{-sum.missing} {sum.missing === -1 ? 'Punkt' : 'Punkte'} mehr erfasst als im Endstand.</b> Bitte im Verlauf prüfen.</>}
          <br />Eigene Fehler: <b>{sum.ownErrors}</b>, vom Gegner selbst erspielt: <b>{sum.oppEarned}</b>.
        </div>
        <div class="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button class="btn ghost" onClick={onClose}>Abbrechen</button>
          {!isLast && <button class="btn" onClick={() => save('stay')}>Speichern</button>}
          <button class="btn" onClick={() => save('finish')}>Spiel beenden</button>
          <button class="btn primary" onClick={() => save('next')}>Weiter zu Satz {nr + 1}</button>
        </div>
      </div>
    </div>
  );
}

