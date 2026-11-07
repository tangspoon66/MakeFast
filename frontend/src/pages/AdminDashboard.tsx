/**
 * 管理员仪表板
 * 
 * 功能：
 * - 显示统计卡片（固件总数、存储使用、下载次数、烧录次数）
 * - 显示热门固件 Top 10
 * - 存储空间警告
 * - 自动刷新（5 分钟）
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AdminClient } from '../api/adminClient';
import type { AdminStatistics } from '../api/types';
import {
  LogOut,
  Cpu,
  Settings,
  Server,
  Download,
  Zap,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Blocks,
  Eye,
  Key,
  FileDown,
  FileCode2,
  Activity,
  HardDrive,
  MessageSquareWarning,
  MessageCircleQuestion,
  ShieldCheck,
  Plus,
} from 'lucide-react';

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 分钟

export function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [statistics, setStatistics] = useState<AdminStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      setError(null);
      const stats = await AdminClient.getStatistics();
      setStatistics(stats);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load statistics:', err);
      setError(err instanceof Error ? err.message : '加载统计信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和自动刷新
  useEffect(() => {
    loadStatistics();
    
    const interval = setInterval(() => {
      loadStatistics();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const handleManualRefresh = () => {
    setLoading(true);
    loadStatistics();
  };

  // 格式化存储空间
  const formatStorage = (mb: number | undefined | null): string => {
    if (mb == null || isNaN(mb)) return '0 MB';
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatPercent = (value: number | undefined | null): string => {
    if (value == null || Number.isNaN(value)) return '0%';
    return `${value.toFixed(1)}%`;
  };

  // Older deployments and cached admin fixtures may omit newer observability
  // fields. Keep the dashboard useful while the API rolls forward.
  const compileStats = statistics?.compile_stats ?? { total: 0, success: 0, failure: 0, failure_rate: 0 };
  const flashStats = statistics?.flash_stats ?? { total: 0, success: 0, failure: 0, failure_rate: 0 };
  const storageStats = statistics?.storage ?? {
    disk_path: '',
    disk_total_mb: 0,
    disk_used_mb: 0,
    disk_free_mb: 0,
    disk_usage_percent: 0,
    app_used_mb: statistics?.total_storage_mb ?? 0,
    breakdown_mb: {},
    warning: statistics?.storage_warning ?? false,
  };
  const recentFeedback = statistics?.recent_feedback ?? [];
  const popularTemplates = statistics?.popular_templates ?? [];
  const topFirmware = statistics?.top_firmware ?? [];

  return (
    <div className="min-h-screen bg-[#edf6fb]">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">管理员仪表板</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">欢迎，{user?.username}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>退出登录</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 快捷操作 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => navigate('/admin/firmware')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">固件管理</h3>
                <p className="text-sm text-slate-600">管理固件和源代码资源</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/firmware/upload')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileDown className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">上传固件</h3>
                <p className="text-sm text-slate-600">上传新的固件包并发布</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/ai-config')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">服务配置</h3>
                <p className="text-sm text-slate-600">管理 AI、语音识别和对象存储</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/libraries')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Arduino 库管理</h3>
                <p className="text-sm text-slate-600">在线安装和管理 Arduino 库</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/blocks')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Blocks className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">自定义积木管理</h3>
                <p className="text-sm text-slate-600">添加和编辑 Blockly 积木块</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/boards')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Cpu className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">开发板管理</h3>
                <p className="text-sm text-slate-600">添加和编辑支持的开发板</p>
              </div>
            </div>
          </button>


          <button
            onClick={() => navigate('/admin/course-qa')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                <MessageCircleQuestion className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">课程问答管理</h3>
                <p className="text-sm text-slate-600">审核课程留言并回复学生</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/learning-courses/temperature-alert')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center"><FileCode2 className="w-6 h-6 text-amber-600" /></div>
              <div><h3 className="font-semibold text-slate-900">学习课程编辑器</h3><p className="text-sm text-slate-600">编辑 schema、校验并发布版本</p></div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/system')}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">系统配置</h3>
                <p className="text-sm text-slate-600">查看部署、对象存储和备份状态</p>
              </div>
            </div>
          </button>

        </div>

        {/* 存储空间警告 */}
        {(statistics?.storage?.warning || statistics?.storage_warning) && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-yellow-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  存储容量不足
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  存储空间使用率已超过 80%，请及时清理缓存、课程附件或扩展存储空间。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {loading && !statistics && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-slate-500 mt-4">加载统计信息中...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && !statistics && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              重试
            </button>
          </div>
        )}

        {/* 统计信息 */}
        {statistics && (
          <>
            {/* 兼容旧版固件管理接口，同时为运营人员保留固件概览。 */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">固件概览</h2>
                <button
                  type="button"
                  onClick={() => navigate('/admin/firmware')}
                  className="text-sm text-blue-600 hover:underline"
                >固件管理</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-slate-600">固件总数</p><p className="text-2xl font-bold text-slate-900">{statistics.total_firmware_count ?? 0}</p></div>
                <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-slate-600">已发布固件</p><p className="text-2xl font-bold text-slate-900">{statistics.published_firmware_count ?? 0}</p><p className="text-xs text-slate-500 mt-1">已发布: {statistics.published_firmware_count ?? 0}</p></div>
                <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-slate-600">近 30 天下载</p><p className="text-2xl font-bold text-slate-900">{statistics.downloads_last_30_days ?? 0}</p></div>
                <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-slate-600">近 30 天烧录</p><p className="text-2xl font-bold text-slate-900">{statistics.flashes_last_30_days ?? 0}</p></div>
                <div className="bg-white p-4 rounded-lg shadow"><p className="text-sm text-slate-600">存储占用</p><p className="text-2xl font-bold text-slate-900">{formatStorage(statistics.total_storage_mb)}</p></div>
              </div>
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">热门固件 Top 10</h3>
                  <button type="button" onClick={() => navigate('/admin/firmware/upload')} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"><Plus className="w-4 h-4" />上传固件</button>
                </div>
                {topFirmware.length === 0 ? <p className="text-center text-slate-500 py-8">暂无固件数据</p> : <div className="divide-y divide-slate-100">{topFirmware.slice(0, 10).map(item => <div key={item.firmware_id} className="flex items-center justify-between px-6 py-3"><span className="font-medium text-slate-800">{item.project_name}</span><span className="text-sm text-slate-500">下载 {item.download_count} · 烧录 {item.flash_count}</span></div>)}</div>}
              </div>
            </section>

            {/* 课程统计卡片 */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">课程统计</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">
                    最后更新: {lastRefresh.toLocaleTimeString('zh-CN')}
                  </span>
                  <button
                    onClick={handleManualRefresh}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>刷新</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">课程总数</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {statistics.total_template_count ?? 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        已发布: {statistics.published_template_count ?? 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-teal-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">查看次数</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {statistics.total_template_views ?? 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        打开项目: {statistics.total_template_open_projects ?? 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Eye className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">课程下载</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {statistics.total_template_downloads ?? 0}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        附件包: {statistics.total_template_package_downloads ?? 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <FileDown className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">课程烧录</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {statistics.total_template_flashes ?? 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">口令解锁</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {statistics.total_template_unlocks ?? 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Key className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">打开项目</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {statistics.total_template_open_projects ?? 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <FileCode2 className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 课程固件排行 */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900">课程固件</h2>
              </div>
              <div className="p-6">
                {popularTemplates.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">暂无课程数据</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            排名
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            课程名称
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            分类
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                            查看次数
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                            下载次数
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                            烧录次数
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {popularTemplates.map((tpl, index) => (
                          <tr
                            key={tpl.template_id}
                            className="hover:bg-[#edf6fb] cursor-pointer"
                            onClick={() => navigate('/admin/resources')}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                    index === 0
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : index === 1
                                      ? 'bg-slate-100 text-slate-800'
                                      : index === 2
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-blue-50 text-blue-800'
                                  }`}
                                >
                                  {index + 1}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {tpl.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                ID: {tpl.template_id.substring(0, 8)}...
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                {tpl.category}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Eye className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-slate-900">
                                  {tpl.view_count}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Download className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-slate-900">
                                  {tpl.download_count}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Zap className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-slate-900">
                                  {tpl.flash_count}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 运行状态 */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">运行状态</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">编译失败率</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {formatPercent(compileStats.failure_rate)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        失败 {compileStats.failure} / 总计 {compileStats.total}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">烧录失败率</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {formatPercent(flashStats.failure_rate)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        失败 {flashStats.failure} / 总计 {flashStats.total}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">存储占用</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {formatPercent(storageStats.disk_usage_percent)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        应用数据 {formatStorage(storageStats.app_used_mb)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <HardDrive className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">服务器磁盘</h3>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full ${storageStats.warning ? 'bg-yellow-500' : 'bg-blue-600'}`}
                        style={{ width: `${Math.min(storageStats.disk_usage_percent, 100)}%` }}
                      />
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>路径: {storageStats.disk_path || '-'}</p>
                      <p>
                        已用 {formatStorage(storageStats.disk_used_mb)} / 总计 {formatStorage(storageStats.disk_total_mb)}
                      </p>
                      <p>可用 {formatStorage(storageStats.disk_free_mb)}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">应用数据占用</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(storageStats.breakdown_mb || {}).map(([key, value]) => (
                        <div key={key} className="border border-slate-200 rounded-lg p-3">
                          <p className="text-xs text-slate-500">{key}</p>
                          <p className="text-lg font-semibold text-slate-900">{formatStorage(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 用户反馈 */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">用户反馈</h2>
                <MessageSquareWarning className="w-5 h-5 text-slate-500" />
              </div>
              <div className="p-6">
                {recentFeedback.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">暂无反馈</p>
                ) : (
                  <div className="space-y-4">
                    {recentFeedback.map(item => (
                      <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-sm font-semibold text-slate-900">{item.category}</span>
                          <span className="text-xs text-slate-500">
                            {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.message}</p>
                        {(item.contact || item.page_url) && (
                          <p className="text-xs text-slate-500 mt-2">
                            {item.contact && `联系方式: ${item.contact} `}
                            {item.page_url && `页面: ${item.page_url}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
