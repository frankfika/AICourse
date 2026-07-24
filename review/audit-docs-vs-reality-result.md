# 文档 vs 现实一致性 Audit

## 摘要
- USER_MANUAL 验证事实: 14 条
  - 一致: 5
  - 不一致: 9
- ADMIN_MANUAL 验证事实: 10 条
  - 一致: 4
  - 不一致: 6
- GLOSSARY 验证事实: 6 条
  - 一致: 3
  - 不一致: 3

## P0(用户能直接踩到的文档坑)

### 文档坑 1: 视频进度上报频率写 5 秒,实际 1 秒
- 文档位置: USER_MANUAL §2 步骤 4 + §8.5
- 文档原文: "视频每 5 秒会向后端上报学习进度";"每 5 秒 video time + 1,触发 LearningEvent 上报"
- 现实: apps/web/src/features/dashboard/DashboardPage.tsx:483-500 `setInterval(..., 1000)` 每 1 秒 +1,且 console.log 标 `TODO(后端)`,后端 `LearningEvent` 接口未实现
- 影响: 调试时 console 刷屏 5 倍;用户以为上报节流,实际未节流

### 文档坑 2: 退款 5% 手续费 / 7 天 / 20% 进度校验全不存在
- 文档位置: USER_MANUAL §12.4
- 文档原文: "课程开通后 7 天内、学习进度 < 20%:有条件退款(扣除 5% 手续费)"
- 现实: apps/api/src/modules/orders/orders.service.ts:301-322 `refundOrder` 仅校验 `status === paid`,无时间窗口、无进度检查、无手续费计算,直接 `update status: refunded`
- 影响: 用户在 7 天外 / 进度 > 20% 仍可退款,文档承诺的规则形同虚设;运营对账会出现预期外的全退

### 文档坑 3: 评分 1-10 分,实际 0-100
- 文档位置: ADMIN_MANUAL §7.4
- 文档原文: "评分表(各维度 1-10 分 + 评语)"
- 现实: apps/api/src/modules/hackathons/hackathons.dto.ts:172-177 `JudgeSubmissionDto.score` 用 `@Min(0) @Max(100)`,范围 0-100
- 影响: 评审 UI 显示 1-10,后端拒收 >10 分数;前端必须改 0-100,否则提交 500

### 文档坑 4: 通知中心 4 tab + 30s 轮询全未实现
- 文档位置: USER_MANUAL §13 + ADMIN_MANUAL §3.3
- 文档原文: "/dashboard/notifications — 4 tab:全部 / 未读 / 系统 / 互动";"30s 轮询:未读数 badge 实时刷新"
- 现实: apps/web/src/features/dashboard/notifications/NotificationsPage.tsx 整个文件是 placeholder,4 tab 只是静态 `<button>` 标签,无 onClick / 无 react-query / 无 setInterval;占位说明写"通知中心 UI 正在迭代中"
- 影响: 用户点 tab 不切内容,等不到 unread badge 变化

### 文档坑 5: 4 个角色,代码 3 个
- 文档位置: ADMIN_MANUAL §1 角色权限矩阵
- 文档原文: "user / admin / super_admin" 4 角色 + "只有 super_admin 可创建新 admin"
- 现实: prisma/schema.prisma:87-91 `enum UserRole { admin / student / instructor }`,无 `user`、无 `super_admin`
- 影响: 权限矩阵整张表是空头支票,Router `ProtectedRoute requireAdmin` 只判 `admin`,无 super_admin 区分;UI 显示 "请用 super_admin" 是死路

## P1(细节不一致)

### 文档坑 6: 看板 KPI 名字对不上
- 文档位置: ADMIN_MANUAL §3.1
- 文档原文: "总用户数 / 总课程数 / 本月订单收入(CNY) / 本月活跃学员"
- 现实: apps/web/src/features/admin/AdminDashboardPage.tsx:39-78 `KPI_MOCK` 是"今日 GMV / 新增用户 / 活跃学员(DAU) / AI token 成本",**4 项全错**且不是同维度
- 影响: admin 找"本月订单收入"找不到,以为是 bug

