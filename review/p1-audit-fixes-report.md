# P1 Audit Fixes 总报告

**日期**: 2026-07-19
**范围**: 4 个并行 audit agent + 落地修复 + 文档同步
**状态**: Sprint 1+2+3 完成,Sprint 4 (Playwright e2e) 留作后续

---

## 1. 4 个 Audit 报告

每个 agent 在 30 分钟内完成只读 audit,产出一份 800-1500 字中文报告 + 对照表:

| 报告 | 文件 | P0 缺口 | 涵盖 |
|------|------|---------|------|
| **Feature 完整性** | `review/audit-feature-completeness-result.md` | 5 | 30 个文档承诺功能 vs 代码现状 |
| **UX 状态机** | `review/audit-ux-states-result.md` | 5 | 12 个核心页 × 8 个状态 |
| **文档 vs 现实** | `review/audit-docs-vs-reality-result.md` | 5 | 14+10+6 条事实声明核查 |
| **移动端 + 暗色** | `review/audit-mobile-darkmode-result.md` | 4 | 11 页 × 6 维度(响应式/暗色/触摸/a11y) |

**汇总 P0 缺口(30+)** 按影响范围:

### 用户立刻能撞到(10)
- 通知中心是占位 skeleton,整页 4 tab 死代码
- 证书下载是 mock toast(「已发到邮箱」是假的)
- 黑客松卡片无倒计时
- AI 4 chips 实际只有 3
- LearningEvent 进度上报是 console.log
- 订单取消/退款无二次确认(误点直接发请求)
- 4 个核心页(CourseList/CourseDetail/Orders/Certificates)无 isError 兜底
- 全 app 无 ErrorBoundary(任一组件 throw = 白屏)
- 退款 4 规则文档承诺,代码 0 校验
- 课程完成 mutation 无 onError(失败用户不知道)

### 管理员侧(8)
- 看板 4 KPI + 4 图表全 hardcode mock
- 课程编辑器 5 tab 中 3 tab 是前端 mock
- 用户详情抽屉 6 section 全部缺失
- 改角色/封号/授权/重置密码/删账号 5 操作无 UI
- 徽章规则 DSL 仅单条,无 and/or/not 嵌套
- 课程批量导入 20 条 URL 前端无 UI
- 审计日志只写不读,无 admin 路由
- 系统设置 / 数据导出 / 删评价全部未实现

### 移动端/暗色/a11y(10)
- admin 后台 < md 无重定向
- 课程编辑器 < lg 三栏断成单栏
- Dashboard mobile tab 底部完成按钮覆盖 AI 输入
- 顶 nav < sm 缺搜索/头像
- admin 30+ `bg-white` 硬编,暗色撕裂
- CourseListPage mobile 筛选撑爆视口
- 3 套 theme state 互不同步(icon 显示跟实际 class 相反)
- 触摸目标普遍 < 44px
- CommandPalette iOS 刘海没让位
- aria-label 不一致

### 文档 vs 现实(8)
- 视频进度写 5 秒,实际 1 秒
- 退款规则 4 条全未实现
- 评分 1-10,后端 0-100
- 通知 30s 轮询未实现(已修)
- 4 角色(user/admin/super_admin/instructor)代码只有 3
- 看板 KPI 名字完全对不上
- 徽章 DSL 7→6,3 类型不重叠
- 订单状态 5 tab 实际有 6 状态,cancelled UI 吞了 expired/failed

---

## 2. 修复(Sprint 1+2+3)

### Sprint 1a: ErrorBoundary + isError 兜底 (5 文件)

- `apps/web/src/components/ErrorBoundary.tsx` (新) — class component,接 dev console.error,产「页面出错了」友好页 + 重试 + 回首页
- `apps/web/src/components/QueryErrorState.tsx` (新) — 通用 react-query 错误兜底,识别 401/403/404/429/500/网络错,自动给对应文案 + 重试按钮
- `apps/web/index.tsx` — 包 `<ErrorBoundary>`
- 4 个 useQuery 页加 isError: CourseListPage / CourseDetailPage / OrdersPage / CertificatesPage

**Sprint 1b: 二次确认弹层 + 按钮 isPending 锁 (3 文件)**
- `apps/web/src/components/ConfirmDialog.tsx` (新) — variant: danger/warning/info,async onConfirm,自动 loading 锁,ESC + 遮罩 + X 关闭
- OrdersPage: 取消/退款 2 个 mutation 走 `<ConfirmDialog>`,所有操作按钮接 `isAnyPending` prop disable

**Sprint 1c: AI chips + 倒计时 (2 文件)**
- DashboardPage: QUICK_PROMPTS 3 → 4
- `apps/web/src/components/CountdownChip.tsx` (新) — 通用倒计时,1s tick,format 智能切换(天/时/分/秒)
- HackathonCard: 报名截止 / 距开赛倒计时接 `<CountdownChip>`,upcoming/active 状态展示

