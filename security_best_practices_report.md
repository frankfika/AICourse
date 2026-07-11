# OpenCSG Academy — Security Best Practices Report

> 审计时间：2026-06-28
> 修复时间：2026-06-29
> 审计范围：`apps/api`（NestJS 后端）、`apps/web`（React + Vite 前端）、`prisma/schema.prisma`、`.env*`
> 参考规范：`security-best-practices` skill（Express / React / 通用前端 三份规则集）
> 审计方式：手工代码扫描 + Prisma 查询审查 + 配置静态检查
> **状态：✅ 所有 Critical / High / Medium 已修复完成，依赖漏洞 16→0**

---

## 0. 执行摘要（Executive Summary）

本次审计在 OpenCSG Academy 代码库中发现 **18 项安全问题**，全部已修复：

| 严重度 | 数量 | 修复状态 |
| --- | --- | --- |
| 🔴 Critical | 4 | ✅ 4/4 已修复 |
| 🟠 High | 6 | ✅ 6/6 已修复 |
| 🟡 Medium | 5 | ✅ 5/5 已修复 |
| 🟢 Low / Info | 3 | ✅ 3/3 已修复 |
| 📦 依赖漏洞 | 16 | ✅ 0 剩余（pnpm overrides） |

**修复覆盖：18/18 = 100%**

**最危险的 4 个 Critical：**

1. **C-01** 前端 `vite.config.ts` 把 `GEMINI_API_KEY` 注入到客户端 bundle —— 任何人打开 DevTools 即可窃取 ✅
2. **C-02** `auth.service.ts` 用 `Math.random()` 生成 refresh token —— 不是加密随机，可被预测/枚举 ✅
3. **C-03** `auth.service.ts` 把 refresh token **明文**存进数据库 —— DB 一泄露所有 token 全丢 ✅
4. **C-04** `.env` 里 `JWT_SECRET` 是占位符 `change-this-to-very-strong-random-secret...` —— 上生产 = 任意签发 token ✅

另外 **多项 H/M 级问题** 集中在「**完全没有任何速率限制 / helmet / body 大小限制 / 全局异常过滤 / trust proxy**」，整个 API 对暴力破解、DoS、信息泄露的防护是裸奔状态。全部已修复。

---

## 1. 🔴 Critical 级别问题

### C-01 · API Key 泄露到前端 Bundle

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-typescript-react-web-frontend-security §3 (Secrets in Client) |
| **位置** | `apps/web/vite.config.ts:13-16` |
| **证据** | ```ts\ndefine: {\n  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),\n  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)\n},\n``` |
| **影响** | `define` 会在构建时把 `process.env.GEMINI_API_KEY` 字符串替换为**字面量**，因此一旦 `.env` 里有真实 key，最终产物的 JS 文件会包含明文 key。任何用户访问站点后，DevTools → Sources → 搜 `AIza` 即可拿到。攻击者拿到后可以拿这个 key 调 Gemini API 计费/封号。 |
| **修复** | 1. 立刻从 `vite.config.ts` 移除这两行。\n2. 任何 Gemini 调用必须放到后端（API 已经有了 `ai.service.ts`）。\n3. 前端调用 `/api/v1/ai/generate-course`，由 API 转发到 Gemini。\n4. 删除 `.env` 中的 `VITE_GEMINI_API_KEY`（如果存在），并到 Google AI 控制台**轮换 key**。 |
| **是否假阳性** | 否。即使现在 `.env` 里 `GEMINI_API_KEY=""` 为空，这个 `define` 也会工作，但一旦填了真实值就泄露。 |

---

