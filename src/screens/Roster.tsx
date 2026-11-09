import { db } from '../db';
import { POSITIONS, type Player, type Position } from '../model';
import { ask, go, team, toast, useLive } from '../state';

export function Roster() {
  const t = team.value!;
  const players = useLive(
    async () => (await db.players.where('teamId').equals(t.id!).filter((p) => p.active).toArray()).sort((a, b) => a.order - b.order),
    [t.id],
    [] as Player[],
  );

  const add = async () => {
    const maxOrder = players.reduce((m, p) => Math.max(m, p.order), 0);
    await db.players.add({ teamId: t.id!, name: '', number: null, position: '', order: maxOrder + 1, active: true });
  };
  const upd = (p: Player, patch: Partial<Player>) => db.players.update(p.id!, patch);
  const remove = async (p: Player) => {
    if (!(await ask(`${p.name || 'Spielerin'} aus dem Kader entfernen? Alte Spiele bleiben erhalten.`, 'Entfernen'))) return;
    const used = await db.actions.filter((a) => a.playerId === p.id).count();
    if (used) await db.players.update(p.id!, { active: false });
    else await db.players.delete(p.id!);
    toast('Entfernt');
  };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= players.length) return;
    const a = players[i], b = players[j];
    await db.transaction('rw', db.players, async () => {
      await db.players.update(a.id!, { order: b.order });
      await db.players.update(b.id!, { order: a.order });
    });
  };

  return (
    <div class="page">
      <div class="topbar">
        <button class="btn" onClick={() => go({ name: 'home' })}>‹ Zurück</button>
        <h1>Kader · {t.name}</h1>
        <div class="spacer" />
        <button class="btn primary" onClick={add}>＋ Spielerin</button>
      </div>
      <div class="card">
        <p class="muted small" style={{ marginTop: 0 }}>
          Einmal anlegen, pro Spiel nur auswählen, wer dabei ist. Die Reihenfolge hier ist auch die Reihenfolge der Knöpfe beim Erfassen.
        </p>
        <div class="list-edit">
          <div class="prow small muted" style={{ fontWeight: 700 }}>
            <span>Nummer</span><span>Name</span><span>Position</span><span />
          </div>
          {players.map((p, i) => (
            <div class="prow" key={p.id}>
              <input type="number" inputMode="numeric" value={p.number ?? ''} placeholder="Nr."
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  upd(p, { number: v === '' ? null : Number(v) });
                }} />
              <input value={p.name} placeholder="Name" autoFocus={!p.name}
                onChange={(e) => upd(p, { name: (e.target as HTMLInputElement).value.trim() })} />
              <select value={p.position} onChange={(e) => upd(p, { position: (e.target as HTMLSelectElement).value as Position })}>
                <option value="">Position</option>
                {POSITIONS.map((x) => <option value={x}>{x}</option>)}
              </select>
              <div class="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <button class="iconbtn" aria-label="nach oben" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button class="iconbtn" aria-label="nach unten" onClick={() => move(i, 1)} disabled={i === players.length - 1}>↓</button>
                <button class="iconbtn danger" aria-label="entfernen" onClick={() => remove(p)}>✕</button>
              </div>
            </div>
          ))}
          {!players.length && <div class="muted">Noch keine Spielerinnen. Tippe auf „＋ Spielerin“.</div>}
        </div>
      </div>
    </div>
  );
}
