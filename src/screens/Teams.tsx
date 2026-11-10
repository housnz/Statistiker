// Mannschafts-Leiste: wechseln und neue Mannschaft anlegen.
import { useState } from 'preact/hooks';
import { db } from '../db';
import { KATEGORIEN, Kategorie, Team } from '../model';
import { createTeam, switchTeam, team, toast, useLive } from '../state';

export function TeamBar() {
  const teams = useLive(() => db.teams.toArray(), [], [] as Team[]);
  const [open, setOpen] = useState(false);
  const cur = team.value;
  return (
    <div class="teambar" data-testid="teambar">
      <span class="label">Mannschaft</span>
      {teams.map((x) => (
        <button class={`chip ${x.id === cur?.id ? 'on' : ''}`} onClick={() => switchTeam(x.id!)}>
          {x.name}
          <span class="kat">{x.kategorie === 'herren' ? 'H' : x.kategorie === 'mixed' ? 'X' : 'D'}</span>
        </button>
      ))}
      <button class="chip" onClick={() => setOpen(true)}>＋ Mannschaft</button>
      {open && <NewTeamDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

export function KategorieSeg({ value, onChange }: { value: Kategorie; onChange: (k: Kategorie) => void }) {
  return (
    <div class="seg">
      {KATEGORIEN.map((k) => (
        <button class={value === k.key ? 'on' : ''} onClick={() => onChange(k.key)}>{k.label}</button>
      ))}
    </div>
  );
}

export function NewTeamDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [kat, setKat] = useState<Kategorie>('damen');
  const [liga, setLiga] = useState('');
  const save = async () => {
    await createTeam(name.trim(), kat, liga.trim());
    toast(`Mannschaft „${name.trim()}“ angelegt`);
    onClose();
  };
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog stack" role="dialog" aria-modal="true">
        <h2>Neue Mannschaft</h2>
        <p class="small muted" style={{ margin: 0 }}>Jede Mannschaft hat ihren eigenen Kader und ihre eigenen Spiele. Nichts wird vermischt.</p>
        <label class="field">Name<input id="team-name" autoFocus value={name} placeholder="z. B. VC Weil Damen 2" onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
        <div class="field"><span>Kategorie</span><KategorieSeg value={kat} onChange={setKat} /></div>
        <label class="field">Liga oder Altersklasse<input id="team-liga" value={liga} placeholder="optional, z. B. Landesliga oder U16" onInput={(e) => setLiga((e.target as HTMLInputElement).value)} /></label>
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <button class="btn ghost" onClick={onClose}>Abbrechen</button>
          <button class="btn primary" disabled={!name.trim()} onClick={save}>Anlegen</button>
        </div>
      </div>
    </div>
  );
}