### 文档坑 7: 徽章规则 DSL 7 类型,代码 6 类型且 3 个不重叠
- 文档位置: ADMIN_MANUAL §8.3
- 文档原文: "course_completed / degree_completed / hackathon_joined / hackathon_won / points_earned / streak_days / lessons_completed"
- 现实: apps/api/src/modules/badges/badges.service.ts:316-330 `case` 只 6 个:`course_completed / lessons_completed / streak_days / first_enrollment / practice_completed / points_reached`
  - 文档有的 3 个缺失: `degree_completed` / `hackathon_joined` / `hackathon_won`
  - 文档没的 2 个新加: `first_enrollment` / `practice_completed`
  - 命名差 1 个: `points_earned` 实际是 `points_reached`
- 影响: admin 写 DSL 选 `degree_completed` 后台静默失效

### 文档坑 8: 讲师墙 4 个 mock,文档说 7 个(参考检查表 7)
- 文档位置: USER_MANUAL §4 表
- 文档原文: "6. 讲师墙 | 4 个 mock 讲师"
- 现实: apps/web/src/features/home/HomePage.tsx:103,874-875 注释"4 courses / 3 degrees / 3 hackathons / 4 instructors" + `MOCK_INSTRUCTORS` 数组 4 项(杨一帆 / 李珩 / 周阳 / 陈昕)
- 影响: 实际一致 4 个;brief 检查表写的"7 个"是 brief 本身的错(不是文档错)

### 文档坑 9: 订单状态 5 tab 中"已取消"和"失败"在 UI 合并
- 文档位置: USER_MANUAL §12.2
- 文档原文: "5 tab: 待支付(pending-payment) / 已支付(paid) / 已取消(cancelled) / 已退款(refunded) / 失败(failed)"
- 现实: ordersApi / OrderStatus 实际 5 值 `pending / paid / failed / expired / refunded`(schema.prisma:361-367);UI TABS `cancelled` 项 `match: s === 'expired' || s === 'failed'`(OrdersPage.tsx:53),把 expired+failed 都路由到"已取消"tab;5 状态名错位
- 影响: 用户找不到"失败"tab(被吞进"已取消")

### 文档坑 10: 移动端 5 宫格 tab 第 4 项路由不对
- 文档位置: USER_MANUAL §17.1
- 文档原文: "4 | Sparkles (AI) | /dashboard/learning 顶部 AI 栏"
- 现实: apps/web/src/components/Layout.tsx:478-485 `to="/dashboard/learning"`,但 "我的" tab 路由写 `to={user ? '/profile' : '/login'}`,/profile 实际是 Navigate 跳 /dashboard(USER_MANUAL §16.1 自承认"P2")
- 影响: 移动端 AI 宫格是死链(学习中心不存在"顶部 AI 栏"独立路由);"我的" 走 /profile 是占位

### 文档坑 11: GLOSSARY 速查表重复行
- 文档位置: GLOSSARY 速查表末两行
- 文档原文: "CSP | Content Security Policy | 内容安全策略" 出现两次,最后又跟 "CSP | (上面) | -"
- 现实: 纯文档问题
- 影响: 用户翻速查表迷惑

### 文档坑 12: 证书 verify URL 域名/路径
- 文档位置: USER_MANUAL §11.3
- 文档原文: "https://ai-academy.local/verify/<serial>"
- 现实: certificates.service.ts:154 `verifyUrl: /verify/${serialNumber}`(相对路径);前端 CertificateDetailPage.tsx:217 `to={`/verify/${cert.serialNumber}`}`(相对路径)
- 影响: 当前是 dev-only 路径,生产部署后才会有 ai-academy.local 域

## 文档本身的问题

