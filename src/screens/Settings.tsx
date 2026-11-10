import { useRef } from 'preact/hooks';
import { db, importBackup, saveBackupFile } from '../db';
import { exportPdf, exportXlsx } from '../exporting';
import { setsWon } from './Home';
import type { Match } from '../model';
import { createDemoTeam } from '../demo';
import { ElementKey, INPUT_ELEMENTS, Kategorie, Team } from '../model';
import { prefs, savePrefs } from '../prefs';
import { applyTeamColors, ask, deleteTeam, go, reloadTeam, switchTeam, team, toast, useLive } from '../state';
import { KategorieSeg } from './Teams';

export function Settings() {
  const t = team.value!;
  const p = prefs.value;
  const counts = useLive(async () => ({
    players: await db.players.where('teamId').equals(t.id!).filter((x) => x.active).count(),
    matches: await db.matches.where('teamId').equals(t.id!).count(),
  }), [t.id], { players: 0, matches: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const updTeam = async (patch: Partial<Team>) => {
    await db.teams.update(t.id!, patch);
    team.value = { ...t, ...patch };
    applyTeamColors(team.value);
  };

  const onLogo = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        // verkleinern, damit die Datenbank klein bleibt
        const s = Math.min(1, 400 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        updTeam({ logo: c.toDataURL('image/png') });
      };
      img.src = r.result as string;
    };
    r.readAsDataURL(f);
  };

  const backup = () => saveBackupFile();
  const matches = useLive(
    async () => (await db.matches.where('teamId').equals(t.id!).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [t.id],
    [] as Match[],
  );
  const restore = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (!(await ask('Alle Daten auf diesem Gerät durch die Sicherung ersetzen?', 'Ersetzen'))) return;
    try {
      await importBackup(JSON.parse(await f.text()));
      await savePrefs({ teamId: null });
      await reloadTeam();
      toast('Sicherung eingelesen');
    } catch (err) {
      toast(String((err as Error).message || err));
    }
  };

  const removeTeam = async () => {
    const ok = await ask(
      `Mannschaft „${t.name}“ löschen? Dabei werden der Kader (${counts.players} ${counts.players === 1 ? 'Person' : 'Personen'}) und ${counts.matches} ${counts.matches === 1 ? 'Spiel' : 'Spiele'} dieser Mannschaft gelöscht. Andere Mannschaften bleiben unverändert.`,
      'Endgültig löschen',
    );
    if (!ok) return;
    await deleteTeam(t.id!);
    toast('Mannschaft gelöscht');
  };
  const demo = async () => {
    const id = await createDemoTeam();
    await switchTeam(id);
    toast('Demo-Team mit Beispielspiel angelegt');
    go({ name: 'home' });
  };

  const toggleEl = (k: ElementKey) => {
    const hidden = p.hidden.includes(k) ? p.hidden.filter((x) => x !== k) : [...p.hidden, k];
    savePrefs({ hidden });
  };

  return (
    <div class="page">
      <div class="topbar">
        <button class="btn" onClick={() => go({ name: 'home' })}>‹ Zurück</button>
        <h1>Einstellungen</h1>
      </div>

      <div class="grid2">
        <div class="card stack">
          <h2>Mannschaft · {t.name}</h2>
          <label class="field">Name<input id="team-name-edit" value={t.name} onChange={(e) => updTeam({ name: (e.target as HTMLInputElement).value })} /></label>
          <div class="field"><span>Kategorie</span><KategorieSeg value={t.kategorie ?? 'damen'} onChange={(k: Kategorie) => updTeam({ kategorie: k })} /></div>
          <label class="field">Liga oder Altersklasse<input id="team-liga-edit" value={t.liga ?? ''} placeholder="optional" onChange={(e) => updTeam({ liga: (e.target as HTMLInputElement).value.trim() })} /></label>
          <div class="row">
            <label class="field">Vereinsfarbe 1<input class="swatch" type="color" value={t.color1} onInput={(e) => updTeam({ color1: (e.target as HTMLInputElement).value })} /></label>
            <label class="field">Vereinsfarbe 2<input class="swatch" type="color" value={t.color2} onInput={(e) => updTeam({ color2: (e.target as HTMLInputElement).value })} /></label>
            <div class="field">
              <span class="small muted" style={{ fontWeight: 600 }}>Logo</span>
              <div class="row">
                {t.logo && <img src={t.logo} style={{ height: 46, maxWidth: 90, objectFit: 'contain' }} />}
                <button class="btn" onClick={() => logoRef.current?.click()}>{t.logo ? 'Ändern' : 'Bild wählen'}</button>
                {t.logo && <button class="btn danger" onClick={() => updTeam({ logo: undefined })}>Entfernen</button>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogo} />
            </div>
          </div>
          <p class="small muted" style={{ margin: 0 }}>Mannschaft wechseln oder neu anlegen geht auf der Startseite und im Kader.</p>
          <div class="row"><button class="btn danger" onClick={removeTeam}>Mannschaft löschen</button></div>
        </div>

        <div class="card stack">
          <h2>Ansicht</h2>
          <div class="field">
            <span class="small muted" style={{ fontWeight: 600 }}>Hell oder dunkel</span>
            <div class="seg">
              {(['auto', 'hell', 'dunkel'] as const).map((v) => (
                <button class={p.theme === v ? 'on' : ''} onClick={() => savePrefs({ theme: v })}>{v === 'auto' ? 'wie iPad' : v}</button>
              ))}
            </div>
          </div>
          <div class="field">
            <span class="small muted" style={{ fontWeight: 600 }}>Buttongröße</span>
            <div class="seg">
              <button class={p.buttonSize === 'normal' ? 'on' : ''} onClick={() => savePrefs({ buttonSize: 'normal' })}>normal</button>
              <button class={p.buttonSize === 'gross' ? 'on' : ''} onClick={() => savePrefs({ buttonSize: 'gross' })}>groß</button>
            </div>
          </div>
          <div class="field">
            <span class="small muted" style={{ fontWeight: 600 }}>Modus für neue Spiele</span>
            <div class="seg">
              <button class={p.defaultMode === 'simpel' ? 'on' : ''} onClick={() => savePrefs({ defaultMode: 'simpel' })}>Simpel</button>
              <button class={p.defaultMode === 'profi' ? 'on' : ''} onClick={() => savePrefs({ defaultMode: 'profi' })}>Profi</button>
            </div>
          </div>
          <div class="field">
            <span class="small muted" style={{ fontWeight: 600 }}>Sichtbare Elemente beim Erfassen</span>
            <div class="row">
              {INPUT_ELEMENTS.map((e) => (
                <button class={`chip ${p.hidden.includes(e.key) ? '' : 'on'}`} onClick={() => toggleEl(e.key)}>
                  {e.label}{e.profiOnly ? ' (Profi)' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div class="card stack">
          <h2>Sichern</h2>
          <p class="small muted" style={{ margin: 0 }}>
            Alle Daten bleiben nur auf diesem iPad. Sichere regelmäßig eine Datei, zum Beispiel in iCloud Drive („In Dateien sichern“).
          </p>
          <div class="row">
            <button class="btn primary" onClick={backup}>Sicherung speichern</button>
            <button class="btn" onClick={() => fileRef.current?.click()}>Sicherung einlesen</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
          </div>
        </div>

        <div class="card stack" style={{ gridColumn: '1 / -1' }}>
          <h2>Auswertungen exportieren · {t.name}</h2>
          <p class="small muted" style={{ margin: 0 }}>PDF zum Weiterleiten an Team und Trainer, Excel zum Weiterrechnen. Die Dateien entstehen direkt auf diesem Gerät.</p>
          {!matches.length && <div class="muted">Noch keine Spiele in dieser Mannschaft.</div>}
          {matches.map((m) => {
            const [a, b2] = setsWon(m);
            return (
              <div class="row" style={{ borderTop: '1px solid var(--rule)', paddingTop: 8 }}>
                <span class="num small muted" style={{ minWidth: 86 }}>{m.date.split('-').reverse().join('.')}</span>
                <b style={{ flex: 1 }}>gegen {m.opponent} <span class="num">{a}:{b2}</span></b>
                <button class="btn" onClick={() => exportXlsx(m.id!)}>Excel</button>
                <button class="btn primary" onClick={() => exportPdf(m.id!)}>PDF</button>
              </div>
            );
          })}
        </div>

        <div class="card stack">
          <h2>Ausprobieren</h2>
          <p class="small muted" style={{ margin: 0 }}>Legt ein zusätzliches Demo-Team mit erfundenen Namen und einem Beispielspiel an. Deine eigenen Mannschaften bleiben unverändert.</p>
          <div class="row"><button class="btn" onClick={demo}>Demo-Team anlegen</button></div>
                  </div>
      </div>
    </div>
  );
}
