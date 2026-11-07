import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Zap, ShieldCheck,
  BookOpen, Rocket,
  ArrowRightIcon, Check, X,
} from 'lucide-react';

const openCoursePreview = (navigate: ReturnType<typeof useNavigate>) => {
  navigate('/library');
};

// ── Navbar ──
const Navbar = () => {
  const navigate = useNavigate();
  return (
    <nav className="landing-nav">
      <div className="landing-nav__inner">
        <div className="landing-nav__brand">
          <div className="landing-nav__logo">
            <svg viewBox="0 0 40 40" className="landing-nav__logo-svg">
              <rect x="8" y="8" width="24" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M4 14h4M4 20h4M4 26h4M32 14h4M32 20h4M32 26h4M14 4v4M20 4v4M26 4v4M14 32v4M20 32v4M26 32v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <rect x="14" y="14" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
            <div className="landing-nav__logo-glow" />
          </div>
          <span className="landing-nav__title">
            <span>一键造物</span>
            <span className="landing-nav__subtitle">MakeFast</span>
          </span>
        </div>
        <div className="landing-nav__actions">
          <button className="landing-nav__btn" onClick={() => openCoursePreview(navigate)}>
            <span>先看课程</span>
            <span className="landing-nav__btn-label">/ VIEW COURSE</span>
            <Zap className="landing-nav__btn-icon" />
            <div className="landing-nav__btn-glow" />
          </button>
        </div>
      </div>
    </nav>
  );
};

// ── Typewriter ──
const Typewriter = ({ text, speed = 50, delay = 0 }: { text: string, speed?: number, delay?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayedText(text.substring(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, speed, delay]);

  return <span>{displayedText}<span className="animate-pulse">_</span></span>;
};

// ── Particles ──
const Particles = () => {
  const [particles, setParticles] = useState<Array<{ id: number, size: number, x: number, y: number, duration: number, delay: number }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 5 + 5,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="landing-particles">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="landing-particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -100],
            x: [0, Math.random() * 30 - 15],
            opacity: [0, 0.6, 0]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

// ── CheckCircle SVG ──
const CheckCircleSvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// ── Hero ──
const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="landing-hero">
      <Particles />
      <div className="landing-hero__bg">
        <div className="landing-hero__grid" />
        <div className="landing-hero__stream" />
      </div>

      <div className="landing-hero__watermark landing-hero__watermark--left">SYS_READY</div>
      <div className="landing-hero__watermark landing-hero__watermark--right">INIT_SUCCESS</div>

      <div className="landing-hero__content">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="landing-hero__badge"
        >
          {'// NEXT-GEN HARDWARE DEV PLATFORM'}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="landing-hero__title"
        >
          <span className="landing-hero__title-main">一键造物</span>
          <br />
          <span className="landing-hero__title-sub">创客最快乐、效率最高的路径</span>
          <br />
          <span className="landing-hero__title-sub">——先成功，再理解</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="landing-hero__typewriter"
        >
          <Typewriter
            text={"不装软件、不写代码\n小铁猫一步步带你做\n创造的快乐来得如此简单！"}
            delay={800}
            speed={40}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="landing-hero__cta"
        >
          <button className="landing-hero__btn" onClick={() => openCoursePreview(navigate)}>
            <div className="landing-hero__btn-glow" />
            <div className="landing-hero__btn-inner">
              查看温湿度提醒器课程 <span className="landing-hero__btn-label">/ VIEW COURSE</span>
              <Rocket className="landing-hero__btn-icon" />
            </div>
          </button>
        </motion.div>
      </div>
    </section>
  );
};

