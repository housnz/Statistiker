// Datenmodell und Zählregeln der App "Statistiker".

export type Position = 'Außen' | 'Mitte' | 'Diagonal' | 'Zuspiel' | 'Libero' | '';
export const POSITIONS: Position[] = ['Außen', 'Mitte', 'Diagonal', 'Zuspiel', 'Libero'];

/** Damen, Herren oder Mixed. Steuert die Anrede (Spielerin oder Spieler). */
export type Kategorie = 'damen' | 'herren' | 'mixed';
export const KATEGORIEN: { key: Kategorie; label: string }[] = [
  { key: 'damen', label: 'Damen / weiblich' },
  { key: 'herren', label: 'Herren / männlich' },
  { key: 'mixed', label: 'Mixed' },
];

/** Eine Mannschaft mit eigenem Kader und eigenen Spielen. */
export interface Team {
  id?: number;
  name: string;
  kategorie?: Kategorie; // fehlt bei alten Daten, dann gilt 'damen'
  liga?: string; // z. B. Landesliga, U16 Oberliga
  logo?: string; // Bild als data-URL
  color1: string; // Vereinsfarbe 1
  color2: string; // Vereinsfarbe 2
}

export interface Player {
  id?: number;
  teamId: number;
  name: string;
  number: number | null;
  position: Position;
  order: number;
  active: boolean; // false = nicht mehr im Kader (bleibt für alte Spiele erhalten)
}

export type Mode = 'simpel' | 'profi';

export interface SetInfo {
  nr: number;
  final: [number, number] | null; // eingetippter Endstand (wir, Gegner)
}

export interface Match {
  id?: number;
  teamId: number;
  date: string; // JJJJ-MM-TT
  opponent: string;
  place: string;
  league: string;
  mode: Mode;
  playerIds: number[];
  sets: SetInfo[];
  currentSet: number;
  finished: boolean;
  createdAt: number;
}

export type ElementKey = 'att' | 'srv' | 'rec' | 'set' | 'dig' | 'blk' | 'oth' | 'opp';

export interface Action {
  id?: number;
  matchId: number;
  set: number;
  seq: number; // Reihenfolge im Spiel
  playerId: number | null; // null bei Gegner-Aktionen
  element: ElementKey;
  result: string;
  pos?: number; // Position auf dem Feld (Angriff 1 bis 6, Annahme 1, 5, 6)
  from?: number; // Profi: Startzone 1 bis 6
  to?: number; // Profi: Zielzone 1 bis 6 im gegnerischen Feld
  ts: number;
}

/** Wirkung eines Ergebnisses auf den Spielstand. */
export type Effect = 'point' | 'error' | 'opppoint' | 'none';

export interface ResultDef {
  key: string;
  label: string;
  effect: Effect;
  tone: 'good' | 'ok' | 'mid' | 'low' | 'bad'; // nur für Button-Farben
}

export interface ElementDef {
  key: ElementKey;
  label: string;
  short: string;
  profiOnly?: boolean;
  needsPlayer: boolean;
  /** Welche Positionen abgefragt werden (Simpel und Profi). */
  positions?: number[];
  /** Profi: Start- und/oder Zielzone abfragen. */
  zones?: { from?: boolean; to?: boolean };
  results: ResultDef[];
}

