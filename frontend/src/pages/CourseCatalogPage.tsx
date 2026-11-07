/**
 * S1 课程目录 — full catalog at /courses only (Welcome → Hub → /courses).
 * Agent MUST stay IDLE here: no guide overlay / auto-speak (M7).
 */
import { articleLinkForMeta, articleLinkForSlug, workbenchLinkForMeta } from '../lesson/lessonRegistry';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { learningClient } from '../api/learningClient';
import { useCatalogCourses } from '../catalog/publishedCourses';
import { CatalogFilter } from '../components/catalog/CatalogFilter';
import { CatalogIdleAgent } from '../components/catalog/CatalogIdleAgent';
import { CourseCard } from '../components/catalog/CourseCard';
import {
  DEFAULT_CATALOG_FILTER,
  filterCatalogCourses,
  type CatalogCourse,
  type CatalogFilterId, FIRST_LESSON_WORKBENCH } from '../catalog/courseCatalog';
import { useLearnerAuthStore } from '../store/learnerAuthStore';

export function CourseCatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, checkSession } = useLearnerAuthStore();
  const [filter, setFilter] = useState<CatalogFilterId>(DEFAULT_CATALOG_FILTER);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [errorCourseId, setErrorCourseId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const autoStartHandled = useRef(false);

  useEffect(() => {
    void checkSession().finally(() => setSessionReady(true));
  }, [checkSession]);

  const allCourses = useCatalogCourses();
  const courses = useMemo(
    () => filterCatalogCourses(allCourses, filter),
    [allCourses, filter],
  );

  const beginCourse = useCallback(
    async (course: CatalogCourse) => {
      setStartError(null);
      setErrorCourseId(null);
      if (course.comingSoon) return;
      const article = articleLinkForMeta(course.id) ?? articleLinkForSlug(course.slug);
      if (course.startHere || article || workbenchLinkForMeta(course.id)) {
        // 有章节文 → 课文章节页；否则进工作台
        navigate(article ?? workbenchLinkForMeta(course.id) ?? FIRST_LESSON_WORKBENCH);
        return;
      }
      if (!isAuthenticated) {
        navigate('/login', {
          state: { from: `/courses?start=${encodeURIComponent(course.slug)}` },
          replace: false,
        });
        return;
      }
      setStartingId(course.id);
      try {
        const project = await learningClient.createProject(course.title, course.slug);
        // learning_mode defaults to guided on backend → Agent may GUIDING on workbench
        navigate(`/project?project=${encodeURIComponent(project.project_id)}`);
      } catch {
        setStartError('打不开这门课，稍后再试');
        setErrorCourseId(course.id);
        setStartingId(null);
      }
    },
    [isAuthenticated, navigate],
  );

  // Optional deep-link: /?start=<slug> after login return
  useEffect(() => {
    if (!sessionReady || !isAuthenticated || autoStartHandled.current) return;
    const startSlug = searchParams.get('start');
    if (!startSlug) return;
    const course = allCourses.find((item) => item.slug === startSlug);
    if (!course) return;
    autoStartHandled.current = true;
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 带 ?start= 时自动开课：依赖会话就绪这一外部事件
    void beginCourse(course);
  }, [sessionReady, isAuthenticated, searchParams, setSearchParams, beginCourse, allCourses]);

  const onFilterChange = (next: CatalogFilterId) => {
    setFilter(next);
    setStartError(null);
    setErrorCourseId(null);
  };

  // Guard: never force guide on catalog (explicit no-op surface)
  useEffect(() => {
    document.documentElement.dataset.makefastSurface = 'catalog';
    document.documentElement.dataset.agentState = 'idle';
    return () => {
      delete document.documentElement.dataset.makefastSurface;
      delete document.documentElement.dataset.agentState;
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-[#C0E2F9]"
      data-page="course-catalog"
      data-agent-force-guide="false"
    >
      <header className="sticky top-0 z-10 border-b border-white/60 bg-[#74B0E1]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/home" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg">✦</span>
            <span>
              MakeFast
              <span className="ml-2 text-xs font-medium text-white/85">先成功，再理解</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/home" className="rounded-lg px-3 py-1.5 hover:bg-white/15">
              ← 学习主页
            </Link>
            {isAuthenticated ? (
              <Link to="/workbench?mode=free" className="rounded-lg px-3 py-1.5 hover:bg-white/15" data-cta="free-create">自由创作</Link>
            ) : (
              <Link to="/login" state={{ from: '/workbench?mode=free' }} className="rounded-lg px-3 py-1.5 hover:bg-white/15" data-cta="free-create">自由创作</Link>
            )}
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-white/20 px-3 py-1.5 font-semibold hover:bg-white/30"
              >
                我的学习
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: '/courses' }}
                className="rounded-lg bg-[#F4C65C] px-3 py-1.5 font-semibold text-[#1A2B3C] hover:brightness-95"
              >
                登录
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">课程目录</h1>
          <p className="mt-1 text-sm text-slate-600">挑一门课开始动手。小铁猫在目录里安静待命，进了课程才开始带你一步步做。</p>
        </div>

        <div className="mb-5">
          <CatalogFilter value={filter} onChange={onFilterChange} />
        </div>

        {courses.length === 0 ? (
          <div
            className="rounded-2xl bg-white/80 px-6 py-16 text-center shadow-sm"
            data-testid="catalog-empty"
          >
            <p className="text-slate-600">这会儿没有匹配的课，换个筛选试试</p>
            <button
              type="button"
              className="mt-4 rounded-xl border border-[#74B0E1] px-4 py-2 text-sm font-semibold text-[#2a6ea0]"
              onClick={() => setFilter('全部')}
            >
              清除筛选
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                starting={startingId === course.id}
                error={errorCourseId === course.id ? startError : null}
                onStart={beginCourse}
              />
            ))}
          </div>
        )}

      </main>

      {/* Idle cat only — no guide bubble / overlay (M7) */}
      <CatalogIdleAgent />
    </div>
  );
}

export default CourseCatalogPage;
