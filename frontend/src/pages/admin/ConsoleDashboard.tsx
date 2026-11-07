import { Link } from 'react-router-dom';
import { get, pct, type Dashboard } from './api';
import { Alert, Empty, Loading, Stat } from '../../components/admin/ui';
import { useLoad } from '../../components/admin/uiHooks';

const FUNNEL: [string, string][] = [
  ['compile_succeeded', '编译成功'], ['flash_succeeded', '烧录成功'], ['serial_verified', '看到串口读数'],
  ['quiz_passed', '测验通过'], ['course_completed', '完成课程'],
];

export function ConsoleDashboard() {
  const { data, error, loading, reload } = useLoad(() => get<Dashboard>('/dashboard'));
  if (loading && !data) return <Loading />;
  return (
    <div>
      <Alert message={error} />
      {data && (
        <>
          <div className="adm-grid stats">
            <Stat label="学习者总数" value={data.learner_count} hint={`${data.started_learners} 人已开始学习`} />
            <Stat label="活跃会话" value={data.active_sessions} hint="未过期的登录会话" />
            <Stat label="课程完成率" value={pct(data.completion_rate)} hint="完成课程 / 已开始" accent />
            <Stat label="测验通过率" value={pct(data.quiz_pass_rate)} hint="通过 / 到达测验" accent />
            <Stat label="Agent 提问" value={data.agent_messages} hint={`${data.agent_conversations} 个会话`} />
            <Stat label="Agent 拒答" value={data.agent_refusals} hint="离题 / 注入 / 不安全" />
          </div>
          <div className="adm-grid two">
            <section className="adm-card">
              <h2>学习漏斗 <button className="adm-btn" onClick={reload}>刷新</button></h2>
              {data.started_learners === 0 ? (
                <Empty icon="🌱" title="还没有学习数据" hint="学生登录并完成第一课步骤后，这里会显示漏斗。" />
              ) : (
                <table className="adm-table"><tbody>
                  {FUNNEL.map(([k, label]) => {
                    const n = data.event_funnel[k] || 0;
                    const r = data.started_learners ? n / data.started_learners : 0;
                    return (
                      <tr key={k}><td style={{ width: 110 }}>{label}</td>
                        <td><div className="adm-bar"><span style={{ width: `${r * 100}%` }} /></div></td>
                        <td style={{ width: 70, textAlign: 'right' }}>{n} 人</td></tr>
                    );
                  })}
                </tbody></table>
              )}
            </section>
            <section className="adm-card">
              <h2>常见错误 <Link className="adm-btn" to="/admin/agent?tab=refusals">查看拒答日志</Link></h2>
              {data.common_errors.length === 0 ? (
                <Empty icon="✅" title="暂无错误记录" hint="编译/烧录失败与 Agent 拒答会汇总在这里。" />
              ) : (
                <table className="adm-table">
                  <thead><tr><th>类型</th><th>次数</th><th>失败率</th></tr></thead>
                  <tbody>{data.common_errors.map((e) => (
                    <tr key={e.label}><td>{e.label}</td><td>{e.count}</td><td>{e.rate === null ? '—' : `${e.rate}%`}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
          </div>
          <section className="adm-card" data-testid="adm-quiz-timings">
            <h2>测验每题用时</h2>
            {!data.quiz_timings || data.quiz_timings.length === 0 ? (
              <Empty icon="⏱️" title="还没有测验记录" hint="学生提交课后小练习后，这里显示每题平均用时和正确率。" />
            ) : (
              <table className="adm-table">
                <thead><tr><th>题目</th><th>作答次数</th><th>平均用时</th><th>正确率</th></tr></thead>
                <tbody>{data.quiz_timings.map((q) => (
                  <tr key={q.question_id}><td>{q.question_id}</td><td>{q.attempts}</td><td>{q.avg_sec} 秒</td><td>{Math.round(q.correct_rate * 100)}%</td></tr>
                ))}</tbody>
              </table>
            )}
          </section>
          <section className="adm-card">
            <h2>Agent 拒答分类</h2>
            {Object.keys(data.refusal_categories).length === 0 ? (
              <Empty icon="🐱" title="还没有拒答记录" />
            ) : (
              <div className="adm-btns">{Object.entries(data.refusal_categories).map(([k, n]) => <span key={k} className="adm-tag warn">{k} · {n}</span>)}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default ConsoleDashboard;
