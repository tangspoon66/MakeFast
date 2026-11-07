/**
 * S-WELCOME `/` — cold-open sell page (Welcome → Hub → /courses).
 * Bright kids palette; Agent IDLE (M7 / HC-04) — no forced guide.
 * Copy aligned with makefast-ui-welcome-hub.md.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { CatalogIdleAgent } from '../components/catalog/CatalogIdleAgent';
import { FIRST_LESSON_WORKBENCH } from '../catalog/courseCatalog';
import { useLearnerAuthStore } from '../store/learnerAuthStore';

const VISITED_KEY = 'makefast.hasVisited';

export function WelcomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, checkSession } = useLearnerAuthStore();
  const [sessionReady, setSessionReady] = useState(false);
  const starting = false;
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    void checkSession().finally(() => setSessionReady(true));
  }, [checkSession]);

  // Returning users (visited or signed-in) prefer Hub
  useEffect(() => {
    if (!sessionReady) return;
    const visited =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(VISITED_KEY) === '1';
    if (isAuthenticated || visited) {
      navigate('/home', { replace: true });
    }
  }, [sessionReady, isAuthenticated, navigate]);

  useEffect(() => {
    document.documentElement.dataset.makefastSurface = 'welcome';
    document.documentElement.dataset.agentState = 'idle';
    return () => {
      delete document.documentElement.dataset.makefastSurface;
      delete document.documentElement.dataset.agentState;
    };
  }, []);

  const markVisited = () => {
    try {
      localStorage.setItem(VISITED_KEY, '1');
    } catch {
      /* ignore quota */
    }
  };

  const goHub = () => {
    markVisited();
    navigate('/home');
  };

  const startFirstLesson = useCallback(async () => {
    setStartError(null);
    markVisited();
    // P0：第一课本地单用户即可进入工作台（模拟模式可无硬件演示）
    navigate(FIRST_LESSON_WORKBENCH);
  }, [navigate]);

  if (sessionReady && (isAuthenticated || (typeof localStorage !== 'undefined' && localStorage.getItem(VISITED_KEY) === '1'))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#C0E2F9]">
        <p className="text-sm font-medium text-slate-600">正在进入学习主页…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#C0E2F9]"
      data-page="welcome"
      data-agent-force-guide="false"
    >
      <header className="sticky top-0 z-10 border-b border-white/60 bg-[#74B0E1]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-[880px] items-center justify-between gap-4 px-6 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg">
              ✦
            </span>
            <span>
              MakeFast
              <span className="ml-2 text-xs font-medium text-white/85">
                先成功，再理解
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              to="/login"
              state={{ from: '/home' }}
              className="rounded-lg bg-white/20 px-3 py-1.5 font-semibold hover:bg-white/30"
            >
              登录
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-6 py-12 sm:px-8 sm:py-16">
        <section className="rounded-[24px] bg-white px-6 py-10 text-center shadow-[0_12px_32px_rgba(15,23,42,0.1)] sm:px-12 sm:py-12">
          <h1 className="text-[22px] font-bold leading-snug text-[#08083D] sm:text-2xl">
            用真板子做完第一课
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-slate-600">
            读到温湿度、让蜂鸣器响起来；课程助手「小铁猫」会一步步讲清楚为什么
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <button
              type="button"
              data-cta="enter-hub"
              onClick={goHub}
              className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-[#74B0E1] px-6 text-base font-semibold text-white shadow-md transition hover:brightness-95"
            >
              进入学习主页
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              data-cta="start-first-lesson"
              disabled={starting || !sessionReady}
              onClick={() => void startFirstLesson()}
              className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-[#F4C65C] px-6 text-base font-semibold text-[#1A2B3C] shadow-md transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? '正在打开…' : '开始第一课'}
            </button>
          </div>

          <div className="mt-4">
            <Link
              to="/courses"
              data-cta="browse-courses"
              onClick={markVisited}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#74B0E1]/50 bg-white px-5 text-sm font-medium text-[#2a6ea0] transition hover:bg-[#eef8ff]"
            >
              <BookOpen size={16} />
              浏览课程
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            老师 / 评委：
            <Link to="/workbench?course=first-lesson&demo=1" data-cta="judge-demo" className="font-semibold text-[#2a6ea0] underline-offset-2 hover:underline">
              🎬 3 分钟看懂小铁猫（演示导览）
            </Link>
          </p>

          {startError && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {startError}
            </p>
          )}

          <div
            className="mt-8 rounded-2xl bg-[#C0E2F9]/70 px-4 py-3 text-sm text-slate-700"
            data-testid="welcome-trust-strip"
            aria-label="第一课需要"
          >
            <span className="font-semibold text-[#1e5f8a]">第一课需要</span>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { src: '/boards/xiao-esp32-s3/photo.webp', name: 'XIAO ESP32-S3', role: '小板（大脑）' },
                { src: '/components/dht22/module.svg', name: 'DHT22', role: '温湿度（眼睛）' },
                { src: '/components/active-buzzer/module.svg', name: '有源蜂鸣器', role: '提醒（嘴巴）' },
              ].map((h) => (
                <figure key={h.name} className="m-0 flex flex-col items-center gap-1 rounded-xl bg-white p-2">
                  <img src={h.src} alt={h.name} className="h-16 w-auto object-contain" loading="lazy" />
                  <figcaption className="text-xs leading-tight"><b className="text-slate-800">{h.name}</b><br /><span className="text-slate-500">{h.role}</span></figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </main>

      <CatalogIdleAgent surface="welcome" />
    </div>
  );
}

export default WelcomePage;
