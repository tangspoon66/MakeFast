import { useEffect, useState, type ReactNode, type KeyboardEvent } from 'react';

export function Alert({ kind = 'err', message, errors = [], onClose }: { kind?: 'err' | 'ok'; message: string | null; errors?: string[]; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div className={`adm-alert ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <div className="adm-btns" style={{ justifyContent: 'space-between' }}>
        <span>{message}</span>
        {onClose && <button className="adm-btn" onClick={onClose} aria-label="关闭提示">×</button>}
      </div>
      {errors.length > 0 && <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </div>
  );
}

export function Empty({ icon = '🗂️', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="adm-empty"><div>{icon}</div><b>{title}</b>{hint && <p className="adm-muted">{hint}</p>}</div>
  );
}

export function Loading() {
  return <div className="adm-empty adm-muted">加载中…</div>;
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={`adm-stat${accent ? ' accent' : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="adm-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-modal" role="dialog" aria-label={title}>
        <h3>{title}<button className="adm-btn" onClick={onClose} aria-label="关闭">×</button></h3>
        {children}
      </div>
    </div>
  );
}

export function ChipInput({ value, onChange, placeholder, disabled, label }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean; label?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="adm-chipinput">
      {value.map((v) => (
        <span className="adm-tag" key={v}>{v}{!disabled && <button type="button" aria-label={`移除 ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button>}</span>
      ))}
      {!disabled && <input aria-label={label || placeholder} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} />}
    </div>
  );
}
