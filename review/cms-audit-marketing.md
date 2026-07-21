# AICourse 前端 marketing 文案硬编码审计

> 只读扫描,不修代码。范围:`apps/web/src` 下 marketing / brand copy 硬编码。
> 排除 Frank 已修项(HomePage hero 4 stats / hero badge 数字 / AuthShell 3 stats / Layout ICP / EnterprisePage 4 stats / hero 预览卡分支)。

## 1. 关键硬编码文案(按 P0/P1/P2)

### P0 — 落地页 / 顶部 auth / 全局品牌(每个访客必见)

- `features/home/HomePage.tsx:1013-1017` — hero 主标题 `学完仍然不会做? 让 AI 时代的能力 可被看见。` — 建议: `site_settings.brand.hero.headline`(key-value)
- `features/home/HomePage.tsx:1020` — hero 副标题 `课程 + 学位 + 实践项目 + 黑客松 + AI 助教 —— 一条连续的学习回路,不是又一个视频站。` — 建议: `site_settings.brand.hero.subheadline`
- `features/home/HomePage.tsx:1010` — hero badge fallback `2026 夏季 · 开放报名`(stats 拉不到时显示) — 建议: `site_settings.brand.hero.term_default`
- `features/home/HomePage.tsx:1025` / `:1030` — hero CTA `免费开始` / `了解学位路径` — 建议: `site_settings.brand.cta.primary` / `.secondary`
- `features/home/HomePage.tsx:227` / `:359` / `:552` / `:666` / `:778` — 5 段 section 副标题(`学完一个可被验证的能力` / `不是又一张证书` / `让你的能力被看见` / `AI 助教,不在抽屉里` + `贯穿全程` / `不是 PPT 复读机`) — 建议: `page_settings.home.courses_subhead` / `.degrees_subhead` / `.hackathons_subhead` / `.aitutor_subhead` / `.aitutor_chip` / `.instructors_subhead`
- `features/home/HomePage.tsx:1009` — 模板 `${hackathonCount} 场黑客松进行中`(hero badge 拼接) — 建议: `site_settings.brand.hero.badge_template`
- `components/Layout.tsx:260` — footer brand statement `学完仍然不会做?让 AI 时代的能力可被看见。` — 建议: `site_settings.brand.footer.tagline`(与 hero headline 共用)
- `components/auth/AuthShell.tsx:125-129` — 登录/注册左栏品牌标题(三行) — 建议: `site_settings.brand.auth.shell_headline`
- `components/auth/AuthShell.tsx:133-134` — auth sub `… 名工程师、创业者、CTO 在这里把 AI 能力变成可被验证的作品。` — 建议: `site_settings.brand.auth.shell_sub`(stats 走模板)
- `components/auth/AuthShell.tsx:162-179` — `学员故事 · 占位示例` + K. Chen 整段 testimonial + `LLM 应用工程师学位 · 占位示例` — 建议: 独立表 `testimonials(id, name, title, degree_label, quote, avatar_initial, sort_order)`;或先抽 `site_settings.brand.auth.testimonial` 整体字段
- `components/auth/AuthShell.tsx:230` / `:238` / `LoginPage.tsx:113-118` / `RegisterPage.tsx:129-134` / `BindingsPage.tsx:178` — 5 处 auth 页主标题/副标题(`登录` / `注册` tab + `欢迎回来` + `继续你的 AI 时代学习路径` + `创建账号` + `注册后立即开始学习 AI 课程` + `绑定第三方账号,登录更便捷`) — 建议: `page_settings.auth.{tab_login,tab_register,h1_login,h1_register,sub_login,sub_register,h1_bindings}`
- `features/auth/BindingsPage.tsx:163-165` — demo 假账号 `k.chen@opencsg.ai` / `K. Chen`(写在 component 内,生产 demo mode 才用) — 建议: `VITE_PUBLIC_DEMO_EMAIL` / `VITE_PUBLIC_DEMO_NAME` env
- `features/enterprise/EnterprisePage.tsx:107-118` — `/ Enterprise Training` 标 + `Build Your AI Team.` + `1v1 咨询 + 定制化课程路径…` — 建议: `page_settings.enterprise.hero.{eyebrow,headline,sub}`
- `features/enterprise/EnterprisePage.tsx:174-201` — `/ 01 Method` + `How We Work` + 3 步法(战略对齐 / 路径设计 / 实战交付 + 各自 desc + bullets) — 建议: 表 `enterprise_methods(id, num, title, desc, bullets jsonb, sort_order)`
- `features/enterprise/EnterprisePage.tsx:244-283` — `/ 02 Cases` + `Trusted By` + 8 行业(金融 / 电商 / 制造 / 医疗 / 教育 / 政企 / 汽车 / 媒体 + 描述) — 建议: 表 `industries(id, key, label, desc, sort_order)`
- `features/enterprise/EnterprisePage.tsx:295-303` — `Get In Touch` + `Start The Conversation` + `填写右侧表单,我们的解决方案顾问会在 1 个工作日内联系你…` — 建议: `page_settings.enterprise.inquiry.{eyebrow,headline,sub}`
- `features/enterprise/EnterprisePage.tsx:329` — `OpenCSG · Beijing · Shanghai · Shenzhen`(地址行) — 建议: `site_settings.brand.company.addresses`(数组,默认填 3 城,后续可改)

