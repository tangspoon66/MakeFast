import { useMemo, useState, type ChangeEvent } from 'react';
import { canEdit, del, fmtTime, get, post, put, type CoursePack, type QuizItem } from './api';
import { Alert, ChipInput, Empty, Loading, Modal } from '../../components/admin/ui';
import { errText, useLoad } from '../../components/admin/uiHooks';
import { useAdminMe } from '../../components/admin/AdminConsoleContext';

const LEVELS: CoursePack['level'][] = ['入门', '进阶', '熟练', '高级'];
const SKILLS = ['电子与接线', '编程逻辑', '传感器', '调试排错', '原理理解'];

const blankCourse = (): CoursePack => ({
  slug: '', title: '', level: '入门', summary: '', skills: [], prerequisites: [], cover: '', duration_min: 45,
  board_id: 'xiao-esp32-s3', steps: [], quiz: [], resources: [],
});

function stripMeta(c: CoursePack): CoursePack {
  const { slug, title, level, summary, skills, prerequisites, cover, duration_min, board_id, steps, quiz, resources, article } = c;
  return { slug, title, level, summary, skills, prerequisites, cover, duration_min, board_id, steps, quiz, resources: resources || [], article: article || undefined };
}

export function CoursePreview({ course }: { course: CoursePack }) {
  return (
    <div className="adm-preview" aria-label="课程预览">
      <div className="cover">{course.cover ? <img src={course.cover} alt={course.title} /> : '📘'}</div>
      <h3 style={{ margin: '10px 0 4px' }}>{course.title || '（未命名课程）'}</h3>
      <div className="adm-btns"><span className="adm-tag">{course.level}</span><span className="adm-tag">{course.duration_min} 分钟</span>
        {course.skills.map((s) => <span key={s} className="adm-tag ok">{s}</span>)}</div>
      <p className="adm-muted">{course.summary || '暂无简介'}</p>
      {course.prerequisites.length > 0 && <p>先修：{course.prerequisites.join('、')}</p>}
      <b>步骤（{course.steps.length}）</b>
      <ol style={{ margin: '4px 0 8px 18px', padding: 0 }}>{course.steps.map((s) => <li key={s.id}>{s.title}{s.why && <span className="adm-muted"> — {s.why}</span>}</li>)}</ol>
      <b>课后测验（{course.quiz.length}）</b>
      <ol style={{ margin: '4px 0 0 18px', padding: 0 }}>{course.quiz.map((q) => (
        <li key={q.id}>{q.prompt}<div className="adm-muted">{q.choices.map((c, i) => (i === q.answer_index ? `✔ ${c}` : c)).join(' ｜ ')}</div></li>
      ))}</ol>
    </div>
  );
}

