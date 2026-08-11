# Go API 最终验证记录（2026-08-12）

## 结论

本轮完成了 Go API 的本地编译、静态检查、非 Docker 测试，以及按模块严格串行的 dockertest e2e 验证。已执行的测试范围内没有遗留失败；CMS 为 21/21，Hackathons 为 35/35，交接清单中的 13 个中小模块也全部通过。

这个结果证明当前代码在本机、测试配置和模拟外部依赖下具备较完整的回归基线，**不等于生产就绪**。生产对象存储、真实 LLM/RAG、真实外部 OAuth/邮件/Redis，以及数据库连接池架构仍有明确边界，见文末。

## 验证方法

- 所有 dockertest e2e 都以单进程、单模块或单个顶层测试运行；没有并发启动多个 `go test`。
- 每次测试结束后清理该次产生的 MySQL 容器。
- CMS 和 Hackathons 没有用一个超长命令整包硬跑，而是用精确的 `^TestName$` 逐项执行。
- 所有时间均为本机墙钟近似值，包含 Go 测试启动和容器准备时间；它们不是性能基准。

## Smoke 与非 Docker 检查

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `go build ./...` | PASS | 最终代码再次执行，exit 0 |
| `go vet ./...` | PASS | 最终代码再次执行，exit 0 |
| `TestHealth` smoke | PASS | in-process health smoke 通过，约 0.4s |
| 非 Docker race 测试 | PASS | 40 个非 e2e/integration package 通过 race 检查 |
| `gofmt` 检查 | PASS | 本轮报告的格式检查无未格式化 Go 文件 |
| `git diff --check` | PASS | 无空白错误 |
| e2e 编译检查 | PASS | e2e package 可编译；实际 dockertest 结果见下文 |

CI 定义位于 `.github/workflows/go-api.yml`：push/PR 运行 gofmt、vet、非 Docker race、e2e 仅编译和 build；完整串行 e2e 只在手动触发或定时任务运行，并明确设置 `-parallel=1`。本轮核对了工作流定义，但没有把“本地通过”写成“GitHub Actions 远端运行已通过”。

## 13 个中小模块

| 模块 | 最终结果 | 墙钟 |
| --- | --- | ---: |
| Badges | PASS | 71s |
| Certificates（实际前缀 `TestCerts`） | PASS | 115s |
| Chapters | PASS | 49s |
| Degrees | PASS | 75s |
| Notes | PASS | 38s |
| Points | PASS | 69s |
| Progress | PASS | 73s |
| Resources | PASS | 39s |
| Reviews | PASS | 45s |
| Uploads（最终 Storage 改动后复跑） | PASS | 110s |
| Site | PASS | 18s |
| Notifications（含 `TestNotif` 与 `TestNotifOrders`） | PASS | 79s |
| Enrollments | PASS | 58s |

交接文档里的 `TestCertificates` 和 `TestNotifications` 不是实际测试前缀。本轮使用真实前缀，避免出现“没有匹配任何测试但命令返回成功”的假绿。

## 大模块

### CMS

- 从 `cms_test.go` 枚举出 21 个 `TestCMS...` 顶层测试。
- 逐项用精确名称独立运行，并在每项后清理 MySQL。
- 结果：**21/21 PASS**，单项约 7–10s，累计墙钟约 176s。
- 覆盖管理员鉴权、公开读取、app/site/page settings、enum/i18n、内容资源 CRUD、导航安全路径和公开 auth-provider 配置脱敏。

### Hackathons

- 覆盖 core、teams、submissions、judges、sponsors 五个测试文件，共 35 个顶层测试。
- 逐项独立运行；最终结果：**35/35 PASS**，累计墙钟约 360s。
- 覆盖公开列表/详情、管理员创建与软删除、报名/取消/重新报名、用户隔离、公告、队伍生命周期、提交 ownership、评审、judges/sponsors 管理和权限门禁。
- `TestHackathonSubmissions_Judge` 曾稳定返回 400。核对 NestJS `JudgeSubmissionDto` 后确认其使用 `@IsInt`，是测试错误地发送了 `87.5`，不是 Go 业务 bug。测试改为整数 `87`，并断言 MySQL `DECIMAL(5,2)` 返回 `87.00`；单独复跑 13s 通过。

## 本轮新增或最终代码复跑

| 范围 | 用例数 | 最终结果 | 墙钟 |
| --- | ---: | --- | ---: |
| OAuth | 8 | PASS | 75s |
| Chat | 4 | PASS | 34s |
| Password Reset | 1 个端到端测试及其子测试 | PASS | 11s |
| AI 扩展覆盖 | 18 | PASS | 166s |
| Uploads 最终实现 | 12 | PASS | 110s |

OAuth 和 Password Reset 在安全修复后重新执行，表中是最终代码结果，不是修复前的旧结果。AI 扩展测试包含兼容路由、配置 CRUD 与双用户隔离。Uploads 在 Storage 接口和本地真实 PUT 闭环完成后重新执行。

## 主要真实修复

以下是本轮从最终源码和回归覆盖中确认的主要修复；不把纯测试夹具修正算成生产业务修复。

1. **OAuth/SAML state 安全边界**
   - 浏览器回调必须走 state-aware callback，生产环境不能使用直接认证捷径。
   - state 为一次性消费，并绑定 provider、`login`/`link` flow；link flow 还绑定当前 user，防止跨 flow 或跨用户复用。
   - 生产启用有状态认证提供方时要求 Redis；测试继续使用线程安全的内存 store。

