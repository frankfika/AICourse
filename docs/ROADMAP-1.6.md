# AI Academy Roadmap — v1.5.3 → v1.6.0

> **范围**：基于 v1.5.2 white-label (commit `2b018a7`) 现状，规划下一阶段
> **写于**：2026-07-25
> **作者**：Mavis (audit + 规划)，待 Frank 过审
>
> **核心思路**：v1.5.x 把"功能 + CMS 化"基本做完了，下一阶段不再是堆功能，而是
> 把"工程成熟度 + 投资人故事"做厚 —— 让 demo 不只看得到，还要"稳 + 可演 + 可扩展"。

---

## 0. 现状（30 秒摘要）

| 维度 | 数字 | 评估 |
|------|------|------|
| Web LOC | 30,084 / 1,423 测试 | 4.7% 测试比，**低** |
| API LOC | 15,943 / 2,668 测试 | 16.7% 测试比，**中** |
| Controllers | 38 | 14 个有 spec = **37% 覆盖率** |
| Prisma models | 55 | 99 个 index，设计合理 |
| Redis 集成 | 0 (docker-compose 有，但代码 0 引用) | **完整闲置** |
| 死代码 hook | 2 个 (`useClientPagination` / `usePresignedUpload`) | 删 |
| 持久化策略分裂 | 3 个 store 走 3 种策略 | **统一** |
| i18n | zh-CN + en-US 80 双语 key，集中在 `cms.ts:650` | 走 CMS 表，OK |

**最强项**：CMS 化（30+ 硬编码清零）、auth 401 三层根因修、AI 兜底 + 严格 schema 校验、设计系统统一、white-label 干净。
**最弱项**：测试黑洞（10 模块 = 4693 行 0 spec）、Redis 完全闲置、向量检索缺席、监控缺席。

---

## 1. 巧妙优化点（v1.5.3 主线，2-3 周）

> **目标**：投资人 demo 不变，但工程面更"稳 + 干净 + 统一"。每个点都是 1-2 个 commit 颗粒度。

### 1.1 Redis 集成 — 这次是真的要用起来

**现状**：`docker-compose.yml:25-38` Redis 7-alpine 在跑，`app.module.ts:51-62` ThrottlerModule 用 `@nestjs/throttler` 内存 store。**0 引用 Redis。**

**修法（一次性把 Redis 拉成核心基础设施）**：

1. **`@nestjs/throttler-storage-redis`** 替换默认 in-memory store — 横向扩展到多实例时 rate limit 才不重复计数（投资人"可扩展"故事点）
2. **`cache-manager-redis-yet` + `@keyv/redis`** 包装成 NestJS CacheModule — 给 RAG 检索、首页 hot data、enum translations 加 TTL cache
3. **`ioredis` pub/sub** 给 WebAssistant / notification 做实时推送（v1.5.2 chat polling 改 SSE / WebSocket）

**预期**：5 行 Redis 命令变成"全站基础设施"，投资人问"你们的缓存怎么做" 30 秒能答清楚。

**避开陷阱**：先做（1）throttler Redis store，**不要一上来就上 cache**。cache 加错地方比没 cache 还糟。

### 1.2 死代码清理 — 2 个 hook 删掉

| 文件 | 状态 | 修法 |
|------|------|------|
| `apps/web/src/hooks/useClientPagination.ts` (46 行) | **0 调用方** | 删，`usePagination` 已经在用 |
| `apps/web/src/hooks/usePresignedUpload.ts` (48 行) | **0 调用方**（`FileUploadButton.tsx:69` 直接调 `uploadsApi.upload`） | 删，或改成 wrapper 给 `FileUploadButton` 用 |

**附带**：router.tsx 注释 stale (`router.tsx:54` 写"873KB → 拆 3-4 个 chunk"，实际早拆完了) — 同步重写。

### 1.3 持久化策略统一 — 3 个 store 走 3 种策略

| Store | 当前 | 问题 |
|-------|------|------|
| `authStore.ts` (commit b8cc017 后) | 纯内存 | ✅ 跟安全哲学一致 |
| `themeStore.ts:33` | localStorage | ⚠️ 合理（dark/light 是用户偏好），但要加 SSR-safe 兜底 |
| `webAssistantStore.ts:42` `writePersistedSessionId` | localStorage 存 currentSessionId | ❌ 注释自相矛盾："跟 authUser 策略一致"——但 authUser 是纯内存 |

**修法**：

- `webAssistantStore` sessionId 改 sessionStorage（跟 accessToken 同策略 — 跨 reload 留存 / close tab 清，**不污染多账号**）
- 抽象出 `lib/persistence.ts`：`useMemory / useSession / useLocal` 三档 — 注释明文写"X 存哪、为什么"
- logout 流程同步清 `webAssistantStore.reset()` (commit b8cc017 已做) — 加测试锁住

