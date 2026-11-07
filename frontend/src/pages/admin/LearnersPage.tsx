import { useState } from 'react';
import { fmtTime, get, type LearnerDetail, type LearnerRow } from './api';
import { Alert, Empty, Loading } from '../../components/admin/ui';
import { useLoad } from '../../components/admin/uiHooks';

const EVENT_LABEL: Record<string, string> = {
  materials_confirmed: '确认材料', wiring_confirmed: '确认接线', blocks_saved: '保存积木', code_saved: '保存代码',
  compile_succeeded: '编译成功', flash_succeeded: '烧录成功', serial_verified: '串口读数', challenge_completed: '完成挑战',
  quiz_passed: '测验通过', course_completed: '完成课程',
};

export function LearnersPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const { data, error, loading } = useLoad(() => get<{ items: LearnerRow[] }>(`/learners?q=${encodeURIComponent(query)}`), [query]);
  const [selId, setSelId] = useState<string | null>(null);
  const detail = useLoad(() => (selId ? get<LearnerDetail>(`/learners/${selId}`) : Promise.resolve(null)), [selId]);
  const items = (data?.items || []).filter((l) => !stage || l.stage === stage);

  return (
    <div className="adm-split">
      <section className="adm-card">
        <Alert message={error} />
        <form className="adm-filters" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
          <input className="adm-input" placeholder="用户名 / 昵称" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索学习者" />
          <button className="adm-btn primary" type="submit">搜索</button>
          <select className="adm-select" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="阶段筛选">
            <option value="">全部阶段</option>{['入门', '进阶', '熟练', '高级'].map((s) => <option key={s}>{s}</option>)}</select>
        </form>
        {loading && !data ? <Loading /> : items.length === 0 ? (
          <Empty icon="🧒" title="还没有学习者" hint="学生在 /register 注册后会出现在这里。" />
        ) : (
          <table className="adm-table">
            <thead><tr><th>学习者</th><th>阶段</th><th>积分</th><th>进度</th><th>最近活跃</th></tr></thead>
            <tbody>{items.map((l) => (
              <tr key={l.id} className={`click${selId === l.id ? ' sel' : ''}`} onClick={() => setSelId(l.id)}>
                <td><b>{l.display_name}</b><div className="adm-muted">{l.username}</div></td>
                <td><span className="adm-tag">{l.stage}</span></td>
                <td>{l.points}</td>
                <td>{l.completed ? <span className="adm-tag ok">已完课</span> : <span className="adm-tag warn">{l.event_count} 个事件</span>}
                  {l.quiz_passed && <span className="adm-tag ok">测验✓</span>}</td>
                <td className="adm-muted">{fmtTime(l.last_active)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <section className="adm-card">
        {!selId ? <Empty icon="👈" title="选择一位学习者查看详情" /> : detail.loading && !detail.data ? <Loading /> : detail.data ? (
          <>
            <h2>{detail.data.display_name} <span className="adm-muted">@{detail.data.username}</span></h2>
            <div className="adm-btns" style={{ marginBottom: 10 }}>
              <span className="adm-tag">阶段：{detail.data.stage}</span><span className="adm-tag">积分 {detail.data.points}</span>
              <span className="adm-tag">注册 {fmtTime(detail.data.created_at)}</span>
              {detail.data.completed && <span className="adm-tag ok">已完成第一课</span>}
            </div>
            <b>技能画像</b>
            <table className="adm-table" style={{ margin: '6px 0 12px' }}><tbody>
              {Object.entries(detail.data.skills).map(([k, v]) => (
                <tr key={k}><td style={{ width: 100 }}>{k}</td><td><div className="adm-bar"><span style={{ width: `${v * 100}%` }} /></div></td><td style={{ width: 50 }}>{Math.round(v * 100)}</td></tr>
              ))}
            </tbody></table>
            <b>测验记录</b>
            {detail.data.quiz_history.length === 0 ? <p className="adm-muted">暂无测验记录</p> : (
              <ul>{detail.data.quiz_history.map((q) => <li key={q.event_key}>通过 · {fmtTime(q.created_at)}</li>)}</ul>
            )}
            {detail.data.quiz_timings && detail.data.quiz_timings.length > 0 && (
              <><b>每题用时</b><ul>{detail.data.quiz_timings.map((t, i) => (
                <li key={i}>{fmtTime(t.created_at)} · {t.passed ? '通过' : '未通过'} · {t.items.map((it) => `${it.question_id} ${it.correct ? '✓' : '✗'} ${(it.ms / 1000).toFixed(1)}s`).join('，')}</li>
              ))}</ul></>
            )}
            {detail.data.compile_errors && detail.data.compile_errors.length > 0 && (
              <><b>编译报错</b><ul>{detail.data.compile_errors.slice(0, 10).map((e, i) => <li key={i}><code>{e.error_text}</code> <span className="adm-muted">{fmtTime(e.created_at)}</span></li>)}</ul></>
            )}
            {detail.data.lesson_profile && (
              <div data-testid="adm-lesson-profile"><b>学习者画像（课程端同步）</b>
                <p className="adm-muted">年龄档：{({ low: '小学', mid: '初中', high: '高中及以上' } as Record<string, string>)[detail.data.lesson_profile.age_tier ?? ''] ?? '未选'} · 阶段：{String((detail.data.lesson_profile.profile as { stage?: string } | null)?.stage ?? '—')} · 事件 {detail.data.lesson_profile.event_count} 条 · 测验 {detail.data.lesson_profile.quiz_attempts} 次 · 更新于 {fmtTime(detail.data.lesson_profile.updated_at)}</p>
                {Object.keys(detail.data.lesson_profile.difficulties).length > 0 && <div className="adm-btns">{Object.entries(detail.data.lesson_profile.difficulties).map(([k, n]) => <span key={k} className="adm-tag warn">{k} · {n}</span>)}</div>}
              </div>
            )}
            {detail.data.lesson_sessions && detail.data.lesson_sessions.length > 0 && (
              <><b>课程会话</b><table className="adm-table"><thead><tr><th>课程</th><th>步骤</th><th>主线</th><th>测验</th><th>更新</th></tr></thead>
                <tbody>{detail.data.lesson_sessions.map((x) => <tr key={x.session_id}><td>{x.course_id}</td><td>{x.step_index + 1}</td><td>{x.mainline_completed ? '✓ 完成' : '进行中'}</td><td>{x.quiz_passed === null ? '—' : x.quiz_passed ? '通过' : '未通过'}</td><td className="adm-muted">{fmtTime(x.updated_at)}</td></tr>)}</tbody></table></>
            )}
            <b>学习进度</b>
            {detail.data.events.length === 0 ? <p className="adm-muted">还没有进度事件</p> : (
              <table className="adm-table"><thead><tr><th>事件</th><th>积分</th><th>时间</th></tr></thead>
                <tbody>{detail.data.events.map((e) => <tr key={e.event_key}><td>{EVENT_LABEL[e.event_type] || e.event_type}</td><td>+{e.points}</td><td className="adm-muted">{fmtTime(e.created_at)}</td></tr>)}</tbody></table>
            )}
            {detail.data.projects.length > 0 && <><b>项目</b><ul>{detail.data.projects.map((p, i) => <li key={i}>{p.title || p.project_id}</li>)}</ul></>}
          </>
        ) : <Alert message={detail.error} />}
      </section>
    </div>
  );
}

export default LearnersPage;
