/** 课程资源下载 / 解锁面板（从 HomePage 拆出）。 */
import { Download, FileText, Folder, Lock, Zap } from 'lucide-react';
import { templateApi } from '../../api/templateApi';

export interface CourseResourcesPanelProps {
  course: any;
  onImport: () => void;
  unlockingPkg: string | null; setUnlockingPkg: (v: string | null) => void;
  unlockCode: string; setUnlockCode: (v: string) => void;
  unlockError: string; setUnlockError: (v: string) => void;
  onUnlocked: (pkg: string) => void;
}

export function CourseResourcesPanel({ course, onImport, unlockingPkg, setUnlockingPkg, unlockCode, setUnlockCode, unlockError, setUnlockError, onUnlocked }: CourseResourcesPanelProps) {
  return (

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto p-4 space-y-3 min-h-0">
              {course.files?.length > 0 && (
                <button
                  onClick={onImport}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-md transition-all active:scale-[0.98]"
                >
                  <Zap size={20} />
                  一键打开课程代码
                </button>
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2.5">课程资源下载</h3>
                {course.files?.length > 0 && (
                  <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden mb-2">
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <span className="text-[13px] text-slate-700">源代码.zip</span>
                      </div>
                      <a
                        href={templateApi.getSourceDownloadUrl(course.template_id || course.id)}
                        download
                        className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-400 transition-colors no-underline"
                      >
                        <Download size={14} />
                        下载
                      </a>
                    </div>
                  </div>
                )}
                {course.packages?.map((pkg: string) => {
                  const labelMap: Record<string, string> = {
                    '3d_model': '3D打印模型.zip',
                    'course_material': '课程资料.zip',
                    'document': '文档资料',
                  };
                  const isLocked = course.locked_resources?.includes(pkg);
                  const isUnlocking = unlockingPkg === pkg;
                  return (
                    <div key={pkg} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden mb-2">
                      <div className="flex items-center justify-between px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Folder size={16} className="text-slate-400" />
                          <span className="text-[13px] text-slate-700">{labelMap[pkg] || `${pkg}.zip`}</span>
                          {isLocked && <Lock size={14} className="text-amber-500" />}
                        </div>
                        {isLocked ? (
                          <button onClick={() => { setUnlockingPkg(pkg); setUnlockCode(''); setUnlockError(''); }}
                            className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors">
                            <Lock size={14} />
                            解锁下载
                          </button>
                        ) : (
                          <a
                            href={templateApi.getPackageDownloadUrl(course.template_id || course.id, pkg)}
                            download
                            className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-400 transition-colors no-underline"
                          >
                            <Download size={14} />
                            下载
                          </a>
                        )}
                      </div>
                      {isUnlocking && (
                        <div className="px-3.5 py-2.5 border-t border-slate-200 bg-amber-50">
                          <div className="flex gap-2 items-center">
                            <input type="text" value={unlockCode}
                              onChange={(e) => { setUnlockCode(e.target.value); setUnlockError(''); }}
                              placeholder="请输入解锁口令"
                              className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-[13px] outline-none focus:border-blue-400"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  templateApi.verifyUnlock(course.template_id || course.id, unlockCode).then(ok => {
                                    if (ok) {
                                      setUnlockingPkg(null);
                                      setUnlockCode('');
                                      onUnlocked(pkg);
                                    } else { setUnlockError('口令错误，请重试'); }
                                  });
                                }
                              }}
                            />
                            <button onClick={() => {
                              templateApi.verifyUnlock(course.template_id || course.id, unlockCode).then(ok => {
                                if (ok) {
                                  setUnlockingPkg(null);
                                  setUnlockCode('');
                                  onUnlocked(pkg);
                                } else { setUnlockError('口令错误，请重试'); }
                              });
                            }} className="shrink-0 px-2 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-400 transition-colors whitespace-nowrap">确认</button>
                            <button onClick={() => { setUnlockingPkg(null); setUnlockCode(''); setUnlockError(''); }}
                              className="shrink-0 px-2 py-1 border border-slate-300 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors whitespace-nowrap">取消</button>
                          </div>
                          {unlockError && <p className="mt-1.5 text-xs text-red-600">{unlockError}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[13px] text-slate-400 text-center">更多内容即将上线...</p>
            </div>
  );
}