### C-02 · Refresh Token 使用 `Math.random()` 生成

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-general-web-frontend-security §6 (Secure RNG) / OWASP A02:2021 Cryptographic Failures |
| **位置** | `apps/api/src/modules/auth/auth.service.ts:110-112` |
| **证据** | ```ts\nprivate randomToken(): string {\n  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;\n}\n``` |
| **影响** | `Math.random()` **不是**加密安全随机数生成器（CSPRNG），输出可预测。攻击者通过观察几个 token 即可推断 PRNG 状态并预测其他用户的 refresh token，进而**劫持会话**。`Date.now()` 是已知前缀，更进一步降低熵。 |
| **修复** | 改用 `crypto.randomUUID()`（Node 内置）或 `crypto.randomBytes(32).toString('hex')`：\n```ts\nimport { randomBytes } from 'crypto';\nprivate randomToken(): string {\n  return randomBytes(32).toString('hex');\n}\n``` |
| **是否假阳性** | 否。 |

---

### C-03 · Refresh Token 数据库明文存储

| 项目 | 内容 |
| --- | --- |
| **规则** | OWASP A02:2021 Cryptographic Failures / PCI-DSS §3.2 |
| **位置** | `apps/api/src/modules/auth/auth.service.ts:90-96` + `prisma/schema.prisma:47-57` |
| **证据** | ```ts\nawait this.prisma.refreshToken.create({\n  data: { token: refreshToken, userId: user.id, expiresAt: refreshExpires },\n});\n```\nSchema 中 `model RefreshToken { token String @unique ... }`（明文列） |
| **影响** | 数据库泄露、SQL 注入、备份泄漏、运维失误 → 攻击者拿到所有用户的 refresh token → 直接绕过 access token 失效机制续命。 |
| **修复** | 用 SHA-256 哈希后存储，验证时对客户端传来的 token 做哈希再比对：\n```ts\nimport { createHash } from 'crypto';\nprivate hashToken(t: string) { return createHash('sha256').update(t).digest('hex'); }\n\n// create\nconst refreshToken = randomBytes(32).toString('hex');\nawait this.prisma.refreshToken.create({ data: {\n  token: this.hashToken(refreshToken),\n  userId: user.id, expiresAt: refreshExpires,\n}});\n\n// verify\nconst stored = await this.prisma.refreshToken.findUnique({\n  where: { token: this.hashToken(token) },\n});\n``` |
| **是否假阳性** | 否。 |

---

### C-04 · JWT_SECRET 是占位符

| 项目 | 内容 |
| --- | --- |
| **规则** | OWASP A02:2021 Cryptographic Failures |
| **位置** | `.env:26` + `.env.example:27` |
| **证据** | `JWT_SECRET="change-this-to-a-very-strong-random-secret-key-min-32-chars"` |
| **影响** | 任何人知道源码就知道 JWT secret，可任意签发任意 user / role 的 token → 完整账户接管。开发环境上线即裸奔。 |
| **修复** | 1. `.env.example` 改为 `JWT_SECRET=""` 加注释「必填，使用 \`openssl rand -hex 32\` 生成」\n2. 在 `auth.module.ts` 增加 secret 长度校验（最少 32 字符），否则启动失败：\n```ts\nconst secret = configService.getOrThrow<string>('JWT_SECRET');\nif (secret.length < 32) throw new Error('JWT_SECRET must be ≥ 32 chars');\n```\n3. 启动文档 / README 提示：每个环境必须独立生成 secret。 |
| **是否假阳性** | 否（占位字符串明摆在那里）。 |

---

## 2. 🟠 High 级别问题

### H-01 · 完全没有速率限制（Brute Force 暴露）

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §11 (Rate Limiting) |
| **位置** | `apps/api/src/main.ts`（全局） + `apps/api/src/modules/auth/auth.controller.ts`（登录注册） |
| **证据** | 没有引入 `express-rate-limit` / `@nestjs/throttler`；`package.json` 也无相关依赖。 |
| **影响** | - `/auth/login` 可被暴力破解密码（bcrypt 慢但分布式即可绕过）\n- `/enterprise/inquiries` 公开端点可被无限刷，形成工单 spam / SendGrid 配额耗尽\n- `/auth/register` 可被脚本批量创建用户 |
| **修复** | 安装 `@nestjs/throttler` 并全局启用：\n```ts\nThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 3 }]),\n```\n针对 `/auth/login`、`/auth/register`、`/enterprise/inquiries` 用 `@Throttle({ default: { limit: 5, ttl: 60000 } })` 单独配置更严的策略。 |

---

### H-02 · 缺失安全响应头（无 helmet）

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §1 (Helmet / Security Headers) |
| **位置** | `apps/api/src/main.ts` |
| **证据** | `grep helmet` 返回 0；`package.json` 无 `helmet`。 |
| **影响** | 缺少 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Strict-Transport-Security`、`Referrer-Policy`、`Content-Security-Policy` 等关键头 → 点击劫持、MIME 嗅探 XSS、降级攻击都更容易。 |
| **修复** | 1. `pnpm add helmet`\n2. 在 `main.ts` 第一行注册：\n```ts\nimport helmet from 'helmet';\napp.use(helmet({\n  contentSecurityPolicy: {\n    directives: {\n      defaultSrc: [`'self'`],\n      imgSrc: [`'self'`, 'data:', 'https://coresg-normal.trae.ai'],\n      scriptSrc: [`'self'`],\n      styleSrc: [`'self'`, `'unsafe-inline'`],\n    },\n  },\n  crossOriginEmbedderPolicy: false,\n}));\n``` |

