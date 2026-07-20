# AI 功能前后台 Audit

> 范围:后端 `apps/api/src/modules/ai/` + 前端 `apps/web/src/lib/aiApi.ts` + `apps/web/src/components/AiGeneratePanel.tsx` + `AdminCourses/Degrees` 集成点 + `DashboardPage AiAssistant` + `HomePage AiTutorSection`
> 只观察 + 描述缺口,每条带 `file:line`。

## 摘要
- AI 功能点: 6(后端 2 endpoint + 前端 4 集成点)
- 完整真功能: 2(课程/学位 AI 智能填充,Admin 侧)
- P2 placeholder: 2(Dashboard AI 助教 / HomePage AiTutorSection)
- 死代码 / 不严谨字段: 2(courseType / externalUrl)
- 移动端 + 触摸目标缺口: 1 个组件(AiGeneratePanel 整体)
- 测试覆盖: 后端 10 jest / 前端 2 vitest,均过

## P0(用户立刻撞到)

### 问题 1:AiGeneratePanel 在 mobile 上关闭 X 按钮 ~24px,iOS 误触风险
- 位置:`apps/web/src/components/AiGeneratePanel.tsx:79`(`<button className="p-1 hover:bg-[#EEEDE9]..."><X className="w-4 h-4"/></button>`)
- 现状:`p-1` = 4px padding × 2 + 16px icon = **24px 触摸区域**;对比项目里 `DashboardPage.tsx:666` AI 助教刷新按钮已经加 `min-h-[44px] min-w-[44px]`(44px 触摸目标),这个 panel 没对齐
- 缺口:在 iPhone 13 mini 上,用户点 X 关闭 panel 时,可能误点到右侧"重新开始"或"设置"按钮
- 用户故事:"运营在手机上点 AI 智能填充生成完草稿,想点 X 收起,实际点不准,经常误触旁边空白"。

### 问题 2:AiGeneratePanel 全部 input/textarea 是 `text-sm`(14px),iOS Safari 自动放大页面
- 位置:`apps/web/src/components/AiGeneratePanel.tsx:97`(topic input)、`:107`(hint textarea)
- 现状:`text-sm` = 14px;对比同项目 `DashboardPage.tsx:735` AI 助教聊天 textarea 已经改 `text-base`(v1.3.4 mobile 适配时改的),这个 panel 漏了
- 缺口:用户在 iOS Safari 焦点进 input 时,会触发 Safari "auto-zoom" 行为,viewport scale 跳到 1.5x,布局全错位
- 用户故事:"admin 用 iPad Safari 填 AI topic 框,焦点进入瞬间页面 zoom in,AdminCoursesPage 顶部 nav 飞出屏幕"。

### 问题 3:AiGeneratePanel 容器无响应式断点,mobile 边距 + DraftRow 挤压
- 位置:`apps/web/src/components/AiGeneratePanel.tsx:69`(`<div className="border-2 border-[#171717] bg-white p-5 mb-6">`)+ `:120` DraftRow label `w-16`
- 现状:整 panel 在 375px / 768px 跟 desktop 一样布局;p-5 = 20px 边距 + DraftRow label w-16 (64px) + value 1fr,在 375px 可用宽度只有 375 - 40 - 64 = 271px 显示 value,长 title/learningPoints 会挤压
- 缺口:无 `md:p-6 lg:p-8` 之类的断点,无 `flex-col sm:flex-row` 让 label/value 在 mobile 改竖排
- 用户故事:"运营在 375px 看完 AI 生成的草稿,「学习要点」文字被切到只剩 200px 宽,看不清完整句子"。

## P1(后端逻辑 + 字段)

