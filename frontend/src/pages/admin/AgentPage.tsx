import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { canEdit, del, fmtTime, get, post, put, type AgentEvent, type Conversation, type Faq, type Provider } from './api';
import { Alert, ChipInput, Empty, Loading, Modal } from '../../components/admin/ui';
import { errText, useLoad } from '../../components/admin/uiHooks';
import { useAdminMe } from '../../components/admin/AdminConsoleContext';

const TABS = [
  ['logs', '对话日志'], ['refusals', '拒答日志'], ['faq', 'FAQ 知识库'], ['guard', '守卫关键词'], ['providers', '服务商状态'],
] as const;
type Tab = typeof TABS[number][0];

const LIST_LABEL: Record<string, string> = {
  course: '课程关键词（命中才放行）', off_topic: '离题词', injection: '提示注入（正则）', unsafe: '不安全内容（正则）', pii: '个人信息（正则）',
};

function Logs() {
  const { data, error, loading } = useLoad(() => get<{ items: Conversation[]; events: AgentEvent[] }>('/agent/conversations'));
  const [open, setOpen] = useState<Conversation | null>(null);
  if (loading && !data) return <Loading />;
  const convs = data?.items || [];
  const events = data?.events || [];
  return (
    <>
      <Alert message={error} />
      <p className="adm-muted">🔒 已脱敏：学习者以匿名编号显示，手机号 / 邮箱 / 证件号 / 姓名 / 住址 / 学校自动隐藏。</p>
      {convs.length === 0 && events.length === 0 ? <Empty icon="💬" title="还没有 Agent 对话" /> : (
        <table className="adm-table">
          <thead><tr><th>学习者</th><th>课程</th><th>标题 / 问题</th><th>消息</th><th>时间</th><th></th></tr></thead>
          <tbody>
            {convs.map((c) => (
              <tr key={c.id}><td>{c.learner}</td><td>{c.course_slug}</td><td>{c.title}</td><td>{c.messages.length}</td>
                <td className="adm-muted">{fmtTime(c.updated_at)}</td><td><button className="adm-btn" onClick={() => setOpen(c)}>查看</button></td></tr>
            ))}
            {events.map((e) => (
              <tr key={`e${e.event_id}`}><td>{e.user_ref || '匿名'}</td><td>{e.course_slug || '—'}</td><td>{e.question}</td><td>1</td>
                <td className="adm-muted">{fmtTime(e.created_at)}</td><td /></tr>
            ))}
          </tbody>
        </table>
      )}
      {open && (
        <Modal title={`${open.learner} · ${open.title}`} onClose={() => setOpen(null)}>
          {open.messages.map((m, i) => <div key={i} className={`adm-msg ${m.role}`}>{m.content}</div>)}
        </Modal>
      )}
    </>
  );
}

function Refusals() {
  const { data, error, loading } = useLoad(() => get<{ items: AgentEvent[] }>('/agent/refusals'));
  const [cat, setCat] = useState('');
  if (loading && !data) return <Loading />;
  const items = (data?.items || []).filter((e) => !cat || e.category === cat);
  const cats = Array.from(new Set((data?.items || []).map((e) => e.category)));
  return (
    <>
      <Alert message={error} />
      <div className="adm-filters">
        <select className="adm-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="拒答类型">
          <option value="">全部类型</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {items.length === 0 ? <Empty icon="🛡️" title="暂无拒答记录" hint="课程 Agent 拒绝离题 / 注入 / 不安全问题时会记录在这里（已脱敏）。" /> : (
        <table className="adm-table"><thead><tr><th>时间</th><th>类型</th><th>问题（脱敏）</th><th>回复</th></tr></thead>
          <tbody>{items.map((e) => <tr key={e.event_id}><td className="adm-muted">{fmtTime(e.created_at)}</td><td><span className="adm-tag warn">{e.category}</span></td><td>{e.question}</td><td className="adm-muted">{e.answer}</td></tr>)}</tbody></table>
      )}
    </>
  );
}

const blankFaq = { question: '', answer: '', tags: [] as string[], course_slug: 'first-lesson', enabled: true };

