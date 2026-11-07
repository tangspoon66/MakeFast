import { test, expect } from '@playwright/test';
import { watch } from './helpers';

const SHOTS = '../docs/screenshots';
const USER = process.env.E2E_ADMIN_USER || '';
const PASS = process.env.E2E_ADMIN_PASSWORD || '';

test('学生章节页：图文结合（封面/图注/提示条/画廊）+ 开始创作', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/courses/first-lesson');
  await expect(page.getByTestId('course-article')).toBeVisible();
  await expect(page.getByTestId('article-cover')).toBeVisible();
  await expect(page.getByTestId('article-prose')).toBeVisible();
  await expect(page.locator('.ca-prose .ca-figure').first()).toBeVisible();
  await expect(page.locator('.ca-prose .ca-gallery').first()).toBeVisible();
  await expect(page.locator('.ca-prose .ca-callout').first()).toBeVisible();
  await expect(page.locator('.ca-prose .ca-bilibili').first()).toBeVisible();
  await expect(page.getByTestId('article-toolbar')).toHaveCount(0); // 学生端无编辑工具栏
  await page.screenshot({ path: `${SHOTS}/course-article-illustrated.png`, fullPage: true });
  await page.getByTestId('article-start-create').getByRole('link', { name: '开始创作' }).click();
  await expect(page.getByTestId('lesson-workbench')).toBeVisible();
  expect(problems).toEqual([]);
});

test.describe('管理端文章编辑器', () => {
  test.skip(!USER || !PASS, '需要 scripts/e2e.sh 注入的临时管理员账号');

  test('选课、三档 tabs、保存与样例', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByPlaceholder('请输入用户名').fill(USER);
    await page.getByPlaceholder('请输入密码').fill(PASS);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(/\/admin(\/|$)(?!login)/);

    const created = await page.evaluate(async () => {
      const body = {
        slug: 'first-lesson', title: '温湿度小管家', level: '入门', summary: '', skills: [],
        prerequisites: [], cover: '', duration_min: 45, board_id: 'xiao-esp32-s3',
        steps: [{ id: 's1', title: '认识', why: '' }],
        quiz: [{ id: 'q1', prompt: '?', choices: ['a', 'b'], answer_index: 0, explain: '' }],
        resources: [],
      };
      const r = await fetch('/api/admin/console/courses', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return r.status;
    });
    expect([200, 201, 409, 400]).toContain(created); // 已存在也可

    await page.goto('/admin/articles?slug=first-lesson');
    await expect(page.getByTestId('admin-article-editor')).toBeVisible();
    await expect(page.getByTestId('article-tier-tab-low')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('article-toolbar')).toBeVisible();
    await expect(page.getByTestId('article-doc-editor')).toBeVisible();
    await page.getByTestId('article-tier-tab-mid').click();
    await page.getByTestId('article-tier-tab-high').click();
    await page.getByTestId('article-tier-tab-low').click();
    await page.getByRole('button', { name: '填入第一课样例' }).click();
    await page.getByTestId('article-save').click();
    await expect(page.getByText('已保存文章')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SHOTS}/admin-article-editor.png` });

    await page.evaluate(async () => {
      await fetch('/api/admin/console/courses/first-lesson/publish', { method: 'POST', credentials: 'include' });
    });
    await page.goto('/courses/first-lesson');
    await expect(page.getByTestId('course-article')).toBeVisible();
    await expect(page.locator('.ca-prose .ca-gallery, .ca-prose .ca-figure').first()).toBeVisible();
    await expect(page.getByTestId('article-wysiwyg')).toHaveCount(0);
  });
});