// ── PainPoints ──
const PainPoints = () => {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.5 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const points = [
    { title: '安装 IDE 速度极慢', desc: '下载慢、安装报错、版本不兼容' },
    { title: 'C++ 库管理与依赖冲突', desc: '版本冲突、编译失败、依赖地狱' },
    { title: '换电脑就要重新配环境', desc: '配置丢失、重新安装、效率低下' },
  ];

  return (
    <section ref={sectionRef} className="landing-pain">
      <div className="landing-pain__watermark">SYSTEM_OVERLOAD // DEPENDENCY_ERROR</div>

      <div className="landing-pain__content">
        <h2 className="landing-pain__title">玩开源硬件，还在经历这些？</h2>

        <div className="landing-pain__grid">
          {points.map((point, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.2 }}
              className={`landing-pain__card ${inView ? 'landing-pain__card--active' : ''}`}
            >
              <div className="landing-pain__card-title">{point.title}</div>
              <div className="landing-pain__card-desc">{point.desc}</div>
              {inView && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 1.5, delay: 0.8 + i * 0.2, ease: "linear" }}
                  className="landing-pain__scanline"
                />
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="landing-pain__result"
        >
          <div className="landing-pain__result-text">
            我们将这一切缩短到了 0 秒。
          </div>
          <div className="landing-pain__result-code">
            {'// ZERO LATENCY. ZERO CONFIG.'}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ── BentoCard ──
const BentoCard = ({
  className, label, title, desc, icon: Icon, children
}: {
  className?: string, label: string, title: string, desc?: string, icon: any, children?: React.ReactNode
}) => (
  <div className={`landing-bento ${className || ''}`}>
    <div className="landing-bento__header">
      <span className="landing-bento__label">{label}</span>
      <Icon className="landing-bento__icon" />
    </div>
    <h3 className="landing-bento__title">{title}</h3>
    {desc && <p className="landing-bento__desc">{desc}</p>}
    <div className="landing-bento__content">
      {children}
    </div>
  </div>
);

// ── Features ──
const Features = () => {
  return (
    <section className="landing-features">
      <div className="landing-features__inner">
        <div className="landing-features__header">
          <h2 className="landing-features__title">为什么更容易开始</h2>
          <div className="landing-features__subtitle">CORE FEATURES // SYSTEM ARCHITECTURE</div>
        </div>

        <div className="landing-features__grid">
          {/* Card 1: 零配置 */}
          <BentoCard
            label="亮点 01 / ZERO CONFIG"
            title="不用装环境"
            desc="打开网页，连接开发板，直接编译烧录。"
            icon={CloudLightningIcon}
          >
            <div className="landing-features__demo">
              <div className="landing-features__demo-bar">
                <div className="landing-features__demo-header">
                  <span>DETECTING_DEVICE & COMPILING</span>
                  <span className="landing-features__demo-status">ESP32-S3 ATTACHED</span>
                </div>
                <div className="landing-features__demo-progress">
                  <motion.div
                    initial={{ width: "0%" }}
                    whileInView={{ width: "100%" }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                    className="landing-features__demo-fill"
                  />
                </div>
                <div className="landing-features__demo-steps">
                  <div className="landing-features__demo-step">
                    <CheckCircleSvg className="landing-features__demo-check" />
                    选板子
                  </div>
                  <div className="landing-features__demo-step">
                    <CheckCircleSvg className="landing-features__demo-check" />
                    连接USB
                  </div>
                  <div className="landing-features__demo-step landing-features__demo-step--active">
                    <Zap className="landing-features__demo-bolt" />
                    云端极速编译烧录
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 2: AI */}
          <BentoCard
            label="亮点 02 / AI ASSISTANT"
            title="跟着课程做"
            desc="图文、视频、清单和代码放在一起，不再到处找资料。"
            icon={Sparkles}
          >
            <div className="landing-features__ai">
              <div className="landing-features__ai-user">
                帮我修改课程里的智能小车代码
              </div>
              <div className="landing-features__ai-code">
                <span className="text-ice-blue">const int</span> leftSensor = 2;<br />
                <span className="text-ice-blue">const int</span> rightSensor = 3;<br />
                <span className="text-ice-blue">void</span> setup() {'{\n  ...'}
                <div className="landing-features__ai-fade" />
              </div>
            </div>
          </BentoCard>

          {/* Card 3: 100% 验证 */}
          <BentoCard
            label="亮点 03 / 100% VERIFIED"
            title="AI 随时陪跑"
            icon={ShieldCheck}
          >
            <div className="landing-features__verify">
              报错、看不懂、想改功能，都可以直接问。
            </div>
          </BentoCard>

          {/* Card 4: 全套课程包 */}
          <BentoCard
            label="亮点 04 / MAKER ASSETS"
            title="作品马上动起来"
            icon={BookOpen}
          >
            <div className="landing-features__assets">
              先看到结果，再理解背后的代码和原理。
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
};

// ── CloudLightning Icon ──
const CloudLightningIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" />
    <path d="m13 12-3 5h4l-3 5" />
  </svg>
);

// ── Comparison ──
const Comparison = () => {
  return (
    <section className="landing-comparison">
      <div className="landing-comparison__inner">
        <div className="landing-comparison__header">
          <h2 className="landing-comparison__title">打破开发门槛，为每一次探索加速</h2>
          <div className="landing-comparison__subtitle">EMPOWERING EVERY CREATOR</div>
        </div>

        <div className="landing-comparison__table">
          <div className="landing-comparison__row landing-comparison__row--header">
            <div>使用场景</div>
            <div>传统开发方式</div>
            <div className="landing-comparison__highlight">MakeFast 体验</div>
          </div>

          {[
            {
              scene: '新手入门',
              before: <><span>查教程/装环境/配库包</span> <span>= 2小时</span></>,
              after: <><span>打开浏览器接上USB</span> <span>= 10秒</span></>,
            },
            {
              scene: '团队协作',
              before: <><span>每台电脑重复配置，</span><span>且版本不一</span></>,
              after: <><span>共享项目链接，</span><span>环境即开即用</span></>,
            },
            {
              scene: '资产管理',
              before: <><span>代码、3D模型、</span><span>BOM表散落四处</span></>,
              after: <><span>All-in-One</span> <span>一站式云端工坊</span></>,
            },
          ].map((row, i) => (
            <div key={i} className="landing-comparison__row">
              <div className="landing-comparison__cell-scene">{row.scene}</div>
              <div className="landing-comparison__cell-before">
                <X className="landing-comparison__x" />
                <span>{row.before}</span>
              </div>
              <div className="landing-comparison__cell-after">
                <Check className="landing-comparison__check" />
                <span>{row.after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Footer ──
const Footer = () => {
  const navigate = useNavigate();
  return (
    <footer className="landing-footer">
      <div className="landing-footer__glow" />

      <div className="landing-footer__content">
        <h2 className="landing-footer__title">
          准备好点亮你的创造力了吗？
        </h2>
        <div className="landing-footer__subtitle">
          READY TO BUILD THE FUTURE?
        </div>

        <button className="landing-footer__btn" onClick={() => openCoursePreview(navigate)}>
          <span className="landing-footer__btn-inner">
            先看看温湿度提醒器课程
            <span className="landing-footer__btn-label">/ VIEW COURSE</span>
            <ArrowRightIcon className="landing-footer__btn-icon" />
          </span>
        </button>

        <div className="landing-footer__copy">
          &copy; 2026 MakeFast. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

// ── 主页 ──
export function LandingPage() {
  return (
    <div className="landing">
      <Navbar />
      <main>
        <Hero />
        <PainPoints />
        <Features />
        <Comparison />
      </main>
      <Footer />
    </div>
  );
}
