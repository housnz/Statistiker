// Spalten der Tabelle „Alle Werte“, gruppiert nach Kategorie. Gemeinsam für App, PDF und Excel,
// damit jede Kategorie überall dieselbe Farbe hat (Angriff immer blau, Block immer orange usw.).
import { PlayerStats, bil, pctLabel } from './stats';

/** Farben der Kategorien. Bewusst kein Grün und Rot, weil die für gut und schlecht stehen. */
export const CAT = {
  ges: '#16181d', // Gesamt: Schwarz
  att: '#2563eb', // Angriff: Blau
  srv: '#0d9488', // Aufschlag: Türkis
  rec: '#7c3aed', // Annahme: Violett
  blk: '#c2410c', // Block: Orange
  set: '#a16207', // Zuspiel: Ocker
  dig: '#be185d', // Abwehr: Pink
  oth: '#64748b', // Sonstiges: Grau
} as const;
export type CatKey = keyof typeof CAT;

export type Val = { n: number } | { pct: [number, number] } | { sgn: number };
export interface Col { h: string; long: string; v: (s: PlayerStats) => Val }
export interface Group { key: CatKey; label: string; cols: Col[] }

const n = (h: string, long: string, f: (s: PlayerStats) => number): Col => ({ h, long, v: (s) => ({ n: f(s) }) });
const p = (h: string, long: string, a: (s: PlayerStats) => number, b: (s: PlayerStats) => number): Col => ({ h, long, v: (s) => ({ pct: [a(s), b(s)] }) });

const G = {
  ges: { key: 'ges', label: 'Gesamt', cols: [n('Pkt', 'Punkte', (s) => s.points), n('Fehl.', 'Fehler', (s) => s.errors), { h: 'Bil.', long: 'Bilanz', v: (s) => ({ sgn: s.balance }) }] },
  attShort: { key: 'att', label: 'Angriff', cols: [n('Ges.', 'Angriffe', (s) => s.att), n('Pkt', 'Angriff Punkt', (s) => s.attK), n('geb.', 'Angriff geblockt', (s) => s.attB), n('Fehl.', 'Angriff Fehler', (s) => s.attE), p('Kill', 'Kill-Quote', (s) => s.attK, (s) => s.att), p('Eff.', 'Effizienz', (s) => s.attK - s.attE - s.attB, (s) => s.att)] },
  att: { key: 'att', label: 'Angriff', cols: [n('Ges.', 'Angriffe', (s) => s.att), n('Pkt', 'Angriff Punkt', (s) => s.attK), n('weiter', 'Angriff im Spiel', (s) => s.attN), n('geb.', 'Angriff geblockt', (s) => s.attB), n('Fehl.', 'Angriff Fehler', (s) => s.attE), p('Kill', 'Kill-Quote', (s) => s.attK, (s) => s.att), p('Eff.', 'Effizienz', (s) => s.attK - s.attE - s.attB, (s) => s.att)] },
  srvShort: { key: 'srv', label: 'Aufschlag', cols: [n('Ges.', 'Aufschläge', (s) => s.srv), n('Ass', 'Ass', (s) => s.srvA), n('Fehl.', 'Aufschlag Fehler', (s) => s.srvE)] },
  srv: { key: 'srv', label: 'Aufschlag', cols: [n('Ges.', 'Aufschläge', (s) => s.srv), n('Ass', 'Ass', (s) => s.srvA), n('gut', 'Aufschlag gut', (s) => s.srvG), n('ok', 'Aufschlag ok', (s) => s.srvO), n('schl.', 'Aufschlag schlecht', (s) => s.srvS), n('Fehl.', 'Aufschlag Fehler', (s) => s.srvE), p('Druck', 'Aufschlagdruck', (s) => s.srvA + s.srvG, (s) => s.srv)] },
  recShort: { key: 'rec', label: 'Annahme', cols: [n('Ges.', 'Annahmen', (s) => s.rec), p('pos.', 'Annahme positiv', (s) => s.recP + s.recG, (s) => s.rec), n('Fehl.', 'Annahme Fehler', (s) => s.recE)] },
  rec: { key: 'rec', label: 'Annahme', cols: [n('Ges.', 'Annahmen', (s) => s.rec), n('perf.', 'Annahme perfekt', (s) => s.recP), n('gut', 'Annahme gut', (s) => s.recG), n('ok', 'Annahme ok', (s) => s.recO), n('schl.', 'Annahme schlecht', (s) => s.recS), n('Fehl.', 'Annahme Fehler', (s) => s.recE), p('pos.', 'Annahme positiv', (s) => s.recP + s.recG, (s) => s.rec)] },
  blk: { key: 'blk', label: 'Block', cols: [n('Pkt', 'Blockpunkte', (s) => s.blkK), n('Touch', 'Block Touch', (s) => s.blkT), n('Fehl.', 'Blockfehler', (s) => s.blkE)] },
  set: { key: 'set', label: 'Zuspiel', cols: [n('Ges.', 'Zuspiele', (s) => s.set), n('gut', 'Zuspiel gut angreifbar', (s) => s.setG), n('eing.', 'Zuspiel eingeschränkt', (s) => s.setL), n('n. a.', 'Zuspiel nicht angreifbar', (s) => s.setN), n('Fehl.', 'Zuspielfehler', (s) => s.setE), p('gut %', 'Zuspiel gut %', (s) => s.setG, (s) => s.set)] },
  dig: { key: 'dig', label: 'Abwehr', cols: [n('Ges.', 'Abwehr', (s) => s.dig), n('gut', 'Abwehr gut', (s) => s.digG), n('ok', 'Abwehr ok', (s) => s.digO), n('Fehl.', 'Abwehrfehler (vermeidbar)', (s) => s.digE), n('unh.', 'Abwehr unhaltbar', (s) => s.digU), p('gut %', 'Abwehr gut %', (s) => s.digG, (s) => s.dig)] },
  oth: { key: 'oth', label: 'Sonst.', cols: [n('Fehl.', 'Sonstige Fehler', (s) => s.othE)] },
} satisfies Record<string, Group>;

