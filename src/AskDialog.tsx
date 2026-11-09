import { useState } from 'preact/hooks';
import { askState } from './state';

export function AskDialog() {
  const a = askState.value;
  const [val, setVal] = useState('');
  if (!a) return null;
  const close = (v: string | null) => {
    askState.value = null;
    setVal('');
    a.resolve(v);
  };
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && close(null)}>
      <div class="dialog stack" role="dialog" aria-modal="true">
        <div style={{ fontSize: 18, fontWeight: 600 }}>{a.text}</div>
        {a.input && (
          <label class="field">
            <input id="ask-input" autoFocus value={val} placeholder={a.input.placeholder}
              onInput={(e) => setVal((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && val.trim() && close(val.trim())} />
          </label>
        )}
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <button class="btn ghost" onClick={() => close(null)}>Abbrechen</button>
          <button class="btn primary" disabled={!!a.input && !val.trim()} onClick={() => close(a.input ? val.trim() : '')}>{a.ok}</button>
        </div>
      </div>
    </div>
  );
}