**Sprint 1d: 退款规则 + 证书下载 + 通知重接 (5 文件)**
- `apps/api/src/modules/orders/orders.service.ts` — 落地 4 规则:课程(未开始全退 / 7 天内+<20% 95% 退 / 其他拒) + 学位(全部未开始全退 / 任一开始拒)。返回 `refundAmount` 字段反映实际金额
- `apps/api/src/modules/orders/orders.service.spec.ts` — +5 测试(规则覆盖),从 40 → 45 tests,全绿
- CertificateDetailPage: 假 toast 改真「下载 PDF → window.print() 走浏览器原生」+ 复制验证链接按钮 + print.css
- `apps/web/src/styles/print.css` (新) — 打印时只保留证书大图,隐藏 nav/tab/操作按钮
- `apps/web/src/lib/notificationsApi.ts` (新) — 接后端 6 endpoint
- `apps/web/src/features/dashboard/notifications/NotificationsPage.tsx` — 整页重写:4 tab 真切换(全部/未读/系统/互动)+ 4 type icon 区分 + 30s 轮询 + 标已读 / 全部已读 / 清空已读 / 删除 + 二次确认

**Sprint 2a: 主题 store 3 合一 (4 文件)**
- `apps/web/src/stores/themeStore.ts` (新) — zustand store,单点状态,自动同步 `<html class="dark">` + localStorage,initThemeFromStorage 读 system pref
- `Layout.tsx` / `DashboardLayout.tsx` / `AdminDashboardPage.tsx` — 删独立 useState,改用 useTheme + useThemeStore.toggle

**Sprint 2b: 移动端 admin 拦截 (2 文件)**
- `apps/web/src/components/MobileBlocked.tsx` (新) — < md 屏幕拦截页,「请用桌面访问」+ 复制链接按钮
- AdminLayout: 包 `<MobileBlocked />` + 实际内容 `hidden md:block`,符合 USER_MANUAL §17.4 承诺

**Sprint 3: 文档修正 (3 文件)**
- USER_MANUAL §2/§8.5: 视频进度 5 秒 → 1 秒
- USER_MANUAL §11.4: PNG/PDF 下载描述 → 真实流程(window.print)
- USER_MANUAL §12.2: 5 tab 状态描述 + 加 expired
- USER_MANUAL §12.4: 退款规则细化 + 标"后端已落地"
- ADMIN_MANUAL §1: 4 角色表 → 3 角色(student/instructor/admin,加 "super_admin 暂未实现" 说明)
- ADMIN_MANUAL §3.1: KPI 4 个名字(今日 GMV / 新增用户 / DAU / AI token)
- ADMIN_MANUAL §7.4: 评分 1-10 → 0-100
- ADMIN_MANUAL §8.3: 徽章 7 规则 → 6 规则(实际代码)
- GLOSSARY: 删 CSP 重复行

---

## 3. 验证

```
✅ pnpm build: 23 chunks 全部成功
   - main: 657KB (gzip 191KB) — 不变
   - 新 chunk: CountdownChip / MobileBlocked / QueryErrorState / ConfirmDialog
   - AdminDashboardPage 仍走 mock (未接真 API,留 P2+)
✅ pnpm test:
   - apps/api: 45/45 (从 40 → +5 退款规则测试)
   - apps/web: 3/3
✅ tsc --noEmit: web + api 全绿
✅ vite dev (5500) 持续运行
```

---

## 4. 仍 TODO(本次未做,留给后续 Sprint)

### P0(用户还能撞到)
- admin 看板接真 `/api/v1/admin/stats`(目前 mock,文档自承)
- 课程编辑器 chapters/resources tab 接真后端(目前 mock)
- 用户详情抽屉 6 section(目前 0)
- 改角色/封号/授权课程/重置密码/删账号 5 操作 UI(目前 0)
- 徽章规则 DSL and/or/not 嵌套(目前单条)
- 课程批量导入 20 条 URL UI(目前单 URL)
- 审计日志读取 + 路由(目前只写)
- 系统设置 + 数据导出 + 删评价(目前 0)

### P1(管理员/技术债)
- 30+ admin `bg-white` 硬编 → token 化
- 触摸目标统一到 44px
- CourseListPage mobile 筛选 sheet 容器
- /admin/courses 课程编辑器 < lg 改 tab 切换(替代两栏)
- Dashboard mobile tab 「完成」按钮避开 AI 区域
- 顶 nav < sm 显示 search/avatar
- AdminDashboardPage 整站 `bg-white` + hex 硬编
- ⌘K 评分 1-10 → 0-100 已经在 doc 修了,代码侧 HackathonJudgeForm 也可能要调

### P2(可选,留 backlog)
- Playwright e2e 测试(本仓库还没装 playwright)
- ErrorBoundary 接 Sentry 上报
- ConfirmDialog 键盘 Enter 快捷键
- CountdownChip 国际化 i18n
- themeStore 持久化 storage event 同步(多 tab 同步)
- bundle 主 chunk 还 657KB,继续压(lucide 按需引 / 拆 vendor)

---

## 5. 提交建议

```
6 个 commits,每个 sprint 一个 + docs
- feat(error): 全局 ErrorBoundary + 4 页 isError 兜底
- feat(ux): ConfirmDialog 二次确认 + 订单按钮 isPending 锁
- feat(features): AI 4 chip + 黑客松倒计时
- feat(orders+cert+notif): 退款 4 规则 + 证书 PDF 下载 + 通知中心重接
- refactor(theme): themeStore zustand 3 合 1
- feat(mobile): admin < md MobileBlocked 拦截
- docs(USER/ADMIN/GLOSSARY): 同步 7 处不一致
- test(orders): 退款 4 规则 +5 tests
```

---

**报告作者**: Mavis
**对应 commit**: 见 `git log` 后续
**Audit 报告**: `review/audit-*-result.md` (4 份)
**修改文件**: 21 (8 新 + 13 改)
**测试**: 40 → 45 (+5)
**bundle**: main 657KB 不变
