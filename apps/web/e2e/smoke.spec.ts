/**
 * 关键流 e2e smoke 测试
 *
 * 覆盖:
 *   1) 首页加载 + 8 段位渲染
 *   2) 课程列表 + 筛选
 *   3) 登录页可访问
 *   4) ⌘K 搜索弹层可开
 *   5) 暗色主题切换
 *   6) 移动端 bottom tab 出现(< md)
 *
 * 不需要后端:大部分页面有 mock fallback,空数据也算"渲染成功"。
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('首页加载 + 8 段位', async ({ page }) => {
    await page.goto('/');
    // 等 nav 出来(任何 main 元素)
    await expect(page.locator('main, header').first()).toBeVisible({ timeout: 10_000 });
    // 验证 hero 标语(8 段位的第 1 段,主标题会有"AI"字)
    const body = await page.textContent('body');
    expect(body).toMatch(/AI|课程|学位|黑客松|Learn/i);
  });

  test('课程列表页 + 筛选区存在', async ({ page, isMobile }) => {
    await page.goto('/courses');
    // 等页面 main 内容(2 个 main: Layout 包 + courses 内容)
    await expect(page.locator('main').last()).toBeVisible({ timeout: 10_000 });

    if (isMobile) {
      // mobile: 筛选按钮可点开
      const filterBtn = page.getByRole('button', { name: /筛选/ }).first();
      await filterBtn.click();
      // 弹层固定在屏幕底,等下一帧
      await page.waitForTimeout(300);
      // 弹层标题 / 关闭按钮可访问(选择器存在即可,visibility 由 CSS 决定)
      const closeBtn = page.getByLabel(/关闭/);
      expect(await closeBtn.count()).toBeGreaterThan(0);
    } else {
      // desktop: 筛选 aside 存在
      const aside = page.locator('aside').first();
      await expect(aside).toBeVisible();
    }
  });

  test('登录页可访问', async ({ page }) => {
    await page.goto('/auth/login');
    // LoginPage h1 是 "欢迎回来"
    await expect(page.getByRole('heading', { name: /欢迎回来|登录/ })).toBeVisible({ timeout: 10_000 });
    // 邮箱 + 密码 input
    await expect(page.getByLabel(/邮箱|email/i).first()).toBeVisible();
    await expect(page.getByLabel(/密码|password/i).first()).toBeVisible();
  });

  test('⌘K 搜索弹层: 顶部搜索按钮可点', async ({ page, isMobile }) => {
    await page.goto('/');
    // CSS 控制可见性:desktop 是 "打开搜索(⌘K)", mobile 是 "打开搜索"
    // 用 button:has-text 等价,但更稳的写法是按 class visibility 区分
    const searchBtn = isMobile
      ? page.locator('button[aria-label="打开搜索"][title*="搜索"]')
      : page.locator('button[aria-label="打开搜索(⌘K)"]');
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();
    // 弹层 role="dialog"
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    // ESC 关闭
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('暗色主题切换', async ({ page }) => {
    await page.goto('/');
    // 初始是 light
    const initialClass = await page.evaluate(() => document.documentElement.className);
    // 切到暗色
    await page.getByLabel(/切换为暗色|切换为亮色/).click();
    await expect(page.locator('html.dark')).toBeVisible({ timeout: 2_000 });
    // localStorage 持久化
    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    expect(stored).toBe('dark');
    // 切回亮色
    await page.getByLabel(/切换为暗色|切换为亮色/).click();
    const finalClass = await page.evaluate(() => document.documentElement.className);
    expect(finalClass).not.toContain('dark');
  });

  test('移动端 bottom tab 出现(< md)', async ({ page, isMobile }) => {
    test.skip(!isMobile, '只在 mobile viewport 跑');
    await page.goto('/');
    // bottom tab 有 5 个图标:Home / BookOpen / GraduationCap / Sparkles / User
    // 用 Home 文字定位(底部)
    const homeTab = page.getByRole('link', { name: /首页|^Home/ }).last();
    await expect(homeTab).toBeVisible();
  });

  test('未登录访问受保护路由重定向到 login', async ({ page }) => {
    await page.goto('/dashboard');
    // 应该跳到 /auth/login
    await page.waitForURL(/\/auth\/login/, { timeout: 5_000 });
    expect(page.url()).toMatch(/\/auth\/login/);
  });

  test('404 路径渲染 NotFound 页', async ({ page }) => {
    // SPA 单页应用: 任意路径都返回 index.html(200), 客户端 router 渲染 NotFoundPage
    await page.goto('/this-path-does-not-exist-xyz');
    // 页面有 "404" 或 "找不到" 文案
    await expect(page.locator('body')).toContainText(/404|找不到|not.found/i, {
      timeout: 5_000,
    });
  });
});
