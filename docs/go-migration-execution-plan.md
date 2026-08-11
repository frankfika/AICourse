# Academy 后端 Go 化迁移执行计划

**日期**: 2026-08-10
**目标**: 把 `apps/api/` (NestJS/TypeScript/Prisma) 全部迁移到 Go, **保证整体系统反复测试不出问题**
**路径**: C — OpenAPI-first + Strangler Fig + 灰度切流
**栈**: Go 1.23+ / Fiber v2 / sqlc / go-migrate / atlas / ogen / crewjam/saml / stripe-go
**编排**: Mavis (root orchestrator) + background agent 团队并行跑 POC + 持续 phase 推进

---

## 决策记录 (Frank 授权 Mavis 自决)

| 决策点 | 选择 | 理由 |
|---|---|---|
| 路径 | C: OpenAPI-first 双跑 + 灰度切流 | 业务冻结期可控, 风险分散 |
| 框架 | **Fiber v2** | Express 风格, 中间件思路一致, 团队迁移摩擦最小 |
| ORM | **sqlc** + go-migrate + atlas | 编译时类型安全, 与 Prisma schema 比对生成 |
| 验证 | go-playground/validator v10 | 统一替代 class-validator + zod |
| 文档 | ogen (OpenAPI-first) | spec 作为前后端契约 |
| 认证 | golang-jwt/jwt v5 | 保留现有 auth-provider 抽象 |
| SAML | crewjam/saml v2 | 必须 Phase 0 POC 验证 IDP 兼容 |
| 测试 | testify + dockertest | 强制补 e2e (当前 0 个) |
| 部署 | 多阶段 Dockerfile + distroless | 镜像 < 50MB, 启动 < 200ms |
| 监控 | prometheus/client_golang | /metrics + p95 可观测 |
| 迁移 | 双写 + 灰度切流 | 10% → 50% → 100% |

---

## 总体时间线

| Phase | 周期 | 关键产出 | 验证标准 |
|---|---|---|---|
| **Phase 0 (POC)** | 2-3 周 | Go 骨架 + 4 个外部依赖 POC + OpenAPI spec | Fiber 起 hello, sqlc 跑通第一个 model, SAML POC 通过, 抽出的 spec 与 NestJS swagger 1:1 比对 |
| **Phase 1** | 4 周 | auth/password + 基础设施 (config, logger, error, middleware) | 登录/注册/refresh/SSO 端点行为一致, 全部走 38 个现有 spec |
| **Phase 2** | 8 周 | 用户/课程/订单/学位/进度/通知 核心 CRUD | 双写 (写 Node + Go 读) 一致, 流量切 10% |
| **Phase 3** | 4 周 | CMS / Hackathons / Enterprise / URL-Import 边角 | 流量切 50% |
| **Phase 4** | 2 周 | 流量切 100% + Node API 下线 | 全部 e2e 通过, 0 线上事故 |

**总**: 6-9 个月. Frank 主业 (IR) 受影响时间需要明确预期.

---

## Phase 0 详细任务 (本周启动)

### T1. Go 骨架 — `apps/api-go/`
- [ ] `apps/api-go/go.mod` (Go 1.23)
- [ ] 目录结构: `cmd/server/`, `internal/{config,handler,middleware,service,repo,model,validator}/`, `migrations/`, `db/queries/`
- [ ] 多阶段 Dockerfile (golang:1.23-bookworm → distroless/static)
- [ ] docker-compose 集成 (apps/api-go 替换 apps/api)
- [ ] Fiber hello world (单测通过, 启动 < 200ms)
- [ ] 配置加载 (viper, 与 .env 兼容)
- [ ] logger (slog + zap fallback)
- [ ] error 全局 filter (保留 NestJS 异常格式契约)
- [ ] prometheus /metrics 中间件

### T2. OpenAPI 3.0 抽取
- [ ] 跑 NestJS `npm run build` + `npm run start`
- [ ] 访问 `/api/docs-json` 拉 swagger.json
- [ ] 落盘到 `apps/api-go/api/openapi.yaml`
- [ ] 写脚本 `scripts/export-openapi.sh` 一键导出
- [ ] ogen 生成 Go client/server 接口 (`oapi-codegen.yml`)
- [ ] 验证: 抽出的 spec 覆盖现有 38 个 controller 全部 endpoints

### T3. 外部依赖 POC (background agent 跑)
- [ ] **S3**: aws-sdk-go-v2 上传/下载/presigned URL 跑通 (对比 Node SDK 行为)
- [ ] **Redis**: go-redis v9 ping/set/get 跑通, throttler-storage-redis 替代方案
- [ ] **Stripe**: stripe-go 支付意图/退款/webhook 签名验证跑通
- [ ] **SAML**: crewjam/saml + 测试 IDP metadata, 走通 SAML response 验证