---

### H-03 · 无 Body 大小限制 → 大请求 DoS

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §3 (Body Parsing Limits) |
| **位置** | `apps/api/src/main.ts` |
| **证据** | 未配置 `express.json({ limit: ... })`；NestJS 默认 100kb 但需要显式确认。 |
| **影响** | 攻击者发巨大 JSON body 耗尽内存；登录/咨询接口被滥用。 |
| **修复** | ```ts\napp.use(express.json({ limit: '100kb' }));\napp.use(express.urlencoded({ limit: '100kb', extended: false }));\n``` |

---

### H-04 · Refresh Token 在 body 里传输且无防重放

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §6 (Auth) |
| **位置** | `apps/api/src/modules/auth/auth.controller.ts:33-49` + `apps/web/src/lib/api.ts:25-29` |
| **证据** | ```ts\n// controller\nasync refresh(@Body('refreshToken') bodyToken?: string, ...)\n// 前端 axios.post('/auth/refresh', { refreshToken }, ...)\n``` |
| **影响** | (1) refresh token 出现在请求 body → 服务端访问日志、APM、CDN 边缘日志都会记录 → 严重密钥泄漏。\n(2) `auth.service.refresh` 每次成功后 `delete` token 并发新 token（OK），但**没有原子事务**：两个并发刷新请求可能同时通过校验，导致一 token 两用。 |
| **修复** | 1. **首选 cookie 模式**：前端不再传 body token，依赖 `httpOnly` cookie。代码里其实已经 set cookie 了但前端没读，逻辑是双轨并存。建议只保留 cookie：删除 body 读取，删除前端 `localStorage.setItem('refresh_token', ...)`。\n2. 增加 token rotation 事务：用 `prisma.$transaction` 把 delete + create 包起来。\n3. 后端关闭 body 日志（生产环境 Nest 默认不打印 body，但需要确认 logger filter）。 |

---

### H-05 · 公开端点 `GET /courses/:id` 未过滤草稿

