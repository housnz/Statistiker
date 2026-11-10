// Profi: Ballwechsel, Rotation und Läufer aus der Reihenfolge der Aktionen ableiten.
// Ein Ballwechsel endet mit jeder Aktion, die einen Punkt entscheidet (Punkt, Fehler, Gegnerpunkt).
import { Action, ElementKey, Player, SetInfo, effectOf } from './model';

export type Side = 'us' | 'them';

export interface Rally {
  nr: number; // 1, 2, 3 … im Satz
  server: Side; // wer hat aufgeschlagen
  rot: number; // Läufer 1 bis 6 (Position der Zuspielerin), 0 = unbekannt
  slots: number[]; // Aufstellung während des Ballwechsels (Index 0 = Position I)
  actions: Action[];
  winner: Side | null; // null = Ballwechsel läuft noch
  score: [number, number]; // Spielstand nach dem Ballwechsel
}

export interface SetState {
  ready: boolean; // Aufstellung vorhanden
  rallies: Rally[]; // abgeschlossene Ballwechsel
  current: Rally; // laufender Ballwechsel
  setterId?: number;
}

/** Rotation im Uhrzeigersinn: wer auf II stand, schlägt jetzt auf (I). */
export function rotate(slots: number[]): number[] {
  return [...slots.slice(1), slots[0]];
}

export function setterOf(set: SetInfo, players: Map<number, Player>): number | undefined {
  if (set.setterId != null) return set.setterId;
  return set.lineup?.find((id) => players.get(id)?.position === 'Zuspiel');
}

export function replaySet(set: SetInfo | undefined, actions: Action[], players: Map<number, Player>): SetState {
  const lineup = set?.lineup ?? [];
  const ready = lineup.length === 6 && lineup.every((x) => x != null) && !!set?.firstServe;
  let slots = [...lineup];
  let server: Side = set?.firstServe ?? 'us';
  let setter = set ? setterOf(set, players) : undefined;
  const rotOf = () => (setter != null && slots.includes(setter) ? slots.indexOf(setter) + 1 : 0);
  const rallies: Rally[] = [];
  let score: [number, number] = [0, 0];
  const fresh = (): Rally => ({ nr: rallies.length + 1, server, rot: rotOf(), slots: [...slots], actions: [], winner: null, score: [...score] as [number, number] });
  let cur = fresh();

  for (const a of actions) {
    if (a.element === 'sub') {
      const i = slots.indexOf(a.out!);
      if (i >= 0 && a.playerId != null) slots[i] = a.playerId;
      if (a.out === setter && a.playerId != null) setter = a.playerId;
      if (!cur.actions.length) cur = fresh();
      continue;
    }
    cur.actions.push(a);
    const e = effectOf(a);
    if (e === 'none') continue;
    const winner: Side = e === 'point' ? 'us' : 'them';
    score = winner === 'us' ? [score[0] + 1, score[1]] : [score[0], score[1] + 1];
    cur.winner = winner;
    cur.score = [...score] as [number, number];
    rallies.push(cur);
    if (winner === 'us' && server === 'them') {
      slots = rotate(slots);
      server = 'us';
    } else if (winner === 'them' && server === 'us') {
      server = 'them';
    }
    cur = fresh();
  }
  return { ready, rallies, current: cur, setterId: setter };
}

/** Welches Element als Nächstes zu erwarten ist (für die Hervorhebung beim Erfassen). */
export function expectedNext(r: Rally): ElementKey[] {
  const last = r.actions[r.actions.length - 1];
  if (!last) return r.server === 'us' ? ['srv'] : ['rec'];
  switch (last.element) {
    case 'srv': return ['blk', 'dig'];
    case 'rec': return ['set', 'att'];
    case 'set': return ['att'];
    case 'att': return ['blk', 'dig'];
    case 'blk': return ['dig', 'set'];
    case 'dig': return ['set', 'att'];
    default: return [];
  }
}

// ---------- Auswertung ----------

export interface RotStat { rot: number; soWon: number; soAll: number; bpWon: number; bpAll: number; won: number; lost: number }

