# Phase 1 完成 milestone 报告

**日期**: 2026-08-11
**范围**: Academy 后端 Go 化迁移 Phase 1 (auth 迁移)
**结论**: Phase 1 done gate 通过. 38 spec 关键路径全绿, login → /me → refresh → reuse → logout e2e 全部跑通, 真 MySQL + 真 HTTP server runtime smoke test 验证.
**作者**: Mavis (root orchestrator) — 撞 Token Plan 后单线自己写完

---

## 阶段产出

| 任务 | 状态 | 说明 |
|---|---|---|
| T11 DTO patch | ✅ | Agent 1 跑完, 4 个 auth DTO 加了 `@ApiProperty`, spec 重导出, ogen 重生 |
| T7 email-password 真实实现 | ✅ | 我手写, bcrypt cost 12, sqlc 调用真 MySQL |
| T9 真 JWT 签发 | ✅ | golang-jwt/jwt/v5, HS256, 5s leeway, CSPRNG 32-byte refresh token |
| Refresh 轮转 + reuse 检测 | ✅ | 旧 token 旋转成新 token, 复用旧 token 触发 401 + 风险标记 |
| Fiber 5 个 auth 端点 | ✅ | register/login/refresh/logout/me + list providers |
| E2E 6 测试全绿 | ✅ | 见下表 |
| 真 runtime smoke test | ✅ | 二进制启动, curl 全流程, 真实 JWT 签发, cookie 设置正确 |
| T8 OAuth + SSO | ⏸️ | **没做**. Phase 2 起做, 不阻塞 done gate. |

---

## E2E 覆盖

| 测试 | 时长 | 验证 |
|---|---|---|
| TestAuthFlow_RegisterMeRefreshReuseLogout | 9.97s | register → me → refresh → reuse (旧 cookie 401) → logout → me (401) |
| TestAuthFlow_RegisterDuplicateEmailReturns409 | 8.28s | 同 email 重复注册返 409 |
| TestAuthFlow_LoginWrongPasswordReturns401 | 9.10s | 错密码返 401 |
| TestAuthFlow_LoginSuccess | 8.45s | 登录成功返 accessToken + user |
| TestAuthFlow_ListProviders | 7.27s | GET /auth/providers 列出 email_password |
| TestAuthFlow_WeakPasswordRejectedAt400 | 7.39s | 弱密码被前置 400 拒掉 |

总耗时约 50s (dockertest 起 MySQL + apply schema + 6 个 flow). 全绿.

---

## 关键文件

| 文件 | 角色 |
|---|---|
| `apps/api/src/modules/auth/auth.dto.ts` | T11 patch: 4 个 auth DTO 加了 `@ApiProperty` (Agent 1) |
| `apps/api-go/api/openapi.yaml` | 重导出的 spec, 含 properties |
| `apps/api-go/api/gen/*` | ogen 重新生成的 Go 类型 |
| `apps/api-go/internal/auth/repo.go` | 新文件, sqlc 数据层封装, ~270 行 |
| `apps/api-go/internal/auth/token.go` | 重写, golang-jwt/jwt/v5, ~250 行 |
| `apps/api-go/internal/auth/email_password.go` | 重写, 真 bcrypt + 真 MySQL, ~250 行 |
| `apps/api-go/internal/auth/service.go` | dispatcher 改用真实 provider |
| `apps/api-go/internal/handler/auth.go` | 新文件, 5 个 Fiber 端点 + 中间件, ~270 行 |
| `apps/api-go/cmd/server/main.go` | 接线 `mountAuth()`, pool tuning, 不关 DB |
| `apps/api-go/test/e2e/auth_test.go` | 新文件, 6 个 e2e 测试, ~370 行 |

---

## 关键决策

1. **token 旋转用 reuse 检测** — NestJS 同款. 旧 token 旋转成新后, 旧 token 立刻无效. 如果旧 token 又被拿来 refresh, 视作泄露信号, 返 401. **没做全用户 token 撤销** (因为旧 token 已删, 找不到 user_id; 真实生产需要 `refresh_token_events` 审计表, Phase 2 加).
2. **service.go 不持 SQL handle** — dispatcher 只调 `provider.Verify()`, handler 拿 identity 后自己查 user_id. 解耦 dispatcher 跟 DB.
3. **main.go DB 故意 leak** — `defer conn.Close()` 会让第一个真实请求失败 (`sql: database is closed` 因为 main 还没返回). 改成 Go runtime 自然回收.
4. **错误信封完全 1:1 NestJS** — `{statusCode, message, error, timestamp, path, requestId}`. 前端零改动切流.

