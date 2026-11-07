import { test, expect } from '@playwright/test';
import { watch } from './helpers';

const SHOTS = '../docs/screenshots';

test('目录「开始课程」→ 课文章节页 → sticky「开始创作」进工作台', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/courses');
  await page.getByRole('tab', { name: '全部' }).click();
  const card = page.locator('[data-start-here="true"]');
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: '开始课程' })).toBeVisible();
  await expect(card.getByRole('button', { name: '开始创作' })).toHaveCount(0);
  await card.getByRole('button', { name: '开始课程' }).click();
  await expect(page).toHaveURL(/\/courses\/first-lesson/);
  await expect(page.getByTestId('course-article')).toBeVisible();
  await expect(page.getByTestId('detail-idle-agent')).toBeVisible();
  await expect(page.locator('.ca-prose .ca-bilibili, .ca-bilibili').first()).toBeVisible();
  await expect(page.getByTestId('article-resources')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/course-article.png` });
  await page.getByTestId('article-start-create').getByRole('link', { name: '开始创作' }).click();
  await expect(page).toHaveURL(/\/workbench\?course=first-lesson/);
  await expect(page.getByTestId('lesson-workbench')).toBeVisible();
  await expect(page.getByTestId('guide-step-card')).toBeVisible({ timeout: 8000 });
  expect(problems).toEqual([]);
});

test('自由创作：未登录进登录页；登录后进工作台无引导卡', async ({ page }) => {
  await page.goto('/home');
  await page.locator('[data-cta="free-create"]').click();
  await expect(page).toHaveURL(/\/login/);
  // 注册临时账号再进自由创作
  const user = `free_${Date.now().toString(36)}`;
  await page.goto('/register');
  await page.getByPlaceholder('例如：xiaoming').fill(user);
  await page.getByPlaceholder('至少 8 位').fill('e2e-password-1');
  await page.locator('form button[type=submit]').click();
  await page.waitForLoadState('networkidle');
  // 若未自动登录，再用同一账号登录
  if (page.url().includes('/login') || page.url().includes('/register')) {
    await page.goto('/login');
    await page.getByPlaceholder('例如：xiaoming').fill(user);
    await page.getByPlaceholder('至少 8 位').fill('e2e-password-1');
    await page.locator('form button[type=submit]').click();
    await page.waitForLoadState('networkidle');
  }
  await page.goto('/workbench?mode=free');
  await expect(page).toHaveURL(/mode=free/, { timeout: 15000 });
  await expect(page.getByTestId('lesson-workbench')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('free-create-panel')).toBeVisible();
  await expect(page.getByTestId('guide-step-card')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/free-create.png` });
});