/** Tabellen „Alle Werte“: Simpel eine kompakte Tabelle, Profi alles in drei Tabellen (passt so aufs Hochformat). */
export function valueTables(profi: boolean): Group[][] {
  return profi
    ? [[G.ges, G.att, G.srv], [G.ges, G.rec, G.blk, G.oth], [G.set, G.dig]]
    : [[G.ges, G.attShort, G.srvShort, G.recShort, G.blk, G.oth]];
}

/** Alle Gruppen in voller Länge (für Excel). */
export function allGroups(profi: boolean): Group[] {
  return profi ? [G.ges, G.att, G.srv, G.rec, G.blk, G.set, G.dig, G.oth] : [G.ges, G.att, G.srv, G.rec, G.blk, G.oth];
}

/** Wert als Text, wie in App und PDF angezeigt. */
export function fmtVal(v: Val): string {
  if ('pct' in v) return pctLabel(v.pct[0], v.pct[1]);
  if ('sgn' in v) return bil(v.sgn);
  return String(v.n);
}

/** Erklärung der Abkürzungen unter der Tabelle. */
export function legendText(profi: boolean): string {
  return 'Pkt = Punkte, Fehl. = Fehler, Bil. = Bilanz, Ges. = gesamt, geb. = geblockt, pos. = positiv (perfekt + gut).'
    + (profi ? ' weiter = Angriff im Spiel, schl. = schlecht, perf. = perfekt, eing. = eingeschränkt, n. a. = nicht angreifbar, unh. = unhaltbar. Druck = (Ass + gut) / Aufschläge.' : '')
    + ' Kill = Angriffspunkte / Angriffe. Eff. = (Punkte minus Fehler minus geblockt) / Angriffe.';
}
