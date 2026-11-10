// Fertige Dateien (PDF, Excel, Sicherung) an die Person geben: Teilen-Menü am iPad,
// sonst Herunterladen. Auf der Testseite in claude.ai über deren Download-Funktion.
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';

interface ReadyFile { blob: Blob; name: string; title: string }
export const readyFile = signal<ReadyFile | null>(null);
export const busy = signal<string | null>(null);

/** Datei ist fertig: Dialog mit Teilen und Speichern zeigen (eigener Tipp nötig fürs Teilen-Menü). */
export function offerFile(blob: Blob, name: string, title: string) {
  readyFile.value = { blob, name, title };
}

/** Lange Aufgabe mit Hinweis "wird erstellt" ausführen. */
export async function withBusy<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  busy.value = label;
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    alertMsg.value = `Das hat nicht geklappt: ${(e as Error)?.message ?? e}`;
    return undefined;
  } finally {
    busy.value = null;
  }
}
const alertMsg = signal<string | null>(null);

type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };
async function claudeDownloads(): Promise<Downloads | null> {
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!c?.use) return null;
  try {
    return (await Promise.race([c.use('downloads'), new Promise((r) => setTimeout(() => r(null), 3000))])) as Downloads | null;
  } catch {
    return null;
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function FileDialogs() {
  const f = readyFile.value;
  const [dl, setDl] = useState<Downloads | null | undefined>(undefined);
  const [msg, setMsg] = useState('');
  useEffect(() => { claudeDownloads().then(setDl); }, []);
  useEffect(() => setMsg(''), [f]);

  const file = f ? new File([f.blob], f.name, { type: f.blob.type }) : null;
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    try {
      await navigator.share({ files: [file!], title: f!.title });
      readyFile.value = null;
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg('Teilen ging nicht. Bitte „Herunterladen“ nehmen.');
    }
  };
  const save = async () => {
    if (dl) {
      try {
        await dl.save({ filename: f!.name, data: f!.blob });
        readyFile.value = null;
      } catch (e) {
        const code = (e as { code?: string }).code;
        setMsg(code === 'declined' ? 'Speichern abgebrochen.' : 'Speichern ist hier nicht möglich.');
      }
      return;
    }
    download(f!.blob, f!.name);
    readyFile.value = null;
  };

  return (
    <>
      {busy.value && (
        <div class="overlay"><div class="dialog stack" role="status" style={{ width: 'min(380px, 100%)', textAlign: 'center' }}>
          <div class="spinner" aria-hidden="true" />
          <b>{busy.value}</b>
        </div></div>
      )}
      {alertMsg.value && (
        <div class="overlay" onClick={() => (alertMsg.value = null)}><div class="dialog stack" role="alertdialog">
          <div>{alertMsg.value}</div>
          <div class="row" style={{ justifyContent: 'flex-end' }}><button class="btn primary" onClick={() => (alertMsg.value = null)}>OK</button></div>
        </div></div>
      )}
      {f && (
        <div class="overlay" onClick={(e) => e.target === e.currentTarget && (readyFile.value = null)}>
          <div class="dialog stack" role="dialog" aria-modal="true" data-testid="file-ready">
            <h2>{f.title} ist fertig</h2>
            <div class="check"><b>{f.name}</b><br /><span class="small muted">{Math.max(1, Math.round(f.blob.size / 1024))} KB</span></div>
            {msg && <div class="check warn">{msg}</div>}
            <div class="row" style={{ justifyContent: 'flex-end' }}>
              <button class="btn ghost" onClick={() => (readyFile.value = null)}>Schließen</button>
              {canShare && !dl && <button class="btn" onClick={save}>Herunterladen</button>}
              {canShare && !dl
                ? <button class="btn primary" onClick={share}>Teilen oder sichern</button>
                : <button class="btn primary" onClick={save}>{dl ? 'Speichern' : 'Herunterladen'}</button>}
            </div>
            {canShare && !dl && <span class="small muted">„Teilen oder sichern“ öffnet das Teilen-Menü: in Dateien sichern, per WhatsApp oder Mail schicken.</span>}
          </div>
        </div>
      )}
    </>
  );
}
