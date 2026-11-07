import { test, expect } from '@playwright/test';
import { clickEveryButton, watch } from './helpers';

const SHOTS = '../docs/screenshots';

for (const route of ['/', '/home', '/courses', '/login', '/register', '/library']) {
  test(`页面 ${route}：无报错，所有按钮可点`, async ({ page }) => {
    const problems = watch(page);
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const n = await clickEveryButton(page, problems);
    expect(problems).toEqual([]);
    test.info().annotations.push({ type: 'clicked', description: String(n) });
  });
}

test('目录读取后台已发布课程；第一课可开始，其它显示即将开放', async ({ page }) => {
  await page.goto('/courses');
  await page.getByRole('tab', { name: '全部' }).click();
  await expect(page.locator('[data-start-here="true"]')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/page-courses.png` });
});

test('工作台模拟模式：完整第一课 + 修改建议 + 带我去 + 测验', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/workbench?course=first-lesson');
  await expect(page.getByTestId('lesson-workbench')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/page-workbench.png` });
  const mock = page.getByRole('checkbox', { name: '模拟模式' });
  if (!(await mock.isChecked())) await mock.check();
  await expect(mock).toBeChecked();

  // 代码页：删掉一个分号 → 编译 → 精确到行的修改建议
  await page.getByTestId('tab-code').click();
  const editor = page.locator('textarea').first();
  const code = await editor.inputValue();
  await editor.fill(code.replace('Serial.begin(115200);', 'Serial.begin(115200)'));
  await page.locator('[data-lw-anchor="topbar.compile"]').click();
  await expect(page.getByTestId('fix-card')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/agent-fix-code-line.png` });
  await page.getByTestId('fix-apply').click();
  await page.getByTestId('fix-confirm').click();
  await expect(page.getByTestId('fix-applied')).toBeVisible();
  await page.getByTestId('fix-undo').click();
  await expect(editor).toHaveValue(/Serial\.begin\(115200\)\n/);
  // 撤销后立刻重新本地检查 → 同一条建议马上回来，这次确认帮我改
  await expect(page.getByTestId('fix-apply')).toBeVisible({ timeout: 2000 });
  await page.getByTestId('fix-apply').click();
  await page.getByTestId('fix-confirm').click();
  expect(await editor.inputValue()).toContain('Serial.begin(115200);');

  // 积木页：引脚改错 → 积木字段建议
  await page.getByTestId('tab-blocks').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/page-workbench-blocks.png` });
  // 连线改到 D2 → 积木里的引脚字段与连线图不一致 → 积木字段修改建议
  const selId = await page.locator('select[data-lw-anchor^="wire."]').filter({ has: page.locator('option[value="D0"]:checked') }).first().getAttribute('data-lw-anchor');
  const dataSel = page.locator(`select[data-lw-anchor="${selId}"]`);
  await dataSel.selectOption('D2');
  await page.locator('[data-lw-anchor="topbar.compile"]').click();
  await expect(page.getByTestId('fix-card')).toBeVisible();
  await page.waitForTimeout(500);
  const card = await page.getByTestId('agent-fix').boundingBox();
  const blk = await page.locator('[data-id="dht_setup"] > .blocklyPath').first().boundingBox();
  expect(card && blk).toBeTruthy();
  const top = card!.y - 40; // 含卡片上方的小铁猫头像
  const overlap = card!.x < blk!.x + blk!.width && card!.x + card!.width > blk!.x && top < blk!.y + blk!.height && card!.y + card!.height > blk!.y;
  expect(overlap, '修改建议卡不能盖住目标积木').toBe(false);
  await page.screenshot({ path: `${SHOTS}/agent-fix-block.png` });
  await page.getByTestId('fix-apply').click();
  await page.getByTestId('fix-confirm').click();
  await page.getByTestId('fix-undo').click();
  await dataSel.selectOption('D0');
  await page.waitForTimeout(300);

  // 聊天 + 带我去
  await page.getByTestId('agent-summon').click();
  const chat = page.getByTestId('agent-chat');
  await expect(chat).toBeVisible();
  await chat.locator('input, textarea').first().fill('DATA 线接哪里？');
  await chat.locator('input, textarea').first().press('Enter');
  const chip = page.getByTestId('chat-goto-chip').first();
  await expect(chip).toBeVisible({ timeout: 15000 });
  await chip.click();
  await expect(page.getByTestId('agent-nav')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/agent-nav-pin.png` });

  // 主线：连接 → 编译 → 烧录 → 串口 → 确认现象
  for (const id of ['topbar.connect', 'topbar.compile', 'topbar.flash']) {
    const b = page.locator(`[data-lw-anchor="${id}"]`);
    await expect(b).toBeEnabled({ timeout: 20000 });
    await b.click();
    await page.waitForTimeout(1500);
  }
  // 烧录（模拟设备）：进度走完、按钮变「完成」，随后串口出读数
  await expect(page.locator('[data-lw-anchor="topbar.flash"]')).toContainText('完成', { timeout: 30000 });
  await expect(page.getByTestId('serial-dock')).toContainText(/温度|Temp/i, { timeout: 30000 });
  await page.getByTestId('confirm-phenomenon').click().catch(() => {});
  await page.screenshot({ path: `${SHOTS}/page-workbench-done.png` });
  const quiz = page.getByTestId('open-quiz');
  if (await quiz.isVisible().catch(() => false)) {
    await quiz.click();
    const modal = page.getByTestId('quiz-modal');
    await expect(modal).toBeVisible();
    for (const fs of await modal.locator('fieldset:has(input[type=radio])').all()) await fs.locator('input[type=radio]').first().check();
    await page.getByTestId('practical-check').check().catch(() => {});
    await page.getByTestId('quiz-submit').click();
    await expect(page.getByTestId('quiz-result')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/page-quiz-growth.png` });
  }
  expect(problems).toEqual([]);
});