**预期**：以后加新 store / 写新 hook 不用纠结"这个该存哪"。

### 1.4 测试黑洞填补 — 6 个核心模块 0 spec 必修

| 模块 | LOC | 优先级 | 关键测试 |
|------|-----|--------|----------|
| `auth` (login / refresh / logout / 多 provider) | 1063 | **P0** | 401 回归 + 3 provider 调度 + token 轮换 |
| `users` (CRUD + soft delete) | 463 | P0 | soft delete 17 外键 cascade 安全 + admin 禁删自己 |
| `enrollments` (97 行，小) | 96 | P1 | order → enrollment 事务 |
| `progress` (lesson complete) | 315 | P0 | 重复 complete 幂等 + 跨设备同步 |
| `hackathons` (注册 + 团队 + 评审) | 1311 | P1 | 团队满员 + 评审分数聚合 |
| `notification` (站内信 + 模板) | 442 | P1 | 模板变量替换 + 用户未读计数 |

**预期**：补 30-50 个测试，jest 150 → 200+。**v1.5.0 注释里就标了"v1.5.1 重点补"**，到现在没补，是技术债。

**为什么是 P0**：投资人/客户 demo 现场最容易被"没测试"翻车 —— 一个奇怪的 bug 现场修不了。

### 1.5 stale 注释清理 — 5 处已知矛盾

- `HomePage.tsx:17` 注释 vs line 223 实际"无 mock fallback" 矛盾
- `router.tsx:54` "873KB → 拆 chunk" 早过时
- `webAssistantStore.ts:42` "跟 authUser 策略一致" 实际相反
- `DashboardPage.tsx:16` "失败 / 401 / 网络错 → 渲染 EmptyState" 已改成 QueryErrorState
- `ProfilePage.tsx:12-14` "如果 Frank 决定彻底删除" — 都 v1.5.2 决定不删了，注释该去掉

**修法**：一次性 grep 全部 "TODO" / "FIXME" / "如果..." 注释，分类（保留 / 删 / 转 issue），commit "docs: 删 stale 注释 + 转 issue 跟踪"。

---

## 2. v1.6.0 规划（特性 release，4-6 周）

> **目标**：让 demo 有"AI 真的在工作"的体感，让投资人看到工程深度。

### 2.1 RAG 升级 — 从 Prisma `contains` 到真向量检索

**现状**：`apps/api/src/modules/chat/rag.service.ts:42-58` 用 `Promise.allSettled` 跑 4 个 Prisma `contains` 查询 + `rag.util.ts` 中英分词。规模 100+ 课程时噪声大、相关度差。

**修法**：

1. **Embedding**：用 Gemini `text-embedding-004`（已有 GEMINI_API_KEY 通道）
2. **存储**：MySQL 8.0 已有 JSON 类型 + `@@index` 模式；先不上 vector extension（运维负担），用"title + description + tags" 拼 embedding + 内存 cosine 相似度（先跑通，100-500 条足够）
3. **重建管道**：`scripts/backfill-embeddings.ts` 一次性回填 + `chat/embed.service.ts` 增量更新
4. **降级**：embedding 失败 → 自动 fall back 到 contains 检索（跟 AI service 兜底哲学一致）

**预期**：WebAssistant 答案质量明显提升 —— "推荐入门 LLM 课"能从 5 个假命中变成 1 个真相关。

**成本预估**：回填一次性调 Gemini API，~1000 文档 × $0.025/1M token ≈ $0.01。

### 2.2 监控 + 可观测性 — 投资人问"线上怎么运维"的答案

**现状**：`apps/api/src` 0 个 `@nestjs/terminus` health check，0 Prometheus metrics，0 request tracing。

**修法**：

1. **`/api/health` + `/api/health/ready`** — DB / Redis / MinIO ping（terminus 标准三件套）
2. **`@willsoto/nestjs-prometheus`** — http_requests_total / http_request_duration_seconds 暴露 `/metrics`
3. **request-id 中间件** — 每个请求塞 `X-Request-Id`，log 自动 trace 关联
4. **前端 ErrorBoundary 上报端点** — `POST /api/v1/audit-logs/client-error`（已有 AuditLog 表，加 source='client' enum）

**预期**：投资人问"线上出 bug 怎么排查" → 答 "X-Request-Id grep + 看板"。

### 2.3 WebAssistant 实时化 — 去掉 30s polling

**现状**：`apps/web/src/components/WebAssistant/WebAssistantDrawer.tsx` 401 行 chat drawer，发完消息等后端响应，没有流式。

**修法**：