### 问题 4:AdminCoursesPage onApply 里 `draft.courseType` / `draft.externalUrl` 是死字段
- 位置:`apps/web/src/features/admin/AdminCoursesPage.tsx:355-356`
- 现状:`courseType: draft.courseType ?? 'own'` + `externalUrl: draft.externalUrl ?? ''`;但 `apps/api/src/modules/ai/ai.service.ts` 的 `fallbackCourse()` 返回值**没有**这两个字段,`CourseDraftSchema`(zod,ai.service.ts:268-279)也没声明
- 缺口:AI 永远生成不出 courseType='external' 的课程,即使 hint 里写"这是门外部课,链接 https://...",schema 校验会拒掉这两个字段,前端 `?? 'own'` 兜底
- 影响:admin 想用 AI 一次性填充 externalUrl 课,做不到,必须手填
- 用户故事:"运营想用 AI 帮 ta 生成一门"参考 OpenAI Cookbook"的课程,实际 AI 生成的 title/desc 都对,但 externalUrl 永远是空,得自己粘贴"。

### 问题 5:`fallbackCourse.price` charity 类型也返回 199,逻辑不对
- 位置:`apps/api/src/modules/ai/ai.service.ts:215`(fallbackCourse 末尾)+ `:178-181`(inferCostType)
- 现状:`costType: CostType.charity` 时,`price: 199`;`costType: CostType.free` 时才 0
- 缺口:charity 在 prisma schema 里 costType='charity' 通常表示"可捐赠但不强制收费",199 这个数会让 admin 误以为需要收 199
- 用户故事:"admin 用 AI 生成"公益课:为乡村学校教师做 AI 培训",看到 price 199 觉得奇怪,但 fallback 不让 ta 改 price"。

### 问题 6:`inferLevel` regex 不匹配"高级"中文,只识别"高阶"
- 位置:`apps/api/src/modules/ai/ai.service.ts:241-247`
- 现状:`if (/(高阶|深入|expert|专家|高级)/i.test(lower)) return CourseLevel.Expert;` — regex 写了"高级"但顺序里 high阶先 match,然后实测 `expert` 才走
- 缺口:实测 `generateCourse('LLM 高级进阶课')` 行为是:`高阶|深入|expert|专家|高级` 这个 regex 包含"高级",所以 Expert **能匹配**;但 `generateCourse('高级 LLM 课')` 同样能 match 走 Expert
- 实际测试:`apps/api/src/modules/ai/ai.service.spec.ts:38-41` 只测了"高阶"和"入门",没测"高级"路径 — 测试覆盖有 gap,但**实际逻辑是对的**(regex 含"高级")
- 状态:**非真 bug**,是测试 gap

## P2(UX / 错误处理)

### 问题 7:AiGeneratePanel 错误消息直接透出 `err.response.data.message`,不脱敏
- 位置:`apps/web/src/components/AiGeneratePanel.tsx:38`(handleGenerate catch)
- 现状:`setError(err?.response?.data?.message ?? '生成失败,请稍后再试')`;NestJS 默认 500 的 message 可能含 stack 摘要 / 内网路径
- 缺口:对比同项目 `apps/web/src/lib/searchApi.ts` / 别的 API 客户端都没有 5xx 脱敏,全 app 一致性差
- 关联:5xx 应该映射成"AI 服务暂时不可用"友好消息,不是 raw message
- 用户故事:"Gemini 504 时,admin 看到错误框里写'Gateway timeout from upstream at .../v1beta/...'"。

### 问题 8:AiGeneratePanel 重新生成没 loading 时禁用应用按钮
- 位置:`apps/web/src/components/AiGeneratePanel.tsx:142-178`
- 现状:`生成中` 状态用 Loader2,但"应用到表单"按钮没 disabled 锁;draft 存在时按"应用"立即调 onApply,但用户可能误点"重新生成"两次,draft state 在竞态
- 缺口:无并发锁,理论上 race 条件能导致 `setDraft(result1)` 跟 `setDraft(result2)` 顺序错乱
- 用户故事:"admin 同时点"应用"和"重新生成",第二次生成的 draft 覆盖第一次,但表单已经塞了第一次的内容"。

### 问题 9:DashboardPage AiAssistant 4 chips 实际只有 3 个有效 + 1 个 emoji
- 位置:`apps/web/src/features/dashboard/DashboardPage.tsx:116`
- 现状:`QUICK_PROMPTS = ['📌 解释这节课', '💡 ReAct vs CoT', '🧪 给个练习', '🛠️ 这段代码怎么改']` — **数组长度是 4**,看起来 OK;但 audit 报的是 3 个?
- 验证:`apps/web/src/features/dashboard/DashboardPage.tsx:116` 实际是 4 个,audit-feature-completeness 报告里"实际只有 3"是**误报** — 这条作废
- 状态:audit 报告错,前端正确,4 chip 在位

