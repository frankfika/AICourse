# 数据模型 + API 完整性 audit

> 范围:prisma/schema.prisma(605 行) + apps/api/src/modules/(19 个 NestJS module) + main.ts
> 角色:audit(纯观察 + 缺口,无建议)
> 时间:2026-07-12

## 1. 数据模型现状
骨架:"课程销售 + 学习进度"主线 User → Enrollment → Course → Chapter → Lesson → ProgressRecord(schema.prisma:11/196/60/108/122/410),订单走 mock(orders.service.ts:104),学习产出用 PracticeProject+Completion(454/496),游戏化用 PointTransaction+UserBadge+Badge(589/549/520),运营靠 AuditLog(435)。**AI 模块(ai.controller.ts:13-31)只服务管理员内容生成,无学生侧 AI 助教,schema 全文无 ChatSession / ChatMessage 表。**

## 2. 模型缺失 / 字段缺失
- User(schema.prisma:11-39)只有 name/avatar/points/level/lastLoginAt,**无 interests / skillLevel / learningGoal / aiTone / lang**(学情画像零)
- Course(60-87)learningPoints 是 Text,**缺 prerequisites 数组 / objectives / 版本号**;Lesson(122-138)只有 videoUrl+duration,**无 transcript / keypoints / quiz**
- ProgressRecord(410-426)只有 status / lastPosition / completedAt,**无 LearningEvent 事件流**(答不了"哪段卡住、重复看、跳过")
- 全文 grep 无 Note / Highlight / Bookmark / Question / Review / Rating,**学习者产生内容完全未建模**
- NotificationService(notification.service.ts)只发企业询价邮件,**无 push_token / 模板 / 用户订阅表**
- 全文无 deletedAt / tenantId / locale / translation 表(**多租户 / 软删 / i18n 全部缺失**)
- 关键索引不全:User / Course / Lesson / Order / Enrollment 高频查询字段多数无 @@index,仅 AuditLog(448-449) / UserBadge(559) / PointTransaction(601) 显式建

## 3. API 一致性 + 性能/事务盲点
- 分页 / 排序 / 字段选择不统一:users.findAll(users.controller.ts:36-49)有 page+limit,courses.list(25-31)/orders/hackathons/practices 都无
- Swagger 标注分散:progress/badges/points/orders/practices/hackathons 有 @ApiTags,**users/courses/degrees/enterprise/auth 完全没有**
- 事务零零碎碎:orders.service.ts:120(mockPay)+ users.service.ts:119(grantCourse)用了 $transaction,**progress.service.ts:81-94 写 progress+points+badges 跨 3 表裸跑**;points.service.ts:100-107 是 read-modify-write 无锁
- N+1 / hot path:badges.service.ts:260-272 每次拉全 progressRecord 算完成课程;progress.service.ts:142-147 把用户全部完成记录 orderBy+set 拼(O(n) 内存)
- common/filters/all-exceptions.filter.ts:1-41 是统一兜底但**无 error code / i18n messageId**;users.controller.ts:71 裸 `return { error: 'Forbidden' }`
- 公共组件几乎为零:grep 整个 apps/api/src **无 Cache / Redis / Queue / Bull / EventEmitter / multer / S3**
- AI 集成脆弱:ai.service.ts:119-164(callGemini)直连 generativelanguage,**无 retry / circuit breaker / token 计量**

## 4. 扩展性断点
- **加 AI 实时对话卡在"会话没存"**:schema 无 ChatSession/ChatMessage/Citation;ai.controller.ts:13-31 只暴露 admin 端点;要做"问 AI 关于这节课"必须新建会话/消息/引用三表
- **加学习分析卡在"行为事件没打点"**:ProgressRecord(410-426)只答"完成到哪",要做热力图/卡点检测必须建 LearningEvent(userId/lessonId/eventType/positionSec/durationMs) 表
- **加个性化路径卡在"用户画像空"**:User(11-39)无兴趣/水平/目标,Course(60-87)无结构化先修图,只能从 progressRecord 反推
- **加课程评分/Q&A 卡在"学习者内容没建模"**:全文无 Note/Review/Question/Answer,前端写课后笔记只能塞 PracticeCompletion.notes(504)
- **加多端推送卡在"通知全无"**:NotificationService 只企业询价一用
- **加 B2B 租户/多语言卡在"全表无 tenant/locale"**:要做企业版几乎所有表都需加 tenantId

## 5. 认证/授权模型可插拔性观察
- **User 是单 IdP 形状**:schema.prisma:11-39 字段是 email+passwordHash+name+role,**无 provider / providerAccountId / externalUserId / identityMetadata**,**无 ProviderAccount 关联表**(全文 grep 无 Account / Identity / OAuthAccount);RefreshToken(47-57)只有 token+userId+expiresAt,**无 deviceId / ip / userAgent**
- **AuthService 无 Provider 抽象层**:auth.service.ts:3、13 直接 import `bcrypt` 和 JwtService,register/login/refresh 三个方法全耦合具体实现,加微信/SSO 要直接改这个文件
- **Token 策略只有 JWT**:auth.module.ts:35 `PassportModule.register({ defaultStrategy: 'jwt' })`、jwt.strategy.ts:10 硬编码 `ExtractJwt.fromAuthHeaderAsBearerToken()`,**无 Session / OAuth2 / API Key 策略接口**
- **RBAC 写死 enum 三档**:schema.prisma:41-45 `UserRole { admin, student, instructor }`,roles.guard.ts:14-25 直接 array contains,**无 permission / policy / scope 表**,**无 ABAC / ownership 校验**(users.controller.ts:64-74 update 只能挡"非 admin 改他人",无法表达"我只能改我自己的 progress")
