import { useState } from 'preact/hooks';
import { db } from '../db';
import type { Mode, Player } from '../model';
import { prefs } from '../prefs';
import { go, team, todayIso, useLive, words } from '../state';

export function NewMatch() {
  const t = team.value!;
  const players = useLive(
    async () => (await db.players.where('teamId').equals(t.id!).filter((p) => p.active).toArray()).sort((a, b) => a.order - b.order),
    [t.id],
    [] as Player[],
  );
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayIso());
  const [place, setPlace] = useState('');
  const [league, setLeague] = useState(t.liga ?? '');
  const [mode, setMode] = useState<Mode>(prefs.value.defaultMode);
  const [off, setOff] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    const n = new Set(off);
    n.has(id) ? n.delete(id) : n.add(id);
    setOff(n);
  };
  const selected = players.filter((p) => !off.has(p.id!));

  const start = async () => {
    const id = await db.matches.add({
      teamId: t.id!, date, opponent: opponent.trim() || 'Gegner', place: place.trim(), league: league.trim(), mode,
      playerIds: selected.map((p) => p.id!), sets: [{ nr: 1, final: null }], currentSet: 1, finished: false, createdAt: Date.now(),
    });
    go({ name: 'scout', matchId: id });
  };

  return (
    <div class="page">
      <div class="topbar">
        <button class="btn" onClick={() => go({ name: 'home' })}>‹ Zurück</button>
        <h1>Neues Spiel · {t.name}</h1>
        <div class="spacer" />
        <button class="btn primary big" onClick={start} disabled={!selected.length}>Los geht's ▶</button>
      </div>
      <div class="grid2">
        <div class="card stack">
          <label class="field">Gegner<input value={opponent} placeholder="z. B. TV Staufen" onInput={(e) => setOpponent((e.target as HTMLInputElement).value)} /></label>
          <div class="grid2">
            <label class="field">Datum<input type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} /></label>
            <label class="field">Ort<input value={place} placeholder="Halle" onInput={(e) => setPlace((e.target as HTMLInputElement).value)} /></label>
          </div>
          <label class="field">Liga / Wettbewerb<input value={league} placeholder="optional" onInput={(e) => setLeague((e.target as HTMLInputElement).value)} /></label>
          <div class="field">
            <span class="small muted" style={{ fontWeight: 600 }}>Modus</span>
            <div class="seg">
              <button class={mode === 'simpel' ? 'on' : ''} onClick={() => setMode('simpel')}>Simpel</button>
              <button class={mode === 'profi' ? 'on' : ''} onClick={() => setMode('profi')}>Profi</button>
            </div>
            <span class="small muted">
              {mode === 'simpel' ? `Wie der Papierbogen: ${words().one}, Element, Ergebnis, Position.` : 'Für die Videoanalyse: jeder Ballwechsel, Aufstellung und Läufer, Zielzonen, Zuspiel, Abwehr, Video.'}
            </span>
          </div>
        </div>
        <div class="card">
          <h2>Wer ist dabei? <span class="muted small">({selected.length} von {players.length})</span></h2>
          <div class="row">
            {players.map((p) => (
              <button class={`chip ${off.has(p.id!) ? '' : 'on'}`} onClick={() => toggle(p.id!)}>
                {p.number != null && <b>{p.number}</b>} {p.name || 'ohne Namen'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