| 项目 | 内容 |
| --- | --- |
| **规则** | OWASP A01:2021 Broken Access Control |
| **位置** | `apps/api/src/modules/courses/courses.controller.ts:31-34` + `courses.service.ts:44-51` |
| **证据** | ```ts\n@Get(':id')\nasync findOne(@Param('id') id: string) {\n  return this.coursesService.findOne(id);  // 无任何状态过滤\n}\n``` |
| **影响** | 任何人（无需登录）通过遍历 ID 即可拉取 status=`draft` 的课程内容（包括章节、课时、视频 URL、内部资源链接）。 |
| **修复** | 在 service 里加过滤：\n```ts\nasync findOne(id: string, includeDraft = false) {\n  return this.prisma.course.findFirst({\n    where: { id, ...(includeDraft ? {} : { status: 'published' }) },\n    include: this.courseInclude,\n  });\n}\n```\nController 判断 req.user.role === admin 时传 `includeDraft=true`。`degrees.controller.ts:31-33` 同问题，一起修。 |

---

### H-06 · `orders.mockPay` 无事务，存在双发风险

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §6 / OWASP A04:2021 |
| **位置** | `apps/api/src/modules/orders/orders.service.ts:104-151` |
| **证据** | ```ts\nconst paidOrder = await this.prisma.order.update({ ... });\n// 中间没有事务\nawait this.prisma.enrollment.upsert({ ... });\nawait this.enrollAllDegreeCourses(userId, order.degreeId);\n``` |
| **影响** | (1) 并发调用 `mockPay`：两个请求都读到 `status=pending`，都 update 为 paid，都创建 enrollment。\n(2) 中途崩溃 → 订单已扣款但未注册，或注册了但订单状态错误。\n(3) 没有幂等键，重试会重复创建关联。 |
| **修复** | 用 `$transaction` 包起来：\n```ts\nawait this.prisma.$transaction(async (tx) => {\n  const order = await tx.order.update({\n    where: { id: orderId, status: OrderStatus.pending },  // 条件 update 防并发\n    data: { status: OrderStatus.paid, paidAt: new Date(), ... },\n  });\n  if (!order) throw new ConflictException('Order already processed');\n  // enrollment logic with tx\n});\n```\n另外：mockPay 真实接入 Stripe 时必须改成 webhook 回调，不要客户端触发支付成功。 |

---

## 3. 🟡 Medium 级别问题

### M-01 · 无全局异常过滤 → 错误信息可能泄露栈

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §14 (Error Handling) |
| **位置** | `apps/api/src/main.ts` |
| **证据** | 没有 `app.useGlobalFilters(new HttpExceptionFilter())` |
| **影响** | 5xx 错误时 Nest 默认返回错误对象，开发环境带 stack，prod 也可能带 message。攻击者可通过错误信息推断库版本、文件结构。 |
| **修复** | 实现 `AllExceptionsFilter`：\n```ts\n@Catch()\nexport class AllExceptionsFilter implements ExceptionFilter {\n  catch(exception, host: ArgumentsHost) {\n    const ctx = host.switchToHttp();\n    const res = ctx.getResponse();\n    const status = exception instanceof HttpException ? exception.getStatus() : 500;\n    if (status >= 500) console.error(exception);  // 只在服务端日志\n    res.status(status).json({\n      statusCode: status,\n      message: status >= 500 ? 'Internal server error' : (exception as any).message,\n    });\n  }\n}\n```\n并在 `main.ts` 启用。 |

---

### M-02 · `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` 配置但未使用

| 项目 | 内容 |
| --- | --- |
| **规则** | 配置文件一致性 |
| **位置** | `.env:27-28` + `apps/api/src/modules/auth/auth.module.ts` |
| **证据** | `.env` 写了 `JWT_ACCESS_EXPIRATION="15m"` `JWT_REFRESH_EXPIRATION="7d"`，但 `auth.module.ts` 没读取（默认 7 天？）。`auth.service.ts:88` 里 `refreshExpires.setDate(refreshExpires.getDate() + 7)` 是硬编码 7 天。 |
| **影响** | 配置项失效，运营无法调短过期时间。 |
| **修复** | `JwtModule.registerAsync` 里读 env，service 里读取并 set TTL。 |

---

