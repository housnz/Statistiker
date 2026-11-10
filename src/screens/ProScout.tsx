// Profi-Modus für die Videoanalyse: Ballwechsel für Ballwechsel, Aufstellung, Läufer, Video.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../db';
import { Draft, EMPTY, SHORT, draftFrom, needs, push, stepBack, token } from '../draft';
import { Logo } from '../logo';
import { Action, EL, ElementKey, INPUT_ELEMENTS, Match, Player, SetInfo, describeAction, effectOf, liveScore } from '../model';
import { prefs } from '../prefs';
import { expectedNext, replaySet, setterOf } from '../rally';
import { go, team, toast, useLive, words } from '../state';
import { VideoPlayer, fmtTime, seekTo, video, videoTime } from '../video';
import { EndSetDialog } from './Scout';

const COURT_IDX = [3, 2, 1, 4, 5, 0]; // Anzeige IV III II / V VI I → Index in der Aufstellung
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function ProScout({ matchId }: { matchId: number }) {
  const match = useLive(() => db.matches.get(matchId), [matchId], undefined as Match | undefined);
  const players = useLive(async () => {
    const m = await db.matches.get(matchId);
    if (!m) return [];
    return ((await db.players.bulkGet(m.playerIds)).filter(Boolean) as Player[]).sort((a, b) => a.order - b.order);
  }, [matchId], [] as Player[]);
  const actions = useLive(() => db.actions.where('matchId').equals(matchId).sortBy('seq'), [matchId], [] as Action[]);

  const [d, setD] = useState<Draft>(EMPTY);
  const [tab, setTab] = useState<'video' | 'bogen'>('video');
  const [dlg, setDlg] = useState<null | 'lineup' | 'sub' | 'end' | 'hist'>(null);
  const [showBench, setShowBench] = useState(false);
  const [autoKey, setAutoKey] = useState('');

  const setNr = match?.currentSet ?? 1;
  const setInfo = match?.sets.find((s) => s.nr === setNr);
  const setActions = useMemo(() => actions.filter((a) => a.set === setNr), [actions, setNr]);
  const pmap = useMemo(() => new Map(players.map((p) => [p.id!, p])), [players]);
  const st = useMemo(() => replaySet(setInfo, setActions, pmap), [setInfo, setActions, pmap]);
  const cur = st.current;
  const score = liveScore(setActions);
  const W = words();
  const visible = INPUT_ELEMENTS.filter((e) => !prefs.value.hidden.includes(e.key));
  const expected = expectedNext(cur);

  // Ohne Aufstellung geht es nicht los.
  useEffect(() => {
    if (match && !st.ready && !match.finished && dlg == null) setDlg('lineup');
  }, [match?.id, setNr, st.ready]);

  // Neuer Ballwechsel mit eigenem Aufschlag: Aufschlägerin schon vorwählen.
  // Der Schlüssel merkt sich, für welchen Ballwechsel und welche Aufschlägerin schon vorgewählt wurde.
  const fresh = st.ready && !cur.actions.length && cur.server === 'us';
  const serverId = cur.slots[0];
  const autoNow = `${setNr}-${cur.nr}-${serverId}`;
  const blank = d.playerId == null && !d.element && d.editId == null;
  useEffect(() => {
    if (d.auto && d.editId == null) {
      // Die Vorwahl passt nicht mehr: andere Aufschlägerin (Wechsel) oder kein frischer eigener Aufschlag.
      if (fresh && d.playerId !== serverId) { setAutoKey(autoNow); setD({ ...d, playerId: serverId }); return; }
      if (!fresh && !d.result) { setD(EMPTY); return; }
    }
    if (!fresh || autoKey === autoNow || !blank) return;
    setAutoKey(autoNow);
    setD({ ...EMPTY, playerId: serverId, element: 'srv', steps: ['player', 'element'], auto: true });
  }, [fresh, autoNow, autoKey, blank, d.auto, d.playerId, d.result]);

  // Speichern, sobald alles Nötige gewählt ist.
  useEffect(() => {
    if (!match || d.playerId == null || !d.element || !d.result) return;
    if (d.editId != null && !d.dirty) return;
    const n = needs(d, true);
    if (n.pos || n.to) return;
    commit(d);
  }, [d]);

  async function commit(x: Draft) {
    const base = { playerId: x.playerId === 'opp' ? null : (x.playerId as number), element: x.element!, result: x.result!, pos: x.pos, to: x.to };
    if (x.editId != null) {
      await db.actions.update(x.editId, { ...base, pos: base.pos ?? undefined, to: base.to ?? undefined });
      toast('Korrigiert');
    } else {
      const last = actions[actions.length - 1];
      await db.actions.add({ ...base, matchId, set: setNr, seq: (last?.seq ?? 0) + 1, ts: Date.now(), vt: videoTime() });
    }
    setD(EMPTY);
  }

  const pickPlayer = (id: number) => setD({ ...d, auto: false, dirty: true, playerId: id, element: d.element === 'opp' ? null : d.element, result: d.element === 'opp' ? null : d.result, steps: d.element === 'opp' ? ['player'] : push(d.steps, 'player') });
  const pickElement = (k: ElementKey) => setD({ ...d, auto: false, dirty: true, playerId: d.playerId === 'opp' ? null : d.playerId, element: k, result: null, pos: undefined, to: undefined, noZone: false, steps: push(d.playerId === 'opp' ? [] : d.steps, 'element', ['result', 'pos', 'to', 'noZone']) });
  const pickResult = (r: string) => setD({ ...d, dirty: true, result: r, steps: push(d.steps, 'result') });
  const pickPos = (z: number) => setD({ ...d, dirty: true, pos: z, steps: push(d.steps, 'pos') });
  const pickTo = (z: number) => setD({ ...d, dirty: true, to: z, noZone: false, steps: push(d.steps, 'to', ['noZone']) });
  const pickNoZone = () => setD({ ...d, dirty: true, noZone: true, to: undefined, steps: push(d.steps, 'noZone', ['to']) });
  const pickOpp = (k: string) => {
    const keep = d.editId != null ? { editId: d.editId } : {};
    setD({ ...EMPTY, ...keep, dirty: true, playerId: 'opp', element: 'opp', result: k, steps: ['player', 'result'] });
  };

  const draftEmpty = !d.steps?.length && d.playerId == null && !d.element;
  const onlyAuto = !!d.auto && !d.result && d.editId == null;
  const undo = async () => {
    if (!draftEmpty && !onlyAuto) {
      const n = stepBack(d);
      setD(n.steps?.length ? n : EMPTY);
      return;
    }
    const last = setActions[setActions.length - 1];
    if (!last) return;
    await db.actions.delete(last.id!);
    setAutoKey(''); // der zurückgenommene Ballwechsel darf später wieder vorwählen
    if (last.element === 'sub') { toast('Wechsel zurückgenommen'); return; }
    setD(stepBack(draftFrom(last, true)));
    toast(`Zurückgeholt: ${describeAction(last, pmap.get(last.playerId!))}`);
  };
  const startEdit = (a: Action) => { if (a.element !== 'sub') setD(draftFrom(a, true, a.id)); };
  const deleteEdit = async () => {
    if (d.editId == null) return;
    await db.actions.delete(d.editId);
    toast('Gelöscht');
    setD(EMPTY);
  };

  if (!match) return <div class="page">Lade …</div>;

  const el = d.element ? EL[d.element] : null;
  const n = needs(d, true);
  const editing = d.editId != null;
  const oppActive = !!el?.zones?.to && !(d.element === 'srv' && d.result === 'E');
  const liberos = (setInfo?.liberos ?? []).map((id) => pmap.get(id)).filter(Boolean) as Player[];
  const bench = players.filter((p) => !cur.slots.includes(p.id!) && !setInfo?.liberos?.includes(p.id!));
  const picked = d.playerId === 'opp' ? null : d.playerId != null ? pmap.get(d.playerId) : undefined;

  let hint = `${W.one} auf dem Feld antippen`;
  if (picked && !d.element) hint = 'Element wählen';
  else if (d.element && !d.result) hint = 'Ergebnis wählen';
  else if (n.pos) hint = d.element === 'rec' ? 'Annahmeposition antippen' : 'Angriffsposition antippen';
  else if (n.to) hint = 'Zielzone im Gegnerfeld antippen';

  const pbtn = (p: Player | undefined, label?: string) => p ? (
    <button class={`pbtn2 ${d.playerId === p.id ? 'on' : ''}`} data-player={p.name} onClick={() => pickPlayer(p.id!)}>
      <span class="nr">{p.number ?? '·'}</span>
      <span class="na">{p.name}</span>
      {label && <span class="tag">{label}</span>}
    </button>
  ) : <span class="pbtn2 empty">frei</span>;

  return (
    <div class="scout pro">
      <div class="bar">
        <button class="btn" onClick={() => go({ name: 'home' })} aria-label="Zur Startseite">‹</button>
        <Logo size={44} />
        <div class="title">
          <b>gegen {match.opponent}</b>
          <span>{team.value?.name} · Profi</span>
        </div>
        <div class="score" data-testid="score">
          <span class="who">WIR</span>
          <span class="n num">{score[0]}</span>
          <span class="sep">:</span>
          <span class="n num">{score[1]}</span>
          <span class="who">GEGNER</span>
          <div class="sets" role="group" aria-label="Satz wählen">
            {match.sets.map((s) => (
              <button class={s.nr === setNr ? 'on' : ''} aria-label={`Satz ${s.nr}`} onClick={() => { db.matches.update(matchId, { currentSet: s.nr }); setD(EMPTY); }}>{s.nr}</button>
            ))}
          </div>
        </div>
        <button class="btn" onClick={() => setDlg('sub')} disabled={!st.ready}>Wechsel</button>
        <button class="btn" onClick={() => setDlg('hist')}>Verlauf</button>
        <button class="btn" onClick={undo} disabled={(draftEmpty || onlyAuto) && !setActions.length}>↶ Schritt zurück</button>
        <button class="btn accent" onClick={() => setDlg('end')}>Satz beenden</button>
      </div>

      <div class="sbody">
        <section class="sheet prol">
          <div class="row" style={{ justifyContent: 'space-between' }}>
            <div class="seg">
              <button class={tab === 'video' ? 'on' : ''} onClick={() => setTab('video')}>Video</button>
              <button class={tab === 'bogen' ? 'on' : ''} onClick={() => setTab('bogen')}>Bogen</button>
            </div>
            <span class="rinfo">
              <span class="pill">Ballwechsel {cur.nr}</span>
              <span class="pill">{cur.server === 'us' ? 'Wir schlagen auf' : 'Gegner schlägt auf'}</span>
              <span class="pill strong">Läufer {cur.rot || '?'}</span>
              <button class="btn" onClick={() => setDlg('lineup')}>Aufstellung</button>
            </span>
          </div>

          <div class="pmain">
            {tab === 'video' ? (
              <VideoPlayer expected={match.video?.name} onOpened={(name, size) => {
                if (match.video?.name !== name) db.matches.update(matchId, { video: { name, size } });
              }} />
            ) : (
              <MiniSheet players={players} actions={setActions} visible={visible.map((e) => e.key)} />
            )}
          </div>

          <div class="rstrip" data-testid="rally">
            <span class="label">Laufender Ballwechsel</span>
            <div class="rtoks">
              {cur.actions.length ? cur.actions.map((a) => {
                const p = a.playerId != null ? pmap.get(a.playerId) : undefined;
                const tk = token(a);
                return <span class="rtok"><b class="num">{p?.number ?? ''}</b> {EL[a.element]?.short} <span class={`tok ${tk.cls}`}>{tk.t}</span></span>;
              }) : <span class="small muted">{cur.server === 'us' ? `Aufschlag: ${pmap.get(cur.slots[0])?.name ?? ''}` : 'Gegner schlägt auf: mit der Annahme beginnen'}</span>}
            </div>
            {st.rallies.length > 0 && (() => {
              const r = st.rallies[st.rallies.length - 1];
              return <span class="small muted">Letzter Ballwechsel: {r.winner === 'us' ? 'Punkt für uns' : 'Punkt für den Gegner'} ({r.score[0]}:{r.score[1]})</span>;
            })()}
          </div>
          <div class="opprow pro3">
            {EL.opp.results.map((r) => (
              <button class="oppbtn" data-opp={r.key} onClick={() => pickOpp(r.key)}>
                <span>{r.key === 'SE' ? 'Gegner: Aufschlagfehler' : r.key === 'F' ? 'Gegner: Fehler' : 'Gegner punktet'}</span>
                <span class="num">{setActions.filter((a) => a.element === 'opp' && a.result === r.key).length}</span>
              </button>
            ))}
          </div>
        </section>

        <aside class={`aside ${editing ? 'editing' : ''}`}>
          <div class="row" style={{ justifyContent: 'space-between' }}>
            <span class="label">{editing ? 'Aktion korrigieren' : 'Auf dem Feld · Netz oben'}</span>
            <button class="linkbtn" onClick={() => setShowBench(!showBench)}>{showBench ? 'Bank ausblenden' : 'Bank'}</button>
          </div>
          <div class="pcourt">
            {COURT_IDX.map((i) => pbtn(pmap.get(cur.slots[i]), i === 0 && cur.server === 'us' ? 'Aufschlag' : ROMAN[i]))}
          </div>
          {(liberos.length > 0 || showBench) && (
            <div class="pextra">
              {liberos.map((p) => pbtn(p, 'Libero'))}
              {showBench && bench.map((p) => pbtn(p))}
            </div>
          )}
          <div class="picked">
            {d.playerId === 'opp' ? <span class="t">Gegner</span>
              : picked ? <><span class="nr">{picked.number ?? ''}</span><span class="t">{picked.name}{el ? ` · ${el.label}` : ''}</span></>
              : <span class="ph">{hint}</span>}
          </div>
          <div class="egrid">
            {visible.map((e) => (
              <button class={`ebtn2 ${d.element === e.key ? 'on' : expected.includes(e.key) && !d.element ? 'exp' : ''}`} data-el={e.key} onClick={() => pickElement(e.key)}>
                {SHORT[e.key] && e.label.length > 8 ? SHORT[e.key] : e.label}
              </button>
            ))}
          </div>
          {el && (
            <div class="rlist two">
              {el.results.map((r) => (
                <button class={`rbtn ${r.tone} ${d.result === r.key ? 'on' : ''}`} onClick={() => pickResult(r.key)}>{el.key === 'opp' && r.key === 'F' ? 'Fehler' : r.label}</button>
              ))}
            </div>
          )}
          {el && <div class={`hint ${d.element ? 'ask' : ''}`}>{hint}</div>}
          {el?.zones?.to && (
            <div class="court opp">
              {[1, 6, 5, 2, 3, 4].map((z) => (
                <button class={`zbtn ${d.to === z ? 'on' : n.to && !n.pos ? 'ask' : ''}`} data-zone={`opp-${z}`} disabled={!oppActive} onClick={() => pickTo(z)}>{z}</button>
              ))}
            </div>
          )}
          {el?.positions && (
            <div class="court" style={el?.zones?.to ? { borderTop: 0, paddingTop: 0 } : undefined}>
              {[4, 3, 2, 5, 6, 1].map((z) => (
                <button class={`zbtn ${d.pos === z ? 'on' : n.pos && d.result ? 'ask' : ''}`} data-zone={`own-${z}`} disabled={!el.positions!.includes(z)} onClick={() => pickPos(z)}>{z}</button>
              ))}
            </div>
          )}
          {(n.to || editing || d.playerId != null || d.element) && (
            <div class="row">
              {n.to && <button class="btn" onClick={pickNoZone}>ohne Zone</button>}
              {editing && <button class="btn danger" onClick={deleteEdit}>Löschen</button>}
              <button class="btn ghost" onClick={() => { setAutoKey(autoNow); setD(EMPTY); }}>Abbrechen</button>
            </div>
          )}
        </aside>
      </div>

      {dlg === 'lineup' && <LineupDialog match={match} set={setInfo} players={players} onClose={() => setDlg(null)} />}
      {dlg === 'sub' && <SubDialog onCourt={cur.slots.map((id) => pmap.get(id)!).filter(Boolean)} bench={bench} onClose={() => setDlg(null)} onSave={async (outId, inId) => {
        const last = actions[actions.length - 1];
        await db.actions.add({ matchId, set: setNr, seq: (last?.seq ?? 0) + 1, ts: Date.now(), playerId: inId, out: outId, element: 'sub', result: 'IN', vt: videoTime() });
        toast(`Wechsel: ${pmap.get(inId)?.name} für ${pmap.get(outId)?.name}`);
        setDlg(null);
      }} />}
      {dlg === 'end' && <EndSetDialog match={match} setActions={setActions} onClose={() => setDlg(null)} />}
      {dlg === 'hist' && (
        <div class="overlay" style={{ background: 'rgba(8,10,14,.35)' }} onClick={(e) => e.target === e.currentTarget && setDlg(null)}>
          <div class="hsheet" role="dialog" aria-modal="true" aria-label="Verlauf">
            <div class="row" style={{ justifyContent: 'space-between' }}>
              <h2>Verlauf Satz {setNr}</h2>
              <button class="btn" onClick={() => setDlg(null)}>Schließen</button>
            </div>
            <span class="small muted">Eintrag antippen, um ihn zu korrigieren.{video.value ? ' Die Uhrzeit springt im Video zur Szene.' : ''}</span>
            <div class="history">
              {[...st.rallies, ...(cur.actions.length ? [cur] : [])].reverse().map((r) => (
                <>
                  <div class="rhead"><b>Ballwechsel {r.nr}</b> · Läufer {r.rot || '?'} · {r.server === 'us' ? 'Aufschlag wir' : 'Annahme'}{r.winner ? ` · ${r.winner === 'us' ? 'Punkt' : 'Gegnerpunkt'} ${r.score[0]}:${r.score[1]}` : ' · läuft'}</div>
                  {[...r.actions].reverse().map((a) => {
                    const eff = effectOf(a);
                    const color = eff === 'point' ? 'var(--good)' : eff === 'error' ? 'var(--bad)' : eff === 'opppoint' ? 'var(--low)' : 'var(--mid)';
                    return (
                      <div class="hrow">
                        <button class="hitem" onClick={() => { startEdit(a); setDlg(null); }}>
                          <span class="dot" style={{ background: color }} />
                          <span>{describeAction(a, pmap.get(a.playerId!))}</span>
                        </button>
                        {a.vt != null && video.value && <button class="btn" onClick={() => { seekTo(a.vt!); setTab('video'); setDlg(null); }}>{fmtTime(a.vt)}</button>}
                      </div>
                    );
                  })}
                </>
              ))}
              {!setActions.length && <div class="hint">Noch keine Aktionen in diesem Satz.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bogen-Übersicht im Profi-Modus (nur ansehen, Eingabe läuft über das Feld rechts). */
function MiniSheet({ players, actions, visible }: { players: Player[]; actions: Action[]; visible: ElementKey[] }) {
  return (
    <div class="mx-wrap">
      <div class="mx" style={{ gridTemplateColumns: `130px repeat(${visible.length}, minmax(0, 1fr))` }}>
        <div class="h">Name</div>
        {visible.map((k) => <div class="h">{SHORT[k] ?? EL[k].label}</div>)}
        {players.map((p) => (
          <>
            <div class="nm"><span class="nr">{p.number ?? '·'}</span><span class="na">{p.name}</span></div>
            {visible.map((k) => (
              <div class="cell">
                {actions.filter((a) => a.playerId === p.id && a.element === k).map((a) => {
                  const tk = token(a);
                  return <span class={`tok ${tk.cls}`}>{tk.t}</span>;
                })}
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

function LineupDialog({ match, set, players, onClose }: { match: Match; set?: SetInfo; players: Player[]; onClose: () => void }) {
  const prev = match.sets.filter((s) => s.nr < match.currentSet && s.lineup?.length === 6).pop();
  const [slots, setSlots] = useState<(number | null)[]>(set?.lineup ?? prev?.lineup ?? [null, null, null, null, null, null]);
  const [libsState, setLibs] = useState<number[] | null>(set?.liberos ?? prev?.liberos ?? null);
  const libs = libsState ?? players.filter((p) => p.position === 'Libero').map((p) => p.id!); // ohne Auswahl: Libero laut Kader
  const [first, setFirst] = useState<'us' | 'them' | undefined>(set?.firstServe);
  const pmap = new Map(players.map((p) => [p.id!, p]));
  const chosen = slots.filter((x): x is number => x != null);
  const autoSetter = setterOf({ nr: 0, final: null, lineup: chosen }, pmap);
  const [setter, setSetter] = useState<number | undefined>(set?.setterId);
  const setterId = setter != null && chosen.includes(setter) ? setter : autoSetter;
  const valid = chosen.length === 6 && new Set(chosen).size === 6 && !!first;

  const save = async () => {
    const sets = match.sets.map((s) => (s.nr === match.currentSet ? { ...s, lineup: chosen, liberos: libs, setterId, firstServe: first } : s));
    await db.matches.update(match.id!, { sets });
    onClose();
  };
  const sel = (i: number) => (
    <label class="lslot">
      <span class="pos">{ROMAN[i]}{i === 0 ? ' · Aufschlag' : ''}</span>
      <select id={`slot-${i}`} value={slots[i] ?? ''} onChange={(e) => {
        const v = (e.target as HTMLSelectElement).value;
        const n = [...slots];
        n[i] = v ? Number(v) : null;
        setSlots(n);
      }}>
        <option value="">wählen</option>
        {players.map((p) => <option value={p.id}>{p.number != null ? `${p.number} ` : ''}{p.name}{p.position ? ` (${p.position})` : ''}</option>)}
      </select>
    </label>
  );

  return (
    <div class="overlay">
      <div class="dialog stack" role="dialog" aria-modal="true" style={{ width: 'min(680px, 100%)' }}>
        <h2>Aufstellung Satz {match.currentSet}</h2>
        <p class="small muted" style={{ margin: 0 }}>Wer steht zu Satzbeginn wo? Position I schlägt zuerst auf, wenn wir den Aufschlag haben. Die App rotiert danach automatisch.</p>
        <div class="lcourt">
          <div class="net">Netz</div>
          {COURT_IDX.map(sel)}
        </div>
        {chosen.length === 6 && new Set(chosen).size < 6 && <div class="check warn">Eine Person steht doppelt in der Aufstellung.</div>}
        <div class="field">
          <span>Libero</span>
          <div class="row">
            {players.filter((p) => !chosen.includes(p.id!)).map((p) => (
              <button class={`chip ${libs.includes(p.id!) ? 'on' : ''}`} onClick={() => setLibs(libs.includes(p.id!) ? libs.filter((x) => x !== p.id) : [...libs, p.id!].slice(-2))}>
                {p.number != null && <b>{p.number}</b>} {p.name}
              </button>
            ))}
          </div>
        </div>
        <div class="field">
          <span>Zuspielerin für die Läufer</span>
          <select id="setter" value={setterId ?? ''} onChange={(e) => setSetter(Number((e.target as HTMLSelectElement).value) || undefined)}>
            <option value="">wählen</option>
            {chosen.map((id) => <option value={id}>{pmap.get(id)?.name}</option>)}
          </select>
        </div>
        <div class="field">
          <span>Wer schlägt zuerst auf?</span>
          <div class="seg">
            <button class={first === 'us' ? 'on' : ''} onClick={() => setFirst('us')}>Wir</button>
            <button class={first === 'them' ? 'on' : ''} onClick={() => setFirst('them')}>Gegner</button>
          </div>
        </div>
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <button class="btn ghost" onClick={() => go({ name: 'home' })}>Zur Startseite</button>
          {set?.lineup && <button class="btn" onClick={onClose}>Abbrechen</button>}
          <button class="btn primary" disabled={!valid} onClick={save}>Aufstellung speichern</button>
        </div>
      </div>
    </div>
  );
}

function SubDialog({ onCourt, bench, onClose, onSave }: { onCourt: Player[]; bench: Player[]; onClose: () => void; onSave: (outId: number, inId: number) => void }) {
  const [out, setOut] = useState<number | null>(null);
  const [inn, setIn] = useState<number | null>(null);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog stack" role="dialog" aria-modal="true">
        <h2>Wechsel</h2>
        <div class="field"><span>Wer geht raus?</span>
          <div class="row">{onCourt.map((p) => <button class={`chip ${out === p.id ? 'on' : ''}`} onClick={() => setOut(p.id!)}>{p.number != null && <b>{p.number}</b>} {p.name}</button>)}</div>
        </div>
        <div class="field"><span>Wer kommt rein?</span>
          <div class="row">{bench.map((p) => <button class={`chip ${inn === p.id ? 'on' : ''}`} onClick={() => setIn(p.id!)}>{p.number != null && <b>{p.number}</b>} {p.name}</button>)}</div>
          {!bench.length && <span class="small muted">Niemand auf der Bank.</span>}
        </div>
        <p class="small muted" style={{ margin: 0 }}>Libero-Wechsel musst du nicht eintragen. Die Libero tippst du beim Erfassen einfach direkt an.</p>
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <button class="btn ghost" onClick={onClose}>Abbrechen</button>
          <button class="btn primary" disabled={out == null || inn == null} onClick={() => onSave(out!, inn!)}>Wechsel speichern</button>
        </div>
      </div>
    </div>
  );
}
