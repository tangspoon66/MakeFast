/** 学生端 → 后端：测验每题用时、编译报错原文（后端脱敏存储，供管理员仪表盘 / 学习者画像）。失败静默。 */
const KEY = 'makefast.learnerId';

export function learnerId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).slice(0, 40);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export type TelemetryPayload =
  | { kind: 'quiz_attempt'; items: { question_id: string; correct: boolean; ms: number; skill?: string }[]; passed?: boolean; course_slug?: string }
  | { kind: 'compile_error'; error_text: string; line?: number; course_slug?: string };

export function sendTelemetry(p: TelemetryPayload): void {
  try {
    const body = JSON.stringify({ course_slug: 'first-lesson', ...p, learner_id: learnerId() });
    void fetch('/api/course-agent/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'same-origin', keepalive: true }).catch(() => {});
  } catch { /* 离线 / 测试环境 */ }
}