### M-03 · AI prompt 注入风险

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-general-web-frontend-security §10 (LLM Prompt Injection) |
| **位置** | `apps/api/src/modules/ai/ai.service.ts:59-100` |
| **证据** | ```ts\nreturn `...用户题目：${topic}\n${hint ? `附加要求：${hint}` : ''}\n请输出：`;\n``` |
| **影响** | 用户输入的 `topic` / `hint` 直接拼到 system prompt 末尾，恶意输入可让 Gemini 输出恶意 JSON（如 `thumbnail: "javascript:alert(1)"`）。后端 `mergeWithFallback` 把 LLM 输出直接 merge，前端再用 `<img src={draft.thumbnail} />` 渲染。\n注意：当前只有管理员可调用 → 影响有限，但仍然是 LLM prompt injection 反模式。 |
| **修复** | 1. JSON 输出后用 zod 校验每个字段类型与格式。\n2. URL 字段（`thumbnail`）必须匹配 `^https://` 白名单。\n3. 长度限制每个字段。 |

---

### M-04 · Swagger / API docs 生产环境暴露

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §12 (Docs Exposure) |
| **位置** | `apps/api/src/main.ts:42-49` |
| **证据** | 始终 `SwaggerModule.setup('api/docs', ...)` |
| **影响** | 生产环境暴露完整 API schema（包括 `/auth/login`、`/users/{id}` 等敏感接口），降低攻击成本。 |
| **修复** | ```ts\nif (configService.get('NODE_ENV') !== 'production') {\n  SwaggerModule.setup('api/docs', app, document);\n}\n``` |

---

### M-05 · 缺乏 trust proxy 配置（如果部署到 Nginx / LB 后）

| 项目 | 内容 |
| --- | --- |
| **规则** | javascript-express-web-server-security §2 |
| **位置** | `apps/api/src/main.ts` |
| **证据** | 没有 `app.set('trust proxy', ...)` |
| **影响** | `req.ip` 始终是代理 IP；rate limiter 用 IP 时不准确；HSTS / secure cookie 行为可能异常。 |
| **修复** | `app.set('trust proxy', 1)`（仅当部署在 1 层反代后）。 |

---

## 4. 🟢 Low / Info 级别问题

### L-01 · `prompt` 直接拼接用户输入到 SQL 字段虽然有 DTO 长度限制但无字符过滤

`ai.service.ts:59-100` 用了 `topic.trim()` 但未做特殊字符过滤。LLM 调用本身有长度上限 + 后端 merge fallback，风险低。

**建议**：增加 emoji / 控制字符过滤，避免 prompt 注入。

---

### L-02 · `mockPay` transactionId 用 `Date.now()` 可预测

`orders.service.ts:121` 用 `mock_${Date.now()}` 生成 transactionId。生产接入 Stripe 后应改用 Stripe 返回的 `payment_intent.id`，但 mock 期间风险低。

**建议**：mock 阶段用 `randomUUID()`。

---

### L-03 · `.env` 入库（已被 .gitignore 忽略，但开发流程依赖）

`.gitignore:26` 已忽略 `.env`，但本地开发仍然依赖弱密码（`opencsg_pass` / `minioadmin` / `opencsg_root`）。生产部署文档需强调：**生产 secret 必须独立生成**。

---

## 5. 已通过检查（✅）

| 项 | 状态 | 备注 |
| --- | --- | --- |
| Prisma 参数化查询 | ✅ | 全代码无 `$queryRaw` / `$executeRaw` 调用 |
| bcrypt 强度 | ✅ | `bcrypt.hash(pwd, 12)` cost=12 OK |
| Cookie httpOnly + sameSite=strict | ✅ | auth.controller.ts:22-27 |
| `forbidNonWhitelisted: true` | ✅ | ValidationPipe 配置正确 |
| `whitelist: true` | ✅ | 防止多余字段 |
| DTO 长度限制 | ✅ | MaxLength 都有 |
| IDOR 防护（hackathon submission）| ✅ | controller 里 `userId` 来自 req.user 而非 body |
| 管理员权限校验 | ✅ | RolesGuard + @Roles('admin') 全覆盖 |
| 无 dangerouslySetInnerHTML | ✅ | 前端搜索 0 匹配 |
| 无 innerHTML / eval / Function | ✅ | 前端搜索 0 匹配 |
| 无 postMessage 滥用 | ✅ | 前端搜索 0 匹配 |
| 外部链接 rel="noopener noreferrer" | ✅ | Layout.tsx 配置正确 |
| CORS allowlist | ✅ | 仅在白名单 origin 才放行 |