function FaqTab({ editable }: { editable: boolean }) {
  const { data, error, loading, reload } = useLoad(() => get<{ items: Faq[] }>('/agent/faq'));
  const [edit, setEdit] = useState<(typeof blankFaq & { id?: number }) | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!edit) return;
    try {
      const { id, ...body } = edit;
      if (id) await put(`/agent/faq/${id}`, body); else await post('/agent/faq', body);
      setEdit(null); setErr(null); await reload();
    } catch (e) { setErr(errText(e).message); }
  };
  const remove = async (f: Faq) => {
    if (!window.confirm(`删除 FAQ「${f.question}」？`)) return;
    try { await del(`/agent/faq/${f.id}`); await reload(); } catch (e) { setErr(errText(e).message); }
  };
  const toggle = async (f: Faq) => {
    try { await put(`/agent/faq/${f.id}`, { question: f.question, answer: f.answer, tags: f.tags, course_slug: f.course_slug, enabled: !f.enabled }); await reload(); }
    catch (e) { setErr(errText(e).message); }
  };
  if (loading && !data) return <Loading />;
  const items = (data?.items || []).filter((f) => !q || f.question.includes(q) || f.answer.includes(q) || f.tags.some((t) => t.includes(q)));
  return (
    <>
      <Alert message={error || (edit ? null : err)} onClose={() => setErr(null)} />
      <div className="adm-filters">
        <input className="adm-input" placeholder="搜索问题 / 答案 / 标签" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索FAQ" />
        <span style={{ flex: 1 }} />
        {editable && <button className="adm-btn accent" onClick={() => { setErr(null); setEdit({ ...blankFaq }); }}>+ 新增 FAQ</button>}
      </div>
      {items.length === 0 ? <Empty icon="📖" title="FAQ 为空" /> : (
        <table className="adm-table"><thead><tr><th>问题</th><th>答案</th><th>标签</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>{items.map((f) => (
            <tr key={f.id}><td><b>{f.question}</b></td><td>{f.answer}</td><td>{f.tags.map((t) => <span key={t} className="adm-tag">{t}</span>)}</td>
              <td>{f.enabled ? <span className="adm-tag ok">启用</span> : <span className="adm-tag">停用</span>}</td>
              <td>{editable && <div className="adm-btns">
                <button className="adm-btn" onClick={() => { setErr(null); setEdit({ id: f.id, question: f.question, answer: f.answer, tags: f.tags, course_slug: f.course_slug, enabled: f.enabled }); }}>编辑</button>
                <button className="adm-btn" onClick={() => toggle(f)}>{f.enabled ? '停用' : '启用'}</button>
                <button className="adm-btn danger" onClick={() => remove(f)}>删除</button></div>}</td></tr>
          ))}</tbody></table>
      )}
      {edit && (
        <Modal title={edit.id ? '编辑 FAQ' : '新增 FAQ'} onClose={() => setEdit(null)}>
          <Alert message={err} />
          <div className="adm-form">
            <label htmlFor="faq-q">问题</label><input id="faq-q" className="adm-input" value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />
            <label htmlFor="faq-a">答案</label><textarea id="faq-a" className="adm-textarea" rows={4} value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} />
            <label>标签</label><ChipInput label="添加标签" value={edit.tags} onChange={(tags) => setEdit({ ...edit, tags })} placeholder="回车添加" />
            <label htmlFor="faq-c">课程</label><input id="faq-c" className="adm-input" value={edit.course_slug} onChange={(e) => setEdit({ ...edit, course_slug: e.target.value })} />
            <label htmlFor="faq-e">启用</label><input id="faq-e" type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />
          </div>
          <div className="adm-btns" style={{ marginTop: 12 }}><button className="adm-btn primary" onClick={save}>保存</button><button className="adm-btn" onClick={() => setEdit(null)}>取消</button></div>
        </Modal>
      )}
    </>
  );
}

