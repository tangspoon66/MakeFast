import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, LockKeyhole, Sparkles, UserRound } from 'lucide-react';
import { useLearnerAuthStore } from '../store/learnerAuthStore';

const markerOptions = [
  { value: 'none', label: '这是我第一次接触这类硬件' },
  { value: 'recognizes_board_sensor', label: '我见过开发板或传感器' },
  { value: 'connected_component', label: '我试过把元件接起来' },
  { value: 'compiled_or_flashed', label: '我编译或烧录过程序' },
  { value: 'used_serial_or_debugged', label: '我用过串口或自己排查过问题' },
];

export function LearnerAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, error, login, register, clearError } = useLearnerAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [markers, setMarkers] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated) navigate('/home', { replace: true });
  }, [isAuthenticated, navigate]);

  const isRegister = mode === 'register';
  const switchPath = isRegister ? '/login' : '/register';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    clearError();
    try {
      if (isRegister) {
        await register({ username: username.trim(), password, display_name: displayName.trim() || undefined, experience_markers: markers });
      } else {
        await login(username.trim(), password);
      }
      navigate((location.state as { from?: string } | null)?.from || '/home', { replace: true });
    } catch {
      // Store 已经把适合学习者阅读的错误放进页面状态。
    }
  };

  const toggleMarker = (value: string) => {
    setMarkers((current) => {
      if (value === 'none') return current.includes('none') ? [] : ['none'];
      return current.filter((item) => item !== 'none').includes(value)
        ? current.filter((item) => item !== value)
        : [...current.filter((item) => item !== 'none'), value];
    });
  };

  return (
    <main className="learner-auth-page">
      <section className="learner-auth-intro">
        <Link to="/" className="learner-brand" aria-label="返回 MakeFast 首页">
          <span className="learner-brand__mark">✦</span>
          <span><strong>MakeFast</strong><small>先成功，再理解</small></span>
        </Link>
        <div className="learner-auth-intro__body">
          <span className="learner-kicker"><Sparkles size={15} /> 个人学习空间</span>
          <h1>{isRegister ? '先创建一个自己的造物空间' : '欢迎回来，继续你的造物旅程'}</h1>
          <p>{isRegister ? '保存你的课程进度、积分和作品。小朋友可以请爸爸妈妈帮忙创建账号。' : '登录后，你的课程进度、作品和小铁猫的对话都会接着上次的位置保留。'}</p>
          <div className="learner-auth-note"><BookOpen size={18} /><span>不注册也能用「模拟模式」完整体验第一课；注册后会保存进度和作品，还能连接真板子编译、烧录。</span></div>
        </div>
      </section>

      <section className="learner-auth-card" aria-labelledby="learner-auth-title">
        <div className="learner-auth-card__heading">
          <span className="learner-auth-icon"><UserRound size={20} /></span>
          <div><h2 id="learner-auth-title">{isRegister ? '创建学习账号' : '登录学习账号'}</h2><p>{isRegister ? '现在只需要用户名和密码' : '输入你注册时使用的信息'}</p></div>
        </div>

        <form onSubmit={submit} className="learner-auth-form">
          <label>用户名<input required minLength={3} maxLength={50} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如：xiaoming" autoComplete="username" /></label>
          {isRegister && <label>显示名字 <span className="learner-optional">可选</span><input maxLength={48} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：小明" /></label>}
          <label>密码<input required minLength={8} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete={isRegister ? 'new-password' : 'current-password'} /></label>

          {isRegister && <fieldset className="learner-marker-fieldset"><legend>你以前做过哪些？ <span>可以多选，也可以跳过</span></legend>{markerOptions.map((option) => <label className="learner-marker" key={option.value}><input type="checkbox" checked={markers.includes(option.value)} onChange={() => toggleMarker(option.value)} /><span>{option.label}</span></label>)}</fieldset>}

          {error && <div className="learner-auth-error" role="alert">{error}</div>}
          <button className="learner-submit" type="submit" disabled={isLoading}>{isLoading ? '请稍等...' : isRegister ? '创建账号并开始' : '登录并继续'} <ArrowRight size={17} /></button>
        </form>

        <div className="learner-auth-card__footer"><span>{isRegister ? '已经有账号？' : '还没有账号？'}</span><Link to={switchPath}>{isRegister ? '去登录' : '创建一个账号'}</Link></div>
        <div className="learner-auth-privacy"><LockKeyhole size={14} /> 我们暂时只保存学习所需的信息，不要求填写家庭信息。</div>
      </section>
    </main>
  );
}