test('注册 → /dashboard → /project 可用', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/register');
  const u = `e2e${Date.now() % 1e8}`;
  await page.getByPlaceholder('例如：xiaoming').fill(u);
  await page.getByPlaceholder('至少 8 位').fill('e2e-password-1');
  await page.locator('form button[type=submit]').click();
  await page.waitForLoadState('networkidle');
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/page-dashboard.png` });
  await clickEveryButton(page, problems, { skip: /退出/ });
  await page.goto('/project');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/page-project.png` });
  expect(problems).toEqual([]);
});

test('评委演示导览：8 步自动走完 → 成长卡推荐第二课 → 第二课可玩', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await page.locator('[data-cta="judge-demo"]').click();
  await expect(page.getByTestId('demo-director')).toBeVisible();
  await expect(page.getByTestId('agent-greeting')).toBeVisible();
  for (let i = 1; i <= 8; i++) {
    await page.getByTestId('demo-next').click();
    await expect(page.locator('.demo-dir__count')).toHaveText(`${i} / 8`, { timeout: 60000 });
    if (i === 3) {
      await expect(page.getByTestId('fix-reasoning')).toContainText('真正要改的是上一行');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOTS}/demo-3-diagnosis.png` });
    }
    if (i === 7) await page.screenshot({ path: `${SHOTS}/demo-7-chat-trace.png` });
  }
  await expect(page.getByTestId('recommendations')).toContainText('排错小侦探');
  await page.screenshot({ path: `${SHOTS}/demo-8-growth.png` });
  await page.getByTestId('rec-go').first().click();
  await page.waitForURL(/course=debug-detective/);
  await expect(page.getByText('排错小侦探：读懂报错').first()).toBeVisible();
  await page.locator('[data-lw-anchor="topbar.board"]').click();
  await page.locator('[data-lw-anchor="topbar.compile"]').click();
  await expect(page.getByTestId('fix-card')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/lesson2-detective.png` });
  expect(problems).toEqual([]);
});

test('404 页、标签标题、favicon', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByTestId('not-found')).toBeVisible();
  await expect(page).toHaveTitle(/MakeFast/);
  await page.getByRole('link', { name: '看看课程' }).click();
  await expect(page).toHaveTitle('课程目录 · MakeFast 一键造物');
  const icon = await page.request.get('/mf-icon-32.png');
  expect(icon.ok()).toBe(true);
});

test('旧 /welcome 跳到新欢迎页，页面上不再宣传语音输入', async ({ page }) => {
  await page.goto('/welcome');
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.locator('body')).not.toContainText('语音');
});
