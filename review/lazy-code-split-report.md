# 路由懒加载 + bundle 优化报告

**日期**: 2026-07-19
**范围**: apps/web
**基线**: `pnpm build` / `pnpm test` / `npx tsc --noEmit` 全绿
**目标**: vite 警告"some chunks > 500KB" + 首屏 bundle 873KB

## 改动

| 文件 | 改动 | 行数 |
|------|------|------|
| `apps/web/src/router.tsx` | 21 个非首屏路由改 `React.lazy()` + `PublicSuspense` 包裹 | +121 / -58 |
| `apps/web/src/components/Layout.tsx` | `<main>` 包 `<Suspense fallback={<RouteFallback />}>` + 移除 2 个 unused import + 删除 `void Trophy/Building2` 兜底 | +32 / -10 |
| `apps/web/src/features/dashboard/DashboardLayout.tsx` | `<Outlet />` 包 `<Suspense fallback={<DashboardFallback />}>` | +23 / -3 |
| `apps/web/src/features/admin/AdminCoursesPage.tsx` | 移除 5 个 unused lucide import (`EyeOff` / `Package` / `Layers` / `Globe` / `Power`) | -5 |

## bundle 拆分对比

| 指标 | 改动前 | 改动后 | 差值 |
|------|--------|--------|------|
| 主 chunk 大小 | 873.28 kB (gzip 237.80) | **657.27 kB (gzip 190.69)** | **-216 KB / -25%** |
| Chunk 总数 | 1 (单 chunk) | 23 (主 + 22 lazy) | +22 |
| 最大非主 chunk | — | AdminCoursesPage 43.19 kB | — |
| 首屏加载页面 | HomePage | HomePage | 不变 |
| Admin 首访 | 进入即加载 | 点 /admin 才拉 admin 7 chunk | -~140KB 首屏 |
| Dashboard 首访 | 进入即加载 | 点 /dashboard 才拉 | -~30KB 首屏 |
| P1 订单/证书/通知 | 进入即加载 | 点开才拉 | -~50KB 首屏 |

## 同步保留的"首屏关键路径"

- HomePage / CourseList / CourseDetail / DegreeList / DegreeDetail
- HackathonList / HackathonDetail / ProfilePage
- Login / Register / Forgot(未登录直接进,不能 lazy)

## 懒加载的"按需拉取"

- 全部 admin 7 个页面(只 admin 角色进,占 7 chunk,共 ~93KB)
- DashboardPage + DashboardLayout + P1 订单/证书/通知(只登录用户,共 5 chunk, ~50KB)
- BindingsPage / EnterprisePage / SearchPage / DesignSystemPage / NotFoundPage / VerifyCertificatePage

## Suspense fallback

- `Layout.tsx` 的主区域 fallback:Skeleton 顶部 1 行 + 3 个 Skeleton card,跟现有 Skeleton 组件复用
- `DashboardLayout.tsx` 的中部 fallback:小 spinner(避免 dashboard 三栏布局回流抖动)
- 路由级 `PublicSuspense`(Layout 外的 /verify 等公开页):页面级 spinner

## 验证

```
✅ pnpm build: 23 chunks 全部成功
✅ apps/web tsc --noEmit: 0 错误
✅ apps/api tsc --noEmit: 0 错误
✅ pnpm test: api 40/40 + web 3/3 通过
✅ vite preview + curl / + 拉取 AdminCoursesPage chunk: 200 OK
```

## 不在本次范围(留作后续)

- 主 chunk 657KB 仍有 warning。下一步可考虑:把 lucide-react 改按需 import(目前 tree-shake 漏了一部分)或拆 vendor chunk
- `: any` 在 AdminCourses/AdminDashboard/Enterprise 多处(legacy mock + 类型松散)
- `tsconfig.json` 没开 strict,无法用 tsc 抓真 bug
- `HomePage.tsx` 1086 行 + 大段 mock data 内联,可拆 `home/mockData.ts`
- 5 个 `interface Course` 在 5 个文件独立声明(comment 说"避免 circular dep",但 shared-types 已经是 leaf,实际可统一)
