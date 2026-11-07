/** 有破坏性的操作（全部在 scripts/e2e.sh 的临时库里跑）：课程增删/发布/下架、FAQ 增改删、账号角色、退出登录、删除作品 */
import { test, expect, type Page } from '@playwright/test';
import { watch } from './helpers';

const USER = process.env.E2E_ADMIN_USER || '';
const PASS = process.env.E2E_ADMIN_PASSWORD || '';

async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.getByPlaceholder('请输入用户名').fill(USER);
  await page.getByPlaceholder('请输入密码').fill(PASS);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/admin(\/|$)(?!login)/);
}

test.describe('管理员破坏性操作', () => {
  test.skip(!USER || !PASS, '需要 scripts/e2e.sh');
  test.beforeEach(async ({ page }) => { page.on('dialog', (d) => void d.accept()); await adminLogin(page); });

  test('课程：新建 → 发布（学生目录可见）→ 下架 → 删除', async ({ page }) => {
    const problems = watch(page);
    const slug = `e2e-course-${Date.now() % 1e6}`;
    await page.goto('/admin/courses');
    await page.getByRole('button', { name: '+ 新建课程' }).click();
    await page.getByLabel('课程标识').fill(slug);
    await page.getByLabel('标题').first().fill('E2E 测试课');
    await page.getByLabel('简介').fill('自动化测试创建');
    const addStep = page.getByRole('button', { name: '+ 添加步骤' });
    if (await addStep.isVisible()) {
      await addStep.click();
      await page.getByLabel('步骤1ID').fill('s1');
      await page.getByLabel('步骤1标题').fill('第一步');
      await page.getByLabel('步骤1为什么').fill('测试');
    }
    await page.getByRole('button', { name: '+ 添加题目' }).click();
    await page.getByLabel('题目1ID').fill('q1');
    await page.getByLabel('题目1题干').fill('DATA 接哪？');
    for (const inp of await page.locator('input[aria-label^="题目1选项"]').all()) await inp.fill(`选项${Math.random().toString(36).slice(2, 5)}`);
    await page.locator('input[name="ans-0"]').first().check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const row = page.locator('tr', { hasText: slug });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '发布' }).click();
    await expect(row).toContainText(/已发布|published/);
    // 学生端目录读到它（显示「即将开放」）
    const student = await page.context().newPage();
    await student.goto('/courses');
    await student.getByRole('tab', { name: '全部' }).click();
    await expect(student.getByText('E2E 测试课')).toBeVisible();
    await expect(student.locator('article', { hasText: 'E2E 测试课' }).getByRole('button')).toHaveText('即将开放');
    await student.close();
    await row.getByRole('button', { name: '下架' }).click();
    await expect(row).not.toContainText(/已发布|published/);
    await row.getByRole('button', { name: '删除' }).click();
    await expect(page.locator('tr', { hasText: slug })).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('FAQ：新增 → 编辑 → 学生聊天用到 → 删除', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/admin/agent?tab=faq');
    const tab = page.getByRole('tab', { name: /FAQ/ });
    if (await tab.count()) await tab.first().click();
    await page.getByRole('button', { name: '+ 新增 FAQ' }).click();
    await page.getByLabel('问题').fill('E2E 小铁猫会唱歌吗编译');
    await page.getByLabel('答案').fill('E2E-FAQ-答案一');
    await page.getByRole('button', { name: '保存' }).click();
    const row = page.locator('tr, li, .adm-card', { hasText: 'E2E 小铁猫会唱歌吗编译' }).last();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '编辑' }).click();
    await page.getByLabel('答案').fill('E2E-FAQ-答案二');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('E2E-FAQ-答案二').first()).toBeVisible();
    // 学生端小铁猫（离线 FAQ）立刻用上后台改过的答案
    const chat = await page.request.post('/api/course-agent/chat', { data: { message: 'E2E 小铁猫会唱歌吗编译', context: { learner_id: 'e2e' } } });
    expect((await chat.json()).reply).toContain('E2E-FAQ-答案二');
    await page.locator('tr, li, .adm-card', { hasText: 'E2E 小铁猫会唱歌吗编译' }).last().getByRole('button', { name: '删除' }).click();
    await expect(page.getByText('E2E-FAQ-答案二')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('账号：新建编辑 → 改角色 → 删除；退出登录', async ({ page }) => {
    const problems = watch(page);
    const name = `e2eeditor${Date.now() % 1e6}`;
    await page.goto('/admin/users');
    await page.getByRole('button', { name: '+ 新建账户' }).click();
    await page.getByLabel('用户名').fill(name);
    await page.getByLabel('初始密码').fill('e2e-temp-pass-1');
    await page.getByLabel('角色', { exact: true }).selectOption('editor');
    await page.getByRole('button', { name: '创建' }).click();
    const sel = page.getByLabel(`${name} 的角色`);
    await expect(sel).toHaveValue('editor');
    await sel.selectOption('viewer');
    await page.reload();
    await expect(page.getByLabel(`${name} 的角色`)).toHaveValue('viewer');
    await page.locator('tr', { hasText: name }).getByRole('button', { name: '删除' }).click();
    await expect(page.locator('tr', { hasText: name })).toHaveCount(0);
    await page.getByRole('button', { name: '退出登录' }).click();
    await page.waitForURL(/\/admin\/login/);
    await page.goto('/admin/users');
    await page.waitForURL(/\/admin\/login/);
    expect(problems).toEqual([]);
  });
});

test('学习者：删除作品 + 退出登录；后台学习者详情看到画像与会话', async ({ page, browser }) => {
  test.skip(!USER || !PASS, '需要 scripts/e2e.sh');
  page.on('dialog', (d) => void d.accept());
  const problems = watch(page);
  const u = `kid${Date.now() % 1e7}`;
  await page.goto('/register');
  await page.getByPlaceholder('例如：xiaoming').fill(u);
  await page.getByPlaceholder('至少 8 位').fill('e2e-password-1');
  await page.locator('form button[type=submit]').click();
  await page.waitForLoadState('networkidle');
  // 建一个作品
  await page.evaluate(async () => {
    const me = await (await fetch('/api/auth/me', { credentials: 'include' })).json();
    await fetch('/api/learning/projects', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf_token }, body: JSON.stringify({ title: 'E2E 作品', course_slug: null }) });
  });
  // 进工作台产生会话 + 画像同步
  await page.goto('/workbench?course=first-lesson');
  await expect(page.getByTestId('lesson-workbench')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.goto('/dashboard');
  const item = page.locator('li', { hasText: 'E2E 作品' });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: /删除作品/ }).click();
  await expect(page.locator('li', { hasText: 'E2E 作品' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('li', { hasText: 'E2E 作品' })).toHaveCount(0);
  await page.getByRole('button', { name: '退出登录' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/dashboard'));
  expect(problems).toEqual([]);

  const admin = await browser.newPage();
  await adminLogin(admin);
  await admin.goto('/admin/learners');
  await admin.getByText(u).first().click();
  await expect(admin.getByTestId('adm-lesson-profile')).toBeVisible();
  await expect(admin.getByText('first-lesson').first()).toBeVisible();
  await admin.screenshot({ path: '../docs/screenshots/admin-learner-profile.png' });
  await admin.close();
});