### P1 — 二三级页面 hero / 列表 / section title

- `features/courses/CourseListPage.tsx:248-253` — `课程大厅` + `从 X 门系统化课程中找到你的下一步` — 建议: `page_settings.courses.list.{h1,sub}`
- `features/courses/CourseListPage.tsx:101-108` / `:111-116` — 6 个分类 + 4 档难度 + 时长档位 — 建议: 表 `filter_taxonomy(category|level|duration, key, label, sort_order)`
- `features/courses/CourseListPage.tsx:289-298` — `热门:` + 5 关键词 chips(LangChain / RAG / Agent / vLLM / Fine-tuning) — 建议: 表 `hot_keywords(keyword, sort_order)`
- `features/courses/CourseListPage.tsx:558-561` / `:600-602` — 排序标签 + 搜索空状态 — 建议: `page_settings.courses.list.{sort_options,empty_title_template,empty_desc}`
- `features/courses/CourseListPage.tsx:265` — placeholder `搜索课程 / 讲师 / 技能,如 LangChain / RAG / Agent` — 建议: `page_settings.courses.list.search_placeholder`
- `features/degrees/DegreeListPage.tsx:22-29` — `/ 02 Nano Degrees` + `LEARNING PATHS` + `体系化课程路径…拿下 OpenCSG 认证学位。` — 建议: `page_settings.degrees.list.{eyebrow,headline,sub}`
- `features/degrees/DegreeListPage.tsx:63` — `Nano Degree` 徽章 — 建议: `site_settings.brand.degree.badge`
- `features/degrees/DegreeDetailPage.tsx:155` / `:189-204` / `:257` / `:286-315` / `:343` / `:375` — `Back To Degrees` / stats 4 项 label / `学位概览` `课程` tab / `/ 01 Overview` `/ 02 What You Will Learn` `/ 03 Coming Next` / `学位时长` / `该学位下暂无课程` — 建议: `page_settings.degrees.detail.{back,stats_labels,tabs,section_eyebrows,sidebar_hours_label,empty_courses}`
- `features/degrees/DegreeDetailPage.tsx:47-52` — 4 个 P2 占位卡(路径阶段图 / 同班排名 / 证书预览 / 学员评价 + `后端 X API 设计中` sub) — 建议: 表 `coming_next_cards(icon, title, sub)`
- `features/hackathons/HackathonListPage.tsx:38-49` / `:107-114` — `/ Hackathons` + `BUILD. SHIP. WIN.` + `加入开放式创新挑战赛…` + `/ 404` + `没有找到符合条件的黑客松` — 建议: `page_settings.hackathons.list.{eyebrow,headline,sub,empty_eyebrow,empty_title}`
- `features/hackathons/HackathonDetailPage.tsx:89` / `:175` / `:210-217` / `:247` — `Back To Hackathons` / `还有 X 天开始` / `活动介绍` / `比赛规则` / `评委待定` — 建议: `page_settings.hackathons.detail.{back,countdown,panel_label_desc,panel_label_rules,empty_judges}`
- `features/hackathons/HackathonStatusBadge.tsx:3-9` — 5 个 status 文案(报名中 / 进行中 / 评审中 / 已结束 / 已取消) — 建议: 表 `hackathon_status_labels(status_key, label)`;或枚举常量
- `components/auth/AuthShell.tsx:104` / `Layout.tsx:175` — `返回首页` / `登录` nav button — 建议: `site_settings.brand.nav.{back_home,login}`
- `components/Layout.tsx:264-286` — footer 4 列(`学习` / `公司` / `法律` + 子项) — 建议: 表 `footer_columns(title, links jsonb)`
- `components/Layout.tsx:302` — `v0.5.0 · built for AI era` — 建议: `site_settings.brand.footer.version_tag`(后续 release 自动更新)
- `components/Layout.tsx:69-73` — top nav 4 项(`课程` / `学位` / `黑客松` / `企业培训`) — 建议: 表 `top_nav(label, path, sort_order)`
- `features/dashboard/DashboardLayout.tsx:110-115` — `我的学习 · 继续上次` / `选课开始学习` / `学习中心` — 建议: `page_settings.dashboard.layout.{my_learning,no_enrollment,learning_center}`
- `features/dashboard/DashboardPage.tsx:117` — AI 4 快捷提示 chip(`📌 解释这节课` / `💡 ReAct vs CoT` / `🧪 给个练习` / `🛠️ 这段代码怎么改`) — 建议: 表 `ai_quick_prompts(emoji, label, sort_order)`(后端可推,后端未上线前先硬编码)
- `features/dashboard/DashboardPage.tsx:566-600` / `:728` — AI 助教空状态(`AI 助教暂未上线…` / `尚未接入 · 等待 chat module` / placeholder `问 AI 助教…`) — 建议: `page_settings.dashboard.ai.{placeholder_state,not_ready_label,input_placeholder}`
- `features/degrees/PurchaseModal.tsx:96-99` / `:138-140` / `:169-174` / `:187` — `确认报名` / `确认下单` / `立即报名` / `立即支付` / `报名成功` / `支付成功` / `开始学习` / 免费 vs 付费描述 — 建议: `page_settings.purchase.{confirm_title_template,confirm_desc_template,success_title_template,success_desc_template,go_learn}`

