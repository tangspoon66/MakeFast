import { defineConfig } from '@playwright/test';

/** 端到端冒烟：用 ../scripts/e2e.sh 运行（会启动隔离后端）；前端由 webServer 启动。 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: process.env.PW_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    actionTimeout: 15_000,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