2. **密码重置防枚举与并发消费**
   - 不存在账号、OAuth-only 账号、发送成功和邮件服务失败对外返回不可区分结果，避免账号枚举。
   - 新请求替换旧 token；发送失败会使未送达 token 失效。
   - confirm 使用数据库事务/锁完成 token 一次性消费和密码更新，覆盖并发确认。

3. **Uploads 本地真实 PUT 闭环**
   - LocalFileStorage 的签名绑定 key、content type、大小和过期时间。
   - PUT 使用限流读取、内容嗅探、路径/符号链接防护和原子 no-replace 发布；已覆盖过期、篡改、超限、类型不符和覆盖写入。
   - 最终 Uploads e2e 在该实现落地后复跑通过。

4. **AI 配置与兼容路由**
   - 补齐 NestJS/Web 兼容路径，同时保留原迁移路径别名。
   - 管理员配置和用户配置保持权限、遮罩与用户隔离；生产环境要求有效的 `AI_KEY_ENC_KEY`，不能回退到开发用可逆格式。
   - cloud provider 的 base URL 校验和本地 provider 行为分开处理。

5. **CMS 与 Hackathons 响应/权限一致性**
   - CMS 公开 auth-provider 响应剥离敏感配置，导航/页脚链接执行安全路径校验，复合 key 路由得到回归覆盖。
   - Hackathons list/detail 使用聚合响应行并补齐关联计数、当前用户报名和 judges；子资源校验 hackathon 归属、用户 ownership 和管理员门禁。

6. **全局接线和基础保护**
   - Learning Events、Chat、AI 兼容路由及密码重置等入口已挂载并有端到端覆盖。
   - 全局限流 key 使用稳定的直接 peer IP，不再受 request-id 影响而导致每次请求落入不同 bucket。

7. **e2e 基础设施稳定性**
   - 多个 dockertest 文件补齐 `pool.MaxWait`；新增 Learning Events、OAuth、Chat、Password Reset、Hackathons 子资源等覆盖。
   - 这改善的是本机 MySQL 启动容错，不应被描述成业务功能修复。

## 作废结果与环境干扰

- Badges 第一轮曾被另一个遗留 runner 清理 Docker，出现 MySQL connection refused、`unexpected EOF` 和 timeout。该轮作废；环境清理后独立重跑 71s 通过。
- Notes 第一次命令在测试启动前遇到共享工作树中 Hackathons 的临时编译错误，没有创建 MySQL，也没有执行 Notes 用例。编译恢复后重跑 38s 通过。
- 早期存在 orphan/延迟 Hackathons runner。之后停止并等待外部 e2e 结束，确认环境安静后才恢复串行队列。
- `packets.go:58 unexpected EOF` 在 MySQL 启动探测阶段仍偶有出现；只要最终连接成功，它属于 dockertest 启动噪声。连接拒绝或超时必须清理后独立重跑，不能直接归类为业务失败。
- 没有把受干扰轮次计入最终通过数，也没有用批量命令的最终 exit code掩盖中间单项失败。

## 尚未验证或尚未完成的生产边界

1. **生产 S3/MinIO backend 未实现**
   - 当前有 InMemoryStorage 和带签名的 LocalFileStorage；`aws-sdk-go-v2` 的真实生产 S3/MinIO Storage 实现仍未接入。
   - `main.go` 在 production 环境会禁用 uploads 路由，而不是假装使用本地实现。

2. **Chat / AI 生成 / URL import 仍含 stub**
   - Chat 的 assistant reply 仍是确定性 stub，没有真实 RAG/Gemini 调用。
   - AI generate-course、generate-degree 和 connection test 仍是 stub；配置 CRUD 通过不代表真实模型可用。
   - URL import 的 YouTube/Bilibili 元数据路径在 e2e 使用本地 mock upstream；Gemini 课程大纲步骤仍是 placeholder/stub。生产外网、限流、上游错误和真实凭据没有在本轮验证。

3. **31 个独立数据库连接池**
   - `cmd/server/main.go` 当前有 31 次 `sql.Open`，每个都设置 `SetMaxOpenConns(50)`，并按当前设计不主动关闭。
   - 理论连接上限和资源占用明显偏大。生产前应改为共享 `*sql.DB`/统一生命周期，并按 MySQL 实际连接额度压测和设定 pool 参数。

4. **异步邮件与外部邮件服务时序**
   - Password Reset 已验证 fake notifier 下的防枚举、失败失效和一次性 token；Enterprise notifier 仍是日志 stub。
   - 真实 Resend 凭据、网络超时、重试、重复投递、进程退出窗口及审计记录时序需要单独的外部依赖验证。

5. **Redis 可用性与多实例行为**
   - OAuth/SAML 生产 state store 依赖 Redis；Redis 不可用时相关认证路由会降级/禁用。本轮 OAuth e2e 使用内存 store，没有证明生产 Redis 的故障恢复能力。
   - 当前全局 Fiber limiter 也是进程内实现，多实例部署不能共享额度。需要 Redis-backed limiter 或网关级限流。

6. **外部凭据与真实供应商**
   - Google/GitHub/SAML、Gemini、Resend、生产对象存储均未用真实生产凭据做端到端验收。
   - 因此不能从本报告推出“所有生产集成都已可用”。

## Git 状态与未提交原因

本轮没有创建 commit。当前仓库视角下，整个 `apps/api-go` 是初始 Go 迁移形成的 untracked 工作树，而不是一个已有基线上的小型测试 diff。在这种状态下提交会把完整迁移、生产代码、测试和文档混成一个无法准确归因的提交，也会错误地把结果描述为“只修改了测试”。

提交前应由项目负责人先确认迁移基线、纳入范围和提交拆分策略，再统一 stage/commit。本文只记录实际执行和观察到的结果，不伪造 commit，也不宣称生产已经验收完成。
