// Video für die Profi-Analyse. Die Datei bleibt auf dem Gerät und wird nur im Speicher geöffnet
// (nicht in der Datenbank abgelegt). Gespeichert wird nur der Name und pro Aktion die Videozeit.
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';

export const video = signal<{ url: string; name: string; size: number } | null>(null);
let el: HTMLVideoElement | null = null;

export function openVideoFile(f: File) {
  if (video.value) URL.revokeObjectURL(video.value.url);
  video.value = { url: URL.createObjectURL(f), name: f.name, size: f.size };
}

/** Aktuelle Videozeit (Sekunden) oder undefined, wenn kein Video läuft. */
export function videoTime(): number | undefined {
  return el && video.value ? Math.round(el.currentTime * 10) / 10 : undefined;
}

/** Zu einer Szene springen: ein paar Sekunden vorher starten. */
export function seekTo(t: number, lead = 3) {
  if (!el) return;
  el.currentTime = Math.max(0, t - lead);
  el.play().catch(() => {});
}

export function fmtTime(t?: number) {
  if (t == null) return '';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function OpenVideoButton({ label = 'Video öffnen', expected }: { label?: string; expected?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button class="btn" onClick={() => ref.current?.click()} title={expected ? `zuletzt: ${expected}` : undefined}>{label}</button>
      <input ref={ref} type="file" accept="video/*" hidden onChange={(e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) openVideoFile(f);
        (e.target as HTMLInputElement).value = '';
      }} />
    </>
  );
}

export function VideoPlayer({ expected, onOpened }: { expected?: string; onOpened?: (name: string, size: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [t, setT] = useState(0);
  const v = video.value;

  useEffect(() => {
    el = ref.current;
    return () => { if (el === ref.current) el = null; };
  }, [v?.url]);
  useEffect(() => { if (v) onOpened?.(v.name, v.size); }, [v?.url]);
  useEffect(() => { if (ref.current) ref.current.playbackRate = rate; }, [rate, v?.url]);

  const skip = (d: number) => { if (ref.current) ref.current.currentTime = Math.max(0, ref.current.currentTime + d); };
  const toggle = () => { const x = ref.current; if (!x) return; x.paused ? x.play().catch(() => {}) : x.pause(); };

  if (!v) {
    return (
      <div class="vempty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2" /><path d="m17 10 4-2.5v9L17 14" /></svg>
        <b>Kein Video geöffnet</b>
        <span class="small muted">{expected ? `Zuletzt verknüpft: ${expected}` : 'Öffne das Video des Spiels. Es bleibt auf dem Gerät.'}</span>
        <OpenVideoButton label={expected ? 'Video wieder öffnen' : 'Video öffnen'} />
        <span class="small muted">Ohne Video kannst du trotzdem erfassen, dann fehlen nur die Szenen-Sprünge.</span>
      </div>
    );
  }
  return (
    <div class="vwrap">
      <video ref={ref} src={v.url} playsInline preload="auto"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT((e.target as HTMLVideoElement).currentTime)}
        onClick={toggle} />
      <div class="vctl">
        <button class="btn" onClick={() => skip(-5)} aria-label="5 Sekunden zurück">−5 s</button>
        <button class="btn dark" onClick={toggle} style={{ minWidth: 92 }}>{playing ? 'Pause' : 'Abspielen'}</button>
        <button class="btn" onClick={() => skip(5)} aria-label="5 Sekunden vor">+5 s</button>
        <span class="num small" style={{ minWidth: 48 }}>{fmtTime(t)}</span>
        <span style={{ flex: 1 }} />
        <div class="seg" style={{ padding: 2 }}>
          {[0.5, 0.75, 1].map((r) => (
            <button style={{ minHeight: 36, padding: '0 10px' }} class={rate === r ? 'on' : ''} onClick={() => setRate(r)}>{String(r).replace('.', ',')}×</button>
          ))}
        </div>
        <OpenVideoButton label="Anderes Video" />
      </div>
    </div>
  );
}