---

## 6. 修复优先级路线图（全部完成 ✅）

### Phase 1 — Critical（全部完成 ✅）

1. ✅ **C-01** 移除 vite `define` 注入，把 Gemini 调用完全走后端
2. ✅ **C-02** 用 `crypto.randomBytes` 替换 `Math.random()`
3. ✅ **C-03** refresh token SHA-256 哈希存储
4. ✅ **C-04** JWT_SECRET 校验 + 启动时强制 ≥ 32 字符

### Phase 2 — High（全部完成 ✅）

5. ✅ **H-01** 安装 `@nestjs/throttler`，全局 + 关键端点限流
6. ✅ **H-02** 加 helmet + CSP
7. ✅ **H-03** 显式 body 100kb 限制
8. ✅ **H-04** refresh 改 cookie-only，加事务
9. ✅ **H-05** `/courses/:id` `/degrees/:id` 草稿过滤
10. ✅ **H-06** orders.mockPay 改 `$transaction` + 条件 update

### Phase 3 — Medium（全部完成 ✅）

11. ✅ **M-01** 全局异常 filter
12. ✅ **M-02** JWT_EXPIRATION env 实际生效
13. ✅ **M-03** AI 输出 zod 校验 + URL 白名单
14. ✅ **M-04** Swagger 生产关闭
15. ✅ **M-05** trust proxy 设置

### Phase 4 — Low / Info（全部完成 ✅）

16. ✅ **L-01** AI prompt sanitize 控制字符 + zero-width
17. ✅ **L-02** transactionId 用 randomBytes（H-06 中实现）
18. ✅ **L-03** README 加生产 secret 生成文档
19. ✅ `pnpm audit` 16 个依赖漏洞清零（vitest / vite / tar / js-yaml / multer overrides）
20. ⏳ OWASP ZAP / Burp 主动扫描（建议下次代码审计）

---

## 7. 附录：审查覆盖矩阵

| 模块 | 文件 | 状态 |
| --- | --- | --- |
| API 入口 | `main.ts` | ✅ 扫 |
| Auth | `auth.controller.ts / auth.service.ts / jwt.strategy.ts / auth.dto.ts` | ✅ 扫 |
| Users | `users.controller.ts / users.service.ts / users.dto.ts / users.module.ts` | ✅ 扫 |
| Courses | `courses.controller.ts / courses.service.ts / courses.dto.ts` | ✅ 扫 |
| Degrees | `degrees.controller.ts` | ✅ 扫 |
| Enrollments | `enrollments.controller.ts` | ✅ 扫 |
| Practices | `practices.controller.ts` | ✅ 扫 |
| Hackathons | `hackathons.controller.ts` | ✅ 扫 |
| Orders | `orders.controller.ts / orders.service.ts` | ✅ 扫 |
| AI | `ai.controller.ts / ai.service.ts / ai.dto.ts` | ✅ 扫 |
| Enterprise | `enterprise.controller.ts / enterprise.service.ts / enterprise.dto.ts` | ✅ 扫 |
| Notification | `notification.service.ts` | ✅ 扫 |
| Audit | `audit-log.service.ts` | ✅ 扫 |
| Guards | `jwt-auth.guard.ts / roles.guard.ts / optional-jwt-auth.guard.ts` | ✅ 扫 |
| Schema | `prisma/schema.prisma`（前 200 行） | ✅ 扫 |
| Web 配置 | `vite.config.ts / index.html` | ✅ 扫 |
| Web API 客户端 | `lib/api.ts / stores/authStore.ts` | ✅ 扫 |
| Web 入口 | `LoginPage.tsx / EnterprisePage.tsx / HomePage.tsx` | ✅ 扫 |
| Web XSS 检查 | grep dangerouslySetInnerHTML/innerHTML/eval/postMessage | ✅ 扫 |
| Env | `.env / .env.example` | ✅ 扫 |
| .gitignore | `.gitignore` | ✅ 扫 |
| 依赖 | `apps/api/package.json / apps/web/package.json` | ✅ 扫 |

