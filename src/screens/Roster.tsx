import { useState } from 'preact/hooks';
import { db } from '../db';
import { POSITIONS, type Player, type Position, type Team } from '../model';
import { ask, go, team, toast, useLive, words } from '../state';
import { TeamBar } from './Teams';

export function Roster() {
  const t = team.value!;
  const W = words();
  const [copyOpen, setCopyOpen] = useState(false);
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
    if (!(await ask(`${p.name || W.one} aus dem Kader entfernen? Alte Spiele bleiben erhalten.`, 'Entfernen'))) return;
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
        <button class="btn" onClick={() => setCopyOpen(true)}>Aus anderer Mannschaft</button>
        <button class="btn primary" onClick={add}>＋ {W.one}</button>
      </div>
      <div style={{ marginBottom: 16, marginTop: -6 }}><TeamBar /></div>
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
          {!players.length && <div class="muted">Noch keine {W.many} in dieser Mannschaft. Tippe auf „＋ {W.one}“ oder übernimm {W.many} aus einer anderen Mannschaft.</div>}
        </div>
      </div>
      {copyOpen && <CopyDialog onClose={() => setCopyOpen(false)} />}
    </div>
  );
}

/** Spielerinnen aus anderen Mannschaften in diese übernehmen (als Kopie, Statistiken bleiben getrennt). */
function CopyDialog({ onClose }: { onClose: () => void }) {
  const t = team.value!;
  const W = words();
  const data = useLive(async () => {
    const teams = (await db.teams.toArray()).filter((x) => x.id !== t.id);
    const players = await db.players.filter((p) => p.active && p.teamId !== t.id).toArray();
    return teams.map((x) => ({ team: x, players: players.filter((p) => p.teamId === x.id).sort((a, b) => a.order - b.order) }));
  }, [t.id], [] as { team: Team; players: Player[] }[]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const toggle = (id: number) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };
  const copy = async () => {
    const mine = await db.players.where('teamId').equals(t.id!).toArray();
    let order = mine.reduce((m, p) => Math.max(m, p.order), 0);
    const all = data.flatMap((g) => g.players).filter((p) => sel.has(p.id!));
    await db.players.bulkAdd(all.map((p) => ({ teamId: t.id!, name: p.name, number: p.number, position: p.position, order: ++order, active: true })));
    toast(`${all.length} übernommen`);
    onClose();
  };
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog stack" role="dialog" aria-modal="true">
        <h2>Aus anderer Mannschaft übernehmen</h2>
        <p class="small muted" style={{ margin: 0 }}>
          Zum Beispiel, wenn jemand aus der Jugend auch bei den Damen spielt. Die Person wird in „{t.name}“ kopiert. Ihre Statistiken bleiben pro Mannschaft getrennt.
        </p>
        {!data.length && <div class="muted">Es gibt noch keine andere Mannschaft.</div>}
        <div class="copylist">
          {data.map((g) => (
            <div>
              <div class="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>{g.team.name}</div>
              <div class="row">
                {g.players.map((p) => (
                  <button class={`chip ${sel.has(p.id!) ? 'on' : ''}`} onClick={() => toggle(p.id!)}>
                    {p.number != null && <b>{p.number}</b>} {p.name || 'ohne Namen'}
                  </button>
                ))}
                {!g.players.length && <span class="small muted">keine {W.many}</span>}
              </div>
            </div>
          ))}
        </div>
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <button class="btn ghost" onClick={onClose}>Abbrechen</button>
          <button class="btn primary" disabled={!sel.size} onClick={copy}>Übernehmen ({sel.size})</button>
        </div>
      </div>
    </div>
  );
}
