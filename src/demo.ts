// Erfundene Beispieldaten zum Ausprobieren. Keine echten Namen.
import { db } from './db';
import type { Action, Player, SetInfo } from './model';
import { todayIso } from './state';

const NAMES: [string, number, Player['position']][] = [
  ['Anna', 4, 'Außen'], ['Bea', 7, 'Außen'], ['Clara', 11, 'Mitte'], ['Dana', 9, 'Mitte'],
  ['Eva', 2, 'Zuspiel'], ['Fiona', 13, 'Diagonal'], ['Greta', 1, 'Libero'], ['Hanna', 5, 'Außen'],
];

export async function createDemoTeam(): Promise<number> {
  const teamId = await db.teams.add({ name: 'Demo-Team', kategorie: 'damen', liga: 'Testliga', color1: '#d7262e', color2: '#16181d' });
  const ids: number[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const [name, number, position] = NAMES[i];
    ids.push(await db.players.add({ teamId, name, number, position, order: i + 1, active: true }));
  }
  // Ein erfundenes Spiel über drei Sätze, zufällig, aber stimmig.
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const attackers = [ids[0], ids[1], ids[2], ids[3], ids[5], ids[7]];
  const receivers = [ids[0], ids[1], ids[6], ids[7]];
  const servers = ids.filter((_, i) => i !== 6); // Libero schlägt nicht auf
  const matchId = await db.matches.add({
    teamId, date: todayIso(), opponent: 'TSV Musterstadt', place: 'Sporthalle', league: 'Testspiel', mode: 'simpel',
    playerIds: ids, sets: [{ nr: 1, final: [25, 21] }, { nr: 2, final: [23, 25] }, { nr: 3, final: [25, 18] }], currentSet: 3, finished: true, createdAt: Date.now(),
  });
  const acts: Action[] = [];
  let seq = 0;
  const add = (set: number, a: Partial<Action>) => acts.push({ matchId, set, seq: ++seq, ts: Date.now(), playerId: null, element: 'opp', result: 'P', ...a } as Action);
  for (const [set, [us, them]] of [[1, [25, 21]], [2, [23, 25]], [3, [25, 18]]] as [number, [number, number]][]) {
    let u = 0, t = 0;
    while (u < us || t < them) {
      const weWin = u < us && (t >= them || rnd() < us / (us + them));
      if (rnd() < 0.5) add(set, { playerId: pick(receivers), element: 'rec', result: pick(['P', 'G', 'G', 'O', 'S']), pos: pick([1, 5, 6]) });
      if (rnd() < 0.45) add(set, { playerId: pick(attackers), element: 'att', result: 'N', pos: pick([4, 4, 4, 3, 2, 2, 6, 1]) });
      if (rnd() < 0.3) add(set, { playerId: pick(servers), element: 'srv', result: pick(['G', 'O', 'S']) });
      if (weWin) {
        const r = rnd();
        if (r < 0.55) add(set, { playerId: pick(attackers), element: 'att', result: 'K', pos: pick([4, 4, 4, 3, 3, 2, 2, 6, 1]) });
        else if (r < 0.68) add(set, { playerId: pick(servers), element: 'srv', result: 'A' });
        else if (r < 0.78) add(set, { playerId: pick([ids[2], ids[3], ids[5]]), element: 'blk', result: 'K' });
        else if (r < 0.9) add(set, { element: 'opp', result: 'SE' });
        else add(set, { element: 'opp', result: 'F' });
        u++;
      } else {
        const r = rnd();
        if (r < 0.15) add(set, { playerId: pick(attackers), element: 'att', result: 'E', pos: pick([4, 3, 2]) });
        else if (r < 0.25) add(set, { playerId: pick(attackers), element: 'att', result: 'B', pos: pick([4, 2]) });
        else if (r < 0.37) add(set, { playerId: pick(servers), element: 'srv', result: 'E' });
        else if (r < 0.45) add(set, { playerId: pick(receivers), element: 'rec', result: 'E', pos: pick([1, 5, 6]) });
        else if (r < 0.5) add(set, { playerId: pick([ids[2], ids[3]]), element: 'blk', result: 'E' });
        else if (r < 0.55) add(set, { playerId: pick(ids), element: 'oth', result: 'E' });
        else add(set, { element: 'opp', result: 'P' });
        t++;
      }
    }
  }
  // Satz 3: zwei Punkte "vergessen", damit die Prüfung etwas zeigt.
  const s3 = acts.filter((a) => a.set === 3 && a.element === 'opp' && a.result === 'SE').slice(0, 2);
  await db.actions.bulkAdd(acts.filter((a) => !s3.includes(a)));
  await createDemoProMatch(teamId, ids);
  return teamId;
}

