import { expect, type Page } from '@playwright/test';

/** 收集页面错误 / console.error / 失败请求（预期内的 401 会话检查除外） */
export function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // 浏览器对 401/403/404 的资源报错会在 response 里单独判断
    if (/Failed to load resource/.test(t)) return;
    problems.push(`console: ${t.slice(0, 200)}`);
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${u.pathname}`);
    if (r.status() === 404 && !/\/api\/(auth|learning)\/(me|session)/.test(u.pathname)) problems.push(`HTTP 404 ${u.pathname}`);
  });
  return problems;
}

const SKIP = /删除|注销|退出登录|退出|清空数据|恢复备份|重置密码|禁用|烧录|下载固件|上传|导入|安装|卸载|Delete|Logout/;

/** 依次点击页面上所有可见、可用的按钮；每次点击后检查没有新的页面错误，URL 变了就回到原页面。 */
export async function clickEveryButton(page: Page, problems: string[], opts: { skip?: RegExp; max?: number } = {}) {
  const start = page.url();
  const labels = await page.locator('button:visible, a[href]:visible, [role="tab"]:visible').evaluateAll((els) =>
    els.map((e, i) => { (e as HTMLElement).dataset.e2eIdx = String(i); return `${i}|${(e.textContent || e.getAttribute('aria-label') || e.getAttribute('title') || '').trim().slice(0, 30)}`; }));
  let clicked = 0;
  for (const entry of labels.slice(0, opts.max ?? 60)) {
    const [idx, label] = [entry.split('|')[0], entry.slice(entry.indexOf('|') + 1)];
    if (SKIP.test(label) || (opts.skip && opts.skip.test(label))) continue;
    const el = page.locator(`[data-e2e-idx="${idx}"]`);
    if (!(await el.count()) || !(await el.isVisible()) || !(await el.isEnabled())) continue;
    const before = problems.length;
    await el.click({ timeout: 1500, trial: false }).catch(() => {});
    await page.waitForTimeout(150);
    expect(problems.slice(before), `点击「${label}」后`).toEqual([]);
    clicked++;
    if (page.url() !== start) { await page.goto(start); await page.waitForLoadState('networkidle').catch(() => {}); return clicked + (await clickEveryButtonAfter(page, problems, opts, Number(idx) + 1)); }
    await page.keyboard.press('Escape').catch(() => {});
  }
  return clicked;
}

async function clickEveryButtonAfter(page: Page, problems: string[], opts: { skip?: RegExp; max?: number }, from: number): Promise<number> {
  // 回到起始页后跳过已点过的（按序号）
  const all = page.locator('button:visible, a[href]:visible, [role="tab"]:visible');
  const n = Math.min(await all.count(), opts.max ?? 60);
  let clicked = 0;
  const start = page.url();
  for (let i = from; i < n; i++) {
    const el = all.nth(i);
    const label = ((await el.textContent().catch(() => '')) || (await el.getAttribute('aria-label')) || '').trim().slice(0, 30);
    if (SKIP.test(label) || (opts.skip && opts.skip.test(label))) continue;
    if (!(await el.isVisible().catch(() => false)) || !(await el.isEnabled().catch(() => false))) continue;
    const before = problems.length;
    await el.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(150);
    expect(problems.slice(before), `点击「${label}」后`).toEqual([]);
    clicked++;
    if (page.url() !== start) { await page.goto(start); await page.waitForLoadState('networkidle').catch(() => {}); }
    else await page.keyboard.press('Escape').catch(() => {});
  }
  return clicked;
}
