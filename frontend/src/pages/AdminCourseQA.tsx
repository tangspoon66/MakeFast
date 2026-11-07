import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, EyeOff, Mail, RefreshCw, Search, Send, Trash2 } from 'lucide-react';
import { AdminClient } from '../api/adminClient';
import { templateApi, type TemplateListItem } from '../api/templateApi';
import type { CourseQAItem } from '../api/types';

const STATUS_LABEL: Record<CourseQAItem['status'], string> = {
  pending: '待审核',
  approved: '已公开',
  replied: '已回复',
  hidden: '已隐藏',
};

const STATUS_STYLE: Record<CourseQAItem['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-blue-50 text-blue-700 ring-blue-200',
  replied: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  hidden: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function AdminCourseQA() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CourseQAItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const templateNameById = useMemo(() => new Map(templates.map(t => [t.template_id, t.name])), [templates]);

  const load = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const [qa, tplResp] = await Promise.all([
        AdminClient.listCourseQA({ status, search: search.trim() || undefined, template_id: templateId || undefined, limit: 200 }),
        templateApi.adminList({ page_size: 50 }),
      ]);
      setItems(qa);
      setTemplates(tplResp.templates || []);
    } catch (error: any) {
      setMessage(error?.message || '加载课程问答失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runAction = async (id: string, action: () => Promise<any>, successText: string) => {
    try {
      setBusyId(id);
      const result = await action();
      const emailMsg = result?.email?.message ? `，${result.email.message}` : '';
      setMessage(`${successText}${emailMsg}`);
      await load();
    } catch (error: any) {
      setMessage(error?.message || '操作失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="mx-auto max-w-7xl">
        <button onClick={() => navigate('/admin')} className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-5 w-5" />
          <span>返回仪表板</span>
        </button>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">课程问答管理</h1>
            <p className="mt-2 text-slate-600">审核课程下方展示的留言，并回复学生邮箱。</p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[160px_220px_1fr_auto]">
            <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="pending">待审核</option>
              <option value="approved">已公开</option>
              <option value="replied">已回复</option>
              <option value="hidden">已隐藏</option>
              <option value="all">全部</option>
            </select>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">全部课程</option>
              {templates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索昵称、邮箱或内容" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
            </div>
            <button onClick={load} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">筛选</button>
          </div>
        </div>

        {message && <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl bg-white p-8 text-center text-slate-500">加载中...</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-slate-500">暂无课程问答</div>
          ) : items.map(item => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{item.nickname}</span>
                    {item.email && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" />{item.email}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">课程：{templateNameById.get(item.template_id) || item.template_id}</p>
                </div>
                <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString('zh-CN')}</span>
              </div>

              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.content}</p>

              {item.admin_reply && <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800"><strong>回复：</strong>{item.admin_reply}</div>}

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <textarea value={replyDrafts[item.id] ?? item.admin_reply ?? ''} onChange={e => setReplyDrafts(current => ({ ...current, [item.id]: e.target.value }))} rows={3} placeholder="输入回复内容。回复后会公开显示，并在配置邮件服务后通知用户邮箱。" className="w-full resize-none rounded-lg border border-slate-300 p-3 text-sm" />
                <div className="flex flex-wrap items-start gap-2 md:flex-col">
                  <button disabled={busyId === item.id} onClick={() => runAction(item.id, () => AdminClient.replyCourseQA(item.id, replyDrafts[item.id] ?? item.admin_reply ?? '', true), '回复已保存')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><Send className="h-4 w-4" />回复公开</button>
                  <button disabled={busyId === item.id} onClick={() => runAction(item.id, () => AdminClient.approveCourseQA(item.id), '已审核通过')} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />通过</button>
                  <button disabled={busyId === item.id} onClick={() => runAction(item.id, () => AdminClient.hideCourseQA(item.id), '已隐藏')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><EyeOff className="h-4 w-4" />隐藏</button>
                  <button disabled={busyId === item.id} onClick={() => runAction(item.id, () => AdminClient.deleteCourseQA(item.id), '已删除')} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"><Trash2 className="h-4 w-4" />删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