### P2 — 空状态 / 加载 / 错误文案(全部走统一 `i18n_messages(key, zh, en, category)`)

- 公共 / 列表 / 详情 / 404:`HomePage.tsx:253-254 / :385-386 / :579-580 / :626 / :323-325 / :461 / :634`、`DegreeDetailPage.tsx:377`、`HackathonDetailPage.tsx:67`、`CoursePracticesTab.tsx:107-110` — 7 处 `暂无X` + 3 处 `数据加载失败…` / `正在准备中…` / `正在筹备中…`
- Dashboard / 订单 / 证书 / 通知:`DashboardPage.tsx:487-488 / :521-522 / :532-533 / :875-876` + `OrdersPage.tsx:197-198 / :243-244 / :254-255` + `CertificatesPage.tsx:155-156` + `NotificationsPage.tsx:198-199 / :290-291` — 13 处 `还没有X` / 确认弹窗 / 描述段
- 黑客松子页:`TeamPanel.tsx:73 / :189` + `SubmissionPanel.tsx:118 / :257` + `AnnouncementList.tsx:13` — 5 处 `报名后可…` / `还没有X` / `暂无公告`
- 基础设施缺口:`index.html:6` — `<title>OpenCSG Academy</title>` 整站固定,全站 0 SEO meta;建议 `react-helmet-async` + `page_settings.<route>.seo.{title,description}`

## 2. 文案分类归纳(后端 schema 建议)