export const ELEMENTS: ElementDef[] = [
  {
    key: 'att', label: 'Angriff', short: 'A', needsPlayer: true,
    positions: [4, 3, 2, 5, 6, 1], zones: { to: true },
    results: [
      { key: 'K', label: 'Punkt', effect: 'point', tone: 'good' },
      { key: 'N', label: 'im Spiel', effect: 'none', tone: 'mid' },
      { key: 'B', label: 'geblockt', effect: 'error', tone: 'low' },
      { key: 'E', label: 'Fehler', effect: 'error', tone: 'bad' },
    ],
  },
  {
    key: 'srv', label: 'Aufschlag', short: 'S', needsPlayer: true,
    zones: { to: true },
    results: [
      { key: 'A', label: 'Ass', effect: 'point', tone: 'good' },
      { key: 'G', label: 'gut', effect: 'none', tone: 'ok' },
      { key: 'O', label: 'ok', effect: 'none', tone: 'mid' },
      { key: 'S', label: 'schlecht', effect: 'none', tone: 'low' },
      { key: 'E', label: 'Fehler', effect: 'error', tone: 'bad' },
    ],
  },
  {
    key: 'rec', label: 'Annahme', short: 'R', needsPlayer: true,
    positions: [5, 6, 1],
    results: [
      { key: 'P', label: 'perfekt', effect: 'none', tone: 'good' },
      { key: 'G', label: 'gut', effect: 'none', tone: 'ok' },
      { key: 'O', label: 'ok', effect: 'none', tone: 'mid' },
      { key: 'S', label: 'schlecht', effect: 'none', tone: 'low' },
      { key: 'E', label: 'Fehler', effect: 'error', tone: 'bad' },
    ],
  },
  {
    key: 'set', label: 'Zuspiel', short: 'Z', needsPlayer: true, profiOnly: true,
    results: [
      { key: 'G', label: 'gut angreifbar', effect: 'none', tone: 'good' },
      { key: 'L', label: 'eingeschränkt', effect: 'none', tone: 'mid' },
      { key: 'N', label: 'nicht angreifbar', effect: 'none', tone: 'low' },
      { key: 'E', label: 'Fehler', effect: 'error', tone: 'bad' },
    ],
  },
  {
    key: 'dig', label: 'Abwehr', short: 'D', needsPlayer: true, profiOnly: true,
    results: [
      { key: 'G', label: 'gut', effect: 'none', tone: 'good' },
      { key: 'O', label: 'ok', effect: 'none', tone: 'mid' },
      { key: 'E', label: 'Fehler', effect: 'error', tone: 'bad' },
    ],
  },
  {
    key: 'blk', label: 'Block', short: 'B', needsPlayer: true,
    results: [
      { key: 'K', label: 'Punkt', effect: 'point', tone: 'good' },
      { key: 'T', label: 'guter Touch', effect: 'none', tone: 'ok' },
      { key: 'E', label: 'Fehler', effect: 'error', tone: 'bad' },
    ],
  },
  {
    key: 'oth', label: 'Sonstiges', short: 'X', needsPlayer: true,
    results: [
      { key: 'E', label: 'Fehler (Netz, Übertritt, Doppel)', effect: 'error', tone: 'bad' },
    ],
  },
  {
    key: 'opp', label: 'Gegner', short: 'G', needsPlayer: false,
    results: [
      { key: 'SE', label: 'Aufschlagfehler', effect: 'point', tone: 'good' },
      { key: 'F', label: 'Fehler (Netz, Doppel, ohne Zutun)', effect: 'point', tone: 'good' },
      { key: 'P', label: 'Punkt Gegner (sonstiger)', effect: 'opppoint', tone: 'mid' },
    ],
  },
];

export const EL: Record<ElementKey, ElementDef> = Object.fromEntries(
  ELEMENTS.map((e) => [e.key, e]),
) as Record<ElementKey, ElementDef>;

export function resultDef(a: Pick<Action, 'element' | 'result'>): ResultDef | undefined {
  return EL[a.element]?.results.find((r) => r.key === a.result);
}

export function effectOf(a: Pick<Action, 'element' | 'result'>): Effect {
  return resultDef(a)?.effect ?? 'none';
}

/** Laufender Spielstand eines Satzes aus den erfassten Aktionen. */
export function liveScore(actions: Action[]): [number, number] {
  let us = 0;
  let them = 0;
  for (const a of actions) {
    const e = effectOf(a);
    if (e === 'point') us++;
    else if (e === 'error' || e === 'opppoint') them++;
  }
  return [us, them];
}

export function playerLabel(p: Player | undefined): string {
  if (!p) return 'Gegner';
  return p.number != null ? `${p.number} ${p.name}` : p.name;
}

export function describeAction(a: Action, p?: Player): string {
  const el = EL[a.element];
  const r = resultDef(a);
  const parts = a.element === 'opp' ? [r?.label ?? a.result] : [el?.label ?? a.element, r?.label ?? a.result];
  if (a.pos) parts.push(`Pos. ${a.pos}`);
  if (a.from) parts.push(`von ${a.from}`);
  if (a.to) parts.push(`nach ${a.to}`);
  return `${a.playerId == null ? 'Gegner' : playerLabel(p)}: ${parts.join(', ')}`;
}

/** Zuspielverteilung aus den Angriffspositionen. */
export function distribution(actions: Action[]) {
  const d = { p4: 0, p3: 0, p2: 0, back: 0, total: 0 };
  for (const a of actions) {
    if (a.element !== 'att' || !a.pos) continue;
    d.total++;
    if (a.pos === 4) d.p4++;
    else if (a.pos === 3) d.p3++;
    else if (a.pos === 2) d.p2++;
    else d.back++;
  }
  return d;
}
