// Kennzahlen wie in den bisherigen PDF-Auswertungen.
import { Action, effectOf, liveScore } from './model';

export interface PlayerStats {
  points: number; errors: number; balance: number;
  att: number; attK: number; attN: number; attB: number; attE: number;
  srv: number; srvA: number; srvG: number; srvO: number; srvS: number; srvE: number;
  rec: number; recP: number; recG: number; recO: number; recS: number; recE: number;
  blkK: number; blkT: number; blkE: number;
  set: number; setG: number; setL: number; setN: number; setE: number;
  dig: number; digG: number; digO: number; digE: number; digU: number;
  othE: number;
}

export function emptyStats(): PlayerStats {
  return {
    points: 0, errors: 0, balance: 0,
    att: 0, attK: 0, attN: 0, attB: 0, attE: 0,
    srv: 0, srvA: 0, srvG: 0, srvO: 0, srvS: 0, srvE: 0,
    rec: 0, recP: 0, recG: 0, recO: 0, recS: 0, recE: 0,
    blkK: 0, blkT: 0, blkE: 0,
    set: 0, setG: 0, setL: 0, setN: 0, setE: 0,
    dig: 0, digG: 0, digO: 0, digE: 0, digU: 0,
    othE: 0,
  };
}

const FIELD: Record<string, Record<string, keyof PlayerStats>> = {
  att: { K: 'attK', N: 'attN', B: 'attB', E: 'attE' },
  srv: { A: 'srvA', G: 'srvG', O: 'srvO', S: 'srvS', E: 'srvE' },
  rec: { P: 'recP', G: 'recG', O: 'recO', S: 'recS', E: 'recE' },
  blk: { K: 'blkK', T: 'blkT', E: 'blkE' },
  set: { G: 'setG', L: 'setL', N: 'setN', E: 'setE' },
  dig: { G: 'digG', O: 'digO', E: 'digE', U: 'digU' },
  oth: { E: 'othE' },
};

export function addAction(s: PlayerStats, a: Action) {
  const f = FIELD[a.element]?.[a.result];
  if (!f) return;
  s[f]++;
  if (a.element === 'att' || a.element === 'srv' || a.element === 'rec' || a.element === 'set' || a.element === 'dig') {
    s[a.element]++;
  }
  const e = effectOf(a);
  if (e === 'point') s.points++;
  if (e === 'error') s.errors++;
  s.balance = s.points - s.errors;
}

export function statsByPlayer(actions: Action[]): Map<number, PlayerStats> {
  const m = new Map<number, PlayerStats>();
  for (const a of actions) {
    if (a.playerId == null) continue;
    let s = m.get(a.playerId);
    if (!s) m.set(a.playerId, (s = emptyStats()));
    addAction(s, a);
  }
  return m;
}

export function teamStats(actions: Action[]): PlayerStats {
  const s = emptyStats();
  for (const a of actions) if (a.playerId != null) addAction(s, a);
  return s;
}

export interface SetSummary {
  nr: number;
  final: [number, number] | null;
  counted: [number, number];
  ownPoints: { att: number; srv: number; blk: number; oppSrv: number; oppF: number };
  ownErrors: number;
  oppEarned: number; // vom Gegner selbst erspielt
  missing: number; // eigene Punkte laut Endstand, die nicht notiert sind (negativ = zu viel)
}

export function setSummary(nr: number, final: [number, number] | null, actions: Action[]): SetSummary {
  const own = { att: 0, srv: 0, blk: 0, oppSrv: 0, oppF: 0 };
  let ownErrors = 0;
  for (const a of actions) {
    if (a.element === 'att' && a.result === 'K') own.att++;
    else if (a.element === 'srv' && a.result === 'A') own.srv++;
    else if (a.element === 'blk' && a.result === 'K') own.blk++;
    else if (a.element === 'opp' && a.result === 'SE') own.oppSrv++;
    else if (a.element === 'opp' && a.result === 'F') own.oppF++;
    if (effectOf(a) === 'error') ownErrors++;
  }
  const counted = liveScore(actions);
  const ownTotal = own.att + own.srv + own.blk + own.oppSrv + own.oppF;
  const missing = final ? final[0] - ownTotal : 0;
  const oppEarned = final ? Math.max(0, final[1] - ownErrors) : counted[1] - ownErrors;
  return { nr, final, counted, ownPoints: own, ownErrors, oppEarned, missing };
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
export const pctLabel = (n: number, d: number) => (d ? `${pct(n, d)} %` : '·');
