import { useState } from 'react';
import { fmtTime, get, put, type CoursePack, type Settings } from './api';
import { Alert, Loading } from '../../components/admin/ui';
import { errText, useLoad } from '../../components/admin/uiHooks';
import { useAdminMe } from '../../components/admin/AdminConsoleContext';

export function SettingsPage() {
  const me = useAdminMe();
  const isAdmin = me?.role === 'admin';
  const { data, error, loading, reload } = useLoad(() => get<{ settings: Settings }>('/settings'));
  const courses = useLoad(() => get<{ items: CoursePack[] }>('/courses'));
  const audit = useLoad(() => (isAdmin ? get<{ items: { audit_id: number; created_at: string; actor: string; action: string; target: string }[] }>('/audit?limit=20') : Promise.resolve({ items: [] })), [isAdmin]);
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string; errors?: string[] } | null>(null);
  const [src, setSrc] = useState(data);
  if (data !== src) { setSrc(data); if (data) setS(data.settings); }
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => (p ? { ...p, [k]: v } : p));
  const save = async () => {
    if (!s) return;
    try { await put('/settings', s); setMsg({ kind: 'ok', text: '设置已保存' }); await reload(); void audit.reload(); }
    catch (e) { const x = errText(e); setMsg({ kind: 'err', text: x.message, errors: x.errors }); }
  };
  if ((loading && !data) || !s) return <Loading />;
  const ro = !isAdmin;
  return (
    <div className="adm-grid two" style={{ alignItems: 'start' }}>
      <section className="adm-card" style={{ marginTop: 0 }}>
        <Alert message={error} />
        {msg && <Alert kind={msg.kind} message={msg.text} errors={msg.errors} onClose={() => setMsg(null)} />}
        <h2>站点与 Agent 设置 {ro && <span className="adm-tag">只读</span>}</h2>
        <div className="adm-form">
          <label htmlFor="s-name">站点名称</label><input id="s-name" className="adm-input" disabled={ro} value={s.site_name} onChange={(e) => set('site_name', e.target.value)} />
          <label htmlFor="s-banner">维护公告</label><input id="s-banner" className="adm-input" disabled={ro} value={s.maintenance_banner} placeholder="留空则不显示" onChange={(e) => set('maintenance_banner', e.target.value)} />
          <label htmlFor="s-reg">开放注册</label><input id="s-reg" type="checkbox" disabled={ro} checked={s.registration_open} onChange={(e) => set('registration_open', e.target.checked)} />
          <label htmlFor="s-course">默认课程</label>
          <select id="s-course" className="adm-select" disabled={ro} value={s.default_course} onChange={(e) => set('default_course', e.target.value)}>
            {(courses.data?.items || []).map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}</select>
          <label htmlFor="s-agent">启用课程 Agent</label><input id="s-agent" type="checkbox" disabled={ro} checked={s.agent_enabled} onChange={(e) => set('agent_enabled', e.target.checked)} />
          <label htmlFor="s-off">仅离线 FAQ</label><input id="s-off" type="checkbox" disabled={ro} checked={s.agent_offline_only} onChange={(e) => set('agent_offline_only', e.target.checked)} />
          <label htmlFor="s-limit">每日提问上限</label><input id="s-limit" type="number" className="adm-input" disabled={ro} value={s.agent_daily_message_limit} onChange={(e) => set('agent_daily_message_limit', Number(e.target.value))} />
          <label htmlFor="s-chars">回复最大字数</label><input id="s-chars" type="number" className="adm-input" disabled={ro} value={s.agent_max_reply_chars} onChange={(e) => set('agent_max_reply_chars', Number(e.target.value))} />
          <label htmlFor="s-ret">日志保留天数</label><input id="s-ret" type="number" className="adm-input" disabled={ro} value={s.log_retention_days} onChange={(e) => set('log_retention_days', Number(e.target.value))} />
        </div>
        {!ro && <div className="adm-btns" style={{ marginTop: 12 }}><button className="adm-btn primary" onClick={save}>保存设置</button><button className="adm-btn" onClick={() => data && setS(data.settings)}>撤销修改</button></div>}
      </section>
      <section className="adm-card" style={{ marginTop: 0 }}>
        <h2>操作审计</h2>
        {!isAdmin ? <p className="adm-muted">仅管理员可见</p> : (audit.data?.items || []).length === 0 ? <p className="adm-muted">暂无记录</p> : (
          <table className="adm-table"><thead><tr><th>时间</th><th>操作人</th><th>操作</th><th>对象</th></tr></thead>
            <tbody>{audit.data!.items.map((a) => <tr key={a.audit_id}><td className="adm-muted">{fmtTime(a.created_at)}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.target}</td></tr>)}</tbody></table>
        )}
      </section>
    </div>
  );
}

export default SettingsPage;