export function CourseEditor({ initial, isNew, allSlugs, onSaved, onCancel }: {
  initial: CoursePack; isNew: boolean; allSlugs: string[]; onSaved: (c: CoursePack) => void; onCancel: () => void;
}) {
  const [c, setC] = useState<CoursePack>(initial);
  const [err, setErr] = useState<{ message: string; errors: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof CoursePack>(k: K, v: CoursePack[K]) => setC((p) => ({ ...p, [k]: v }));
  const setQuiz = (i: number, q: Partial<QuizItem>) => set('quiz', c.quiz.map((x, j) => (j === i ? { ...x, ...q } : x)));
  const uploadRes = async (e: ChangeEvent<HTMLInputElement>, kind: 'pdf' | 'stl') => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f || isNew) { setErr({ message: '请先保存课程再上传资料', errors: [] }); return; }
    const q = new URLSearchParams({ kind, name: f.name });
    const fd = new FormData(); fd.append('file', f);
    try {
      const r = await fetch(`/api/admin/console/courses/${encodeURIComponent(c.slug)}/resources/upload?${q}`, { method: 'POST', body: fd, credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail?.message || j?.message || '上传失败');
      set('resources', j.resources || []);
    } catch (err) { setErr(errText(err)); }
  };
  const removeRes = async (rid: string) => {
    if (isNew) return;
    try {
      const r = await fetch(`/api/admin/console/courses/${encodeURIComponent(c.slug)}/resources/${encodeURIComponent(rid)}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail?.message || '删除失败');
      set('resources', j.resources || []);
    } catch (err) { setErr(errText(err)); }
  };


  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = isNew
        ? await post<CoursePack>('/courses', stripMeta(c))
        : await put<CoursePack>(`/courses/${c.slug}`, { revision: initial.revision, course: stripMeta(c) });
      onSaved(saved);
    } catch (e) { setErr(errText(e)); } finally { setSaving(false); }
  };

  return (
    <div className="adm-split">
      <div>
        {err && <Alert message={err.message} errors={err.errors} onClose={() => setErr(null)} />}
        <div className="adm-form">
          <label htmlFor="c-slug">课程标识</label>
          <input id="c-slug" className="adm-input" value={c.slug} disabled={!isNew} placeholder="如 led-blink（小写字母/数字/-）" onChange={(e) => set('slug', e.target.value)} />
          <label htmlFor="c-title">标题</label>
          <input id="c-title" className="adm-input" value={c.title} onChange={(e) => set('title', e.target.value)} />
          <label htmlFor="c-level">等级</label>
          <select id="c-level" className="adm-select" value={c.level} onChange={(e) => set('level', e.target.value as CoursePack['level'])}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <label htmlFor="c-dur">时长（分钟）</label>
          <input id="c-dur" type="number" className="adm-input" value={c.duration_min} min={5} max={600} onChange={(e) => set('duration_min', Number(e.target.value))} />
          <label htmlFor="c-cover">封面图 URL</label>
          <input id="c-cover" className="adm-input" value={c.cover} placeholder="/boards/xiao-esp32-s3/cover.webp" onChange={(e) => set('cover', e.target.value)} />
          <label htmlFor="c-sum">简介</label>
          <textarea id="c-sum" className="adm-textarea" rows={2} value={c.summary} onChange={(e) => set('summary', e.target.value)} />
          <label>教授技能</label>
          <div>
            <ChipInput label="添加技能" value={c.skills} onChange={(v) => set('skills', v)} placeholder="回车添加" />
            <div className="adm-btns" style={{ marginTop: 4 }}>{SKILLS.filter((s) => !c.skills.includes(s)).map((s) => (
              <button key={s} type="button" className="adm-btn" onClick={() => set('skills', [...c.skills, s])}>+ {s}</button>))}</div>
          </div>
          <label htmlFor="c-pre">先修课程</label>
          <select id="c-pre" className="adm-select" value="" onChange={(e) => e.target.value && set('prerequisites', [...c.prerequisites, e.target.value])}>
            <option value="">{c.prerequisites.length ? `已选 ${c.prerequisites.join('、')} — 继续添加…` : '选择先修课程…'}</option>
            {allSlugs.filter((s) => s !== c.slug && !c.prerequisites.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {c.prerequisites.length > 0 && <><span /><div className="adm-btns">{c.prerequisites.map((p) => (
            <button key={p} type="button" className="adm-btn" onClick={() => set('prerequisites', c.prerequisites.filter((x) => x !== p))}>{p} ×</button>))}</div></>}
        </div>

        <h4>步骤 <button type="button" className="adm-btn" onClick={() => set('steps', [...c.steps, { id: `step-${c.steps.length + 1}`, title: '', why: '' }])}>+ 添加步骤</button></h4>
        {c.steps.length === 0 && <p className="adm-muted">还没有步骤。发布前至少需要 1 个。</p>}
        {c.steps.map((s, i) => (
          <div key={i} className="adm-btns" style={{ marginBottom: 6 }}>
            <span className="adm-muted">{i + 1}.</span>
            <input aria-label={`步骤${i + 1}ID`} className="adm-input" style={{ width: 90 }} value={s.id} onChange={(e) => set('steps', c.steps.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))} />
            <input aria-label={`步骤${i + 1}标题`} className="adm-input" style={{ flex: 1 }} placeholder="标题" value={s.title} onChange={(e) => set('steps', c.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <input aria-label={`步骤${i + 1}为什么`} className="adm-input" style={{ flex: 1 }} placeholder="为什么" value={s.why} onChange={(e) => set('steps', c.steps.map((x, j) => (j === i ? { ...x, why: e.target.value } : x)))} />
            <button type="button" className="adm-btn" disabled={i === 0} aria-label="上移" onClick={() => { const a = [...c.steps]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set('steps', a); }}>↑</button>
            <button type="button" className="adm-btn danger" aria-label="删除步骤" onClick={() => set('steps', c.steps.filter((_, j) => j !== i))}>删除</button>
          </div>
        ))}

        <h4>测验题 <button type="button" className="adm-btn" onClick={() => set('quiz', [...c.quiz, { id: `q-${c.quiz.length + 1}`, prompt: '', choices: ['', ''], answer_index: 0, explain: '' }])}>+ 添加题目</button></h4>
        {c.quiz.map((q, i) => (
          <div key={i} className="adm-card" style={{ padding: 10, marginBottom: 8 }}>
            <div className="adm-btns">
              <input aria-label={`题目${i + 1}ID`} className="adm-input" style={{ width: 110 }} value={q.id} onChange={(e) => setQuiz(i, { id: e.target.value })} />
              <input aria-label={`题目${i + 1}题干`} className="adm-input" style={{ flex: 1 }} placeholder="题干" value={q.prompt} onChange={(e) => setQuiz(i, { prompt: e.target.value })} />
              <button type="button" className="adm-btn danger" onClick={() => set('quiz', c.quiz.filter((_, j) => j !== i))}>删除题目</button>
            </div>
            {q.choices.map((ch, k) => (
              <div key={k} className="adm-btns" style={{ marginTop: 4 }}>
                <label><input type="radio" name={`ans-${i}`} checked={q.answer_index === k} onChange={() => setQuiz(i, { answer_index: k })} /> 正确</label>
                <input aria-label={`题目${i + 1}选项${k + 1}`} className="adm-input" style={{ flex: 1 }} value={ch} onChange={(e) => setQuiz(i, { choices: q.choices.map((x, m) => (m === k ? e.target.value : x)) })} />
                <button type="button" className="adm-btn" disabled={q.choices.length <= 2} onClick={() => setQuiz(i, { choices: q.choices.filter((_, m) => m !== k), answer_index: Math.max(0, q.answer_index >= k ? q.answer_index - (q.answer_index > k ? 1 : 0) : q.answer_index) })}>−</button>
              </div>
            ))}
            <div className="adm-btns" style={{ marginTop: 4 }}>
              <button type="button" className="adm-btn" disabled={q.choices.length >= 6} onClick={() => setQuiz(i, { choices: [...q.choices, ''] })}>+ 选项</button>
              <input aria-label={`题目${i + 1}解析`} className="adm-input" style={{ flex: 1 }} placeholder="解析" value={q.explain} onChange={(e) => setQuiz(i, { explain: e.target.value })} />
            </div>
          </div>
        ))}
        <div className="adm-btns" style={{ marginTop: 12 }}>
          <button className="adm-btn primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
          <button className="adm-btn" onClick={onCancel}>取消</button>
        </div>
      </div>
      
      <div className="adm-card" style={{ marginTop: 12 }} data-testid="course-resources-admin">
        <h4>课程资料（PDF / STL）</h4>
        <p className="adm-muted">上传后会出现在学生课文章节页的「资料下载」。仅支持 pdf、stl，≤25MB。</p>
        <ul>{(c.resources || []).map((r) => (
          <li key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span className="adm-tag">{r.kind}</span>
            <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
            <button type="button" className="adm-btn danger" onClick={() => void removeRes(r.id)}>删除</button>
          </li>
        ))}</ul>
        <div className="adm-btns" style={{ marginTop: 8 }}>
          <label className="adm-btn">
            上传 PDF
            <input hidden type="file" accept=".pdf,application/pdf" data-testid="course-resource-upload" onChange={(e) => void uploadRes(e, 'pdf')} />
          </label>
          <label className="adm-btn">
            上传 STL
            <input hidden type="file" accept=".stl,model/stl" onChange={(e) => void uploadRes(e, 'stl')} />
          </label>
        </div>
      </div>

<CoursePreview course={c} />
    </div>
  );
}

export function CoursesPage() {
  const me = useAdminMe();
  const editable = canEdit(me?.role);
  const { data, error, loading, reload } = useLoad(() => get<{ items: CoursePack[] }>('/courses'));
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [level, setLevel] = useState('');
  const [editing, setEditing] = useState<{ course: CoursePack; isNew: boolean } | null>(null);
  const [preview, setPreview] = useState<CoursePack | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const items = useMemo(() => (data?.items || []).filter((c) =>
    (!q || c.title.includes(q) || c.slug.includes(q)) && (!status || c.status === status) && (!level || c.level === level)), [data, q, status, level]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ kind: 'ok', text: ok }); await reload(); } catch (e) { setMsg({ kind: 'err', text: errText(e).message }); }
  };

  if (loading && !data) return <Loading />;
  return (
    <section className="adm-card">
      <Alert message={error} />
      {msg && <Alert kind={msg.kind} message={msg.text} onClose={() => setMsg(null)} />}
      <div className="adm-filters">
        <input className="adm-input" placeholder="搜索标题 / 标识" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索课程" />
        <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="状态筛选">
          <option value="">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select>
        <select className="adm-select" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="等级筛选">
          <option value="">全部等级</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        <span style={{ flex: 1 }} />
        {editable && <button className="adm-btn accent" onClick={() => setEditing({ course: blankCourse(), isNew: true })}>+ 新建课程</button>}
      </div>
      {items.length === 0 ? <Empty icon="📚" title="没有符合条件的课程" /> : (
        <table className="adm-table">
          <thead><tr><th>课程</th><th>等级</th><th>技能</th><th>先修</th><th>步骤/测验</th><th>状态</th><th>更新</th><th>操作</th></tr></thead>
          <tbody>{items.map((c) => (
            <tr key={c.slug}>
              <td><b>{c.title}</b><div className="adm-muted">{c.slug}</div></td>
              <td>{c.level}</td>
              <td>{c.skills.map((s) => <span key={s} className="adm-tag">{s}</span>)}</td>
              <td>{c.prerequisites.join('、') || '—'}</td>
              <td>{c.steps.length} / {c.quiz.length}</td>
              <td>{c.status === 'published' ? <span className="adm-tag ok">已发布</span> : <span className="adm-tag warn">草稿</span>}</td>
              <td className="adm-muted">{fmtTime(c.updated_at)}<div>r{c.revision} · {c.updated_by}</div></td>
              <td><div className="adm-btns">
                <button className="adm-btn" onClick={() => setPreview(c)}>预览</button>
                {editable && <button className="adm-btn" onClick={() => setEditing({ course: c, isNew: false })}>编辑</button>}
                <a className="adm-btn" href={`/admin/articles?slug=${encodeURIComponent(c.slug)}`} data-testid="open-article-editor">文章</a>
                {editable && (c.status === 'published'
                  ? <button className="adm-btn" onClick={() => act(() => post(`/courses/${c.slug}/unpublish`), `已下架「${c.title}」`)}>下架</button>
                  : <button className="adm-btn primary" onClick={() => act(() => post(`/courses/${c.slug}/publish`), `已发布「${c.title}」`)}>发布</button>)}
                {me?.role === 'admin' && c.status === 'draft' && (
                  <button className="adm-btn danger" onClick={() => { if (window.confirm(`删除草稿课程「${c.title}」？`)) void act(() => del(`/courses/${c.slug}`), '已删除'); }}>删除</button>)}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {editing && (
        <Modal title={editing.isNew ? '新建课程' : `编辑课程：${editing.course.title}`} onClose={() => setEditing(null)}>
          <CourseEditor initial={editing.course} isNew={editing.isNew} allSlugs={(data?.items || []).map((c) => c.slug)}
            onCancel={() => setEditing(null)}
            onSaved={(c) => { setEditing(null); setMsg({ kind: 'ok', text: `已保存「${c.title}」` }); void reload(); }} />
        </Modal>
      )}
      {preview && <Modal title="学生端预览" onClose={() => setPreview(null)}><CoursePreview course={preview} /></Modal>}
    </section>
  );
}

export default CoursesPage;
