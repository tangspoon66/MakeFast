/** 问题反馈弹窗（从 HomePage 拆出）。 */
import { MessageSquareWarning, X } from 'lucide-react';

export interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  category: string; onCategoryChange: (v: string) => void;
  message: string; onMessageChange: (v: string) => void;
  contact: string; onContactChange: (v: string) => void;
  includeLogs: boolean; onIncludeLogsChange: (v: boolean) => void;
  submitting: boolean;
  onSubmit: () => void;
  logsPreview: string[];
  hasSerialLines: boolean;
}

export function FeedbackDialog({ open, onClose, category, onCategoryChange, message, onMessageChange, contact, onContactChange, includeLogs, onIncludeLogsChange, submitting, onSubmit, logsPreview, hasSerialLines }: FeedbackDialogProps) {
  if (!open) return null;
  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">问题反馈</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="关闭反馈窗口"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">类型</label>
                <select
                  value={category}
                  onChange={(event) => onCategoryChange(event.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                >
                  <option value="故障反馈">故障反馈</option>
                  <option value="功能建议">功能建议</option>
                  <option value="课程问题">课程问题</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">描述</label>
                <textarea
                  value={message}
                  onChange={(event) => onMessageChange(event.target.value)}
                  rows={5}
                  maxLength={3000}
                  placeholder="请描述你刚才遇到的问题，最好包含触发步骤和现象。"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">联系方式</label>
                <input
                  value={contact}
                  onChange={(event) => onContactChange(event.target.value)}
                  maxLength={120}
                  placeholder="可选，便于管理员联系你"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeLogs}
                  onChange={(event) => onIncludeLogsChange(event.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span>附带最近执行日志</span>
              </label>
              {includeLogs && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-600">将附带 {logsPreview.length} 条日志</span>
                    {hasSerialLines && (
                      <span className="text-[11px] text-slate-500">包含串口输出</span>
                    )}
                  </div>
                  {logsPreview.length === 0 ? (
                    <p className="text-xs text-slate-500">暂无可附带的执行日志。</p>
                  ) : (
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                      {logsPreview.slice(-6).join('\n')}
                    </pre>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {submitting ? '提交中...' : '提交反馈'}
              </button>
            </div>
          </div>
        </div>
  );
}