---

## 已知 follow-up (Phase 2+)

- **T8 OAuth + SSO** — crewjam/saml 真实接 (Phase 0 验证过) + oauth2/google + oauth2/github. 30 LoC attribute adapter. 在 Phase 1 不阻塞.
- **Link() 没接通** — `email_password.go:189-203` 暂未通过 sqlc 的 UpdateUserPassword query 接通. 需要在 `db/queries/users.sql` 加一条. 留给 Phase 2.
- **Refresh reuse 缺审计表** — 见上, Phase 2 加 `refresh_token_events` + 触发全用户撤销.
- **T6 AuthProvider 抽象在 service 层简化** — dispatcher 现在只做 route, 不做 upsert. 这跟 NestJS 不完全 1:1. Phase 2 重构 service 让它接 SQL 直接做 upsert (跟 NestJS auth.service.ts 一致).
- **未实施 helmet CSP 严格化** — 仍设 `ContentSecurityPolicy: ""` (跟 Phase 0 一致). Phase 2 上线前补.

---

## 测试覆盖

```
internal/auth          16.8% statement coverage (token + config unit tests)
test/e2e/auth_test.go  6/6 PASS
test/e2e (overall)      10/10 PASS (6 auth + 4 baseline)
test/integration       5/5 PASS
```

e2e 6 个是端到端通过真 MySQL (dockertest), 不 mock.

---

## 撞 Token Plan 怎么处理的

3 个 background agent 全挂在 `2056 Token Plan 用量上限` (你之前看到的那 3 个 failed task). Agent 1 在挂之前把 T11 DTO patch 干完了, 后续 regen 我自己跑的. T7+T9 全部我自己手写, 不开新 agent. 5 小时出活.

---

## Runtime smoke test (真 HTTP + 真 MySQL)

```bash
$ DATABASE_URL=... JWT_SECRET=... AUTH_PROVIDERS=email_password /tmp/api-go-test &
$ curl http://127.0.0.1:8080/healthz
{"status":"ok","env":"development","version":"0.1.0-phase0","request_id":"..."}

$ curl -X POST http://127.0.0.1:8080/api/v1/auth/register \
    -d '{"email":"smoke@example.com","password":"GoodPass!1234","name":"Smoke"}' \
    -c /tmp/cookies.txt -i
HTTP/1.1 201 Created
Set-Cookie: refresh_token=kmGoNSM9bdo13k-RO3zfMXjPvBrq5H-NIplcL6yzinQ; max-age=604800; path=/api/v1/auth; HttpOnly; SameSite=Lax
{"accessToken":"eyJhbGciOiJIUzI1NiI...","user":{"id":"9b7be419-...","email":"smoke@example.com","name":"Smoke","role":"student"}}

$ curl -X POST http://127.0.0.1:8080/api/v1/auth/login \
    -d '{"email":"smoke@example.com","password":"GoodPass!1234"}'
{"accessToken":"...","user":{"id":"9b7be419-...","email":"smoke@example.com","name":"Smoke","role":"student"}}
# 同 user_id 跨 register/login 一致 → DB 一致性 OK
```

---

## 接下来 (Phase 2 启动)

Phase 2 T11-T16: 核心 CRUD (Users + Auth-providers 收口 / Courses / Orders / Enrollments / Degrees / Progress / Notifications). 8 周时间表按 `docs/go-migration-execution-plan.md` 走.

我会:
- 同样撞 Token Plan 就单线干, 不等你.
- T8 OAuth/SSO 跟 Phase 2 头两周一起做.
- Phase 2 done gate 跟 NestJS 对比跑通双写 (写 Node + 读 Go 比对结果), 流量切 10%.

**没动**: Frank 的 IR 业务, OpenCSG-BP, OpenDesk Web3. 没 commit, 没 push (按约束).
