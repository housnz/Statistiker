// Eingabe einer Aktion: Entwurf, Schritt zurück, Zeichen im Bogen. Gemeinsam für Simpel und Profi.
import { Action, EL, ElementKey } from './model';

export interface Draft {
  editId?: number;
  playerId: number | 'opp' | null;
  element: ElementKey | null;
  result: string | null;
  pos?: number;
  to?: number;
  noZone?: boolean; // Profi: Zielzone bewusst weggelassen
  dirty?: boolean; // beim Korrigieren: erst speichern, wenn etwas geändert wurde
  steps?: Step[]; // Reihenfolge der Eingaben, für "Rückgängig" in kleinen Schritten
  auto?: boolean; // von der App vorgewählt (Profi: Aufschlägerin), zählt nicht als eigener Schritt
}

export type Step = 'player' | 'element' | 'result' | 'pos' | 'to' | 'noZone';

export const EMPTY: Draft = { playerId: null, element: null, result: null, steps: [] };

/** Schritt ans Ende der Liste setzen (doppelte vorher entfernen). */
export function push(steps: Step[] | undefined, k: Step, drop: Step[] = []): Step[] {
  return [...(steps ?? []).filter((x) => x !== k && !drop.includes(x)), k];
}

/** Gespeicherte Aktion wieder in eine Eingabe verwandeln (mit allen Schritten). */
export function draftFrom(a: Action, profi: boolean, editId?: number): Draft {
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
export function stepBack(d: Draft): Draft {
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

/** Was für diese Aktion noch fehlt. */
export function needs(d: Draft, profi: boolean) {
  const el = d.element ? EL[d.element] : null;
  const pos = !!el?.positions && d.pos == null;
  const to = profi && !!el?.zones?.to && d.to == null && !d.noZone && d.result != null && !(d.element === 'srv' && d.result === 'E');
  return { pos, to };
}

export const SHORT: Partial<Record<ElementKey, string>> = { srv: 'Aufschl.', oth: 'Sonst.', rec: 'Annahme' };

const SYM: Record<string, Record<string, string>> = {
  srv: { A: '#', G: '0', O: '−', S: '/', E: '=' },
  blk: { K: '#', T: '+', E: '!' },
  oth: { E: '=' },
  set: { G: '#', L: '+', N: '−', E: '=' },
  dig: { G: '#', O: '+', E: '=' },
};

/** Zeichen im Bogen: wie auf dem Papier (Positionsziffer bzw. Symbol), Farbe nach Ergebnis. */
export function token(a: Action): { t: string; cls: string } {
  const r = EL[a.element]?.results.find((x) => x.key === a.result);
  const tone = r?.tone ?? 'mid';
  const cls = tone + (r?.effect === 'point' ? ' pt' : '');
  if (a.element === 'att' || a.element === 'rec') return { t: a.pos != null ? String(a.pos) : '·', cls };
  return { t: SYM[a.element]?.[a.result] ?? '·', cls };
}
