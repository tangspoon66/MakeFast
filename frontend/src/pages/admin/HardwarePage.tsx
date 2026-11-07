import { useState } from 'react';
import { canEdit, del, fmtTime, get, post, put, type HardwareItem } from './api';
import { Alert, Empty, Loading } from '../../components/admin/ui';
import { errText, useLoad } from '../../components/admin/uiHooks';
import { useAdminMe } from '../../components/admin/AdminConsoleContext';

type Pin = { id: string; x?: number; y?: number; gpio?: number; side?: string; role?: string };

function parse(text: string, label: string): { value: Record<string, unknown> | null; error: string | null } {
  if (!text.trim()) return { value: null, error: null };
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { value: null, error: `${label} 必须是 JSON 对象` };
    return { value: v, error: null };
  } catch (e) {
    return { value: null, error: `${label} 不是合法 JSON：${(e as Error).message}` };
  }
}

export function HardwarePage() {
  const me = useAdminMe();
  const editable = canEdit(me?.role);
  const { data, error, loading, reload } = useLoad(() => get<{ items: HardwareItem[] }>('/hardware'));
  const [sel, setSel] = useState<{ kind: 'board' | 'component'; id: string; isNew?: boolean } | null>(null);
  const [dataText, setDataText] = useState('');
  const [pinText, setPinText] = useState('');
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; message: string; errors: string[] } | null>(null);

  const open = (h: HardwareItem) => {
    setSel({ kind: h.kind, id: h.id });
    setDataText(JSON.stringify(h.data, null, 2));
    setPinText(h.pinmap ? JSON.stringify(h.pinmap, null, 2) : '');
    setResult(null);
  };
  const newComponent = () => {
    const id = 'new-component';
    setSel({ kind: 'component', id, isNew: true });
    setDataText(JSON.stringify({ schemaVersion: '1.0', id, name: '新元件', category: 'sensor', logicVoltage: [3.3] }, null, 2));
    setPinText(JSON.stringify({ schemaVersion: '1.0', componentId: id, pins: [{ id: 'VCC', role: 'power', x: 10, y: 10 }] }, null, 2));
    setResult(null);
  };

  const parsed = () => {
    const d = parse(dataText, '数据');
    const p = parse(pinText, '引脚图');
    const errs = [d.error, p.error].filter(Boolean) as string[];
    if (!d.value && !d.error) errs.push('数据不能为空');
    return { d: d.value, p: p.value, errs };
  };

  const validate = async () => {
    if (!sel) return;
    const { d, p, errs } = parsed();
    if (errs.length) return setResult({ kind: 'err', message: 'JSON 格式错误', errors: errs });
    try {
      const r = await post<{ valid: boolean; errors: string[] }>(`/hardware/${sel.kind}/validate`, { data: d, pinmap: p });
      setResult(r.valid ? { kind: 'ok', message: '校验通过 ✓', errors: [] } : { kind: 'err', message: '校验未通过', errors: r.errors });
    } catch (e) { const x = errText(e); setResult({ kind: 'err', ...x }); }
  };

  const save = async () => {
    if (!sel) return;
    const { d, p, errs } = parsed();
    if (errs.length) return setResult({ kind: 'err', message: 'JSON 格式错误', errors: errs });
    const id = String((d as { id?: string }).id || '');
    try {
      const saved = await put<HardwareItem>(`/hardware/${sel.kind}/${encodeURIComponent(id)}`, { data: d, pinmap: p });
      setResult({ kind: 'ok', message: `已保存 ${saved.name}`, errors: [] });
      setSel({ kind: saved.kind, id: saved.id });
      await reload();
    } catch (e) { const x = errText(e); setResult({ kind: 'err', ...x }); }
  };

  const remove = async () => {
    if (!sel || sel.isNew || !window.confirm(`删除 ${sel.id}？`)) return;
    try { await del(`/hardware/${sel.kind}/${sel.id}`); setSel(null); await reload(); }
    catch (e) { const x = errText(e); setResult({ kind: 'err', ...x }); }
  };

  const pins = (parse(pinText, '').value?.pins as Pin[] | undefined) || [];
  if (loading && !data) return <Loading />;
  return (
    <div className="adm-split">
      <section className="adm-card">
        <Alert message={error} />
        <h2>板卡 / 元件 {editable && <button className="adm-btn accent" onClick={newComponent}>+ 新建元件</button>}</h2>
        {(data?.items || []).length === 0 ? <Empty icon="🔌" title="没有板卡数据" /> : (
          <table className="adm-table">
            <thead><tr><th>类型</th><th>ID / 名称</th><th>引脚</th><th>校验</th><th>更新</th></tr></thead>
            <tbody>{data!.items.map((h) => (
              <tr key={h.kind + h.id} className={`click${sel?.id === h.id && sel?.kind === h.kind ? ' sel' : ''}`} onClick={() => open(h)}>
                <td>{h.kind === 'board' ? '开发板' : '元件'}</td>
                <td><b>{h.id}</b><div className="adm-muted">{h.name}</div></td>
                <td>{h.pin_count}</td>
                <td>{h.errors.length ? <span className="adm-tag err">{h.errors.length} 个问题</span> : <span className="adm-tag ok">通过</span>}</td>
                <td className="adm-muted">{fmtTime(h.updated_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <section className="adm-card">
        {!sel ? <Empty icon="👈" title="选择左侧一项查看 / 编辑" hint="board.json、pinmap.json、component.json 保存前会自动校验。" /> : (
          <>
            <h2>{sel.kind === 'board' ? 'board.json' : 'component.json'} · {sel.id}
              <span className="adm-btns">
                <button className="adm-btn" onClick={validate}>校验</button>
                {editable && <button className="adm-btn primary" onClick={save}>保存</button>}
                {me?.role === 'admin' && !sel.isNew && <button className="adm-btn danger" onClick={remove}>删除</button>}
              </span>
            </h2>
            {result && <Alert kind={result.kind} message={result.message} errors={result.errors} onClose={() => setResult(null)} />}
            <div className="adm-grid two">
              <div><b>数据</b><textarea aria-label="数据 JSON" className="adm-textarea code" value={dataText} readOnly={!editable} onChange={(e) => setDataText(e.target.value)} /></div>
              <div><b>引脚图 pinmap</b><textarea aria-label="引脚图 JSON" className="adm-textarea code" value={pinText} readOnly={!editable} onChange={(e) => setPinText(e.target.value)} /></div>
            </div>
            <h2 style={{ marginTop: 12 }}>引脚表（{pins.length}）</h2>
            {pins.length === 0 ? <p className="adm-muted">无引脚数据</p> : (
              <table className="adm-table"><thead><tr><th>ID</th><th>GPIO</th><th>角色/侧</th><th>坐标</th></tr></thead>
                <tbody>{pins.map((p, i) => <tr key={i}><td>{p.id}</td><td>{p.gpio ?? '—'}</td><td>{p.role || p.side || '—'}</td><td>{p.x}, {p.y}</td></tr>)}</tbody></table>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default HardwarePage;