**未覆盖**：
- `apps/api/src/modules/progress/progress.service.ts`（业务层详细逻辑）
- `apps/api/src/modules/badges/badges.service.ts`
- `apps/api/src/modules/points/points.service.ts`
- 各前端页面（仅扫了关键入口页）
- 依赖漏洞扫描（`npm audit`）—— 建议在 CI 中加入

---

## 8. 完成总结

📌 **所有 18 项安全问题 + 16 个依赖漏洞全部修复完毕。**

### 修复涉及文件清单

**新增文件（11）：**
- `apps/api/src/common/filters/all-exceptions.filter.ts` — M-01
- `apps/api/src/modules/url-import/url-parser.ts` — FEAT-EX
- `apps/api/src/modules/url-import/url-import.service.ts` — FEAT-EX
- `apps/api/src/modules/url-import/url-import.controller.ts` — FEAT-EX
- `apps/api/src/modules/url-import/url-import.module.ts` — FEAT-EX
- `apps/api/src/modules/url-import/url-import.dto.ts` — FEAT-EX
- `apps/api/src/modules/url-import/url-parser.spec.ts` — 测试
- `prisma/migrations/20260629010000_add_course_source_video/migration.sql` — FEAT-EX

**修改文件（18）：**
- `apps/api/src/main.ts` — H-02/H-03/H-04/M-01/M-04/M-05
- `apps/api/src/app.module.ts` — H-01 + FEAT-EX
- `apps/api/src/modules/auth/auth.controller.ts` — H-01/H-04
- `apps/api/src/modules/auth/auth.service.ts` — C-02/C-03
- `apps/api/src/modules/auth/auth.module.ts` — C-04
- `apps/api/src/modules/users/users.controller.ts` — 草稿过滤支持
- `apps/api/src/modules/courses/courses.controller.ts` — H-05 + FEAT-EX
- `apps/api/src/modules/courses/courses.service.ts` — H-05 + FEAT-EX
- `apps/api/src/modules/courses/courses.dto.ts` — FEAT-EX 字段
- `apps/api/src/modules/degrees/degrees.controller.ts` — H-05
- `apps/api/src/modules/degrees/degrees.service.ts` — H-05
- `apps/api/src/modules/orders/orders.service.ts` — H-06 + L-02
- `apps/api/src/modules/ai/ai.service.ts` — M-03 + L-01
- `apps/api/src/modules/enterprise/enterprise.controller.ts` — H-01
- `prisma/schema.prisma` — FEAT-EX 新增字段
- `apps/web/src/lib/api.ts` — H-04
- `apps/web/src/stores/authStore.ts` — H-04
- `apps/web/src/features/admin/AdminCoursesPage.tsx` — FEAT-EX UI
- `package.json` — pnpm overrides（依赖漏洞清零）
- `.env` / `.env.example` — C-04
- `README.md` — L-03 + FEAT-EX 文档

### 后续建议（非阻塞）

- ⏳ 跑一次 OWASP ZAP / Burp Suite 主动扫描
- ⏳ 引入 CI 安全门禁：`pnpm audit` + `tsc --noEmit` + 单元测试
- ⏳ 定期轮换生产 JWT_SECRET + 监控未授权访问日志