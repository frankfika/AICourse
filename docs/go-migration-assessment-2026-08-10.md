# Academy 后端 Go 化迁移评估

**日期**: 2026-08-10
**作者**: Mavis (应 Frank 要求)
**结论先行**: 推荐 **Strangler Fig + OpenAPI-first 混合路径**, 6-9 个月, 不是"全重写".

---

## 1. 现状摸底(数字说话)

`apps/api/` 是 NestJS + TypeScript + Prisma + MySQL 8 + Redis 7 + MinIO + Express, 单仓 monorepo 的一部分.

| 维度 | 数字 | 来源 |
|---|---|---|
| TS 源文件 | 187 个 | `find apps/api/src -name "*.ts"` |
| 代码行数 | 25,303 | `wc -l` |
| 业务模块 | 28 个 | `apps/api/src/modules/*` |
| Controllers | 38 个 | `*.controller.ts` |
| Services | 36 个 | `*.service.ts` |
| DTO | 22 个 | `*.dto.ts` |
| Guards / Strategies / Filters | 3 / 1 / 1 | — |
| 单元测试 | 38 个 spec | `*.spec.ts` |
| **E2E 测试** | **0 个** | `find test -name "*.e2e-spec.ts"` — **0 结果** |
| Prisma models | 59 | `grep -c "^model" prisma/schema.prisma` |
| Prisma enums | 35 | `grep -c "^enum" prisma/schema.prisma` |
| Prisma schema 行数 | 1,504 | `wc -l` |
| Auth 模块(redesign 后) | 1,877 行, providers/config 分离 | `apps/api/src/modules/auth/` |
| Dockerfile | 2-stage Node 22.18 + pnpm + Prisma generate | `Dockerfile:1-30` |

**外部依赖 (决定 Go 化的关键点)**:
- `@aws-sdk/client-s3` + `s3-request-presigner` — S3 / MinIO
- `ioredis` + `@nest-lab/throttler-storage-redis` — Redis
- `stripe` v17 — 支付
- `@node-saml/node-saml` v5 — **SAML SSO**
- `@nestjs/jwt` + `passport-jwt` — JWT
- `bcryptjs` — 密码哈希
- `class-validator` + `zod` — 双重验证机制
- `helmet` + `cookie-parser` + `express` v5

---

## 2. 关键风险(必须先看清楚再动)

**R1 — 没有 E2E 测试.** 38 个 spec 全是 service 单元测试, e2e `test/` 目录是空的. 这意味着迁移期间**没有端到端回归保护**, Go 化等于盲改. 这是最大的隐藏成本, 不算上就翻车.

**R2 — SAML.** `@node-saml/node-saml` 和 Go 的 `crewjam/saml` API 行为/元数据格式/签名算法细节不一样, SSO 是企业客户的关键路径, 必须**在 Phase 0 单独做 POC**, 不能"到时候再说".

**R3 — Prisma 在 Go 生态很弱.** `prisma-engines` 不支持 Go client 生成, 59 个 model 不能直接复用. 三选一:
- **sqlc** (推荐): SQL-first, 编译时类型安全, 团队要写 SQL 但不复杂
- **gorm**: ORM 风格, Prisma 最接近, 但运行时反射, 性能略输
- **ent**: Facebook 出品, type-safe schema, 代码生成, 学习曲线陡

我倾向 **sqlc + go-migrate + atlas**, 与 Prisma schema 比对生成 migration. 1,504 行 schema 翻译成本真实, 但跑通一劳永逸.

**R4 — 双重验证机制.** `class-validator` (装饰器) + `zod` (运行时) 两套并存, Go 端统一到 `go-playground/validator` + 自定义 tag, 22 个 DTO 文件要逐个翻译.

**R5 — OpenAPI 生成路径变了.** `nestjs/swagger` 是从 TS class 自动生成 OpenAPI 3.0, Go 端两条路:
- `swaggo/swag` annotation 写在 handler 上, 类似 NestJS 习惯
- `ogen` OpenAPI-first, 先定 spec, 再生成 Go 代码

我建议 **ogen**, 原因是 OpenAPI 可以作为"前后端契约"独立维护, 迁移期前端无感知.

**R6 — Auth redesign 刚落地.** `auth-provider.types.ts:1-20` 的可插拔抽象做得不错, Go 端**保留这个抽象**, 不要顺手改成 Go 风格, 不然这一轮白做.

**R7 — 业务冻结期.** 38 个 controller 全部重写, 即使 Strangler Fig 也需要**关键路径业务冻结 2-4 周**做核心模块(用户/课程/订单)切换.

---

## 3. 路径选择

