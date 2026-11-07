import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, Save, Send } from 'lucide-react';
import { AdminClient } from '../api/adminClient';

/** Small, explicit editor for the versioned course schema. Rich form controls
 * belong in the later course-generation skill; this keeps JSON reviewable. */
export function AdminLearningCourseEditor() {
  const [slug, setSlug] = useState('temperature-alert');
  const [revision, setRevision] = useState(1);
  const [json, setJson] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  const load = async () => {
    setBusy(true); setStatus(null); setErrors([]);
    try {
      const draft = await AdminClient.getLearningCourseDraft(slug);
      setRevision(draft.revision); setJson(JSON.stringify(draft.content, null, 2));
    } catch (error) {
      const typed = error as Error & { statusCode?: number };
      setCreateMode(typed.statusCode === 404);
      setStatus(typed.statusCode === 404 ? '还没有这个课程草稿。粘贴一份 CourseDefinition JSON 后可以创建。' : (error instanceof Error ? error.message : '读取失败'));
    }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setBusy(true); setStatus(null); setErrors([]);
    try {
      const content = JSON.parse(json);
      const saved = createMode
        ? await AdminClient.createLearningCourseDraft(content)
        : await AdminClient.saveLearningCourseDraft(slug, revision, content);
      setRevision(saved.revision); setJson(JSON.stringify(saved.content, null, 2)); setStatus('草稿已保存');
      setCreateMode(false);
    } catch (error) { setStatus(error instanceof SyntaxError ? 'JSON 格式有误，请先修正。' : (error instanceof Error ? error.message : '保存失败')); }
    finally { setBusy(false); }
  };
  const validate = async () => {
    setBusy(true); setStatus(null);
    try { const result = await AdminClient.validateLearningCourse(slug); setErrors(result.errors); setStatus(result.valid ? '校验通过，可以发布。' : '校验未通过，请处理下方问题。'); }
    catch (error) { setStatus(error instanceof Error ? error.message : '校验失败'); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    setBusy(true); setStatus(null);
    try { const result = await AdminClient.publishLearningCourse(slug, revision); setStatus(`已发布版本 ${result.version}`); }
    catch (error) { setStatus(error instanceof Error ? error.message : '发布失败'); }
    finally { setBusy(false); }
  };

  return <main className="admin-course-editor" aria-labelledby="admin-course-title">
    <header className="admin-course-editor__header"><div><span className="admin-course-editor__eyebrow"><FileJson size={15} /> BMAD 课程 schema</span><h1 id="admin-course-title">课程编辑与发布</h1><p>先保存草稿，再校验；图片、引脚和接线未核验时，发布会被系统拦截。</p></div><label>课程 ID<input value={slug} onChange={event => setSlug(event.target.value)} disabled={busy} /></label></header>
    <section className="admin-course-editor__toolbar"><span>{createMode ? '新建草稿' : `草稿版本 ${revision}`}</span><button type="button" onClick={() => void load()} disabled={busy}>重新载入</button><button type="button" onClick={() => void save()} disabled={busy}><Save size={16} /> {createMode ? '创建草稿' : '保存草稿'}</button><button type="button" onClick={() => void validate()} disabled={busy || createMode}><CheckCircle2 size={16} /> 校验</button><button type="button" onClick={() => void publish()} disabled={busy || createMode}><Send size={16} /> 发布版本</button></section>
    <textarea className="admin-course-editor__json" value={json} onChange={event => setJson(event.target.value)} spellCheck={false} aria-label="课程 JSON" />
    {status && <p className="admin-course-editor__status" role="status">{status}</p>}
    {errors.length > 0 && <section className="admin-course-editor__errors" aria-label="课程校验错误"><h2><AlertTriangle size={17} /> 需要处理的问题</h2><ul>{errors.map((item, index) => <li key={`${item.field}-${index}`}><code>{item.field}</code>{item.message}</li>)}</ul></section>}
  </main>;
}
