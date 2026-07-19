/**
 * Playwright E2E 配置
 *
 * 跑 e2e:
 *   pnpm e2e         (headless)
 *   pnpm e2e:ui      (interactive UI 模式)
 *   pnpm e2e:debug   (debug 单测)
 *
 * 前置:
 *   - dev server 必须先跑(默认 :5500)
 *   - 数据库可选,e2e 大部分不依赖后端,有 mock fallback
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://127.0.0.1:5500',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // 不在这里启动 webServer — 假设 dev server 已经在跑(避免双实例)
  // 想自动启动就解开注释:
  // webServer: {
  //   command: 'pnpm dev',
  //   port: 5500,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60_000,
  // },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    // 后续要加:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