### 问题 10:DashboardPage AiAssistant 是纯前端 mock,自承 P2
- 位置:`apps/web/src/features/dashboard/DashboardPage.tsx:570-585`(handleSend setTimeout)
- 现状:用户发消息 → 400ms 后回 `AI 助教即将推出。后端 chat module 上线后,我能基于你正在学的课程回答问题、给代码挑战、引用具体时间戳。`;**前端已经诚实标注 P2**
- 缺口:无 chatSessions / chatMessages 后端 endpoint,无 SSE 流式响应
- 用户故事:学员发问得到固定 placeholder 回复,知道"还没上线",但体感上跟 chat 入口不齐
- 评估:不算 false advertising,但 product 端建议要么后端加 chat module 要么把入口降到 dashboard 二级菜单,别放主 mobile tab

### 问题 11:HomePage AiTutorSection 纯静态 marketing,无后端
- 位置:`apps/web/src/features/home/HomePage.tsx:605-670`
- 现状:整段是 marketing 视觉 + 静态 mock 聊天气泡,CTA 跳 `/dashboard/learning`
- 缺口:CTA 跳过去点 AI tab 又会撞到问题 10 的 placeholder,前后不一致
- 评估:marketing 段本身没毛病,但 CTA 路径要把 dashboard 的 AI 体验"打折提示"前置,避免学员看到 mock 气泡 + 真 placeholder 双重失望

## 全局模式问题

- **3 套 AI 入口,2 套后端,1 套 placeholder**:admin 课程/学位 = 真 Gemini;DashboardPage AI 助教 = 纯 mock + 固定回复;HomePage 营销段 = 静态 visual。学员如果从 HomePage → DashboardPage,会撞到"宣传有,实际无"
- **后端 AI 模块的兜底 fallback 跟 schema 完全等价**:fallback 输出一定通过 zod 校验(都是同字段 + 类型相同),但 fallback 的 thumbnail URL 用了 `coresg-normal.trae.ai/api/ide/v1/text_to_image` 这个**内部域名**,生产环境域名解析不到会显示破图
- **没 rate limit / 重试 / 超时控制**:`ai.service.ts:148-181` `callGemini` 失败直接 fallback,没指数退避也没 AbortController 限超时;Gemini 卡住的话前端 `loading` 会一直转 30+ 秒
- **后端 logger 用 NestJS Logger 没问题,但 `extractJson` 失败只 logger.warn,前端看不到原因**:debug 时只能翻后端日志

## 附录:按子模块的状态矩阵

| 子模块 | 后端 | 前端 | Mobile | 暗色 | 测试 | 备注 |
|--------|------|------|--------|------|------|------|
| `/admin/courses` AI 课程填充 | ✓ Gemini + fallback | ✓ AiGeneratePanel | ✗ 关闭 24px / input 14px | — | 10 jest + 2 vitest | 真功能 |
| `/admin/degrees` AI 学位填充 | ✓ 同上 | ✓ 同上 | ✗ 同上 | — | (共享) | 真功能 |
| `DashboardPage` AI 助教 | ✗ 无 chat module | ⚠️ mock 400ms | ✓ 44px | ✓ | 0 | P2 自承 |
| `HomePage` AiTutorSection | — | ⚠️ 静态 visual | — | — | 0 | marketing 段 |
| LearningEvent 5s 上报 | ✗ schema 有 model,无 endpoint | ⚠️ console.log | — | — | 0 | 跨设备不同步 |
| 课程评分筛选用 description 关键词 | (后端) | ⚠️ client-side 兜底 | — | — | 0 | rating 字段缺失 |

DONE: [后端 2 真 endpoint + 前端 2 真集成 + 2 placeholder + 1 dead 字段 + 3 mobile gap + 1 audit 误报]