| 路径 | 描述 | 时长 | 业务冻结 | 风险 | 推荐度 |
|---|---|---|---|---|---|
| A. 全重写 | 一个仓砍掉重写, 一次性切流量 | 4-6 月 | 整段 4-6 周 | R1 翻车率最高 | ❌ |
| B. Strangler Fig | 网关路由, 新模块用 Go, 老模块逐步替换 | 9-12 月 | 几乎零 | R1 缓解, 但**长尾难收** | ⚠️ |
| **C. OpenAPI-first + 双跑** | 先抽 spec, Go 100% 实现核心模块, gateway 按路径切流量, 灰度上线 | **6-9 月** | **2-4 周核心** | R1 缓解, **节奏可控** | **✅ 强烈推荐** |

**我推荐 C 路径**, 关键点:
1. **第 0 阶段 (2 周)** 先做技术验证 POC: Prisma → sqlc 跑通, S3 / Redis / Stripe 三个外部依赖 Go SDK 跑通, **SAML 必须有 POC**
2. **第 1 阶段 (4 周)** 用 ogen 从 NestJS 抽出 OpenAPI 3.0 spec, Go 端搭骨架 (Fiber + sqlc + validator), auth/password 端点走通
3. **第 2 阶段 (8 周)** 用户/课程/订单/学位/进度/通知 核心 CRUD 迁移, 跑 double-write 校验
4. **第 3 阶段 (4 周)** CMS / Hackathons / Enterprise / URL-Import 边角迁移
5. **第 4 阶段 (2 周)** 灰度切流量 (10% → 50% → 100%), 下线 Node API

**人力假设**: Frank 全职 + 我一半时间, 4-5 个月; 两个人全职, 3 个月. Frank 还要做 IR 主业 + HashKey / OpenDesk, 实际**单人 = 6-9 个月**, 这是评估底线.

---

## 4. Go 栈选型建议

| 层 | 选型 | 理由 |
|---|---|---|
| HTTP 框架 | **Fiber v2** | Express 风格, 中间件思路一致, 团队迁移摩擦最小; 比 Gin 快, 比 Echo 文档好 |
| ORM / SQL | **sqlc + go-migrate + atlas** | sqlc 编译时类型安全, atlas 处理 schema 漂移, Prisma schema 翻译一次到位 |
| 验证 | **go-playground/validator v10** | 替代 class-validator + zod, tag 风格 |
| JWT | **golang-jwt/jwt v5** | passport-jwt 行为兼容, refresh token 逻辑要重写 |
| SAML | **crewjam/saml v2** | 主流 Go SAML 库, 必须 POC 验证 IDP 兼容性 |
| Stripe | **stripe/stripe-go** | 官方 SDK, webhook 签名验证要重写 |
| S3 | **aws-sdk-go-v2** | 与 Node SDK 行为一致, minio 兼容 |
| Redis | **redis/go-redis v9** | 替代 ioredis |
| 文档 | **ogen** | OpenAPI-first, 与现有 swagger 注释可以反向生成 spec |
| 任务/队列 | **asynq** | 邮件/通知/异步任务, 替代 NestJS @nestjs/bull |
| 测试 | **testify + dockertest** | 单测 + 真 MySQL 容器测, 强制补 e2e |
| 部署 | **多阶段 Dockerfile + distroless** | 镜像 < 50MB, 启动 < 200ms, 比 Node 镜像小 10 倍 |
| 监控 | **prometheus/client_golang** | 自带 /metrics, p95 延迟可观测 |

---

## 5. 我需要你回答的 3 个问题(决定路径细节)

**Q1 — 业务冻结期可接受多长?**
- 2-4 周核心模块冻结(C 路径) ⬅ 推荐
- 几乎零冻结(B 路径, 时间拉长)
- 1-2 周也可以, 但要分多轮灰度, 时间拉到 9-12 月

**Q2 — 双跑能力**
- 现状是 docker-compose, 有 K8s / nginx 网关可以做路径级流量分发吗?
- 没有的话, C 路径要降级到"前端通过 axios baseURL 切换", 风险更高

**Q3 — 团队规模 / 时间预算**
- 只有你一个人 + 我: 6-9 个月, 主业受影响
- 加 1 个全职 Go 后端: 3-4 个月, 招人成本另算
- 找外包: 1-2 个月, 质量看运气, **不建议** (R1 + R2 风险)

---

## 6. 总结一句话

**6-9 个月, Fiber + sqlc, OpenAPI-first 渐进迁移, 第 0 阶段先做 SAML POC 验证兼容性, 第 4 阶段灰度切流量, 不"全重写".**

报告完. 等你回答 Q1/Q2/Q3 再开 Phase 0.