function GuardTab({ editable }: { editable: boolean }) {
  const { data, error, loading, reload } = useLoad(() => get<{ lists: Record<string, string[]> }>('/agent/guard'));
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [test, setTest] = useState('');
  const [verdict, setVerdict] = useState<{ verdict: string; allowed: boolean; pii: boolean; redacted: string; hits: Record<string, string[]> } | null>(null);
  // 列表数据（重新）加载后，用它重置草稿（渲染期调整，不用 effect）
  const [draftSrc, setDraftSrc] = useState(data);
  if (data !== draftSrc) { setDraftSrc(data); if (data) setDrafts(data.lists); }
  const save = async (name: string) => {
    try { await put(`/agent/guard/${name}`, { keywords: drafts[name] || [] }); setMsg({ kind: 'ok', text: `已保存「${LIST_LABEL[name]}」` }); await reload(); }
    catch (e) { setMsg({ kind: 'err', text: errText(e).message }); }
  };
  const runTest = async () => {
    if (!test.trim()) return;
    try { setVerdict(await post('/agent/guard/test', { message: test })); } catch (e) { setMsg({ kind: 'err', text: errText(e).message }); }
  };
  if (loading && !data) return <Loading />;
  return (
    <>
      <Alert message={error} />
      {msg && <Alert kind={msg.kind} message={msg.text} onClose={() => setMsg(null)} />}
      <div className="adm-card" style={{ marginBottom: 14 }}>
        <h2>试一试</h2>
        <div className="adm-btns">
          <input className="adm-input" style={{ flex: 1 }} placeholder="输入一句学生可能会问的话" value={test} onChange={(e) => setTest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runTest()} aria-label="测试消息" />
          <button className="adm-btn primary" onClick={runTest}>检测</button>
        </div>
        {verdict && (
          <p>结果：{verdict.allowed ? <span className="adm-tag ok">放行（课程问题）</span> : <span className="adm-tag err">拒答：{verdict.verdict}</span>}
            {verdict.pii && <span className="adm-tag warn">含个人信息</span>}
            <span className="adm-muted"> 命中：{Object.entries(verdict.hits).filter(([, v]) => v.length).map(([k, v]) => `${k}=${v.join('/')}`).join('；') || '无'}</span></p>
        )}
      </div>
      <div className="adm-grid two">
        {Object.keys(LIST_LABEL).map((name) => (
          <div key={name} className="adm-card" style={{ marginTop: 0 }}>
            <h2>{LIST_LABEL[name]} <span className="adm-btns"><span className="adm-muted">{(drafts[name] || []).length} 条</span>
              {editable && <button className="adm-btn primary" onClick={() => save(name)}>保存</button>}</span></h2>
            <ChipInput label={`添加到${LIST_LABEL[name]}`} value={drafts[name] || []} disabled={!editable} onChange={(v) => setDrafts({ ...drafts, [name]: v })} placeholder="输入后回车" />
          </div>
        ))}
      </div>
      <p className="adm-muted">说明：这些列表从当前课程 Agent 的内置规则初始化。修改后可用「试一试」验证；接入线上 Agent 见 DELIVERY 第十节差距说明。</p>
    </>
  );
}

function Providers() {
  const { data, error, loading, reload } = useLoad(() => get<{ items: Provider[]; mode: string }>('/agent/providers'));
  if (loading && !data) return <Loading />;
  const MODE: Record<string, string> = { online: '在线（LLM）', offline: '离线（FAQ 兜底）', disabled: '已关闭' };
  return (
    <>
      <Alert message={error} />
      <p>当前模式：<span className="adm-tag">{MODE[data?.mode || ''] || data?.mode}</span> <button className="adm-btn" onClick={reload}>刷新</button></p>
      <table className="adm-table"><thead><tr><th>服务商</th><th>密钥</th><th>环境变量</th><th>模型</th></tr></thead>
        <tbody>{(data?.items || []).map((p) => (
          <tr key={p.id}><td>{p.label}</td><td>{p.key_configured ? <span className="adm-tag ok">已配置</span> : <span className="adm-tag warn">未配置</span>}</td>
            <td><code>{p.key_env}</code></td><td>{p.model || '—'}</td></tr>
        ))}</tbody></table>
      <p className="adm-muted">🔒 只显示是否已配置，从不返回密钥内容。修改密钥请在服务器环境变量中设置。</p>
    </>
  );
}

export function AgentPage() {
  const me = useAdminMe();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'logs';
  const editable = canEdit(me?.role);
  return (
    <section className="adm-card">
      <div className="adm-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`adm-tab${tab === k ? ' active' : ''}`} onClick={() => setParams({ tab: k })}>{label}</button>
        ))}
      </div>
      {tab === 'logs' && <Logs />}
      {tab === 'refusals' && <Refusals />}
      {tab === 'faq' && <FaqTab editable={editable} />}
      {tab === 'guard' && <GuardTab editable={editable} />}
      {tab === 'providers' && <Providers />}
    </section>
  );
}

export default AgentPage;
