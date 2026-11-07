import { AgeTierSelect } from '../components/AgeTierSelect';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, LogOut, Medal, Sparkles, UserRound } from 'lucide-react';
import { learningClient, type LearnerDashboardData } from '../api/learningClient';
import { useLearnerAuthStore } from '../store/learnerAuthStore';
import { captureLegacyDraft, clearLegacyDraft, type LegacyDraft } from '../utils/legacyDraft';

export function LearnerDashboard() {
  const navigate = useNavigate();
  const { learner, logout, isLoading } = useLearnerAuthStore();
  const [dashboard, setDashboard] = useState<LearnerDashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState(false);
  const removeProject = async (id: string, title: string) => {
    if (!window.confirm(`删除作品「${title}」？删除后不会出现在列表里。`)) return;
    try {
      await learningClient.archiveProject(id);
      setDashboard((d) => (d ? { ...d, recent_projects: d.recent_projects.filter((p) => p.project_id !== id) } : d));
    } catch {
      setDashboardError(true);
    }
  };
  const [startingCourse, setStartingCourse] = useState(false);
  const [legacyDraft, setLegacyDraft] = useState<LegacyDraft | null>(null);
  const [importingDraft, setImportingDraft] = useState(false);
  const [importError, setImportError] = useState(false);
  const [hideDraftNotice, setHideDraftNotice] = useState(false);
  const importProjectIdRef = useRef<string | null>(null);
  const name = learner?.display_name || learner?.username || '造物小伙伴';

  useEffect(() => {
    if (!learner?.id) return;
    let active = true;
    queueMicrotask(() => {
      const draft = captureLegacyDraft(learner.id);
      if (active) setLegacyDraft(draft);
    });
    return () => { active = false; };
  }, [learner?.id]);

  useEffect(() => {
    let active = true;
    learningClient.dashboard().then((data) => {
      if (active) setDashboard(data);
    }).catch(() => {
      if (active) setDashboardError(true);
    });
    return () => { active = false; };
  }, []);

  const signOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const startCourse = async () => {
    setStartingCourse(true);
    try {
      const project = dashboard?.continue_project || await learningClient.createProject('我的温湿度提醒器', 'temperature-alert');
      navigate(`/project?project=${encodeURIComponent(project.project_id)}`);
    } catch {
      setDashboardError(true);
    } finally {
      setStartingCourse(false);
    }
  };

  const importOldDraft = async () => {
    if (!legacyDraft || !learner?.id) return;
    setImportingDraft(true);
    setImportError(false);
    try {
      const project = importProjectIdRef.current
        ? await learningClient.getProject(importProjectIdRef.current)
        : await learningClient.createProject('从旧草稿导入');
      importProjectIdRef.current = project.project_id;
      await learningClient.saveProject(project.project_id, project.revision, {
        title: project.title,
        learning_mode: 'autonomous',
        editor_source: 'code',
        board_id: legacyDraft.boardId,
        project_state: { code: legacyDraft.code, projectFiles: legacyDraft.projectFiles },
        current_step_id: null,
        completed_step_ids: [],
      });
      clearLegacyDraft(learner.id);
      navigate(`/project?project=${encodeURIComponent(project.project_id)}`);
    } catch {
      setImportError(true);
    } finally {
      setImportingDraft(false);
    }
  };

  return (
    <main className="learner-dashboard">
      <header className="learner-dashboard__header"><Link to="/home" className="learner-brand"><span className="learner-brand__mark">✦</span><span><strong>MakeFast</strong><small>先成功，再理解</small></span></Link><div className="learner-dashboard__account"><span className="learner-avatar"><UserRound size={17} /></span><span>{name}</span><button type="button" onClick={() => void signOut()} disabled={isLoading} title="退出登录" aria-label="退出登录"><LogOut size={17} /></button></div></header>
      <div className="learner-dashboard__content">
        <section className="learner-welcome"><span className="learner-kicker"><Sparkles size={15} /> 我的学习空间</span><h1>你好，{name}！</h1><p>从一个真实的小作品开始，边做边学会硬件、程序和调试。</p><AgeTierSelect /></section>
        {legacyDraft && !hideDraftNotice && <section className="learner-legacy-draft" aria-label="旧草稿"><div><strong>这台浏览器里有一份旧草稿</strong><p>它还没有保存到账号。你可以确认导入，也可以稍后再说；我们不会自动上传。</p></div><button type="button" onClick={() => void importOldDraft()} disabled={importingDraft}>{importingDraft ? '正在导入...' : '导入旧草稿'}</button><button type="button" onClick={() => setHideDraftNotice(true)} disabled={importingDraft}>稍后再说</button>{importError && <span role="alert">导入失败，草稿仍保留在这台浏览器中。请重试。</span>}</section>}
        <section className="learner-course-card"><div className="learner-course-card__icon"><BookOpen size={27} /></div><div className="learner-course-card__copy"><span className="learner-course-card__label">推荐从这里开始</span><h2>温湿度提醒器</h2><p>用 ESP32、温湿度传感器和蜂鸣器，做出一个会感知环境并提醒你的作品。</p><div className="learner-course-card__meta"><span>约 20–30 分钟</span><span>新手友好</span><span>完成可获得积分</span></div></div><button type="button" onClick={() => void startCourse()} disabled={startingCourse} className="learner-course-card__action">{startingCourse ? '正在打开...' : dashboard?.continue_project ? '继续课程' : '开始课程'} <ArrowRight size={18} /></button></section>
        <div className="learner-dashboard__grid"><section className="learner-stat-card"><Medal size={21} /><div><span>我的积分</span><strong>{dashboard ? dashboard.points_total : '...'}</strong><small>{dashboard?.badges.length ? `已获得 ${dashboard.badges.length} 枚徽章` : '完成第一次关键动作后获得'}</small></div></section><section className="learner-stat-card"><BookOpen size={21} /><div><span>学习进度</span><strong>{dashboard ? `${dashboard.project_count} 个作品` : '...'}</strong><small>{dashboard?.continue_project ? '已经开始一门课程' : '开始课程后会在这里记录'}</small></div></section></div>
        {dashboard && <section className="learner-rewards" aria-label="积分和徽章"><div><h2>我的徽章</h2><div className="learner-badges">{(dashboard.badge_catalog || dashboard.badges).map((badge) => {
          const unlocked = dashboard.badges.some((earned) => earned.key === badge.key);
          return <span className={unlocked ? 'learner-badge learner-badge--earned' : 'learner-badge learner-badge--locked'} key={badge.key} title={badge.criteria || (unlocked ? '已经获得' : '完成对应学习动作后解锁')}><Medal size={15} /><strong>{badge.name}</strong>{!unlocked && <small>{badge.criteria}</small>}</span>;
        })}</div></div><div><h2>最近获得</h2>{dashboard.recent_events?.length ? <ul>{dashboard.recent_events.slice(0, 8).map((event, index) => <li key={`${event.created_at}-${index}`}><span>{event.label || event.event_type}</span><strong>+{event.points}</strong></li>)}</ul> : <p>完成课程中的关键动作后，积分和获得原因会显示在这里。</p>}</div></section>}
        {dashboardError && <p className="learner-dashboard__error" role="status">暂时无法读取学习记录，请刷新页面重试。</p>}
        {dashboard && dashboard.recent_projects.length === 0 && <section className="learner-recent-projects" data-testid="projects-empty"><h2>最近的作品</h2><p>还没有作品。先跟着小铁猫做完第一课吧！</p><button type="button" onClick={() => navigate('/workbench?course=first-lesson')}>去做第一课 →</button></section>}
        {dashboard && dashboard.recent_projects.length > 0 && <section className="learner-recent-projects"><h2>最近的作品</h2><ul>{dashboard.recent_projects.map((project) => <li key={project.project_id}><BookOpen size={17} /><span><strong>{project.title}</strong><small>{project.current_step_id ? '课程进行中' : '还没有开始课程步骤'}</small></span><span className="learner-project-revision">第 {project.revision} 版</span><button type="button" onClick={() => navigate(`/project?project=${encodeURIComponent(project.project_id)}`)}>打开</button><button type="button" className="learner-project-delete" aria-label={`删除作品 ${project.title}`} onClick={() => void removeProject(project.project_id, project.title)}>删除</button></li>)}</ul></section>}
      </div>
    </main>
  );
}