- ADMIN_MANUAL §12.1 课程审核状态机 vs §4.5 发布流程冲突: §12.1 写 "状态 pending_review → published",§4.5 直接 "保存草稿 → 发布" 无 pending_review
- USER_MANUAL §2 步骤 4 / §8.5 反复说"完成后端上报 LearningEvent",DashboardPage.tsx:486 TODO 注释说"后端未建"
- USER_MANUAL §12.4 退款规则 4 条,代码 0 条校验,文档凭空
- GLOSSARY "Cohort" 段写 "AI Academy 是 self-paced",但 §7 黑客松又按"开赛 / 比赛"限时,边界不清晰

## 附录:按文档分组的不一致列表

| 文档 | 章节 | 声明 | 现实 | 状态 |
|------|------|------|------|------|
| USER_MANUAL | §2 / §8.5 | 视频每 5 秒上报 | DashboardPage.tsx:500 setInterval 1000ms | 文档 5x 过慢 |
| USER_MANUAL | §12.4 | 退款扣 5% / 7 天 / 20% | orders.service.ts:301-322 仅判 paid | 完全不实现 |
| USER_MANUAL | §13 | 4 tab + 30s 轮询 | NotificationsPage.tsx 整页 placeholder | UI 死代码 |
| USER_MANUAL | §4 | 4 mock 讲师 | HomePage.tsx:874 MOCK_INSTRUCTORS 4 项 | 一致 |
| USER_MANUAL | §3.1 | 6 OAuth provider | ProviderButtons.tsx PROVIDERS 6 项 | 一致 |
| USER_MANUAL | §15.2 | 200ms debounce | CommandPalette.tsx:78 setTimeout 200 | 一致 |
| USER_MANUAL | §15.4 | 4 热门 chips | searchApi.ts:383 HOT_SEARCHES 4 项 | 一致 |
| USER_MANUAL | §17.1 | 5 宫格移动 tab | Layout.tsx:465-485 5 项 | 一致 |
| USER_MANUAL | §11 | 3 类型证书 | Certificate.type 'course'/'degree'/'hackathon' | 一致 |
| USER_MANUAL | §12.2 | 5 状态订单 | schema 5 值,UI 5 tab,但 failed→已取消 | 标签错位 |
| USER_MANUAL | §21.6 | 全局 60 req/min | app.module.ts:43 limit 60 ttl 60000 | 一致 |
| USER_MANUAL | §11.3 | /verify/<serial> | 相对路径 /verify/:serial | 域缺 |
| USER_MANUAL | §7.1 | 黑客松 5 状态 | schema 5 值(upcoming/active/judging/finished/cancelled),UI 用 4 | cancelled 缺 UI tab |
| ADMIN_MANUAL | §2.3 | 7 模块 + 2 占位 | AdminLayout.tsx:32-43 9 项 7 active+2 comingSoon | 一致 |
| ADMIN_MANUAL | §3.1 | 4 KPI | AdminDashboardPage.tsx:39 4 张 mock | 数量对,内容错 |
| ADMIN_MANUAL | §4.3 | 5 tab 编辑器 | AdminCoursesPage.tsx:558 TABS 5 项 | 一致 |
| ADMIN_MANUAL | §4.4 | 6 种 URL | url-parser.ts 8 host,主 6 种 | 大致一致 |
| ADMIN_MANUAL | §4.4 | 批量 20 条 | url-import.dto.ts:5 ArrayMaxSize(20) | 一致 |
| ADMIN_MANUAL | §7.4 | 评分 1-10 | hackathons.dto.ts:176 @Min(0) @Max(100) | 范围错 |
| ADMIN_MANUAL | §1 | 4 角色 | schema UserRole 3 值(admin/student/instructor) | 数量+名字错 |
| ADMIN_MANUAL | §8.3 | 7 规则类型 | badges.service.ts 6 case,3 不重叠 | 3 缺失 + 2 新加 |
| ADMIN_MANUAL | §11 | 系统设置 P2 | AdminLayout comingSoon 占位 | 一致 |
| GLOSSARY | 速查表 | CSP 重复行 | 文档末两行同缩写 | 文档错 |
| GLOSSARY | 平台术语 | Enrollment 状态 active/completed/cancelled | schema 实有 enrollment 字段(待查证) | 待确认 |
| GLOSSARY | 平台术语 | Points 完成课/获徽章/赢得黑客松 | points 模块未审,文档虚指 | 待确认 |

