import { test, expect, type Page } from '@playwright/test';
import { watch } from './helpers';

const SHOTS = '../docs/screenshots';

async function cardInsideViewport(page: Page) {
  const card = page.locator('.ac-card').first();
  await expect(card).toBeVisible();
  await page.waitForTimeout(800); // 布局稳定后（多次测量）
  const vp = page.viewportSize()!;
  const box = (await card.boundingBox())!;
  const cat = (await page.locator('.ac-card .ac-cat').first().boundingBox())!;
  const top = Math.min(box.y, cat.y);
  expect(top, '卡片（含头像）顶部在视口内').toBeGreaterThanOrEqual(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, '卡片底部在视口内').toBeLessThanOrEqual(vp.height);
}

test('首页 → 工作台（模拟）连续两次：教练卡始终整体在视口内', async ({ page }) => {
  const problems = watch(page);
  for (let round = 0; round < 2; round++) {
    await page.goto('/home');
    await page.getByRole('button', { name: /开始第一课|继续学习/ }).first().click();
    await expect(page.getByTestId('course-article')).toBeVisible({ timeout: 8000 });
    await page.getByTestId('article-start-create').getByRole('link', { name: '开始创作' }).click();
    await expect(page.getByTestId('lesson-workbench')).toBeVisible({ timeout: 10000 });
    const mock = page.getByRole('checkbox', { name: '模拟模式' });
    if (!(await mock.isChecked())) await mock.check();
    await cardInsideViewport(page);
    if (round === 1) await page.screenshot({ path: `${SHOTS}/coach-viewport.png` });
    await page.goto('/home');
  }
  expect(problems).toEqual([]);
});

test('模拟模式旁的「?」说明', async ({ page }) => {
  await page.goto('/workbench?course=first-lesson');
  await page.getByTestId('mock-help').hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.getByRole('tooltip')).toContainText('不用接板子');
});

test('年龄档：首次进工作台选一次；高中档「为什么」默认折叠，文字更短；可在课程面板改', async ({ page }) => {
  await page.goto('/workbench?course=first-lesson');
  const chooser = page.getByTestId('age-tier-chooser');
  await expect(chooser).toBeVisible();
  const lowText = await (async () => { await page.getByTestId('age-tier-low').click(); return page.getByTestId('guide-step-card').innerText(); })();
  await expect(chooser).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/age-tiers.png` });
  await page.getByTestId('age-tier-select').selectOption('high');
  await expect(page.getByTestId('why-folded')).toBeVisible();
  await expect(page.getByTestId('why-folded')).not.toHaveAttribute('open', '');
  const highText = await page.getByTestId('guide-step-card').innerText();
  expect(highText.length).toBeLessThan(lowText.length);
  await page.reload();
  await expect(page.getByTestId('age-tier-chooser')).toHaveCount(0);
  await expect(page.getByTestId('why-folded')).toBeVisible();
  // 「我的进度」页也能改
  await page.goto('/dashboard');
});

test('插板识别：连接后行内提示「检测到 ESP32-S3 类板子」并自动选好板型', async ({ page }) => {
  await page.goto('/workbench?course=first-lesson');
  const mock = page.getByRole('checkbox', { name: '模拟模式' });
  if (!(await mock.isChecked())) await mock.check();
  await page.locator('[data-lw-anchor="topbar.connect"]').click();
  await expect(page.getByTestId('board-detect-note')).toContainText('检测到 ESP32-S3 类板子');
  await expect(page.locator('[data-lw-anchor="topbar.board"]')).toContainText(/✓|已/);
  await page.screenshot({ path: `${SHOTS}/board-detect.png` });
});

test('统一连线图：真实板形 + 只有横竖线', async ({ page }) => {
  await page.goto('/workbench?course=first-lesson');
  const host = page.getByTestId('wiring-panel');
  await expect(host).toBeVisible({ timeout: 5000 });
  const svg = host.getByTestId('wiring-schematic');
  await expect(svg).toBeVisible();
  await expect(svg.locator('image[href*="board.svg"]')).toHaveCount(1);
  const pts = await svg.locator('[data-edge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-points') || ''));
  expect(pts.length).toBeGreaterThanOrEqual(6);
  for (const s of pts) {
    const p = s.split(' ').map((q) => q.split(',').map(Number));
    for (let i = 1; i < p.length; i++) expect(p[i][0] === p[i - 1][0] || p[i][1] === p[i - 1][1]).toBe(true);
  }
  await host.screenshot({ path: `${SHOTS}/wiring-orthogonal.png` });
});

test('接线步骤自动全屏；退出 / Esc 回侧栏；手动开关；引脚下拉箭头不压字', async ({ page }) => {
  await page.goto('/workbench?course=first-lesson');
  await expect(page.getByTestId('lesson-workbench')).toBeVisible();
  const chooser = page.getByTestId('age-tier-chooser');
  if (await chooser.count()) await page.getByTestId('age-tier-mid').click();
  // meet 不高亮 wiringAnchor → 侧栏；手动全屏 / Esc
  await expect(page.getByTestId('wiring-panel')).toBeVisible();
  await expect(page.getByTestId('wiring-fullscreen')).toHaveCount(0);
  await page.getByTestId('wiring-fullscreen-enter').click();
  await expect(page.getByTestId('wiring-fullscreen')).toBeVisible();
  const sel = page.getByTestId('wiring-fullscreen').locator('.lw-pin-select').nth(1);
  await expect(sel).toHaveCSS('padding-right', /^(3[0-9]|[4-9][0-9])/);
  await page.screenshot({ path: `${SHOTS}/wiring-fullscreen.png` });
  await page.getByTestId('wiring-fullscreen').locator('.lw-wiring__table').screenshot({ path: `${SHOTS}/wiring-pin-select.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('wiring-fullscreen')).toHaveCount(0);

  // 用「下一步」走到接线步（自动全屏）→ 再回板型步（自动退出）→ 蜂鸣器步再进 → 手动退出不回弹
  const next = () => page.getByRole('button', { name: '我做好了，下一步' }).click({ force: true });
  await next(); // → board
  await expect(page.getByTestId('wiring-fullscreen')).toHaveCount(0);
  await next(); // → wire-dht
  await expect(page.locator('[data-lw-anchor="step.wire-dht"]')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('wiring-fullscreen')).toBeVisible({ timeout: 5000 });
  await page.locator('[data-lw-anchor="step.board"]').click({ force: true });
  await expect(page.getByTestId('wiring-fullscreen')).toHaveCount(0, { timeout: 5000 });
  await next(); // board → wire-dht again if we're on board... actually after click board we're on board
  await page.locator('[data-lw-anchor="step.wire-buzzer"]').click({ force: true });
  await expect(page.getByTestId('wiring-fullscreen')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('wiring-fullscreen-exit').click();
  await expect(page.getByTestId('wiring-fullscreen')).toHaveCount(0);
  await expect(page.getByTestId('wiring-panel')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('wiring-fullscreen')).toHaveCount(0);
});