export interface ProStats {
  rallies: number;
  sideout: { won: number; all: number };
  breakp: { won: number; all: number };
  fbso: { won: number; all: number }; // Sideout direkt mit dem ersten Angriff nach der Annahme
  perRot: RotStat[];
  attAfterRec: { all: number; k: number; b: number; e: number };
  attTransition: { all: number; k: number; b: number; e: number };
  distAfterGoodRec: Record<'p4' | 'p3' | 'p2' | 'back', number>;
  distAfterBadRec: Record<'p4' | 'p3' | 'p2' | 'back', number>;
  missingLineup: number[]; // Sätze ohne Aufstellung
}

const bucket = (pos?: number): 'p4' | 'p3' | 'p2' | 'back' => (pos === 4 ? 'p4' : pos === 3 ? 'p3' : pos === 2 ? 'p2' : 'back');

export function proStats(sets: SetInfo[], actions: Action[], players: Map<number, Player>): ProStats {
  const st: ProStats = {
    rallies: 0,
    sideout: { won: 0, all: 0 }, breakp: { won: 0, all: 0 }, fbso: { won: 0, all: 0 },
    perRot: [1, 2, 3, 4, 5, 6].map((rot) => ({ rot, soWon: 0, soAll: 0, bpWon: 0, bpAll: 0, won: 0, lost: 0 })),
    attAfterRec: { all: 0, k: 0, b: 0, e: 0 }, attTransition: { all: 0, k: 0, b: 0, e: 0 },
    distAfterGoodRec: { p4: 0, p3: 0, p2: 0, back: 0 }, distAfterBadRec: { p4: 0, p3: 0, p2: 0, back: 0 },
    missingLineup: [],
  };
  for (const set of sets) {
    const acts = actions.filter((a) => a.set === set.nr);
    if (!acts.length) continue;
    const s = replaySet(set, acts, players);
    if (!s.ready) st.missingLineup.push(set.nr);
    for (const r of s.rallies) {
      st.rallies++;
      const won = r.winner === 'us';
      const rs = st.perRot[r.rot - 1];
      if (r.server === 'them') {
        st.sideout.all++; if (won) st.sideout.won++;
        if (rs) { rs.soAll++; if (won) rs.soWon++; }
      } else {
        st.breakp.all++; if (won) st.breakp.won++;
        if (rs) { rs.bpAll++; if (won) rs.bpWon++; }
      }
      if (rs) won ? rs.won++ : rs.lost++;

      // Angriffe: erster Angriff nach unserer Annahme oder Konter
      let afterRec = false;
      let recGood: boolean | null = null;
      let firstAttack = true;
      for (const a of r.actions) {
        if (a.element === 'rec') { afterRec = true; recGood = a.result === 'P' || a.result === 'G'; firstAttack = true; continue; }
        if (a.element === 'dig' || a.element === 'blk') { afterRec = false; continue; }
        if (a.element !== 'att') continue;
        const bucketAtt = afterRec && firstAttack ? st.attAfterRec : st.attTransition;
        bucketAtt.all++;
        if (a.result === 'K') bucketAtt.k++;
        if (a.result === 'B') bucketAtt.b++;
        if (a.result === 'E') bucketAtt.e++;
        if (afterRec && firstAttack && recGood != null && a.pos) {
          (recGood ? st.distAfterGoodRec : st.distAfterBadRec)[bucket(a.pos)]++;
        }
        if (afterRec && firstAttack && r.server === 'them') {
          st.fbso.all++;
          if (a.result === 'K') st.fbso.won++;
        }
        firstAttack = false;
        afterRec = false;
      }
    }
  }
  return st;
}

/** Zielzonen: Anzahl pro Zone 1 bis 6, getrennt nach Ergebnis. */
export function zoneStats(actions: Action[], element: 'att' | 'srv') {
  const z: Record<number, { all: number; pts: number; err: number }> = {};
  for (let i = 1; i <= 6; i++) z[i] = { all: 0, pts: 0, err: 0 };
  let without = 0;
  for (const a of actions) {
    if (a.element !== element) continue;
    if (a.to == null) { if (!(element === 'srv' && a.result === 'E')) without++; continue; }
    const e = effectOf(a);
    z[a.to].all++;
    if (e === 'point') z[a.to].pts++;
    if (e === 'error') z[a.to].err++;
  }
  return { zones: z, without };
}