/** Erfundenes Profi-Spiel: jeder Ballwechsel komplett, mit Aufstellung, Rotation und Videozeiten. */
async function createDemoProMatch(teamId: number, ids: number[]) {
  const [anna, bea, clara, dana, eva, fiona, greta, hanna] = ids;
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const wpick = <T,>(a: [T, number][]) => { let r = rnd() * a.reduce((n, [, w]) => n + w, 0); for (const [v, w] of a) { if ((r -= w) <= 0) return v; } return a[0][0]; };
  const lineup = [eva, anna, clara, fiona, bea, dana];
  const sets: SetInfo[] = [
    { nr: 1, final: null, lineup, liberos: [greta], setterId: eva, firstServe: 'them' },
    { nr: 2, final: null, lineup: [eva, hanna, clara, fiona, bea, dana], liberos: [greta], setterId: eva, firstServe: 'us' },
  ];
  const matchId = await db.matches.add({
    teamId, date: todayIso(), opponent: 'SC Videostadt', place: 'Sporthalle', league: 'Testspiel', mode: 'profi',
    playerIds: ids, sets, currentSet: 2, finished: true, createdAt: Date.now() + 1, video: { name: 'demo-spiel.mp4', size: 0 },
  });
  const acts: Action[] = [];
  let seq = 0;
  let vt = 30;
  for (const set of sets) {
    let slots = [...set.lineup!];
    let server = set.firstServe!;
    let us = 0, them = 0;
    const add = (a: Partial<Action>) => { vt += 2 + Math.round(rnd() * 3); acts.push({ matchId, set: set.nr, seq: ++seq, ts: Date.now(), playerId: null, element: 'opp', result: 'P', vt, ...a } as Action); };
    const back = () => [slots[0], slots[4], slots[5]].map((id) => (id === dana || id === clara ? greta : id));
    const front = () => [slots[1], slots[2], slots[3]];
    const attack = (): 'us' | 'them' | null => {
      const setter = slots.includes(eva) ? eva : slots[0];
      const sr = wpick<string>([['G', 6], ['L', 3], ['N', 1], ['E', 0.3]]);
      add({ playerId: setter, element: 'set', result: sr });
      if (sr === 'E') return 'them';
      const fr = front().filter((id) => id !== setter);
      const attacker = sr === 'N' ? pick(fr) : wpick<number>([...fr.map((id) => [id, 3] as [number, number]), [fiona, slots.slice(1, 4).includes(fiona) ? 0 : 1]]);
      const idx = slots.indexOf(attacker);
      const pos = idx >= 1 && idx <= 3 ? [2, 3, 4][idx - 1] : 1;
      const k = sr === 'G' ? 0.45 : sr === 'L' ? 0.3 : 0.18;
      const r = wpick<string>([['K', k], ['N', 0.35], ['B', 0.1], ['E', 0.1]]);
      add({ playerId: attacker, element: 'att', result: r, pos, to: r === 'E' ? undefined : wpick<number>([[1, 2], [6, 2], [5, 3], [4, 1], [2, 1], [3, 1]]) });
      return r === 'K' ? 'us' : r === 'B' || r === 'E' ? 'them' : null;
    };
    while ((us < 25 && them < 25) || Math.abs(us - them) < 2) {
      let winner: 'us' | 'them' | null = null;
      vt += 8;
      if (server === 'us') {
        const r = wpick<string>([['A', 0.08], ['G', 0.3], ['O', 0.35], ['S', 0.15], ['E', 0.12]]);
        add({ playerId: slots[0], element: 'srv', result: r, to: r === 'E' ? undefined : wpick<number>([[1, 3], [6, 2], [5, 3], [4, 1], [2, 1], [3, 1]]) });
        if (r === 'A') winner = 'us'; else if (r === 'E') winner = 'them';
      } else if (rnd() < 0.08) {
        add({ element: 'opp', result: 'SE' }); winner = 'us';
      } else {
        const rec = wpick<string>([['P', 3], ['G', 3], ['O', 2], ['S', 1.2], ['E', 0.6]]);
        add({ playerId: pick([greta, slots.includes(anna) ? anna : hanna, bea]), element: 'rec', result: rec, pos: pick([1, 6, 5]) });
        if (rec === 'E') winner = 'them'; else winner = attack();
      }
      for (let n = 0; winner == null && n < 3; n++) {
        // Gegner greift an: Block oder Abwehr, dann Konter
        if (rnd() < 0.25) {
          const b = wpick<string>([['K', 0.3], ['T', 0.5], ['E', 0.2]]);
          add({ playerId: pick(front()), element: 'blk', result: b });
          if (b === 'K') { winner = 'us'; break; }
          if (b === 'E') { winner = 'them'; break; }
        }
        const dg = wpick<string>([['G', 4], ['O', 3], ['E', 2]]);
        add({ playerId: pick(back()), element: 'dig', result: dg });
        if (dg === 'E') { winner = 'them'; break; }
        winner = attack();
      }
      if (winner == null) { add(rnd() < 0.5 ? { element: 'opp', result: 'F' } : { element: 'opp', result: 'P' }); winner = acts[acts.length - 1].result === 'F' ? 'us' : 'them'; }
      if (winner === 'us') { us++; if (server === 'them') { slots = [...slots.slice(1), slots[0]]; server = 'us'; } }
      else { them++; server = 'them'; }
      if (us >= 30 || them >= 30) break;
    }
    set.final = [us, them];
  }
  await db.matches.update(matchId, { sets });
  await db.actions.bulkAdd(acts);
}