| 类型 | 示例 | Schema | 说明 |
|---|---|---|---|
| **全局品牌**(hero / footer / auth / nav) | hero headline、footer tagline、auth shell 标题、K. Chen 学员故事、`OpenCSG Academy` 品牌名、nav 4 项、footer 4 列 | `site_settings(key, value jsonb, locale)` | key-value,高频访问,客户端 5min cache;中英文双列 |
| **页面级 hero / section** | HomePage 5 段副标题、CourseListPage header、EnterprisePage hero、DegreeDetailPage 4 个 eyebrow | `page_settings(page, key, value jsonb, locale)` | `(page, key)` 唯一,按 page 路由打 group,客户端按路由 lazy load |
| **结构化列表**(industries / testimonials / methods / status) | 企业 8 行业、3 步法、5 状态、K. Chen 学员故事 | 独立表 `industries` / `enterprise_methods` / `hackathon_status_labels` / `testimonials` | 增删改要带 sort_order;支持多语言用 `i18n` 表;运营可改 |
| **空状态 / loading / error**(通用 i18n) | `暂无课程` / `数据加载失败` / `还没有订单` | `i18n_messages(key, zh, en, category)` | 集中维护,避免每个页面重复;前端 useTranslation 风格 |
| **系统常量 / 演示数据** | demo 账号 `k.chen@opencsg.ai` / `K. Chen` / `demo@gmail.com` | env(`VITE_PUBLIC_DEMO_*`)+ fixture JSON | 不进 CMS,只在 dev / 截图用 |
| **表单 placeholder 短文案** | `you@company.com` / `••••••••` | 不进 CMS,代码常量 | 长度 < 8 字符 / 标准 i18n key,不值得 CMS |
| **SEO meta** | `<title>` / `og:description` | `page_settings.<route>.seo.{title,description}` | 目前全站 0 个 meta,接入 react-helmet-async 后按路由渲染 |

## 3. Top 5 ROI 建议(被用户看到频率 × 修改需求紧迫度)

1. **HomePage hero 标题 + 副标题 + CTA**(`HomePage.tsx:1013-1030`) — 每个未登录访客 100% 第一眼;换季 / 新 term / 调语气最快 1 处改全站统一 — 接 `site_settings.brand.hero.{headline,subheadline,cta_primary,cta_secondary}`
2. **AuthShell 左栏品牌 + K. Chen 学员故事**(`AuthShell.tsx:125-179`) — 登录 / 注册 / 忘记密码 3 个页共享,转化漏斗必经;`占位示例` 文字在生产环境对外部访客可见(合规风险) — 接 `site_settings.brand.auth.{shell_headline,shell_sub,testimonial_jsonb}` + 上线前先把 `占位示例` 标替换
3. **Layout footer 4 列 + brand tagline**(`Layout.tsx:249-302`) — 全站底部每页出现;`服务条款` / `隐私政策` 当前指向 `#` 死链(合规 + 404 双风险) — 接 `footer_columns` 表 + 把 `<a href="#">` 改成 `site_settings.brand.legal.{terms_url,privacy_url}`
4. **EnterprisePage 整个 hero + 方法论 + 8 行业**(`EnterprisePage.tsx:107-283`) — B 端销售路径,客户邮件外发会截图;`1v1 咨询` / `1 个工作日内联系` 涉及 SLA 承诺,合规 + 商务常改 — 接 `page_settings.enterprise.hero` + 表 `enterprise_methods` + 表 `industries`
5. **HackathonStatusBadge 5 项 + HackathonListPage hero**(`HackathonStatusBadge.tsx:3-9` + `HackathonListPage.tsx:38-49`) — 黑客松是高频活动入口,`报名中 / 进行中 / 已结束` 文案每周都变;`BUILD. SHIP. WIN.` 季节性会改 — 接表 `hackathon_status_labels` + `page_settings.hackathons.list.{eyebrow,headline,sub}`

> 完成回复:MARKETING_DONE: P0 = 14 条(横跨 8 个文件,1 个 demo 假账号 + 1 个 footer column 表 + 1 个 industries 表 + 1 个 enterprise_methods 表 + 1 个 testimonials 表),P1 = 27 条(横跨 11 个文件,含 1 个 status_labels 表 + 1 个 filter_taxonomy 表 + 1 个 hot_keywords 表 + 1 个 coming_next_cards 表 + 1 个 ai_quick_prompts 表 + nav / footer / dashboard / purchase 4 套 page_settings),P2 = 30+ 条(全部走 `i18n_messages` 集中),Top 5 已按 "曝光率 × 紧迫度" 排序;另发现整站 0 SEO meta(`index.html:6` 固定 title,无 description)作为基础设施缺口附带记录。
