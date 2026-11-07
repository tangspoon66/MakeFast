import { articleLinkForMeta, articleLinkForSlug } from '../lesson/lessonRegistry';
/**
 * S-HUB `/home` — learning home (Welcome → Hub → /courses).
 * Big continue/start-first card + entry cards + beginner strip.
 * Agent IDLE (M7 / HC-04). Copy: makefast-ui-welcome-hub.md.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, LayoutGrid, Settings, Trophy } from 'lucide-react';
import { learningClient, type LearnerProjectSummary } from '../api/learningClient';
import { CatalogIdleAgent } from '../components/catalog/CatalogIdleAgent';
import { CourseCard } from '../components/catalog/CourseCard';
import { useCatalogCourses } from '../catalog/publishedCourses';
import {
  CATALOG_COURSES,
  filterCatalogCourses,
  type CatalogCourse, FIRST_LESSON_WORKBENCH } from '../catalog/courseCatalog';
import { useLearnerAuthStore } from '../store/learnerAuthStore';

const FIRST_LESSON =
  CATALOG_COURSES.find((c) => c.startHere) ?? CATALOG_COURSES[0];

const VISITED_KEY = 'makefast.hasVisited';

export function HomeHubPage() {
  const navigate = useNavigate();
  const { isAuthenticated, learner, checkSession } = useLearnerAuthStore();
  const [sessionReady, setSessionReady] = useState(false);
  const [continueProject, setContinueProject] =
    useState<LearnerProjectSummary | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // 本浏览器会话里第一次进 Hub 用首次问候（惰性初始化，不在 effect 里 setState）
  const [fromWelcome] = useState(() => { try { return !sessionStorage.getItem('makefast.hubGreeted'); } catch { return false; } });

  useEffect(() => {
    try {
      localStorage.setItem(VISITED_KEY, '1');
    } catch {
      /* ignore */
    }
    // Heuristic: first Hub landing after Welcome uses first-visit greeting
    // once per browser session
    if (fromWelcome) sessionStorage.setItem('makefast.hubGreeted', '1');
  }, [fromWelcome]);

  useEffect(() => {
    void checkSession().finally(() => setSessionReady(true));
  }, [checkSession]);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 登出后清掉上一账号的“继续作品”（与异步请求同一处管理）
      setContinueProject(null);
      return;
    }
    let active = true;
    learningClient
      .dashboard()
      .then((data) => {
        if (active) setContinueProject(data.continue_project);
      })
      .catch(() => {
        if (active) setContinueProject(null);
      });
    return () => {
      active = false;
    };
  }, [sessionReady, isAuthenticated]);

  useEffect(() => {
    document.documentElement.dataset.makefastSurface = 'home-hub';
    document.documentElement.dataset.agentState = 'idle';
    return () => {
      delete document.documentElement.dataset.makefastSurface;
      delete document.documentElement.dataset.agentState;
    };
  }, []);

  const hubCourses = useCatalogCourses();
  const stripCourses = useMemo(
    () => filterCatalogCourses(hubCourses, '入门教程').slice(0, 6),
    [hubCourses],
  );

  const beginCourse = useCallback(
    async (course: CatalogCourse) => {
      setStartError(null);
      if (course.comingSoon) return;
      if (course.startHere) {
        navigate(articleLinkForSlug('first-lesson') ?? FIRST_LESSON_WORKBENCH);
        return;
      }
      const article = articleLinkForMeta(course.id) ?? articleLinkForSlug(course.slug);
      if (article) {
        navigate(article);
        return;
      }
      if (!isAuthenticated) {
        navigate('/login', {
          state: {
            from: `/courses?start=${encodeURIComponent(course.slug)}`,
          },
        });
        return;
      }
      setStarting(true);
      try {
        const project = await learningClient.createProject(
          course.title,
          course.slug,
        );
        navigate(`/project?project=${encodeURIComponent(project.project_id)}`);
      } catch {
        setStartError('打不开这门课，稍后再试');
        setStarting(false);
      }
    },
    [isAuthenticated, navigate],
  );

  const onHeroCta = useCallback(async () => {
    setStartError(null);
    navigate(articleLinkForSlug('first-lesson') ?? FIRST_LESSON_WORKBENCH);
  }, [navigate]);

  const greeting = fromWelcome
    ? '你好！从这里开始学习'
    : '欢迎回来';
  const heroCtaLabel = continueProject ? '继续学习' : '开始第一课';
  const name = learner?.display_name || learner?.username;

  return (
    <div
      className="min-h-screen bg-[#C0E2F9]"
      data-page="home-hub"
      data-agent-force-guide="false"
    >
      <header className="sticky top-0 z-10 border-b border-white/60 bg-[#74B0E1]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="flex items-center gap-2 font-bold tracking-tight"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg">
                ✦
              </span>
              <span>MakeFast</span>
            </Link>
            <span className="hidden rounded-lg bg-white/25 px-2.5 py-1 text-xs font-semibold sm:inline">
              学习主页
            </span>
          </div>
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <Link
              to="/courses"
              className="rounded-lg px-3 py-1.5 hover:bg-white/15"
            >
              课程
            </Link>
            {isAuthenticated ? (
              <Link
                to="/workbench?mode=free"
                className="rounded-lg px-3 py-1.5 hover:bg-white/15"
                data-cta="free-create"
              >
                自由创作
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: '/workbench?mode=free' }}
                className="rounded-lg px-3 py-1.5 hover:bg-white/15"
                data-cta="free-create"
              >
                自由创作
              </Link>
            )}
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-white/20 px-3 py-1.5 font-semibold hover:bg-white/30"
              >
                {name || '我的'}
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: '/home' }}
                className="rounded-lg bg-[#F4C65C] px-3 py-1.5 font-semibold text-[#1A2B3C] hover:brightness-95"
              >
                登录
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <p className="text-lg font-bold text-[#08083D] sm:text-xl">
          {greeting}
          {name && !fromWelcome ? `，${name}` : ''}
        </p>

        {/* HUB-HERO */}
        <section
          className="mt-5 overflow-hidden rounded-[20px] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
          data-hub-module="hero"
        >
          <div className="grid gap-0 md:grid-cols-[200px_1fr]">
            <div className="flex items-center justify-center bg-[#C0E2F9]/60 p-5">
              {FIRST_LESSON.coverUrl ? (
                <img
                  src={FIRST_LESSON.coverUrl}
                  alt=""
                  className="max-h-36 w-auto object-contain"
                />
              ) : (
                <span className="text-5xl" aria-hidden>
                  {FIRST_LESSON.coverEmoji}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 p-5 sm:p-6">
              <span className="inline-flex w-fit rounded-lg bg-[#F4C65C] px-2.5 py-1 text-xs font-semibold text-[#1A2B3C]">
                开始这里
              </span>
              <h1 className="text-xl font-bold leading-snug text-[#08083D] sm:text-[22px]">
                第一课：温湿度小管家
              </h1>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                接上小板，读出温湿度，听到蜂鸣——小铁猫会在课里讲为什么
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-cta="hub-hero"
                  disabled={starting || !sessionReady}
                  onClick={() => void onHeroCta()}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#74B0E1] px-6 text-base font-semibold text-white shadow-md transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {starting ? '正在打开…' : heroCtaLabel}
                  <ArrowRight size={18} />
                </button>
                {startError && (
                  <p className="text-sm text-red-600" role="alert">
                    {startError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Entry cards */}
        <section
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3"
          aria-label="学习入口"
        >
          <Link
            to="/courses"
            data-hub-module="courses"
            className="group flex flex-col gap-2 rounded-[18px] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C0E2F9] text-[#2a6ea0]">
              <LayoutGrid size={20} />
            </span>
            <strong className="text-base text-[#08083D]">全部课程</strong>
            <span className="text-sm text-slate-500">去课程库看看</span>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-[#2a6ea0] group-hover:underline">
              去课程库 <ArrowRight size={14} />
            </span>
          </Link>

          <Link
            to="/dashboard"
            data-hub-module="progress"
            className="flex flex-col gap-2 rounded-[18px] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3D6] text-[#B7791F]">
              <Trophy size={20} />
            </span>
            <strong className="text-base text-slate-800">我的进度</strong>
            <span className="text-sm text-slate-500">作品和学到哪（需要登录）</span>
          </Link>

          <div
            data-hub-module="settings"
            className="flex flex-col gap-2 rounded-[18px] bg-white/70 p-5 opacity-70 shadow-sm"
            aria-disabled="true"
            title="即将开放"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Settings size={20} />
            </span>
            <strong className="text-base text-slate-500">设置</strong>
            <span className="text-sm text-slate-400">偏好与设备 · 即将开放</span>
          </div>
        </section>

        {/* Beginner strip */}
        <section className="mt-8" data-hub-module="strip">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-[#08083D]">入门推荐</h2>
            <Link
              to="/courses"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#2a6ea0] hover:underline"
            >
              <BookOpen size={15} />
              查看全部
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stripCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                starting={starting && course.id === FIRST_LESSON.id}
                error={null}
                onStart={beginCourse}
              />
            ))}
          </div>
        </section>
      </main>

      <CatalogIdleAgent surface="home-hub" />
    </div>
  );
}

export default HomeHubPage;