1. **SSE endpoint** `GET /api/v1/chat/sessions/:id/stream` — 服务端 Gemini 流式 token → 前端 EventSource
2. **乐观更新** + **断线重连** — 之前发一半断网不会丢
3. **typing indicator** — 服务端第一 token 回来前显示"AI 在想…"

**预期**：chat 体感从"等 2 秒弹一坨"变成"打字机效果"。

**避开陷阱**：SSE 在 nginx 反代下要关 `proxy_buffering`，文档要写清楚。

### 2.4 AI 能力深化 — 从"草稿生成"到"全场景"

**现状**：`ai.service.ts` 2 个 endpoint（course / degree draft）。

**v1.6.0 范围**：

1. **Lesson AI 助教升级**：现在 DashboardPage AI 助教是"4 个 quick prompt + 调 Gemini"，改"看到 lesson 内容 + 历史对话 + 用户水平"做真正个性化
2. **AI 自动生成 practice 项目** — 复用 `inferLevel` / `inferTags` 逻辑，输入课程主题 → 输出可运行的 sandbox 代码
3. **AI 评价 review**（管理后台辅助） — 学员评价太多，admin 审不过来。AI 先标"可能含敏感词 / 1-2 星预警"，admin 重点看

**避开陷阱**：这 3 个都涉及 Gemini 调用成本，必须有"用户主动触发"开关 + 兜底（已有 fallback 哲学）。

### 2.5 多端 / 移动端收口 — PWA 化

**现状**：纯 Vite SPA，移动浏览器体验 OK，但没有"装到桌面" / 离线 / push。

**修法**：

1. **`vite-plugin-pwa`** — manifest + service worker（offline shell）
2. **关键页 prefetch** — HomePage / DashboardPage 资源 SW cache
3. **不重要**（不做）：push notification（要 VAPID 密钥 + 多浏览器适配，性价比低）

**预期**：投资人"我们 iPhone Safari 装了" — 比 native app 便宜 100 倍。

---

## 3. 不做（v1.6.0 范围外）

- ❌ 微服务化 / Kubernetes — 现阶段 monorepo + 1 个 backend pod 足够
- ❌ GraphQL — REST + Swagger 已够，投资人不会读 GraphQL schema
- ❌ WebSocket 全站推送 — 局部用 SSE 即可
- ❌ i18n 第三语言 — 80 个双语 key 投资人够用，加 ja/ko 等需求来了再说
- ❌ 重写 auth — 当前可插拔架构 + 3 provider 已经够好

---

## 4. 时间线 + 验收

| Release | 时间 | 包含 | 验收标准 |
|---------|------|------|----------|
| **v1.5.3** | T+1 周 | 1.1-1.5 全部 | pnpm test 250+ 0 fail, pnpm build 0 err, tsc 双 0 |
| **v1.6.0-alpha** | T+3 周 | 2.1 RAG + 2.2 监控 + 2.3 SSE | SSE demo 跑通，/metrics 暴露，回填脚本 1 次跑完 |
| **v1.6.0** | T+5 周 | 2.4 AI 深化 + 2.5 PWA | 完整 release 流程，CHANGELOG + README 同步 |

---

## 5. 风险 + 备选

| 风险 | 影响 | 备选 |
|------|------|------|
| Redis 集成踩生产部署坑 | 多实例时 401 回归 | v1.5.3 只做 throttler Redis store，cache 留到 v1.6.0 |
| Embedding 回填脚本性能 | 1000 文档调 1000 次 Gemini | 改 batch + 异步队列，1 晚上跑完 |
| SSE nginx 配置 | 投资人自己部署不懂 | 写 SOP 文档 + docker-compose 加 nginx 配置示例 |
| 测试黑洞补不完了 | v1.5.3 跳票 | 拆 v1.5.3-a (死代码 + 持久化) + v1.5.3-b (测试) |

---

## 6. 立即可做的事

如果今天就要动：

1. **删死代码** — 2 个 hook + 5 处 stale 注释，1 个 commit 跑完
2. **Redis throttler store** — 加 1 个 npm 包 + 改 `app.module.ts`，半小时
3. **CHANGELOG 加 v1.5.2 white-label 段** — README 已经有但 CHANGELOG.md 漏写
4. **改 package.json v1.5.2** — 当前还是 1.5.0，pre-release 没刷

---

> **待 Frank 决策**：
> 1. v1.5.3 范围 1.1-1.5 是不是同意？还是优先级重排？
> 2. v1.6.0 主线选哪个：RAG（工程深度）vs AI 深化（产品力）vs PWA（移动）？三选二还是全做？
> 3. 测试黑洞补 6 模块，Frank 觉得是 1.5.3 必修还是 1.6.0 拆出去？
