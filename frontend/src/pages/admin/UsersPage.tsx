import { useState } from 'react';
import { del, fmtTime, get, patch, post, ROLE_LABEL, type AdminUser, type Role } from './api';
import { Alert, Empty, Loading, Modal } from '../../components/admin/ui';
import { errText, useLoad } from '../../components/admin/uiHooks';
import { useAdminMe } from '../../components/admin/AdminConsoleContext';

const ROLES: Role[] = ['admin', 'editor', 'viewer'];
const ROLE_DESC: Record<Role, string> = { admin: '全部功能，含用户/设置/旧版工具', editor: '课程、板卡、FAQ、守卫词可编辑', viewer: '只读查看' };

export function UsersPage() {
  const me = useAdminMe();
  const { data, error, loading, reload } = useLoad(() => get<{ items: AdminUser[]; env_admin: string; env_admin_configured: boolean }>('/users'));
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'viewer' as Role, display_name: '' });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ kind: 'ok', text: ok }); await reload(); } catch (e) { setMsg({ kind: 'err', text: errText(e).message }); }
  };
  const create = async () => {
    try { await post('/users', form); setCreating(false); setForm({ username: '', password: '', role: 'viewer', display_name: '' }); setMsg({ kind: 'ok', text: '已创建' }); await reload(); }
    catch (e) { setFormErr(errText(e).message); }
  };

  if (me?.role !== 'admin') return <Empty icon="🔒" title="需要管理员角色" />;
  if (loading && !data) return <Loading />;
  return (
    <section className="adm-card">
      <Alert message={error} />
      {msg && <Alert kind={msg.kind} message={msg.text} onClose={() => setMsg(null)} />}
      <h2>管理员账户 <button className="adm-btn accent" onClick={() => { setFormErr(null); setCreating(true); }}>+ 新建账户</button></h2>
      <p className="adm-muted">环境变量超级管理员：<b>{data?.env_admin}</b>（{data?.env_admin_configured ? '已配置' : '未配置'}，不在此列表中管理）。
        角色：{ROLES.map((r) => <span key={r} className="adm-tag" title={ROLE_DESC[r]}>{ROLE_LABEL[r]}：{ROLE_DESC[r]}</span>)}</p>
      {(data?.items || []).length === 0 ? <Empty icon="👥" title="还没有后台账户" hint="运行 backend/scripts/seed_console_admin.py 创建本地管理员。" /> : (
        <table className="adm-table">
          <thead><tr><th>用户名</th><th>显示名</th><th>角色</th><th>状态</th><th>最近登录</th><th>操作</th></tr></thead>
          <tbody>{data!.items.map((u) => {
            const self = u.username.toLowerCase() === me.username.toLowerCase();
            return (
              <tr key={u.username}>
                <td><b>{u.username}</b>{self && <span className="adm-tag">我</span>}</td>
                <td>{u.display_name}</td>
                <td><select className="adm-select" aria-label={`${u.username} 的角色`} value={u.role} disabled={self}
                  onChange={(e) => act(() => patch(`/users/${u.username}`, { role: e.target.value }), `已把 ${u.username} 设为${ROLE_LABEL[e.target.value as Role]}`)}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                <td>{u.disabled ? <span className="adm-tag err">已停用</span> : <span className="adm-tag ok">启用</span>}</td>
                <td className="adm-muted">{fmtTime(u.last_login_at)}</td>
                <td><div className="adm-btns">
                  <button className="adm-btn" onClick={() => { setNewPw(''); setResetFor(u.username); }}>重置密码</button>
                  <button className="adm-btn" disabled={self} onClick={() => act(() => patch(`/users/${u.username}`, { disabled: !u.disabled }), u.disabled ? '已启用' : '已停用')}>{u.disabled ? '启用' : '停用'}</button>
                  <button className="adm-btn danger" disabled={self} onClick={() => { if (window.confirm(`删除账户 ${u.username}？`)) void act(() => del(`/users/${u.username}`), '已删除'); }}>删除</button>
                </div></td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      {creating && (
        <Modal title="新建后台账户" onClose={() => setCreating(false)}>
          <Alert message={formErr} />
          <div className="adm-form">
            <label htmlFor="u-name">用户名</label><input id="u-name" className="adm-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <label htmlFor="u-disp">显示名</label><input id="u-disp" className="adm-input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <label htmlFor="u-pw">初始密码</label><input id="u-pw" type="password" className="adm-input" value={form.password} placeholder="至少 8 位" onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <label htmlFor="u-role">角色</label><select id="u-role" className="adm-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          </div>
          <div className="adm-btns" style={{ marginTop: 12 }}><button className="adm-btn primary" onClick={create}>创建</button><button className="adm-btn" onClick={() => setCreating(false)}>取消</button></div>
        </Modal>
      )}
      {resetFor && (
        <Modal title={`重置 ${resetFor} 的密码`} onClose={() => setResetFor(null)}>
          <input type="password" className="adm-input" aria-label="新密码" placeholder="新密码（至少 8 位）" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <div className="adm-btns" style={{ marginTop: 12 }}>
            <button className="adm-btn primary" disabled={newPw.length < 8} onClick={() => { const u = resetFor; setResetFor(null); void act(() => patch(`/users/${u}`, { password: newPw }), '密码已重置'); }}>确认重置</button>
            <button className="adm-btn" onClick={() => setResetFor(null)}>取消</button></div>
        </Modal>
      )}
    </section>
  );
}

export default UsersPage;