### T4. Prisma → sqlc 翻译
- [ ] 读 `prisma/schema.prisma` (1504 行, 59 model, 35 enum)
- [ ] 用 prisma-to-sql 或手写 SQL DDL
- [ ] 跑 sqlc, 生成 Go 类型 + 查询函数
- [ ] 对比第一个 model (User) 字段一致
- [ ] 写脚本 `scripts/migrate-schema.sh`

### T5. 测试纪律
- [ ] testify 引入
- [ ] dockertest 写一个示例: 启动 MySQL 容器 → 跑 migration → 跑测试
- [ ] contract test: 用 OpenAPI spec 验证所有现有 endpoints
- [ ] e2e 起步: 选 auth/login 作为第一个 e2e 走通 (login → /me → logout)
- [ ] 写 `docs/testing-strategy.md` 给后续 phase 参考

---

## Phase 1 详细任务 (T6-T10, 待 Phase 0 通过后启动)

- [ ] T6. auth/password-redesign 模块移植 (保留 AuthProvider 抽象, 三个具体实现)
- [ ] T7. JWT 策略 + Refresh Token 轮转 (与现有行为 1:1)
- [ ] T8. SAML/OAuth 端点
- [ ] T9. Middleware 链 (helmet, cors, rate-limit, request-id, recovery)
- [ ] T10. 38 个 spec 全部通过, 启动 e2e 套件

---

## Phase 2 详细任务 (T11-T16, 8 周)

- [ ] T11. Users + Auth-providers (UserProviderAccount)
- [ ] T12. Courses + Chapters + Lessons + Resources
- [ ] T13. Orders + Payments (Stripe) + Enrollments
- [ ] T14. Degrees + Practice + Badges + Certificates
- [ ] T15. Progress + Learning events + Notes + Reviews
- [ ] T16. Notifications + Points + Uploads (S3)

每完成一个模块, 跑双写校验 (Node 写 + Go 读, 比对结果), 单元测试 + 集成测试 + e2e.

---

## Phase 3 详细任务 (T17-T20, 4 周)

- [ ] T17. CMS (admin/config/content/enum/i18n/sitemap)
- [ ] T18. Hackathons (含 Teams / Judges / Sponsors / Submissions)
- [ ] T19. Enterprise + URL-Import + Audit
- [ ] T20. AI (chat/ai-config/ai-user-config) + Site + Health + Search

---

## Phase 4 详细任务 (T21-T23, 2 周)

- [ ] T21. nginx/gateway 切流 10% → 50% (按 user_id hash)
- [ ] T22. 监控 1 周, 0 事故 → 切 100%
- [ ] T23. 下线 Node API, 删除 apps/api/, 清理 monorepo

---

## 风险与对策 (R1-R7 见评估报告)

| 风险 | 现状 | 对策 |
|---|---|---|
| R1 0 e2e | 致命 | Phase 0 T5 起步, 每 phase 补齐 |
| R2 SAML | 关键 | Phase 0 T3 单独 POC, 不通过不上 phase 1 |
| R3 Prisma→sqlc | 大工作量 | Phase 0 T4 跑通, 59 model 一次性翻译 |
| R4 双重验证 | 中等工作量 | Phase 1 统一, 22 DTO 逐个翻译 |
| R5 OpenAPI 路径 | 重要 | Phase 0 T2 用 ogen OpenAPI-first |
| R6 auth 抽象 | 保留 | Phase 1 T6 严格按现有抽象翻译 |
| R7 业务冻结 | 2-4 周核心 | Phase 2/3/4 灰度, 不全量切 |

---

## 任务管理

- **Root**: Mavis (我自己, 在 root session)
- **Background agents**: 跑 Phase 0 POCs (外部依赖 + Prisma 翻译), 阶段交付后给我
- **Cron self-reminder**: 每 6h 检查 background task 进度
- **Frank 汇报节点**: Phase 0 完成 / Phase 1 完成 / Phase 2 完成 (切流 10%) / Phase 4 完成 (切流 100%)
- 中间不打扰 Frank, 决策自主

---

## 文档维护

- `docs/go-migration-assessment-2026-08-10.md` — 评估报告 (已完成)
- `docs/go-migration-execution-plan.md` — 本文档, 执行计划
- `apps/api-go/README.md` — Go 端开发者指南 (Phase 0 完成时)
- `docs/testing-strategy.md` — 测试纪律 (Phase 0 T5 完成时)
- `docs/migration-decisions.md` — 决策日志 (随时追加)
