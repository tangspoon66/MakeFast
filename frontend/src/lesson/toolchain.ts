/**
 * 工具链步进（板型 → 连接 → 编译 → 烧录 → 串口）状态：todo / current / done / error。
 */
import type { PhaseId, PhaseState } from './lessonStore';

export const PHASE_ORDER: PhaseId[] = ['board', 'connection', 'build', 'flash', 'serial'];

/** 重新计算 current：第一个未完成且非 error 的阶段标为 current，其后的 current 降回 todo */
export function normalizeToolchain(tc: Record<PhaseId, PhaseState>): Record<PhaseId, PhaseState> {
  const out = { ...tc };
  let found = false;
  for (const id of PHASE_ORDER) {
    const s = out[id];
    if (s.status === 'done') continue;
    if (!found) {
      found = true;
      if (s.status === 'todo') out[id] = { ...s, status: 'current' };
    } else if (s.status === 'current') {
      out[id] = { ...s, status: 'todo' };
    }
  }
  return out;
}

/** 某阶段失效（如改了代码）时，它和后面的阶段都要重来 */
export function invalidateFrom(tc: Record<PhaseId, PhaseState>, phase: PhaseId): Record<PhaseId, PhaseState> {
  const out = { ...tc };
  const idx = PHASE_ORDER.indexOf(phase);
  PHASE_ORDER.slice(idx).forEach((id) => { if (out[id].status !== 'todo') out[id] = { status: 'todo' }; });
  return normalizeToolchain(out);
}

/** 编译错误 → 儿童可读短句 + 建议（F-BLD-01） */
export function childCompileMessage(raw: string, line?: number): string {
  const at = line ? `第 ${line} 行` : '程序里';
  if (/DHT\.h: No such file|No such file or directory/i.test(raw)) return '编译服务器上还没装好需要的库（DHT 传感器库）。请老师在管理端安装「DHT sensor library」后再试；也可以先用模拟模式体验。';
  if (/expected ';'/i.test(raw)) return `${at}好像少了一个分号「;」。每句话的末尾都要加上它，就像句号一样。`;
  if (/was not declared in this scope/i.test(raw)) {
    const name = raw.match(/'([^']+)' was not declared/)?.[1];
    return `${at}用到了「${name || '一个名字'}」，但电脑不认识它。检查一下是不是拼错了、或者大小写不对。`;
  }
  if (/expected '\}'|expected '\)'/i.test(raw)) return `${at}的括号没有配对，数一数「(」和「)」、「{」和「}」是不是一样多。`;
  return `${at}有一个问题：${raw.slice(0, 120)}。改好后再点一次「编译」就行。`;
}

/** 烧录/连接错误 → 儿童可读短句 */
export function childDeviceMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/No port selected|未选择|NotFoundError/i.test(msg)) return '没有选中设备。再点一次「连接」，在弹窗里选中你的小板（通常名字里有 USB / JTAG）。';
  if (/not supported|不支持/i.test(msg)) return '这个浏览器不能直接连小板。请用电脑上的 Chrome 或 Edge 打开，或者打开「模拟模式」体验。';
  if (/Failed to open|already open|NetworkError|access denied/i.test(msg)) return '串口被别的程序占用了。关掉 Arduino IDE 或其它串口工具，再试一次。';
  if (/Failed to connect|Timed out|sync/i.test(msg)) return '和小板“握手”失败。按住小板上的 B（BOOT）键再插 USB，然后重新点「烧录」。';
  if (/abort|取消/i.test(msg)) return '已经停下来了。准备好后再点一次即可。';
  return `出了点小状况：${msg.slice(0, 100)}。检查 USB 线后再试一次。`;
}
