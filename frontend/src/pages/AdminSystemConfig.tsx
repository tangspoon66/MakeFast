import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Download, HardDrive, Server, ShieldCheck, UploadCloud, Zap } from 'lucide-react';
import { AdminClient } from '../api/adminClient';
import type { BackupInfo, SystemStatus } from '../api/types';

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
      ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    }`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[60%] truncate text-right text-sm font-medium text-slate-800">
        {value === true ? '是' : value === false ? '否' : value || '-'}
      </span>
    </div>
  );
}

export function AdminSystemConfig() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [systemStatus, backupList] = await Promise.all([
        AdminClient.getSystemStatus(),
        AdminClient.listBackups(),
      ]);
      setStatus(systemStatus);
      setBackups(backupList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载系统配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createBackup = async () => {
    setCreatingBackup(true);
    setError('');
    try {
      await AdminClient.createBackup();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建备份失败');
    } finally {
      setCreatingBackup(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">系统配置</h1>
              <p className="text-sm text-slate-500">部署、存储、备份和运行状态</p>
            </div>
          </div>
          <button onClick={load} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            刷新
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading || !status ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">加载中...</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-600" />
                  <h2 className="font-bold text-slate-900">部署状态</h2>
                </div>
                <InfoRow label="环境" value={status.environment} />
                <InfoRow label="域名" value={status.domain} />
                <InfoRow label="Cookie Secure" value={status.cookie_secure} />
                <InfoRow label="允许来源" value={status.allowed_origins.join(', ')} />
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-emerald-600" />
                  <h2 className="font-bold text-slate-900">对象存储</h2>
                  <StatusPill ok={status.object_storage.enabled} label={status.object_storage.enabled ? '已启用' : '未启用'} />
                </div>
                <InfoRow label="Bucket" value={status.object_storage.bucket} />
                <InfoRow label="Endpoint" value={status.object_storage.endpoint} />
                <InfoRow label="Public URL" value={status.object_storage.public_base_url} />
                <InfoRow label="密钥状态" value={status.object_storage.secret_key_configured ? '已配置' : '未配置'} />
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-600" />
                  <h2 className="font-bold text-slate-900">编译资源</h2>
                </div>
                <InfoRow label="并发编译" value={status.compile.concurrency} />
                <InfoRow label="队列等待秒数" value={status.compile.queue_timeout_seconds} />
                <InfoRow label="Redis 配置" value={status.redis.configured ? '已配置' : '未配置'} />
                <InfoRow label="Redis 连接" value={status.redis.connected ? '正常' : '未连接'} />
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-600" />
                  <h2 className="font-bold text-slate-900">SQLite</h2>
                  <StatusPill ok={status.sqlite.exists} label={status.sqlite.exists ? '正常' : '未创建'} />
                </div>
                <InfoRow label="路径" value={status.sqlite.path} />
                <InfoRow label="大小" value={`${status.sqlite.size_mb} MB`} />
                <InfoRow label="备份数量" value={status.sqlite.backup_count} />
                <InfoRow label="最近备份" value={status.sqlite.latest_backup?.name} />
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-purple-600" />
                  <h2 className="font-bold text-slate-900">AI 配置</h2>
                </div>
                <InfoRow label="模型" value={status.ai_config.model} />
                <InfoRow label="API Key" value={status.ai_config.api_key_configured ? '已配置' : '未配置'} />
                <InfoRow label="后台写入" value={status.ai_config.runtime_write_allowed ? '允许' : '生产禁用'} />
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-slate-700" />
                  <h2 className="font-bold text-slate-900">备份操作</h2>
                </div>
                <button
                  onClick={createBackup}
                  disabled={creatingBackup}
                  className="mb-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {creatingBackup ? '创建中...' : '创建 SQLite 备份'}
                </button>
                <div className="max-h-40 space-y-2 overflow-auto">
                  {backups.length === 0 ? (
                    <p className="text-sm text-slate-500">暂无备份</p>
                  ) : backups.map(item => (
                    <a
                      key={item.name}
                      href={AdminClient.getBackupDownloadUrl(item.name)}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="truncate text-slate-700">{item.name}</span>
                      <Download className="h-4 w-4 text-slate-400" />
                    </a>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
