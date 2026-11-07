import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/tokens.css';
import './admin.css';
import { get, ROLE_LABEL, type Me } from '../../pages/admin/api';
import { AdminMeContext } from './AdminConsoleContext';

const NAV = [
  { group: '运营', items: [
    { to: '/admin', label: '仪表盘', icon: '📊', end: true },
    { to: '/admin/learners', label: '学习者', icon: '🧒' },
    { to: '/admin/agent', label: 'Agent 运营', icon: '🐱' },
  ] },
  { group: '内容', items: [
    { to: '/admin/courses', label: '课程管理', icon: '📚' },
    { to: '/admin/articles', label: '文章编辑', icon: '📝' },
    { to: '/admin/hardware', label: '板卡与元件', icon: '🔌' },
  ] },
  { group: '系统', items: [
    { to: '/admin/users', label: '用户与角色', icon: '👥', adminOnly: true },
    { to: '/admin/settings', label: '系统设置', icon: '⚙️' },
    { to: '/admin/legacy', label: '旧版工具（固件/模板/库）', icon: '🧰', adminOnly: true },
  ] },
];

const TITLES: Record<string, string> = {
  '': '仪表盘', learners: '学习者', agent: 'Agent 运营', courses: '课程管理', articles: '文章编辑', hardware: '板卡与元件', users: '用户与角色', settings: '系统设置',
};

export function AdminLayout() {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    get<Me>('/me').then(setMe).catch(() => setFailed(true));
  }, []);
  useEffect(() => { if (failed) navigate('/admin/login', { replace: true }); }, [failed, navigate]);

  const logout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }); } catch { /* 网络失败也回登录页 */ }
    localStorage.removeItem('admin_user');
    navigate('/admin/login', { replace: true });
  };
  const section = loc.pathname.replace(/^\/admin\/?/, '').split('/')[0];

  return (
    <AdminMeContext.Provider value={me}>
      <div className="adm">
        <aside className="adm-side" aria-label="管理导航">
          <div className="adm-brand"><i>⚡</i>MakeFast 管理后台</div>
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="adm-navgroup">{g.group}</div>
              {g.items.filter((i) => !('adminOnly' in i && i.adminOnly) || me?.role === 'admin').map((i) => (
                <NavLink key={i.to} to={i.to} end={'end' in i ? i.end : false} className={({ isActive }) => `adm-nav${isActive ? ' active' : ''}`}>
                  <span aria-hidden>{i.icon}</span>{i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>
        <header className="adm-top">
          <h1>{TITLES[section] ?? '管理后台'}</h1>
          <div className="adm-user">
            <a className="adm-btn" href="/courses" target="_blank" rel="noreferrer">学生端 ↗</a>
            {me && <span><b>{me.display_name || me.username}</b> <span className="adm-tag">{ROLE_LABEL[me.role]}</span></span>}
            <button className="adm-btn" onClick={logout}>退出登录</button>
          </div>
        </header>
        <main className="adm-main">{me ? <Outlet /> : <div className="adm-empty adm-muted">验证身份中…</div>}</main>
      </div>
    </AdminMeContext.Provider>
  );
}

export default AdminLayout;
