import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CircleCheck, Eye, EyeOff, Mail, Mic, Sparkles, UploadCloud } from 'lucide-react';
import { AdminClient } from '../api/adminClient';
import type { ServiceConfig } from '../api/types';

type TabKey = 'ai' | 'asr' | 'oss' | 'email';

type AIProviderTemplate = {
  id: string;
  name: string;
  tag: string;
  api_base: string;
  model: string;
  temperature: number;
  max_tokens: number;
  key_hint: string;
};

const AI_PROVIDER_TEMPLATES: AIProviderTemplate[] = [
  { id: 'deepseek-official', name: 'DeepSeek 官方', tag: '推荐中文编程', api_base: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 0.7, max_tokens: 2000, key_hint: 'DeepSeek 控制台创建的 API Key' },
  { id: 'siliconflow-deepseek', name: '硅基流动 DeepSeek', tag: '国内中转', api_base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', temperature: 0.7, max_tokens: 2000, key_hint: 'SiliconFlow 控制台创建的 API Key' },
  { id: 'qwen-compatible', name: '通义千问', tag: '阿里云百炼', api_base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', temperature: 0.7, max_tokens: 2000, key_hint: '阿里云百炼 DashScope API Key' },
  { id: 'openai', name: 'OpenAI 官方', tag: '海外接口', api_base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 2000, key_hint: 'OpenAI Platform API Key' },
];

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>{label}</span>;
}

export function AdminAIConfig() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('ai');
  const [config, setConfig] = useState<ServiceConfig>({
    ai: { api_key: '', api_base: 'https://api.openai.com/v1', model: 'gpt-4', temperature: 0.7, max_tokens: 2000 },
    asr: { enabled: false, provider: 'tencent', secret_id: '', secret_key: '', app_id: '', region: 'ap-guangzhou', engine_model_type: '16k_zh' },
    oss: { enabled: false, bucket: '', endpoint: '', region: 'auto', access_key_id: '', secret_access_key: '', public_base_url: '', prefix: 'makefast' },
    email: { enabled: false, smtp_host: '', smtp_port: 465, username: '', password: '', from_email: '', from_name: 'MakeFast', use_ssl: true, use_tls: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showOssSecret, setShowOssSecret] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [testingService, setTestingService] = useState<TabKey | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const response = await AdminClient.getServiceConfig();
      setConfig({
        ai: { ...response.ai, api_key: response.ai.api_key.includes('...') ? '' : response.ai.api_key },
        asr: { ...response.asr, secret_id: response.asr.secret_id.includes('...') ? '' : response.asr.secret_id, secret_key: '' },
        oss: { ...response.oss, access_key_id: response.oss.access_key_id.includes('...') ? '' : response.oss.access_key_id, secret_access_key: '' },
        email: { ...(response.email || { enabled: false, smtp_host: '', smtp_port: 465, username: '', password: '', from_email: '', from_name: 'MakeFast', use_ssl: true, use_tls: false }), password: '' },
      });
      setSelectedTemplateId(AI_PROVIDER_TEMPLATES.find(t => t.api_base === response.ai.api_base && t.model === response.ai.model)?.id ?? null);
      setMessage(null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '加载配置失败' });
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: AIProviderTemplate) => {
    setConfig(current => ({ ...current, ai: { ...current.ai, api_base: template.api_base, model: template.model, temperature: template.temperature, max_tokens: template.max_tokens } }));
    setSelectedTemplateId(template.id);
    setMessage({ type: 'info', text: `已套用「${template.name}」模板。` });
  };

  const save = async () => {
    try {
      setSaving(true);
      setMessage({ type: 'info', text: '正在保存配置...' });
      await AdminClient.updateServiceConfig(config);
      setMessage({ type: 'success', text: '服务配置保存成功！' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '保存配置失败' });
    } finally {
      setSaving(false);
    }
  };

  const testCurrentTab = async () => {
    try {
      setTestingService(tab);
      setMessage({ type: 'info', text: '正在测试连接...' });
      const payload = tab === 'ai'
        ? { service: 'ai' as const, config: config.ai }
        : tab === 'asr'
          ? { service: 'asr' as const, config: config.asr }
          : tab === 'oss'
            ? { service: 'oss' as const, config: config.oss }
            : { service: 'email' as const, config: config.email };
      const result = await AdminClient.testServiceConfig(payload);
      setMessage({ type: result.success ? 'success' : 'error', text: result.message || (result.success ? '连接测试成功' : '连接测试失败') });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || '测试连接失败' });
    } finally {
      setTestingService(null);
    }
  };

  const currentTemplate = useMemo(() => AI_PROVIDER_TEMPLATES.find(t => t.id === selectedTemplateId), [selectedTemplateId]);

  const renderMessage = () => {
    if (!message) return null;
    const Icon = message.type === 'success' ? CircleCheck : AlertCircle;
    const styles = {
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
    }[message.type];
    return <div className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${styles}`}><Icon className="mt-0.5 h-5 w-5 flex-shrink-0" /><p className="text-sm">{message.text}</p></div>;
  };

  if (loading) {
    return <div className="min-h-screen bg-[#edf6fb] p-8"><div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">加载配置中...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#edf6fb] p-8">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('/admin')} className="mb-6 flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900">
          <ArrowLeft className="h-5 w-5" />
          <span>返回仪表板</span>
        </button>

        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">服务配置</h1>
          <p className="text-slate-600">统一管理 AI、大模型语音识别和对象存储</p>
        </div>

        {renderMessage()}

        <div className="mb-6 grid grid-cols-4 rounded-xl border border-slate-200 bg-white p-2">
          {[
            { key: 'ai', label: 'AI 大模型', icon: Sparkles },
            { key: 'asr', label: '语音识别 ASR', icon: Mic },
            { key: 'oss', label: '对象存储 OSS', icon: UploadCloud },
            { key: 'email', label: '邮件通知', icon: Mail },
          ].map(item => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button key={item.key} onClick={() => setTab(item.key as TabKey)} className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${active ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'ai' && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="mb-3 text-lg font-bold text-slate-900">供应商模板</h2>
              </div>
              <button onClick={testCurrentTab} disabled={testingService === 'ai'} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                {testingService === 'ai' ? '测试中...' : '测试连接'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {AI_PROVIDER_TEMPLATES.map(template => {
                const active = selectedTemplateId === template.id;
                return (
                  <button key={template.id} onClick={() => applyTemplate(template)} className={`rounded-lg border p-4 text-left transition-colors ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{template.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{template.tag}</p>
                      </div>
                      {active && <CircleCheck className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <p className="truncate">Base: {template.api_base}</p>
                      <p className="truncate">Model: {template.model}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">API Key</span>
                <div className="relative">
                  <input type={showApiKey ? 'text' : 'password'} value={config.ai.api_key} onChange={e => setConfig(current => ({ ...current, ai: { ...current.ai, api_key: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" placeholder={currentTemplate?.key_hint || 'sk-...'} />
                  <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">API Base</span>
                <input value={config.ai.api_base} onChange={e => setConfig(current => ({ ...current, ai: { ...current.ai, api_base: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Model</span>
                <input value={config.ai.model} onChange={e => setConfig(current => ({ ...current, ai: { ...current.ai, model: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Max Tokens</span>
                <input type="number" value={config.ai.max_tokens} onChange={e => setConfig(current => ({ ...current, ai: { ...current.ai, max_tokens: Number(e.target.value) } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>
          </div>
        )}

        {tab === 'asr' && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">腾讯云一句话识别</h2>
                <p className="text-sm text-slate-500">用于 AI 助手语音输入，仅识别短句</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill ok={config.asr.enabled} label={config.asr.enabled ? '已启用' : '未启用'} />
                <button onClick={testCurrentTab} disabled={testingService === 'asr'} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                  {testingService === 'asr' ? '测试中...' : '测试连接'}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={config.asr.enabled} onChange={e => setConfig(current => ({ ...current, asr: { ...current.asr, enabled: e.target.checked } }))} />
              启用语音识别
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">SecretId</span><input value={config.asr.secret_id} onChange={e => setConfig(current => ({ ...current, asr: { ...current.asr, secret_id: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">SecretKey</span><div className="relative"><input type={showSecretKey ? 'text' : 'password'} value={config.asr.secret_key} onChange={e => setConfig(current => ({ ...current, asr: { ...current.asr, secret_key: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-12" /><button type="button" onClick={() => setShowSecretKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">{showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">AppId（可留空）</span><input value={config.asr.app_id} onChange={e => setConfig(current => ({ ...current, asr: { ...current.asr, app_id: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Region</span><input value={config.asr.region} onChange={e => setConfig(current => ({ ...current, asr: { ...current.asr, region: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">EngineModelType</span><input value={config.asr.engine_model_type} onChange={e => setConfig(current => ({ ...current, asr: { ...current.asr, engine_model_type: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
            </div>
          </div>
        )}

        {tab === 'oss' && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">对象存储</h2>
                <p className="text-sm text-slate-500">用于课程包、缩略图和大文件</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill ok={config.oss.enabled} label={config.oss.enabled ? '已启用' : '未启用'} />
                <button onClick={testCurrentTab} disabled={testingService === 'oss'} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                  {testingService === 'oss' ? '测试中...' : '测试连接'}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={config.oss.enabled} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, enabled: e.target.checked } }))} />
              启用对象存储
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Bucket</span><input value={config.oss.bucket} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, bucket: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Endpoint</span><input value={config.oss.endpoint} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, endpoint: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Region</span><input value={config.oss.region} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, region: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Prefix</span><input value={config.oss.prefix} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, prefix: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Access Key ID</span><input value={config.oss.access_key_id} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, access_key_id: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Secret Access Key</span><div className="relative"><input type={showOssSecret ? 'text' : 'password'} value={config.oss.secret_access_key} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, secret_access_key: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-12" /><button type="button" onClick={() => setShowOssSecret(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">{showOssSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
              <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium text-slate-700">Public Base URL</span><input value={config.oss.public_base_url} onChange={e => setConfig(current => ({ ...current, oss: { ...current.oss, public_base_url: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
            </div>
          </div>
        )}

        {tab === 'email' && (
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">邮件通知</h2>
                <p className="text-sm text-slate-500">用于课程问答回复后的邮箱提醒</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill ok={config.email.enabled} label={config.email.enabled ? '已启用' : '未启用'} />
                <button onClick={testCurrentTab} disabled={testingService === 'email'} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                  {testingService === 'email' ? '测试中...' : '测试连接'}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={config.email.enabled} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, enabled: e.target.checked } }))} />
              启用邮件通知
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">SMTP 主机</span><input value={config.email.smtp_host} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, smtp_host: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" placeholder="smtp.qq.com" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">SMTP 端口</span><input type="number" value={config.email.smtp_port} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, smtp_port: Number(e.target.value) } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">SMTP 用户名</span><input value={config.email.username} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, username: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">SMTP 密码/授权码</span><div className="relative"><input type={showEmailPassword ? 'text' : 'password'} value={config.email.password} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, password: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2 pr-12" /><button type="button" onClick={() => setShowEmailPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100">{showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">发件邮箱</span><input value={config.email.from_email} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, from_email: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
              <label className="space-y-2"><span className="text-sm font-medium text-slate-700">发件人名称</span><input value={config.email.from_name} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, from_name: e.target.value } }))} className="w-full rounded-lg border border-slate-300 px-4 py-2" /></label>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={config.email.use_ssl} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, use_ssl: e.target.checked } }))} />SSL</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={config.email.use_tls} onChange={e => setConfig(current => ({ ...current, email: { ...current.email, use_tls: e.target.checked } }))} />STARTTLS</label>
            </div>
          </div>
        )}


        <div className="mt-6 flex justify-end gap-3">
          <button onClick={load} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">重载</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? '保存中...' : '保存配置'}</button>
        </div>
      </div>
    </div>
  );
}
