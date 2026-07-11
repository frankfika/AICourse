# Admin 后台缺失能力 Audit

## 1. 现有 admin 能力地图

后端 17 个 module 中,`apps/api/src/modules/admin/` 目录为空(0 文件,未被 `app.module.ts:24-52` 注册),所有 admin 端点散落在 8 个业务 controller:`users.controller.ts:25-99`、`courses.controller.ts:21-64`、`degrees.controller.ts:21-71`、`hackathons.controller.ts:31-265`、`badges.controller.ts:20-74`、`practices.controller.ts:21-102`、`enterprise.controller.ts:19-50`、`url-import.controller.ts:12-129`、`ai.controller.ts:13-31` — 全部用 `@Roles(UserRole.admin)`。`UserRole` 枚举只有 admin / student / instructor 三档(`schema.prisma:41-45`),守卫单值比对(`roles.guard.ts:14-24`)。`audit` 模块只有 `audit-log.service.ts:1-24` 与 `audit.module.ts:1-8`,**无 controller、无读取端点**。`notification` 模块同样无 controller(`notification.module.ts:1-8`)。前端 `router.tsx:45-62` 挂 `/admin` 7 个子页(dashboard / courses / degrees / users / badges / hackathons / enterprise),由 `ProtectedRoute requireAdmin` 守(`router.tsx:24-29`);入口图标 `components/Layout.tsx:59-67` 只对 `user.role === 'admin'` 暴露,共域子路径、无独立子域名、无 `/admin/login`。

## 2. 缺失能力清单(9 大类)

**用户**:`users.dto.ts:27-35` UpdateUserDto 缺 role;`schema.prisma:11-39` User 无 isBanned / bannedAt / disabledAt;`users.service.ts:105-122` update 与 `users.service.ts:124-135` delete 都不写 audit log;`AdminUsersPage.tsx:117-156` 无改密 / 封禁 / 改角色按钮;`User.lastLoginAt`(schema.prisma:23)只在 `auth.service.ts:59` 写入,无 admin 查询端点;无用户画像 / 标签字段;无批量操作。

**课程**:`courses.service.ts:105-122` update 不接受 chapters(注释 line 107 自承缺 dedicated endpoints);`AdminCoursesPage.tsx:366-414` 课程行**无编辑按钮、无上下架**;`Chapter` / `Lesson` / `Resource`(`schema.prisma:108-160`)在前端完全无 UI;`Lesson.isPreview` 字段无 admin 设置;`AdminCoursesPage.tsx:17-19` 表单缺 instructorId 字段;无定价促销 / 优惠券。

**学位**:`degrees.controller.ts:21-71` 无阶段 / 解锁规则端点;`AdminDegreesPage.tsx:83-178` 无"添加课程到学位" UI(后端 `degrees.controller.ts:65-70` 有但前端没接);无价格促销 / 学员进度总览。

**订单 / 支付**:`apps/api/src/modules/` **无 payments module**(README 提的 Stripe 未接入);`orders.controller.ts:17-54` 仅有 myOrders / create / pay / cancel,**无 admin 端点**;`OrderStatus.refunded` 状态机(`schema.prisma:250-256`)无 controller 触发;`orders.service.ts:26-98` createOrder / `orders.service.ts:104-165` mockPay / `orders.service.ts:174-185` cancel **都不写 audit log**;无流水 / 对账 / Stripe webhook 端点。

**黑客松**:`hackathons.controller.ts:97-217` 报名 / 队伍端点全用户视角、无 admin 审核视角;`RegistrationStatus`(`schema.prisma:310-314`)无 pending / approved 流程;`hackathons.controller.ts:209-217` getAllSubmissions 与 `hackathons.controller.ts:252-265` judgeSubmission admin 端点前端都没接;`Judge` model(`schema.prisma:349-361`)无任何 admin 增删端点;无奖项派发流程。

**实践 / 评测**:`router.tsx:45-62` 无 `/admin/practices`;`practices.controller.ts:39-66` admin CRUD 前端不接;无自动评分 / AI 评测回显;`practices.service.ts` 全文无 `auditLog` import(零审计)。

**内容运营**:无 Banner / HomeSection / 站点级公告 / 邮件模板 model(`Announcement` 仅绑 Hackathon);`notification.module.ts:1-8` 无 controller;无站内信 / 邮件群发 UI。

**数据看板**:唯一 admin/stats 在 `badges.controller.ts:67-74` + `badges.service.ts:153-207`(5 指标硬编码 7d);缺 GMV / 订单分布 / 转化率 / 留存 / 学位完成率 / AI token 成本;`AdminDashboardPage.tsx` 全文无图表库引用。

**审计 / 系统**:`audit-log.service.ts:1-24` 只 log 无 read,无 controller;写覆盖仅 5/15 service(users / courses / degrees / hackathons / enterprise),**orders / points / badges / practices / progress / enrollments / auth / notification / ai 全无**;`audit-log.service.ts:8-23` log 不接 req,`ipAddress` / `userAgent`(`schema.prisma:442-443`)实际全 null;无 SiteConfig / FeatureFlag / 密钥轮转 / 限流 admin 调;throttler 写死 `app.module.ts:31-34`。

## 3. 卡住场景 / 重复信息

- admin API 严重分散,无统一 `apps/api/src/modules/admin/` namespace;前端每页跨 5+ 业务 endpoint 拼装
- 课程 / 学位 / 用户三页**只能新增 + 删除**,无编辑表单
- `Chapter` / `Lesson` / `Resource` 在前端无任何 UI
- `audit-log.service.ts` 只写不读,即便写了也无人能查
- `UserRole` 三档制,缺超管 / 客服 / 财务 / 内容编辑
- `users.service.ts:105-122` update 不经 audit log,改 user 不留痕
- `mockPay`(`orders.service.ts:104-165`)直接 update 状态,生产未接支付
- admin 入口 = 前台共域 `/admin` + `Settings` 图标,共用 `/login`
- 各 admin 页有大量 Field / Select 私有副本(`AdminCoursesPage.tsx:426-474` vs `AdminBadgesPage.tsx:289-333` 等),无公共组件库

## 4. 权限与运营盲点

**RBAC 漏洞**:`users.dto.ts:27-35` DTO 不含 role 字段,但 `schema.prisma:16` 有 — 字段被静默丢弃,行为不安全;`roles.guard.ts:19-21` 无 `@Roles()` 装饰器的方法默认放行,业务模块忘加即裸奔;所有 admin 端点对所有 admin 一视同仁,无"最小权限"细分;无 2FA / 操作确认。

**运营跑不通的位置**:客服查订单(无 admin 订单列表)、财务对账(无流水 / 退款)、运营发公告(无站点级 announcement model)、运营改 Banner(无 model 改前端代码)、运营做促销(无优惠券 / 折扣码)、运营监控 AI 成本(`ai.service.ts` 不统计 token)、运营审黑客松(无团队 / 作品审核 UI)、运营封禁用户(User schema 无 isBanned)、运营改用户角色(DTO 不含 role)、运营重置密码(无 admin 改 passwordHash 端点)、运营看登录日志(`lastLoginAt` 无 admin 查询)。

**数据风险**:`users.service.ts:136-140` delete 走 hard delete + `onDelete: Cascade`,触发 enrollments / orders / progress / audit logs / submissions / userBadges / pointTransactions 全部级联删除;`hackathons.service.ts:177-188` 同理级联 teams / registrations / judges / submissions / announcements;**无软删除、无 deletedAt、无回收站**。
