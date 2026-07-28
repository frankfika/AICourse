# Admin 后台综合 Audit 报告 (4 段 / 仅观察 + 缺口)

**验证时间**: 2026-07-24
**验证方式**: 4 个独立 verifier sub-agent 并行审查 + 主会话交叉验证
**报告范围**: 11 个 admin 页面 + admin settings 13 tab + 后端 AI service + Prisma schema
**总结果**: 4 路 2 PASS / 2 FAIL,**P0 缺口 4 个 / P1 缺口 5 个 / P2 缺口 2 个**

---

## 1. Frank 报告的两个具体问题 — 根因

- **"学位管理添加不了课程"** — 角色 X 在场景"已创建学位"想做"挂 5 门课",实际是 `AdminDegreesPage.tsx:24-32` `EMPTY_FORM` 只有 title/description/learningPoints/price/icon/costType/thumbnail,无 `courseIds` 字段;`:145-223` 整个表单 UI 没有"选择课程"控件;`:109-113` `handleSubmit` payload 不传任何 course 数据。Prisma schema `:305` `NanoDegree.courses: DegreeCourse[]` 完整,后端 `apps/api/src/modules/degrees/degrees.controller.ts:80` 有 `POST /api/v1/degrees/:id/courses` 绑定端点(`LinkCoursesDto { courses: [{courseId, orderIndex}] }`),**前端从未调用**。同样反向断链:`AdminCoursesPage.tsx:89-102` 表单 4 tab 无 degree 字段,`courses.dto.ts:91-170` `CreateCourseDto` 无 `degreeIds`,**双向都不通**。seed 是唯一关联写入路径(`apps/api/prisma/seed.ts:467-475` 硬编码 5 条)。

- **"大模型 key 在 admin 后台配置"** — 完全缺失。`apps/api/src/modules/ai/ai.service.ts:18-20` `this.config.get<string>('GEMINI_API_KEY')` 强绑 process.env;后端 `ai.controller.ts` 只有 2 个生成端点,无任何 admin mutation path;Prisma schema 搜 `gemini/llm/openai/apiKey/provider` 无 AiConfig / AiProvider / ApiKey 表,只有 `AiUsage` 是用量日志(无 key 字段);admin 13 tab 全是 CMS 内容管理(`AdminSettingsPage.tsx:49-85` global / page / enums / industries / testimonials / enterprise_methods / quick_prompts / course_categories / searches / auth_providers / navigation / i18n / date_formats),**0 个 AI tab**。即使想用 `app_settings` 塞 key 也无用 — `ai.service.ts:18-20` 不读 app_settings。当前 `.env:38` `GEMINI_API_KEY=""` 是空 placeholder,改 key 必须 ssh + 改文件 + 重启 API。

## 2. 跨实体断链 (verifier #4 7 处)

- **课程↔行业**: `Course` schema 无 `industryId` FK,`Industry` 模型(`schema.prisma:1056`)孤立 — grep 全 prisma 无 `industry @relation` 引用
- **课程↔分类**: `Course` schema 无 `categoryId` FK,`CourseCategory` 模型(`schema.prisma:1116`)孤立
- **徽章↔特定课程**: `Badge.criteriaJson` 叶子只接受 6 枚举(`schema:761-768` `course_count / course_completed / degree_completed / practice_count / streak_days / points`),无 `courseId` / `hackathonId` 字段
- **黑客松↔评委**: `Judge` 模型(`schema:549`)存在,但 `hackathons.controller.ts:39-264` 全无 judges CRUD 端点,前端 `AdminHackathonsPage.tsx:41-56` 无 judge 字段
- **黑客松↔赞助商**: schema 全无 `Sponsor` 模型
- **黑客松↔奖品/课程**: `prizes` 仅为 text 字段,`hackathon↔course` 无 schema 关联
- **用户详情↔完成度**: `AdminUsersPage.tsx:511-523` 列出所有 enrollments,`:575-590` 列出所有 certificates,**无 `completed` 区分** — 看不出用户是否真修完

## 3. 已 PASS 的部分 (verifier #3)

- 10 个 admin 入口全部联通,无 comingSoon,无死链。`AdminLayout.tsx:32-45` 10 个 NavItem 全部 active;`router.tsx:125-137` 10 个子路由一一对齐;`router.tsx:121` `<ProtectedRoute requireAdmin>` 包裹整个 admin 子树,10 个页面全部继承权限
- 命名一致性:nav path / 文件名 / router path 三方完全对齐(无 conflict)
- JSDoc stale comment:`AdminLayout.tsx:4-5` 注释说"审计日志/系统设置 即将推出",但代码未标 `comingSoon`,实际两个都激活
- `router.tsx:68-72` 有一行 DEBUG `console.log('[ProtectedRoute] requireAdmin=', ...)` 注释说"上线前删"

## 4. P0 / P1 / P2 缺口清单

**P0 (阻塞核心流程,必须修)**
1. 学位管理无法添加/编辑课程 — 整个学位 → 课程关联 UI 缺失
2. 课程管理无法挂学位 — 反向能力同样缺失
3. 大模型 API key 无 admin 配置入口 — 必须 ssh 改文件 + 重启
4. `router.tsx:68-72` DEBUG `console.log` 留在生产路径 — 注释自己写"上线前删"

**P1 (能力残缺,影响产品完整度)**
5. 课程无法挂行业 / 分类 — schema 无 FK,`Industry` / `CourseCategory` 模型孤立
6. 徽章无法绑定"完成特定课程" — `criteriaJson` 6 枚举无 courseId
7. 黑客松无法管理评委 — `Judge` 模型有但 controller 无 CRUD
8. 黑客松无法管理赞助商 — schema 无 `Sponsor` 模型
9. 用户详情无法区分"已修完" vs "已报名" — drawer 无 completed flag

**P2 (代码异味,顺手清)**
10. `AdminLayout.tsx:4-5` JSDoc stale comment — "审计日志/系统设置 即将推出" 已过期
11. `admin-audit-report.md` 旧报告描述的"Degrees 只有 create + delete,无 edit"已过时 — `AdminDegreesPage.tsx:71-83` 已有 `startEdit` + `updateMutation`,**旧报告需刷新**