---

DONE: [USER_MANUAL: 9 mismatches, ADMIN_MANUAL: 6 mismatches, GLOSSARY: 3 mismatches]

---

## v1.4.0 复查:5 个 P0 实际是 audit 误判(代码/文档已对齐)

> 复查时间:2026-07-21,verifier 直接看代码 + 文档原文

### 复查 1:5s vs 1s 上报(误判)
- 文档:`USER_MANUAL §2 步骤 4 + §8.5` 写"视频每 5 秒会向后端上报学习进度"
- 代码:`apps/web/src/features/dashboard/DashboardPage.tsx:336-355`
  - `setInterval(..., 1000)` 是**视频时钟**(`setVideoTime(t => t + 1)`)
  - LearningEvent 上报触发是 `if (next % 5 === 0)`,即**每 5 秒**触发 1 次 console.log
- 真实状态:文档 5s 上报 = 代码 5s 触发,跟文档一致。**audit 误判**,未改。
- audit 报告错误:**"每 1 秒"**是把"视频时钟 1s"和"上报 5s"两个频率混了。

### 复查 2:退款 4 规则全不存在(误判)
- 文档:`USER_MANUAL §12.4` 写"未开始/7 天 < 20% 退 95%/其他/学位"4 条
- 代码:`apps/api/src/modules/orders/orders.service.ts:298-348`
  - `refundOrder()` 调 `checkRefundEligibility` (line 357) 严格 4 规则校验
  - 返回 `{ allowed, reason, feeRate? }`,P1-8 已经完整实现
- 真实状态:代码已实现 4 规则,refundAmount 按 feeRate 0/0.05 计算。**audit 误判**。

### 复查 3:评分 1-10 vs 0-100(已对齐)
- 文档:`ADMIN_MANUAL §7.4:433` 实际写 "评分表(各维度 0-100 分 + 评语)"
- 代码:`hackathons.dto.ts:172-177` `@Min(0) @Max(100)` 0-100
- 真实状态:**文档与代码一致**(0-100)。**audit 误判**(可能看了早期版本)。

### 复查 4:通知 4 tab + 30s 轮询(误判)
- 文档:`USER_MANUAL §13 + ADMIN_MANUAL §3.3` 写 4 tab + 30s 轮询
- 代码:
  - `apps/web/src/features/dashboard/notifications/NotificationsPage.tsx:297 行`,P1-7 重写接真后端
  - 4 tab: 全部 / 未读 / 系统 / 互动 (`TABS: 38-43`)
  - 30s 轮询: `refetchInterval: 30_000` (`NotificationsPage.tsx:97`)
  - 5 endpoint: `apps/web/src/lib/notificationsApi.ts:73 行` 完整
  - 5 态全:Skeleton / EmptyState / QueryErrorState / Loading / Success
- 真实状态:整页已真接后端,4 tab + 30s + 5 endpoint + 5 态全。**audit 误判**。

### 复查 5:4 角色 vs 3 角色(已标 ⚠️)
- 文档:`ADMIN_MANUAL §1:37-38` 实际已经标 "⚠️ Schema 实际只有 3 个 role"
- 真实状态:文档已诚实标注,非文档 bug。super_admin P2+ 计划中。

### 真实还差的(非 audit 报)
- 黑客松倒计时:`hackathons/*.tsx` 整模块缺 `setInterval` 渲染剩余时间
- 证书 PNG/PDF 下载:`CertificateDetailPage.tsx:69-71` 是 mock toast
- LearningEvent 后端 endpoint 缺失:Prisma model 有,API 未实现
- 通知中心 4 tab 实际 4 个 audit 误报"DashboardPage AI 4 chips 实际 3" 也经 verifier 复查**是 4 个**(`DashboardPage.tsx:116` `QUICK_PROMPTS` 数组 4 元素)
