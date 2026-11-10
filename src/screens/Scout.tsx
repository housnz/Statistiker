import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../db';
import {
  Action, EL, ELEMENTS, ElementKey, Match, Player, describeAction, distribution, effectOf, liveScore,
} from '../model';
import { prefs } from '../prefs';
import { setSummary } from '../stats';
import { go, team, toast, useLive, words } from '../state';
import { Logo } from '../logo';

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

export const DIST_COLORS = { p4: '#3b82f6', p3: '#14b8a6', p2: '#a855f7', back: '#f97316' };

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
  const [histOpen, setHistOpen] = useState(false);

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
  /** Zelle im Bogen: Person und Element in einem Tipp. */
  const pickCell = (pid: number, k: ElementKey) => {
    const keep = d.editId != null ? { editId: d.editId } : {};
    setD({ ...EMPTY, ...keep, dirty: true, playerId: pid, element: k, steps: ['player', 'element'] });
  };
  /** Gegner-Knopf im Bogen: wird sofort gespeichert. */
  const pickOpp = (k: string) => {
    const keep = d.editId != null ? { editId: d.editId } : {};
    setD({ ...EMPTY, ...keep, dirty: true, playerId: 'opp', element: 'opp', result: k, steps: ['player', 'result'] });
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

  const W = words();
  const el = d.element ? EL[d.element] : null;
  const n = needs(d, profi);
  const dist = distribution(distScope === 'set' ? setActions : actions);
  const editing = d.editId != null;

  let hint = `${W.one} oder Zelle im Bogen antippen`;
  if (d.playerId != null && d.playerId !== 'opp' && !d.element) hint = 'Element wählen';
  else if (d.element && !d.result) hint = 'Ergebnis wählen';
  else if (n.pos) hint = d.element === 'rec' ? 'Annahmeposition antippen' : 'Angriffsposition antippen';
  else if (n.to) hint = 'Zielzone im Gegnerfeld antippen';
  else if (d.playerId == null && d.element) hint = `${W.one} antippen`;

  const oppActive = profi && !!el?.zones?.to && !(d.element === 'srv' && d.result === 'E');
  const cols = visible.length;
  const gridCols = `${cols > 5 ? 130 : 150}px repeat(${cols}, minmax(0, 1fr))`;
  const oppCount = (k: string) => setActions.filter((a) => a.element === 'opp' && a.result === k).length;
  const picked = d.playerId === 'opp' ? null : d.playerId != null ? pmap.get(d.playerId) : undefined;

  return (
    <div class="scout">
      <div class="bar">
        <button class="btn" onClick={() => go({ name: 'home' })} aria-label="Zur Startseite">‹</button>
        <Logo size={44} />
        <div class="title">
          <b>gegen {match.opponent}</b>
          <span>{team.value?.name} · {profi ? 'Profi' : 'Simpel'}</span>
        </div>
        <div class="score" data-testid="score">
          <span class="who">WIR</span>
          <span class="n num">{score[0]}</span>
          <span class="sep">:</span>
          <span class="n num">{score[1]}</span>
          <span class="who">GEGNER</span>
          <div class="sets" role="group" aria-label="Satz wählen">
            {match.sets.map((s) => (
              <button class={s.nr === setNr ? 'on' : ''} aria-label={`Satz ${s.nr}`} onClick={() => { db.matches.update(matchId, { currentSet: s.nr }); setD(EMPTY); }}>
                {s.nr}
              </button>
            ))}
          </div>
        </div>
        <button class="btn" onClick={() => setHistOpen(true)}>Verlauf</button>
        <button class="btn" onClick={undo} disabled={draftEmpty && !setActions.length} title="Einen Schritt zurück">↶ Schritt zurück</button>
        <button class="btn accent" onClick={() => setEndDialog(true)}>Satz beenden</button>
      </div>

      <div class="sbody">
        <section class="sheet">
          <div class="row" style={{ justifyContent: 'space-between' }}>
            <h2>Bogen Satz {setNr}</h2>
            <span class="small muted">Zelle antippen: {W.one} und Element in einem Schritt</span>
          </div>
          <div class="mx-wrap">
            <div class="mx" style={{ gridTemplateColumns: gridCols }}>
              <div class="h">{W.one}</div>
              {visible.map((e) => <div class="h">{cols > 5 ? SHORT[e.key] ?? e.label : e.label}</div>)}
              {players.map((p) => (
                <>
                  <button class={`nm ${d.playerId === p.id ? 'on' : ''}`} data-player={p.name} onClick={() => pickPlayer(p.id!)}>
                    <span class="nr">{p.number ?? '·'}</span>
                    <span class="na">{p.name}</span>
                  </button>
                  {visible.map((e) => {
                    const on = d.playerId === p.id && d.element === e.key;
                    const toks = setActions.filter((a) => a.playerId === p.id && a.element === e.key);
                    return (
                      <button class={`cell ${on ? 'on' : ''}`} data-cell={`${p.name}:${e.key}`} aria-label={`${p.name}, ${e.label}`} onClick={() => pickCell(p.id!, e.key)}>
                        {toks.map((a) => {
                          const tk = token(a);
                          return <span class={`tok ${tk.cls}`}>{tk.t}</span>;
                        })}
                      </button>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
          <div class="opprow">
            <b>Gegner</b>
            {EL.opp.results.map((r) => (
              <button class="oppbtn" data-opp={r.key} onClick={() => pickOpp(r.key)}>
                <span>{r.key === 'F' ? 'Fehler ohne Zutun' : r.key === 'P' ? 'Punkt Gegner (sonstiger)' : r.label}</span>
                <span class="num">{oppCount(r.key)}</span>
              </button>
            ))}
          </div>
          <div class="legend">
            <span><b class="tok good pt">4</b> Punkt</span>
            <span><b class="tok mid">2</b> im Spiel</span>
            <span><b class="tok low">2</b> geblockt, schlecht</span>
            <span><b class="tok bad">4</b> Fehler</span>
            <span>Ziffer = Position · # Ass oder Blockpunkt · 0 gut · − ok · / schlecht · = Fehler</span>
          </div>
        </section>

        <aside class={`aside ${editing ? 'editing' : ''}`}>
          <span class="label">{editing ? 'Aktion korrigieren' : 'Gewählt'}</span>
          <div class="picked">
            {d.playerId === 'opp' ? (
              <span class="t">Gegner</span>
            ) : picked ? (
              <>
                <span class="nr">{picked.number ?? ''}</span>
                <span class="t">{picked.name}{el ? ` · ${el.label}` : ''}</span>
              </>
            ) : el ? (
              <span class="t">{el.label}</span>
            ) : (
              <span class="ph">noch nichts gewählt</span>
            )}
          </div>

          {d.playerId != null && d.playerId !== 'opp' && !el && (
            <div class="grid2" style={{ gap: 7 }}>
              {visible.map((e) => <button class="btn" onClick={() => pickElement(e.key)}>{e.label}</button>)}
            </div>
          )}

          {el && (
            <div class={`rlist ${profi && el.zones?.to && el.positions ? 'two' : ''}`}>
              {el.results.map((r) => (
                <button class={`rbtn ${r.tone} ${d.result === r.key ? 'on' : ''}`} onClick={() => pickResult(r.key)}>
                  {el.key === 'opp' && r.key === 'F' ? 'Fehler ohne Zutun' : r.label}
                </button>
              ))}
            </div>
          )}

          <div class={`hint ${d.element ? 'ask' : ''}`}>{hint}</div>

          {profi && el?.zones?.to && (
            <>
              <span class="label">Zielzone · Gegnerfeld</span>
              <div class="court opp">
                {[1, 6, 5, 2, 3, 4].map((z) => (
                  <button class={`zbtn ${d.to === z ? 'on' : n.to && !n.pos ? 'ask' : ''}`} data-zone={`opp-${z}`} disabled={!oppActive} onClick={() => pickTo(z)}>{z}</button>
                ))}
              </div>
            </>
          )}
          {el?.positions && (
            <>
              {!(profi && el?.zones?.to) && <span class="label">Position · Netz oben</span>}
              <div class="court" style={profi && el?.zones?.to ? { borderTop: 0, paddingTop: 0 } : undefined}>
                {[4, 3, 2, 5, 6, 1].map((z) => (
                  <button class={`zbtn ${d.pos === z ? 'on' : n.pos && d.result ? 'ask' : ''}`} data-zone={`own-${z}`} disabled={!el.positions!.includes(z)} onClick={() => pickPos(z)}>{z}</button>
                ))}
              </div>
            </>
          )}

          {(n.to || editing || d.playerId != null || d.element) && (
            <div class="row">
              {n.to && <button class="btn" onClick={pickNoZone}>ohne Zone</button>}
              {editing && <button class="btn danger" onClick={deleteEdit}>Löschen</button>}
              <button class="btn ghost" onClick={() => setD(EMPTY)}>Abbrechen</button>
            </div>
          )}

          <div class="foot" data-testid="dist">
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <span class="label">Zuspielverteilung · {dist.total}</span>
              <div class="seg" style={{ padding: 2 }}>
                <button style={{ minHeight: 30, padding: '0 10px' }} class={distScope === 'set' ? 'on' : ''} onClick={() => setDistScope('set')}>Satz</button>
                <button style={{ minHeight: 30, padding: '0 10px' }} class={distScope === 'match' ? 'on' : ''} onClick={() => setDistScope('match')}>Spiel</button>
              </div>
            </div>
            <div class="dist">
              <span class="d4">4 · {dist.p4}</span>
              <span class="d3">3 · {dist.p3}</span>
              <span class="d2">2 · {dist.p2}</span>
              <span class="dh">h · {dist.back}</span>
            </div>
          </div>
        </aside>
      </div>

      {histOpen && (
        <div class="overlay" style={{ background: 'rgba(8,10,14,.35)' }} onClick={(e) => e.target === e.currentTarget && setHistOpen(false)}>
          <div class="hsheet" role="dialog" aria-modal="true" aria-label="Verlauf">
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <h2>Verlauf Satz {setNr}</h2>
              <button class="btn" onClick={() => setHistOpen(false)}>Schließen</button>
            </div>
            <span class="small muted">Eintrag antippen, um ihn zu korrigieren.</span>
            <div class="history">
              {[...setActions].reverse().map((a, i, arr) => {
                const sc = liveScore(arr.slice(i).reverse());
                const eff = effectOf(a);
                const color = eff === 'point' ? 'var(--good)' : eff === 'error' ? 'var(--bad)' : eff === 'opppoint' ? 'var(--low)' : 'var(--mid)';
                return (
                  <button class="hitem" onClick={() => { startEdit(a); setHistOpen(false); }}>
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
      )}

      {endDialog && <EndSetDialog match={match} setActions={setActions} onClose={() => setEndDialog(false)} />}
    </div>
  );
}

const SHORT: Partial<Record<ElementKey, string>> = { srv: 'Aufschl.', oth: 'Sonst.', rec: 'Annahme' };

const SYM: Record<string, Record<string, string>> = {
  srv: { A: '#', G: '0', O: '−', S: '/', E: '=' },
  blk: { K: '#', T: '+', E: '!' },
  oth: { E: '=' },
  set: { G: '#', L: '+', N: '−', E: '=' },
  dig: { G: '#', O: '+', E: '=' },
};

/** Zeichen im Bogen: wie auf dem Papier (Positionsziffer bzw. Symbol), Farbe nach Ergebnis. */
function token(a: Action): { t: string; cls: string } {
  const r = EL[a.element].results.find((x) => x.key === a.result);
  const tone = r?.tone ?? 'mid';
  const cls = tone + (r?.effect === 'point' ? ' pt' : '');
  if (a.element === 'att' || a.element === 'rec') return { t: a.pos != null ? String(a.pos) : '·', cls };
  return { t: SYM[a.element]?.[a.result] ?? '·', cls };
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

