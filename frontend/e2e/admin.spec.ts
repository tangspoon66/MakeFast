import { test, expect } from '@playwright/test';
import { clickEveryButton, watch } from './helpers';

const USER = process.env.E2E_ADMIN_USER || '';
const PASS = process.env.E2E_ADMIN_PASSWORD || '';

test.describe('管理员后台', () => {
  test.skip(!USER || !PASS, '需要 scripts/e2e.sh 注入的临时管理员账号');
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByPlaceholder('请输入用户名').fill(USER);
    await page.getByPlaceholder('请输入密码').fill(PASS);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(/\/admin(\/|$)(?!login)/);
  });
  for (const p of ['', 'courses', 'articles', 'hardware', 'learners', 'agent', 'users', 'settings']) {
    test(`/admin/${p}：无报错，按钮可点`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/admin/${p}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `../docs/screenshots/admin-e2e-${p || 'dashboard'}.png` });
      await clickEveryButton(page, problems, { skip: /发布|下线|保存|新增|创建|停用|启用|角色/ });
      expect(problems).toEqual([]);
    });
  }
});
