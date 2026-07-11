# OpenCSG Academy 整体重设计 Spec(2026 v2)

> 角色:synthesis。输入是 3 份 audit(web-ux / admin / data-api),输出是**可拍板 / 可切片执行**的整体重设计。
> 目标:Frank 看完直接说"开干",我们切成 N 个 plan 落地。
> 不动 `apps/web` / `apps/api` 源码,只写 `review/redesign-spec.md` + `review/mocks/*.html`。

---

## §1 品牌 / 定位一句话

**我们是谁**——OpenCSG Academy 是面向 AI 时代的系统化学习平台,把"课程 + 学位 + 实践 + 黑客松 + AI 助教"做成一条连续的学习回路,不是又一个 MOOC 视频站。

**给谁**——三类人:**想转岗 / 进阶的工程师**(已会写代码,要补 ML/LLM/Agent 系统能力);**AI-native 创业者**(要快速建立对模型、评测、工程链路的全景认知);**企业 CTO / 培训负责人**(要给团队配结构化路径 + 学情数据)。

**解决什么**——"学完仍然不会做"的断层。课程给知识、学位给路径、实践项目给作品、黑客松给压力测试、AI 助教贯穿全程答疑解惑——**让学员的产出可被看见、被评估、被雇主看见**。

**对标 / 差异化**:
- 课程结构 → 对标 **DeepLearning.AI**(短而精 + Andrew 风格的"一课一概念");**不**做 Coursera 那种学期制
- 学位路径 → 对标 **Coursera Degrees / KubeVirt Academy Nano-Degree**,但要**真给证书 + 能力图谱**,不是印个 PDF
- AI 助教 → 对标 **Anthropic Academy 的 prompt 沙盒 + GitHub Copilot 的上下文式辅助**,每节课旁边都有,不藏抽屉里
- 气质 → **OpenCSG 自己的**:技术严肃感 + 开源社区氛围 + 工程师味,不要花花绿绿的卡通插画

---

## §2 视觉系统 tokens(色板 / 字体 / spacing / 圆角 / 阴影)

**对标参考**:**Linear / Vercel / Anthropic**(克制冷峻的暗色优先) + **DeepLearning.AI**(标题克制、字大留白);**反对**对标国内 MOOC 那种"红色 + 大banner + 卡通老师头像"。

### 2.1 品牌主色板(6 主色 + 8 语义色)

```css
/* CSS variables — 写在 apps/web/src/styles/tokens.css,根 :root + .dark 翻转 */
:root {
  /* 品牌主色:OpenCSG 深青绿,延伸到产品 */
  --brand-50:  #E6F5F2;  /* tint */
  --brand-100: #BFEAE0;
  --brand-300: #66CFB7;
  --brand-500: #1D8C80;  /* PRIMARY — OpenCSG teal */
  --brand-700: #146358;
  --brand-900: #0A3A33;  /* dark mode 文字 */

  /* 中性灰(暖偏,不用纯灰) */
  --neutral-0:   #FFFFFF;
  --neutral-50:  #FAFAF7;  /* 默认页面底色,off-white */
  --neutral-100: #F5F4F0;  /* 卡片底 */
  --neutral-200: #E5E3DC;
  --neutral-400: #A8A6A0;
  --neutral-600: #6B6963;
  --neutral-800: #2C2A26;
  --neutral-900: #1A1916;
  --neutral-950: #0D0C0A;  /* dark mode 底 */

  /* 语义色 */
  --success-500: #16A34A;
  --success-100: #DCFCE7;
  --warning-500: #D97706;
  --warning-100: #FEF3C7;
  --danger-500:  #DC2626;
  --danger-100:  #FEE2E2;
  --info-500:    #2563EB;
  --info-100:    #DBEAFE;

  /* 学习专用色(进度 / 等级 / 积分) */
  --progress-500: #1D8C80;  /* = brand-500,进度条用品牌色,语义统一 */
  --xp-500:       #8B5CF6;  /* 紫色,积分 / 等级专用 */
  --xp-100:       #EDE9FE;
  --cert-500:     #C9A227;  /* 金色,证书 / 学位专用 */
  --cert-100:     #FEF3C7;
}

.dark {
  --neutral-0:   #0D0C0A;
  --neutral-50:  #14130F;
  --neutral-100: #1A1916;
  --neutral-200: #2C2A26;
  --neutral-400: #6B6963;
  --neutral-600: #A8A6A0;
  --neutral-800: #E5E3DC;
  --neutral-900: #F5F4F0;
  /* 语义色在暗色下提亮一档 */
  --success-500: #22C55E;
  --warning-500: #F59E0B;
  --danger-500:  #EF4444;
  --info-500:    #3B82F6;
  --brand-500:   #2BA89B;  /* 暗色下提亮 */
  --xp-500:      #A78BFA;
  --cert-500:    #FBBF24;
}
```

### 2.2 Tailwind config 片段

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',  // 'class' 模式,由 <html class="dark"> 切换
  theme: {
    extend: {
      colors: {
        brand:   { 50:'#E6F5F2', 100:'#BFEAE0', 300:'#66CFB7', 500:'#1D8C80', 700:'#146358', 900:'#0A3A33' },
        neutral: { 0:'#FFFFFF', 50:'#FAFAF7', 100:'#F5F4F0', 200:'#E5E3DC', 400:'#A8A6A0', 600:'#6B6963', 800:'#2C2A26', 900:'#1A1916', 950:'#0D0C0A' },
        success:{ 500:'#16A34A', 100:'#DCFCE7' },
        warning:{ 500:'#D97706', 100:'#FEF3C7' },
        danger: { 500:'#DC2626', 100:'#FEE2E2' },
        info:   { 500:'#2563EB', 100:'#DBEAFE' },
        xp:     { 500:'#8B5CF6', 100:'#EDE9FE' },
        cert:   { 500:'#C9A227', 100:'#FEF3C7' },
      },
      fontFamily: {
        sans: ['"Inter"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        display: ['"Inter"', '"PingFang SC"', 'sans-serif'],  // 大标题用 Inter,中文场景降级
      },
      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
      spacing: {
        // 4px base scale,显式列出避免 Tailwind 默认 0.25 rem 太多杂项
        '0.5': '0.125rem', '1': '0.25rem', '2': '0.5rem', '3': '0.75rem', '4': '1rem',
        '5': '1.25rem', '6': '1.5rem', '8': '2rem', '10': '2.5rem', '12': '3rem',
        '16': '4rem', '20': '5rem', '24': '6rem', '32': '8rem',
      },
      borderRadius: {
        'sm': '0.25rem', 'md': '0.5rem', 'lg': '0.75rem', 'xl': '1rem', '2xl': '1.5rem',
        '3xl': '2rem',  // hero card 用
      },
      boxShadow: {
        'sm':  '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'md':  '0 4px 8px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        'lg':  '0 12px 24px -6px rgb(0 0 0 / 0.08), 0 4px 8px -4px rgb(0 0 0 / 0.04)',
        'glow': '0 0 0 1px rgb(29 140 128 / 0.2), 0 8px 24px -8px rgb(29 140 128 / 0.3)',  // brand 发光
      },
    },
  },
};
```

### 2.3 暗色 / 亮色策略

- **默认走 system preference**:`prefers-color-scheme`,用户可手动 toggle 写入 `localStorage.theme`
- **暗色 ≠ 颜色翻转**:`--brand-500` 在暗色下用 `#2BA89B`(提亮),不要机械 `filter: invert`
- **背景层**:`--neutral-50` 亮 / `--neutral-950` 暗;卡片 `--neutral-0` 亮 / `--neutral-100` 暗
- **文字**:亮色 `--neutral-900`,暗色 `--neutral-900`(即亮色用深色字,暗色用浅色字,共用 token 翻转)
- **图片 / 视频**:用 `next/image` 的 theme prop 或 `<picture>` 切两套,暗色下用降低对比度的版本

### 2.4 字体 / 行高 / 字重梯度

- **正文**:Inter 16/24,字重 400;**CJK fallback** PingFang SC
- **小字 / caption**:Inter 13/18,字重 500,`--neutral-600`
- **H1**:Inter display-xl,字重 700,`letter-spacing -0.03em`
- **H2-H3**:Inter display-md / display-lg,字重 600
- **代码 / 数据**:JetBrains Mono,所有数字、ID、价格统一 mono,**让价格、积分、时长一眼对齐**
- **不允许的字重**:`font-weight: 300` 太细在屏幕上看不清;`font-weight: 800+` 太粗显 Low-quality

### 2.5 间距 / 圆角 / 阴影原则

- **section 间距**:桌面 96-128px(24-32 in spacing scale),平板 64px,手机 48px
- **卡片 padding**:桌面 24-32px,手机 16-20px
- **圆角**:卡片 `rounded-xl`,按钮 `rounded-md`,徽章 `rounded-full`;**最大不超 `rounded-2xl`**(否则显卡通)
- **阴影**:克制——卡片默认 `shadow-sm`,hover 才升级到 `shadow-md`;**绝不**用霓虹 / 彩色阴影;**唯一允许的彩色阴影是 `shadow-glow`(品牌发光)用在主 CTA**

---

## §3 信息架构 / 路由树

完整路由树,带权限。**对标参考**:Linear 的 sidebar 极简 + Vercel 的 marketing 大字 + DeepLearning.AI 的"短课 + 立即可学"。

```
/                                    公开  首页
├── /courses                         公开  课程大厅(列表 / 筛选 / 搜索)
│   ├── /courses/:id                 公开  课程详情(大封面 / 章节 / 评价 / CTA)
│   ├── /courses/:id/learn/:lessonId 登录  学习页(视频 / 笔记 / AI 助教)
│   └── /courses/:id/review          公开  评价页(全部评价 + 评分分布)
├── /degrees                         公开  学位列表
│   ├── /degrees/:id                 公开  学位详情(路径图 / 课程矩阵 / 学情)
│   └── /degrees/:id/learn           登录  我的学位进度
├── /hackathons                      公开  黑客松列表
│   ├── /hackathons/:id              公开  详情(规则 / 团队 / 提交)
│   └── /hackathons/:id/submit       登录  提交作品
├── /practices                       公开  实践项目列表(实践 = 项目库)
│   └── /practices/:id               公开  项目详情(任务卡 / 提交 / 评分)
├── /instructors                     公开  讲师列表
│   └── /instructors/:id             公开  讲师主页(简介 / 课程 / 文章)
├── /search?q=                       公开  全站搜索结果
├── /enterprise                      公开  企业咨询
├── /about                           公开  关于我们
├── /pricing                         公开  价格(单课 / 学位 / 企业)
├── /auth                            公开  登录 + 注册 + 第三方登录入口(Frank 硬要求,见 §9)
│   ├── /auth/login                  公开
│   ├── /auth/register               公开
│   ├── /auth/forgot                 公开
│   ├── /auth/verify-email           公开
│   ├── /auth/callback/:provider     公开  第三方回调(Google / GitHub / 微信...)
│   └── /auth/bind                   登录  账号绑定 / 解绑管理
│
/dashboard                           登录  学习中心(取代旧的 /profile)
├── /dashboard                       登录  总览(在学 / 即将学 / 推荐)
├── /dashboard/learning              登录  我的学习(所有 in-progress 课程)
├── /dashboard/degrees               登录  我的学位
├── /dashboard/practices             登录  我的实践项目
├── /dashboard/hackathons            登录  我的参赛
├── /dashboard/certificates          登录  我的证书
├── /dashboard/orders                登录  我的订单 + 发票
├── /dashboard/notes                 登录  我的笔记(全局)
├── /dashboard/points                登录  积分 / 等级 / 徽章
├── /dashboard/notifications         登录  通知中心(bell + list)
└── /dashboard/settings              登录  账号设置
    ├── /dashboard/settings/profile  登录  基本信息
    ├── /dashboard/settings/security 登录  密码 / 2FA / 登录设备
    ├── /dashboard/settings/bindings 登录  第三方账号绑定(Frank 硬要求)
    ├── /dashboard/settings/notifications 登录  通知偏好
    └── /dashboard/settings/billing  登录  支付方式 / 发票抬头

/admin                               admin  后台(独立子域 admin.opencsg.academy 可选)
├── /admin/dashboard                 admin  数据看板(GMV / 留存 / 转化 / AI 成本)
├── /admin/users                     admin  用户管理
│   ├── /admin/users/:id             admin  用户详情(身份 / 订单 / 进度 / Identity)
│   └── /admin/users/:id/impersonate admin  模拟登录(审计)
├── /admin/courses                   admin  课程 CRUD
│   ├── /admin/courses/new
│   └── /admin/courses/:id/edit      admin  章节树 / 富文本 / 资源(见 mock)
├── /admin/degrees                   admin  学位 CRUD + 阶段解锁
├── /admin/orders                    admin  订单 / 退款 / 对账
├── /admin/payments                  admin  支付流水 / Stripe webhook 状态
├── /admin/hackathons                admin  黑客松 CRUD + 团队审核
│   ├── /admin/hackathons/:id/judging admin  作品评审
│   └── /admin/hackathons/:id/dispatch admin  奖项派发
├── /admin/practices                 admin  实践项目 CRUD + AI 评测
├── /admin/content                   admin  内容运营
│   ├── /admin/content/banners       admin  Banner / HomeSection
│   ├── /admin/content/announcements admin  站点公告 / 邮件模板
│   └── /admin/content/seo           admin  页面 SEO
├── /admin/badges                    admin  徽章 / 积分规则
├── /admin/audit                     admin  审计日志(谁登了、改了什么、谁绑定)
├── /admin/support                   admin  客服工单
├── /admin/finance                   admin  财务报表 / 退款审批
├── /admin/ai                        admin  AI 助教配置(模型 / tone / token 预算)
└── /admin/system                    super  系统设置(FeatureFlag / 密钥轮转 / 限流)
```

**对比现状(router.tsx:31-67)**:
- 现有 8 页 + 7 admin,**重设计后 30+ 前台页 + 17 admin**,**关键新增**:`/auth/*`(Frank 硬要求)、`/dashboard/*`(取代 `/profile`)、`/search`、`/instructors/:id`、`/practices`、`/dashboard/orders`、`/dashboard/certificates`、`/dashboard/notifications`、`/admin/payments`、`/admin/audit`
- **现有 /profile 全部迁到 /dashboard/learning**,URL 重定向 301

---

## §4 前台关键 page 视觉稿

**所有 mock HTML 已落到 `review/mocks/`**,每个都是单文件 + Tailwind CDN + dark/light toggle + 响应式 + 真实占位文案。

| 文件 | 页 | 关键元素 |
|---|---|---|
| `mock-home.html` | 首页 | 顶部导航 + hero(大字标语 + 主次 CTA + 课程插画位)+ 4 个数据点(在读 / 完成 / 学位 / 黑客松)+ 课程卡片网格(6 卡片 + "全部课程")+ 学位路径(3 张大卡)+ 黑客松进行中(倒计时 + 3 卡)+ 实践项目(4 卡)+ AI 助教入口(右侧 FAB + 案例预览)+ 讲师墙(4 张头像)+ footer |
| `mock-course-list.html` | 课程大厅 | 顶部搜索栏(全站搜索框 + 热门关键词 chips)+ 左侧筛选侧栏(分类 / 难度 / 时长 / 收费 / 标签 / 讲师 / 评分)+ 右侧顶部排序条(最新 / 热门 / 评分)+ 卡片网格(课程封面 + 标题 + 讲师 + 时长 + 难度 + 标签 + 评分 + 价格)+ 分页 + 空状态 |
| `mock-course-detail.html` | 课程详情 | 大封面 hero(渐变背景 + 课程标题 + 讲师 + 评分 + 时长 + 学分)+ tabs(简介 / 大纲 / 评价 / 讲师 / 常见问题)+ 章节大纲(折叠树,标记试看/已学/进行中)+ 右侧固定侧栏(价格 + 立即报名 + 试看 + 包含什么)+ 评价区(评分分布柱图 + 评论列表) |
| `mock-learn.html` | 学习中心 | 三栏布局:左(章节大纲 280px,标记进行中 / 完成)+ 中(视频区 16:9 + 播放控件 + 字幕 + 倍速 + 笔记 tab / 字幕 tab / 资源 tab)+ 右(AI 助教聊天 360px,带"问这节课"+ 流式响应 + 引用源)+ 顶部进度条 + 完成按钮 |
| `mock-auth.html` | 登录 / 注册(Frank 硬要求) | 单页双 tab(登录 / 注册)+ 左侧大图(品牌宣言 + 数据)+ 右侧表单 + **第三方登录按钮网格(Google / GitHub / 微信 / 企业微信 / 飞书 / Apple,6 宫格,灰底品牌色图标)** + 分隔线 "或" + 邮箱密码表单 + "忘记密码"+ 底部 "继续即同意服务条款" + 二级页:**账号绑定** sub-page(已绑定的 provider 列表 + 解除绑定按钮 + 添加新 provider 网格 + "至少保留一种登录方式" 提示) |
| `mock-admin-overview.html` | 后台总览 | 顶部 KPI 卡片(今日 GMV / 新增用户 / 活跃用户 / AI token 成本,4 卡片带同环比)+ 中部图表区(收入曲线 30d + 用户增长柱图 + 课程报名漏斗 + 学位完成率饼图,4 宫格)+ 下部待办(黑客松待审 / 退款待审 / 讲师申请 / 公告待发,带快捷入口)+ 右侧系统状态(API 健康 / 队列深度 / 缓存命中率 / 错误率) |
| `mock-admin-course-edit.html` | 后台课程编辑 | 顶部 tab 切换(基本信息 / 章节大纲 / 资源 / 价格 / 发布)+ 左侧章节树(Chapter → Lesson 折叠,拖拽排序,加号新增)+ 中间富文本编辑器(markdown + 代码块 + 公式预览)+ 右侧字段面板(标题 / 封面 / 讲师 / 难度 / 时长 / 标签 / 试看 lesson 勾选)+ 底部 sticky 工具条(保存草稿 / 预览 / 发布) |

**mock 共享规范**(全部体现在 HTML 里):
- Tailwind 3.4 CDN + 显式 dark mode class toggle(顶栏一个 🌙/☀️ 按钮)
- 响应式断点:`sm 640 / md 768 / lg 1024 / xl 1280`,mobile 优先
- 真实文案占位(例:课程标题用"用 LangChain 搭建第一个 Agent"而不是 Lorem)
- 所有彩色 / 圆角 / 阴影都用 §2 的 token 值,不写死颜色码
- 顶部导航共享组件结构,但 mock 之间允许微调

---

## §5 后台模块规划

下表把 audit-admin.md 的 60+ 缺口映射到新模块,按 P0/P1/P2 标注。

| 模块 | 路径前缀 | 主要功能 | 权限 | 关键数据流 | 优先级 |
|---|---|---|---|---|---|
| 总览看板 | `/admin/dashboard` | KPI 卡片(收入 / 用户 / 活跃 / AI 成本)+ 图表 + 待办 | admin | Prisma aggregate + ClickHouse/Materialized View | P0 |
| 用户管理 | `/admin/users` | 列表 / 搜索 / 改角色 / 封禁 / 重置密码 / 模拟登录 | admin | User + Identity + AuditLog | P0 |
| 用户详情 | `/admin/users/:id` | 资料 + 所有 Identity + 订单 + 进度 + 学习事件流 | admin | 多表 join | P0 |
| 课程 CRUD | `/admin/courses` | 列表 + 新建 + 编辑(章节树)+ 上下架 + 试看 lesson | admin | Course + Chapter + Lesson + Resource | P0 |
| 学位管理 | `/admin/degrees` | CRUD + 阶段解锁规则 + 学员进度总览 | admin | Degree + DegreeCourse + Enrollment | P0 |
| 订单 | `/admin/orders` | 订单列表 / 详情 / 退款 / 流水 / 异常单 | admin + finance | Order + OrderItem + Refund | P0 |
| 支付 | `/admin/payments` | Stripe webhook 状态 / 流水对账 / 失败重试 | admin + finance | Payment + WebhookEvent | P0 |
| 黑客松 | `/admin/hackathons` | CRUD / 团队审核 / 作品评审 / 奖项派发 | admin + instructor | Hackathon + Team + Submission | P0 |
| 实践项目 | `/admin/practices` | CRUD / 任务卡 / AI 评测回显 | admin | PracticeProject + Completion | P1 |
| 徽章 / 积分 | `/admin/badges` | 规则配置 / 发放记录 / 排行榜 | admin | Badge + PointTransaction | P1 |
| AI 助教配置 | `/admin/ai` | 模型选择 / tone / token 预算 / 成本监控 | super admin | AIConfig + TokenUsage | P0 |
| 内容运营 | `/admin/content` | Banner / 公告 / 邮件模板 / SEO | content_admin | Banner + Announcement + EmailTemplate | P1 |
| 审计 | `/admin/audit` | 全局操作日志 / 登录事件 / 异常告警 | super admin | AuditLog + LoginEvent | P0(对 §9 强相关) |
| 客服工单 | `/admin/support` | 工单 CRUD / 转单 / 关联用户 / SLA | support | Ticket + TicketReply | P2 |
| 财务 | `/admin/finance` | 报表 / 退款审批 / 发票管理 | finance | Order + Refund + Invoice | P2 |
| 系统设置 | `/admin/system` | FeatureFlag / 密钥轮转 / 限流配置 / 监控 | super admin | SiteConfig + FeatureFlag | P1 |

**角色矩阵(扩展现有 UserRole 3 档)**:
```prisma
enum UserRole {
  super_admin    // 系统设置 / 密钥
  admin          // 默认 admin,大多数操作
  finance        // 订单 / 退款
  support        // 工单 / 查用户
  content_admin  // 内容运营
  instructor     // 讲师(只能改自己的课)
  student        // 默认
}
```

**`roles.guard.ts:14-24` 重构**:
- 改成 `@RequirePermission('course:edit')` 细粒度,**不再用 `array contains` enum**
- Permission 写死常量,`PermissionMap[role] = Set<permission>`,**支持新增角色不动 guard**

---

## §6 数据模型 / API 增量

### 6.1 新增 model(Prisma schema 片段)

> **Identity / RefreshToken 是 §9 认证体系的根,这里只先列 schema,详见 §9**。

```prisma
// ===== 用户域 =====

model Identity {
  id             String   @id @default(cuid())
  userId         String   @map("user_id")
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       String   // 'local' | 'google' | 'github' | 'wechat' | 'wecom' | 'feishu' | 'apple' | 'oidc:<issuer>'
  providerUserId String   @map("provider_user_id")
  accessToken    String?  @db.Text @map("access_token")
  refreshToken   String?  @db.Text @map("refresh_token")
  expiresAt      DateTime? @map("expires_at")
  scope          String?  @db.Text
  profile        Json?    // 第三方返回的 profile 快照
  linkedAt       DateTime @default(now()) @map("linked_at")
  lastUsedAt     DateTime @default(now()) @map("last_used_at")

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("identities")
}

// 替换现有 RefreshToken,加 device/ip/ua 字段
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime @default(now()) @map("created_at")
  userAgent String?  @map("user_agent") @db.Text
  ip        String?  @map("ip")

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model LoginEvent {  // 审计登录
  id        String   @id @default(cuid())
  userId    String?  @map("user_id")  // null = 失败登录(用户不存在)
  provider  String
  event     String   // 'success' | 'fail' | 'link' | 'unlink' | 'refresh' | 'revoke'
  reason    String?  // 失败原因
  ip        String?
  userAgent String?  @map("user_agent") @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@index([event, createdAt])
  @@map("login_events")
}

// ===== 学情 / 个性化 =====

model UserProfile {  // 拆分 User,避免 11-39 字段堆
  id              String   @id @default(cuid())
  userId          String   @unique @map("user_id")
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  interests       Json?    // ["llm", "agent", "rag", ...]
  skillLevel      String?  @map("skill_level")  // 'beginner' | 'intermediate' | 'advanced' | 'expert'
  learningGoal    String?  @db.Text @map("learning_goal")
  aiTone          String?  @map("ai_tone")  // 'concise' | 'socratic' | 'patient'
  lang            String   @default('zh-CN')
  timezone        String?
  @@map("user_profiles")
}

model LearningEvent {  // 行为事件流,补 audit-data-api §4 断点
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  lessonId   String?  @map("lesson_id")
  courseId   String?  @map("course_id")
  eventType  String   @map("event_type")  // 'play' | 'pause' | 'seek' | 'complete' | 'replay' | 'skip' | 'note'
  positionSec Int?    @map("position_sec")
  durationMs  Int?    @map("duration_ms")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@index([lessonId, eventType])
  @@map("learning_events")
}

model Note {  // 学员笔记
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  lessonId  String?  @map("lesson_id")
  content   String   @db.Text
  timestampSec Int?  @map("timestamp_sec")  // 视频时间点
  isPublic  Boolean  @default(false) @map("is_public")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, lessonId])
  @@map("notes")
}

model Review {  // 课程评价
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  courseId  String   @map("course_id")
  rating    Int      // 1-5
  content   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([userId, courseId])
  @@index([courseId, rating])
  @@map("reviews")
}

// ===== AI 助教 =====

model ChatSession {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  scope     String   // 'lesson:<id>' | 'course:<id>' | 'general'
  scopeId   String?  @map("scope_id")
  title     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  messages  ChatMessage[]

  @@index([userId, scope])
  @@map("chat_sessions")
}

model ChatMessage {
  id          String   @id @default(cuid())
  sessionId   String   @map("session_id")
  session     ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role        String   // 'user' | 'assistant' | 'system'
  content     String   @db.Text
  citations   Json?    // [{ lessonId, snippet, score }]
  tokensIn    Int?     @map("tokens_in")
  tokensOut   Int?     @map("tokens_out")
  model       String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([sessionId, createdAt])
  @@map("chat_messages")
}

// ===== 业务扩展 =====

model Notification {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  type      String   // 'order' | 'progress' | 'hackathon' | 'system' | 'social'
  title     String
  body      String   @db.Text
  link      String?
  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, isRead, createdAt])
  @@map("notifications")
}

model Banner { id String @id @default(cuid()) ... }       // 内容运营
model Announcement { ... }                               // 站点公告
model EmailTemplate { ... }                              // 邮件模板
model FeatureFlag { key String @id value Json enabled Boolean } // 系统设置
model SiteConfig { key String @id value Json }           // 系统设置

// 软删字段加到主要业务表(deletedAt)
model Course { ... deletedAt DateTime? @map("deleted_at") ... }  // 替换 hard delete
model User   { ... deletedAt DateTime? @map("deleted_at") ... }

// Lesson 扩展
model Lesson {
  ...现有字段
  transcript  String? @db.Text           // 字幕/转写
  keypoints   Json?                      // AI 提取的要点
  quiz        Json?                      // 课后测验
  isPreview   Boolean @default(false) @map("is_preview")  // 已有,但 admin 端点要能改
  resources   Resource[]                 // 关联资源(已有 model)
}
```

### 6.2 新增 / 重构 module(NestJS)

| 新增 module | 职责 | 状态 |
|---|---|---|
| `apps/api/src/modules/identity/` | Identity CRUD + 第三方账号绑定 / 解绑 | **新增** |
| `apps/api/src/modules/strategy/` | AuthStrategy 接口 + Local/Oidc/Social 实现 + 工厂 | **新增(Frank 硬要求)** |
| `apps/api/src/modules/chat/` | AI 助教会话 / 消息 / 引用 / token 计量 | **新增** |
| `apps/api/src/modules/notification/` | 通知 CRUD + 多渠道(站内 / 邮件 / Push)+ 模板 | **新增 controller**(现有只有 service) |
| `apps/api/src/modules/admin/` | 后台总览 / 看板 / 权限 / 审计 / 系统设置 | **新增 namespace**(audit-admin §2 第 1 条) |
| `apps/api/src/modules/payments/` | Stripe 接入 + webhook + 对账 | **新增**(audit-admin §2 订单/支付) |
| `apps/api/src/modules/content/` | Banner / 公告 / 邮件模板 | **新增** |
| `apps/api/src/modules/learning-event/` | 行为事件打点 + 接收 | **新增** |
| `apps/api/src/modules/review/` | 课程评价 / 评分 | **新增** |
| `apps/api/src/modules/note/` | 笔记 CRUD | **新增** |
| `apps/api/src/modules/audit/` | 审计读 + 看板 | **新增 controller**(audit-log 只有写) |

| 重构 module | 改什么 |
|---|---|
| `auth/` | 改用 `Strategy` 工厂 + Identity 表,register/login 走 `LocalStrategy`,新加 `OidcStrategy` / `SocialStrategy` 接口实现(详见 §9) |
| `users/` | 加 `delete` 软删 + admin 改角色 / 封禁 / 重置密码端点 + 写 audit log |
| `courses/` | `update` 接受 chapters(章节树 CRUD)+ 软删 + admin 上下架 |
| `orders/` | 加 admin 端点(列表 / 退款)+ 走真实 `payments` + audit log |
| `progress/` | 完成 lesson 走 `$transaction`(progress + points + badges + learning event) |
| `roles.guard.ts` | 改用 `@RequirePermission('x:y')` 注解 + permission map,不再 array contains |
| `ai/` | 拆 `AiContentService`(admin 内容生成)+ `ChatService`(学员 AI 助教)+ token 计量 |

### 6.3 第三方依赖变化

| 新增 | 用途 | 备注 |
|---|---|---|
| `passport-openidconnect` | OIDC 通用策略 | §9 阶段 3 |
| `passport-google-oauth20` | Google | §9 阶段 2 |
| `passport-github2` | GitHub | §9 阶段 2 |
| `@node-rs/argon2`(或保留 `bcrypt`) | 密码 hash | 已有 bcrypt,**不动** |
| `stripe` + `@nestjs/stripe` | 真实支付 | 替换 mockPay |
| `bullmq` + `ioredis` | 队列(token 计量 / webhook / 邮件) | audit-data-api §3 "无 Queue" |
| `cache-manager-redis-store` | 缓存(搜索 / 排行 / 看板) | 同上 |
| `nestjs-pino` + `pino-http` | 结构化日志 + 链路 | 替换默认 logger |
| `@aws-sdk/client-s3` 或 `minio`(自托管) | 资源存储 | 富文本附件 / 课程封面 / 提交作品 |
| `class-validator` 已有 + `nestjs-i18n` | 错误码 i18n | 替换裸 `{ error: 'Forbidden' }` |
| `next-themes`(或自写 `<ThemeProvider>`) | 暗色 / 亮色 / system | §2.3 |
| `react-i18next` + `i18next` | 前台多语言 | audit-web-ux §4 "无 i18n" |
| `react-hook-form` + `zod`(已装未用) | 表单 | audit-web-ux §3 "空装" |
| `recharts` 或 `apache-echarts` | 后台图表 | 已有 lucide-react,**加图表库** |
| `@radix-ui/*` 或 `shadcn/ui` | 组件库(a11y / 焦点 / 键盘) | audit-web-ux §4 "无 a11y" |
| `cmdk` | Command-K 全站搜索 | audit-web-ux §4 "无搜索" |
| `@dnd-kit/core` | 后台章节树拖拽 | §5 课程编辑 |

---

## §7 实施路线图(P0 / P1 / P2)

### 7.1 P0(2 周内必须出)

> 总目标:**能拍板"开干",并把 §9 认证架构落地 + 学员侧 MVP 跑通**。

| # | 任务 | 完成标准 | 依赖 | 估时 |
|---|---|---|---|---|
| P0-1 | **§9 认证架构落地** — Identity / RefreshToken 迁移 + LocalStrategy 改造 + AuthStrategy 接口骨架 | schema migration 跑通;老用户自动建 `provider='local'` Identity;register/login 不变;`Strategy` 接口 + factory 存在;无第三方代码 | — | 3d |
| P0-2 | **账号绑定 UI** — `mock-auth.html` 实现,`/dashboard/settings/bindings` 后端 + 前端 | 用户能绑定 / 解绑(灰度:仅本地→Google 这一种 provider);解绑前提示"至少保留一种";解绑走 audit log | P0-1 | 2d |
| P0-3 | **登录 / 注册页 + 第三方登录按钮网格(灰度)** — `mock-auth.html` 落实 | mock 落地;前端 `useAuth()` 重构为接口;`LocalAuthProvider` + `OidcAuthProvider` 切换开关走 config | P0-1 | 2d |
| P0-4 | **设计系统 tokens 落地** — `styles/tokens.css` + `tailwind.config.js` 改造 + Storybook 0 个基础组件(Button / Input / Card / EmptyState / Skeleton) | 暗色 / 亮色 / 响应式可用;`shadow-glow` 验证 | — | 2d |
| P0-5 | **新首页** — `mock-home.html` 落地 + 真实课程数据 + 移动端 bottom tab | 首页可访问;hero / 课程卡 / 学位 / 黑客松 / AI 助教 FAB 全部就位;Lighthouse Mobile ≥ 85 | P0-4 | 2d |
| P0-6 | **新学习中心** — `/dashboard` 取代 `/profile` + 章节大纲 + 视频 + AI 助教右栏 | `mock-learn.html` 落地;视频上报 `LearningEvent`;完成 lesson 走 `$transaction`;AI 助教调用 `/chat/sessions` | P0-1 + 新增 `chat` module | 3d |
| P0-7 | **后台总览 + 审计** — `mock-admin-overview.html` 落地 + 看板 API | 4 KPI + 4 图表;`/admin/audit` 能查登录事件 | P0-1 | 2d |
| P0-8 | **后台课程编辑** — `mock-admin-course-edit.html` 落地 + 章节树 CRUD | 章节拖拽;Lesson 增删改;试看勾选;软删 + 上下架 | — | 3d |

**P0 总计:19 人天 ≈ 4 人 × 5 天**。

### 7.2 P1(1 个月内)

| # | 任务 | 完成标准 |
|---|---|---|
| P1-1 | **Google + GitHub 第三方登录** | 真实接入;OIDC 走 `OidcStrategy`;首次登录自动建账号;同 email 自动 merge |
| P1-2 | **课程列表筛选 + 全站搜索** | 难度 / 标签 / 时长 / 排序;Command-K;搜索后端 + 高亮 |
| P1-3 | **课程详情 + 评价** | 大封面 + tabs;Review model + UI;评分分布柱图 |
| P1-4 | **学位路径图 + 我的学位** | 学位详情有路径图;学习进度条;阶段解锁 |
| P1-5 | **AI 助教核心** | `chat` module 完整;按 lesson 上下文检索 + 引用源;token 计量 + cost 看板 |
| P1-6 | **支付真实化** | Stripe 接入;webhook 处理;sandbox 可下单;`mockPay` 切到 feature flag |
| P1-7 | **通知中心** | `notification` module controller 完整;bell + 列表 + 标记已读 + 邮件模板 |
| P1-8 | **我的订单 + 证书页** | `/dashboard/orders` + `/dashboard/certificates` 落地 |
| P1-9 | **暗色模式 + 国际化(zh-CN / en-US)** | `prefers-color-scheme` 默认 + toggle;前端 `useTranslation`;后端 `nestjs-i18n` 错误码 |
| P1-10 | **讲师主页 + 实践项目页** | `/instructors/:id` + `/practices/:id`;任务卡 + 提交 |
| P1-11 | **内容运营后台** | Banner / 公告 / 邮件模板 CRUD |
| P1-12 | **a11y 基础** | focus ring / skip-link / 键盘可达 / `aria-label` 关键交互 |

### 7.3 P2(后续)

| # | 任务 |
|---|---|
| P2-1 | **企业 SSO(OIDC 通用)** — `oidc:<issuer>` 动态注册 |
| P2-2 | **多租户(企业版)** — `tenantId` 加到所有业务表 + 路由 + 隔离 |
| P2-3 | **托管 Auth0 / Clerk / Logto 接入**(如果选型变更) |
| P2-4 | **学习分析看板** — `LearningEvent` 聚合 → 留存 / 漏斗 / 卡点 |
| P2-5 | **个性化推荐** — `UserProfile` 兴趣 → 课程推荐 + 学位推荐 |
| P2-6 | **客服工单** — Ticket + 转单 + SLA |
| P2-7 | **财务报表 + 退款审批** |
| P2-8 | **移动 App / PWA 离线学习** |
| P2-9 | **直播课 / Office Hour** |

---

## §8 风险与未决问题(open question,等 Frank 拍板)

1. **第三方登录首批接哪家?** Google / GitHub(海外)还是微信 / 企业微信(国内)优先?
2. **托管方案(Auth0 / Clerk / Logto) vs 自建?** 影响 §9 阶段 4 是真接还是"接口预留,代码不写"。
3. **迁移窗口期:** 旧 User 表 schema 改 backward compatible(已写),但 `RefreshToken` 字段改了,**是否需要 dual-write 一周**?
4. **课程视频托管:** 自建(Mux / Cloudflare Stream)还是 S3 + CDN?影响 §5 课程编辑器的资源上传实现。
5. **AI 助教模型:** 自托管(开源)还是 OpenAI / Anthropic API?**token 成本**是 P0-7 看板的关键指标。
6. **支付:** Stripe(海外)还是微信 / 支付宝(国内)?**双通道还是单通道**?
7. **暗色模式默认:** system / 暗 / 亮?Frank 倾向哪种?
8. **国际化范围:** P1 只做 zh-CN + en-US,还是加 ja-JP / es-ES?
9. **后台独立子域**(`admin.opencsg.academy`)还是继续共域 `/admin`?
10. **AI 助教是否给学生看完整推理?** 一些课(P0 阶段 2 + 实践项目)希望"AI 不直接给答案,只给提示",这要单独的 `aiTone` 字段 + admin 配置。
11. **讲师主页是否对外公开?** 内部讲师 vs 外部讲师是否同一种 model?
12. **证书生成:** 自动 PDF / 可验证区块链证书 / 可挂 LinkedIn?

---

## §9 认证体系架构(可插拔 + 第三方整合路径)— Frank 硬要求

> **本节是 Frank 2026-07-12 02:46 拍板的硬要求,不可妥协。**
> 现有 `auth.service.ts:3,13,44-63` 把 bcrypt + JwtService 直接 import + 调用,`auth.module.ts:35` `PassportModule.register({ defaultStrategy: 'jwt' })` 把 JWT 写死。**全部要重构**。
> 目标:**AuthStrategy 接口、JwtStrategy / OidcStrategy / SocialStrategy 并存,运行时按 config 切换,业务代码完全不知道底层用哪种**。

### 9.1 AuthStrategy 抽象(接口 + 实现 + 工厂)

**接口定义**(`apps/api/src/modules/strategy/auth-strategy.interface.ts`):

```typescript
export interface AuthStrategy {
  /** 唯一标识,用于 config 切换 */
  readonly name: string;

  /** Passport strategy 名,用于 @UseGuards(AuthGuard('xxx')) */
  readonly passportName: string;

  /**
   * 验证请求(走 passport):从 req 提取凭证,返回 user 主体或抛 UnauthorizedException
   * Passport 内部调用,业务代码不直接调
   */
  validate(req: any): Promise<AuthPrincipal>;

  /**
   * 业务入口:登录 / 注册
   *  - LocalStrategy: 校验 email + password,返回 { user, tokens }
   *  - OidcStrategy:  校验 callback 里的 code,exchange,upsert Identity,返回 tokens
   *  - SocialStrategy: 同 Oidc,只是 grant_type 不同
   */
  authenticate(credentials: unknown, ctx: RequestContext): Promise<AuthResult>;

  /** 已有账号绑定新 provider */
  linkAccount(userId: string, credentials: unknown, ctx: RequestContext): Promise<Identity>;

  /** 解除绑定(业务规则:至少留一种) */
  unlinkAccount(userId: string, identityId: string): Promise<void>;
}

export interface AuthPrincipal {
  userId: string;
  email?: string;
  role: UserRole;
  identities: Identity[];
}

export interface AuthResult {
  user: User;
  identities: Identity[];
  accessToken: string;
  refreshToken: string;  // raw,controller 会写 cookie
}

export interface RequestContext {
  ip: string;
  userAgent: string;
  deviceId?: string;
  redirectUri?: string;  // OIDC 回调用
}
```

**工厂**(`apps/api/src/modules/strategy/strategy.factory.ts`):

```typescript
@Injectable()
export class StrategyFactory {
  private strategies = new Map<string, AuthStrategy>();

  constructor(
    private readonly local: LocalStrategy,
    private readonly oidc: OidcStrategy,
    private readonly social: SocialStrategy,
  ) {
    [local, oidc, social].forEach(s => this.strategies.set(s.name, s));
  }

  /** config-driven 切换: AUTH_DEFAULT_STRATEGY=local|oidc|social */
  getDefault(): AuthStrategy {
    const name = this.config.get('AUTH_DEFAULT_STRATEGY', 'local');
    const s = this.strategies.get(name);
    if (!s) throw new Error(`Unknown strategy: ${name}`);
    return s;
  }

  /** 业务按 name 拿,例如 accounts controller 要 link Google 显式 pick SocialStrategy('google') */
  get(name: string): AuthStrategy {
    const s = this.strategies.get(name);
    if (!s) throw new NotFoundException(`Strategy not found: ${name}`);
    return s;
  }

  /** 列出所有启用的 provider,给前端按钮网格用 */
  listEnabled(): Array<{ name: string; label: string; icon: string; enabled: boolean }> {
    // 从 config (AUTH_PROVIDERS=google,github,wecom) 读
    return this.config.get<string>('AUTH_PROVIDERS', '')
      .split(',').filter(Boolean)
      .map(name => ({
        name,
        label: this.providerLabels[name],
        icon: `/icons/providers/${name}.svg`,
        enabled: true,
      }));
  }
}
```

**LocalStrategy 骨架**(改造现有 `auth.service.ts` + `jwt.strategy.ts`):

```typescript
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy as any, 'local') implements AuthStrategy {
  readonly name = 'local';
  readonly passportName = 'local';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refresh: RefreshTokenService,
    private readonly audit: AuditLogService,
  ) {
    super({
      // 现有策略: 走 header bearer,validate(payload) 返回 user 主体
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  // Passport JWT validate: 把 JWT payload 映射成 AuthPrincipal
  async validate(payload: JwtPayload): Promise<AuthPrincipal> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { identities: { select: { id: true, provider: true, lastUsedAt: true } } },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    return { userId: user.id, email: user.email, role: user.role, identities: user.identities };
  }

  // 业务入口
  async authenticate(creds: LoginDto, ctx: RequestContext): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: creds.email },
      include: { identities: true },
    });
    if (!user || !user.passwordHash) {
      await this.audit.logLogin({ provider: 'local', event: 'fail', reason: 'user_not_found', ctx });
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(creds.password, user.passwordHash);
    if (!ok) {
      await this.audit.logLogin({ provider: 'local', event: 'fail', reason: 'bad_password', ctx, userId: user.id });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 自动确保有 local Identity(老用户迁移用)
    if (!user.identities.find(i => i.provider === 'local')) {
      await this.prisma.identity.create({
        data: { userId: user.id, provider: 'local', providerUserId: user.id, linkedAt: new Date(), lastUsedAt: new Date() },
      });
    }

    await this.audit.logLogin({ provider: 'local', event: 'success', ctx, userId: user.id });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user, ctx);
  }

  async linkAccount(userId: string, _creds: unknown, _ctx: RequestContext) {
    // local strategy 不参与 link——link 是给 OIDC/Social 用的
    throw new BadRequestException('Local account is primary, use OIDC to link additional providers');
  }

  async unlinkAccount(userId: string, identityId: string) {
    const ident = await this.prisma.identity.findUnique({ where: { id: identityId } });
    if (!ident || ident.userId !== userId) throw new NotFoundException();
    if (ident.provider === 'local') {
      const otherCount = await this.prisma.identity.count({ where: { userId, NOT: { id: identityId } } });
      if (otherCount === 0) throw new BadRequestException('Cannot unlink last login method');
    }
    await this.prisma.identity.delete({ where: { id: identityId } });
  }

  private async issueTokens(user: User, ctx: RequestContext): Promise<AuthResult> {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, role: user.role }, { expiresIn: '15m' });
    const refreshToken = await this.refresh.create(user.id, ctx);  // 存 hash + ip + ua
    return { user, identities: user.identities, accessToken, refreshToken };
  }
}
```

**OidcStrategy / SocialStrategy 骨架**(不绑具体 provider,只给 contract):

```typescript
@Injectable()
export class OidcStrategy implements AuthStrategy {
  readonly name = 'oidc';
  readonly passportName = 'oidc';  // 注册到 PassportModule

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly providers: OidcProviderRegistry,  // 一个动态注册器
    private readonly refresh: RefreshTokenService,
    private readonly audit: AuditLogService,
  ) {}

  // 业务入口:接收 { code, state, provider:'google'|'github'|'wecom'|... }
  async authenticate(creds: { code: string; state: string; provider: string }, ctx: RequestContext): Promise<AuthResult> {
    const provider = this.providers.get(creds.provider);
    if (!provider) throw new NotFoundException(`Provider not configured: ${creds.provider}`);

    // 1. code 换 token
    const tokenResp = await provider.exchangeCode(creds.code, ctx.redirectUri);
    // 2. token 拿 profile
    const profile = await provider.fetchProfile(tokenResp.access_token);
    // 3. 找现有 Identity(provider, providerUserId) 或同 email 的 user
    let identity = await this.prisma.identity.findUnique({
      where: { provider_providerUserId: { provider: provider.name, providerUserId: profile.providerUserId } },
      include: { user: true },
    });

    if (!identity) {
      // 同 email 自动 merge(已注册本地账号 + 第三方同 email)
      const existingUser = profile.email
        ? await this.prisma.user.findUnique({ where: { email: profile.email } })
        : null;
      const user = existingUser ?? await this.prisma.user.create({
        data: { email: profile.email ?? `${provider.name}-${profile.providerUserId}@noreply.opencsg.academy`,
                name: profile.name ?? 'OpenCSG User', passwordHash: null },
      });
      identity = await this.prisma.identity.create({
        data: {
          userId: user.id,
          provider: provider.name,
          providerUserId: profile.providerUserId,
          accessToken: tokenResp.access_token,
          refreshToken: tokenResp.refresh_token,
          expiresAt: tokenResp.expires_at,
          scope: tokenResp.scope,
          profile: profile as any,
        },
      });
      await this.audit.logLogin({ provider: provider.name, event: existingUser ? 'link' : 'success', ctx, userId: user.id });
    } else {
      // 已有 Identity,刷新 token
      await this.prisma.identity.update({
        where: { id: identity.id },
        data: { accessToken: tokenResp.access_token, refreshToken: tokenResp.refresh_token,
                expiresAt: tokenResp.expires_at, lastUsedAt: new Date() },
      });
      await this.audit.logLogin({ provider: provider.name, event: 'success', ctx, userId: identity.userId });
    }

    const user = identity.user;
    return this.issueTokens(user, ctx);
  }

  // OIDC 不参与 link——link 走 authenticate 但用 'bind' 模式
  async linkAccount(userId: string, creds: any, ctx: RequestContext) {
    const auth = await this.authenticate(creds, ctx);
    if (auth.user.id !== userId) throw new ConflictException('Identity already bound to another user');
    return auth.identities[0];
  }

  async unlinkAccount(userId: string, identityId: string) { /* 同 Local */ }
  validate(req: any): Promise<AuthPrincipal> { throw new Error('OIDC does not use passport validate'); }

  private issueTokens(...): AuthResult { /* 同 Local */ }
}
```

**Provider 注册器**(动态,config 驱动):

```typescript
@Injectable()
export class OidcProviderRegistry {
  private map = new Map<string, OidcProvider>();

  constructor(config: ConfigService) {
    // 读 AUTH_PROVIDERS=google,github,wecom,feishu
    // 每个 provider 按需实例化对应 passport strategy(可延迟 import)
    const enabled = (config.get('AUTH_PROVIDERS') ?? '').split(',').filter(Boolean);
    for (const name of enabled) {
      const provider = this.create(name, config);
      if (provider) this.map.set(name, provider);
    }
  }

  get(name: string) { return this.map.get(name); }
  list() { return [...this.map.keys()]; }

  private create(name: string, config: ConfigService): OidcProvider | null {
    switch (name) {
      case 'google':   return new GoogleOidcProvider(config);
      case 'github':   return new GithubOAuth2Provider(config);
      case 'wecom':    return new WecomProvider(config);
      case 'feishu':   return new FeishuProvider(config);
      // OIDC 通用:从 AUTH_OIDC_<NAME>_ISSUER / CLIENT_ID / CLIENT_SECRET 读
      default: return config.get(`AUTH_OIDC_${name.toUpperCase()}_ISSUER`)
        ? new GenericOidcProvider(name, config) : null;
    }
  }
}
```

### 9.2 User + Identity 模型(已在 §6.1 给 schema)

> 关键约束:
> 1. `User.email` 改 nullable,允许纯第三方账号;但本地注册仍要求 email 唯一
> 2. `User.passwordHash` 改 nullable,纯第三方账号无 password
> 3. `Identity` 一个用户可多个,**`@@unique([provider, providerUserId])`** 保证不会重复绑
> 4. `Identity.accessToken` / `refreshToken` 单独存,**不**混进 JWT——JWT 只放 `{ sub, email, role }`
> 5. **老数据迁移脚本**(`prisma/migrations/xxx_add_identity/migration.ts`):
>    ```typescript
>    await prisma.$executeRaw`
>      INSERT INTO identities (id, user_id, provider, provider_user_id, linked_at, last_used_at)
>      SELECT UUID(), id, 'local', id, NOW(), NOW() FROM users
>      WHERE NOT EXISTS (SELECT 1 FROM identities WHERE identities.user_id = users.id)
>    `;
>    ```

### 9.3 登录 / 注册 / 绑定 / 解绑 API(完整 endpoint)

> 所有路径前缀 `/api/v1/auth`(或拆 `/api/v1/identity` 业务子域)。**AuthGuard 默认仍用 'jwt'**,但 controller 通过 `StrategyFactory` 路由到具体策略。

| Method | Path | Auth | 行为 | 错误码 |
|---|---|---|---|---|
| POST | `/auth/register` | 公开 | `LocalStrategy.authenticate({ email, password, name })`,自动建 local Identity | 409 email 冲突 / 422 验证失败 |
| POST | `/auth/login` | 公开 | `LocalStrategy.authenticate({ email, password })`,refresh 写 httpOnly cookie,access 返 body | 401 凭证错 / 423 账号封禁 |
| POST | `/auth/refresh` | cookie | 读 cookie → 查 hash → 轮转 | 401 |
| POST | `/auth/logout` | jwt | revoke refresh + clear cookie | — |
| GET | `/auth/providers` | 公开 | `StrategyFactory.listEnabled()`,前端按钮网格用 | — |
| GET | `/auth/:provider/authorize` | 公开 | 生成 state(存 Redis,5min TTL)+ redirect 到 provider 授权页 | 404 provider 未启用 |
| GET | `/auth/:provider/callback` | 公开 | provider 回调,`OidcStrategy.authenticate({ code, state })`,成功后 set cookie + 302 回前端 `/auth/success` | 401 state 校验失败 / 502 provider 异常 |
| GET | `/auth/identities` | jwt | 列当前用户所有 Identity | — |
| POST | `/auth/identities/link` | jwt | `{ provider, code, state }` → OIDC link,要求未在该 provider 绑定 | 409 已绑 / 422 验证失败 |
| DELETE | `/auth/identities/:id` | jwt | `LocalStrategy.unlinkAccount` 或 `OidcStrategy.unlinkAccount`,校验"至少留一种" | 422 最后一个 / 404 |
| POST | `/auth/forgot` | 公开 | 发邮件 | 200(防枚举) |
| POST | `/auth/reset` | 公开 | 校验 token + 改密码 + revoke 所有 refresh | 401 |
| POST | `/auth/change-password` | jwt | 改密码,清空其它设备的 refresh | — |
| GET | `/auth/login-events` | jwt | 当前用户最近 30 天登录事件(给 settings/security) | — |
| GET | `/admin/audit/login-events` | admin | 全局登录事件查询 | — |

**第三方回调流程**(以 Google 为例):

```
用户点 [用 Google 登录]
  → GET /api/v1/auth/google/authorize
    → 服务端生成 state = uuid(),存 Redis: SET auth:state:<state> { provider, redirectAfter, csrf } EX 300
    → 302 到 https://accounts.google.com/o/oauth2/v2/auth?
        client_id=...&redirect_uri=<api>/auth/google/callback&state=<state>&scope=openid+email+profile

用户在 Google 同意
  → 302 回 <api>/auth/google/callback?code=...&state=...
    → 服务端: GET state from Redis,验证一致
    → POST https://oauth2.googleapis.com/token (code + client_secret + redirect_uri)  → access_token
    → GET https://www.googleapis.com/oauth2/v3/userinfo (access_token) → profile
    → upsert Identity / merge User
    → issue access (body) + refresh (httpOnly cookie)
    → 302 回前端 https://app/auth/success
```

**账号合并判定规则**:

| 场景 | 行为 |
|---|---|
| 第三方 profile.email **不存在** User | 新建 User(无 password)+ Identity(provider) |
| 第三方 profile.email 存在 User,User 无 password(纯第三方) | 复用 User + 新建 Identity(provider) |
| 第三方 profile.email 存在 User,User 有 password(本地) | **自动 merge**:绑 Identity(provider)到现有 User;**不要求密码二次确认**(P0);P1 加"敏感操作要求重新输密码"开关 |
| `Identity(provider, providerUserId)` 已存在 | 复用,只刷新 token + 写 login_event |
| 同一 provider 已绑给另一个 User | 报 409(同 OAuth 账号不能绑多用户) |

### 9.4 前端 AuthProvider 抽象(`apps/web/src/lib/auth/`)

```typescript
// apps/web/src/lib/auth/types.ts
export interface AuthAdapter {
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  refresh(): Promise<AuthSession>;
  bindProvider(provider: string, code: string, state: string): Promise<Identity>;
  unbindProvider(identityId: string): Promise<void>;
  listProviders(): Promise<ProviderInfo[]>;
  listMyIdentities(): Promise<Identity[]>;
  onUnauthorized(handler: () => void): () => void;  // 401 拦截
}

export type SignInInput =
  | { kind: 'local'; email: string; password: string }
  | { kind: 'oauth-redirect'; provider: string }  // window.location = /api/v1/auth/<p>/authorize
  | { kind: 'oauth-callback'; provider: string; code: string; state: string };  // /auth/<p>/callback 处理

// apps/web/src/lib/auth/LocalAuthAdapter.ts  ——  默认,Phase 1
export class LocalAuthAdapter implements AuthAdapter { /* 直调 /api/v1/auth/* */ }

// apps/web/src/lib/auth/OidcAuthAdapter.ts  ——  Phase 2+
export class OidcAuthAdapter implements AuthAdapter { /* 同上,但用 OIDC 端点 */ }

// apps/web/src/lib/auth/HostedAuthAdapter.ts  ——  Phase 4(如果选 Auth0/Clerk)
export class HostedAuthAdapter implements AuthAdapter { /* 调托管 SDK */ }
```

**React Context + `useAuth()`**:

```tsx
// apps/web/src/lib/auth/AuthProvider.tsx
const AuthContext = createContext<{
  user: User | null;
  identities: Identity[];
  providers: ProviderInfo[];
  signIn: AuthAdapter['signIn'];
  signOut: AuthAdapter['signOut'];
  bindProvider: AuthAdapter['bindProvider'];
  unbindProvider: AuthAdapter['unbindProvider'];
  isAuthenticating: boolean;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const adapter = useAdapter();  // 读 config,返回 LocalAuthAdapter 或 OidcAuthAdapter

  // 启动:读 /auth/me 拉当前用户(cookie 自动带)+ 列 providers
  useEffect(() => { boot(); }, []);

  // 401 拦截:token 过期 → refresh → 失败 → 跳 /login
  useEffect(() => adapter.onUnauthorized(() => { setUser(null); window.location.href = '/auth/login'; }), [adapter]);

  return <AuthContext.Provider value={...}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used in <AuthProvider>');
  return ctx;
}
```

**`<AuthGuard>` 组件**:

```tsx
export function AuthGuard({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isAuthenticating } = useAuth();
  if (isAuthenticating) return <Skeleton />;  // 不闪跳 login
  if (!user) return <Navigate to="/auth/login" replace />;
  if (requireAdmin && user.role !== 'admin' && user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

**Token 存储**:
- **默认 httpOnly cookie**(refresh);access 走 in-memory store(避免 XSS)
- localStorage 兜底(老浏览器 / config 切)
- 切换开关:`AUTH_TOKEN_STORAGE=cookie|memory|localStorage`

**401 拦截**:
- 单一 `apiClient` axios instance,response interceptor 捕获 401 → 调 `adapter.refresh()` → 失败 → `adapter.onUnauthorized` 回调
- refresh 期间并发请求共享一个 Promise(防 401 storm)

### 9.5 演进路径(env 切换,**不删旧代码**)

| Phase | 启用 | 关闭 | config |
|---|---|---|---|
| **Phase 1(当前 P0)** | LocalStrategy | OidcStrategy / SocialStrategy | `AUTH_DEFAULT_STRATEGY=local` `AUTH_PROVIDERS=`(空) |
| **Phase 2(P1)** | LocalStrategy + SocialStrategy(google,github) | Oidc 通用 | `AUTH_DEFAULT_STRATEGY=local` `AUTH_PROVIDERS=google,github` |
| **Phase 3(P2)** | + OidcStrategy(企业 SSO) | — | `AUTH_PROVIDERS=google,github,oidc:acme-corp,oidc:globex` |
| **Phase 4(选型变更)** | + HostedAuthAdapter(Auth0 / Clerk / Logto) | LocalStrategy(灰度保留) | `AUTH_ADAPTER=local|oidc|hosted` |

**每个 phase 都是非破坏性增量**:
- 业务 controller 不变,只 `StrategyFactory.get(name)` 选
- 数据库 schema 只加字段(`Identity` / `RefreshToken` 重构),**不删旧 `User.passwordHash`**
- 前端 `useAuth()` 永远返回统一 shape,组件代码不感知 provider 切换
- **回滚 = 改 env 一行**,不改代码

### 9.6 测试 + 审计

**单元测试**(`apps/api/src/modules/strategy/__tests__/`):

| 场景 | 期望 |
|---|---|
| `LocalStrategy.authenticate` 正确密码 | 返 tokens + 写 LoginEvent(success) |
| `LocalStrategy.authenticate` 错密码 | 抛 401 + 写 LoginEvent(fail, reason=bad_password) |
| `OidcStrategy.authenticate` 首次(无同 email) | 新建 User + Identity + LoginEvent(success) |
| `OidcStrategy.authenticate` 同 email 本地账号 | 自动 merge + 写 LoginEvent(link) |
| `OidcStrategy.authenticate` state 不匹配 | 抛 401 + 写 LoginEvent(fail, reason=state_mismatch) |
| `LocalStrategy.unlinkAccount` 唯一身份 | 抛 422(必须留一种) |
| `OidcStrategy.unlinkAccount` 有本地兜底 | 成功,写 LoginEvent(unlink) |
| `StrategyFactory.getDefault` 读 env | env 切到 oidc 后路由到 OidcStrategy |

**E2E**(`apps/web/e2e/auth.spec.ts`):

1. 本地注册 → 登录 → 看到 settings
2. 进入 settings/bindings → 点 [绑定 Google] → 走 mock OAuth → 回来看到 Identity 增加
3. 解除 Google 绑定 → 看到提示"至少保留一种"(因为只有 local)
4. 用 Google 重登(直接走 authorize) → 自动识别同 email → 直接进

**审计日志**:`LoginEvent` 全量接入,**所有** auth 路径都必须 log:
- success / fail / link / unlink / refresh / revoke
- 字段:`userId` / `provider` / `event` / `reason` / `ip` / `userAgent` / `createdAt`
- 写入点:`AuthService` / `StrategyFactory` / `IdentityController` / `RefreshTokenService`
- **没有 log 视为 bug**,CI 校验覆盖率 ≥ 90%

**Admin 可见**:`/admin/users/:id` 显示该用户所有 Identity(provider / linkedAt / lastUsedAt / scopes)+ 该用户 login event 时间线。

### 9.7 Open questions(也写进 §8)

- §9.5 Phase 2 首批 provider:**Google + GitHub** 还是 **微信 + 企业微信**(取决于目标用户地域)
- §9.5 Phase 4:是否真接 Auth0 / Clerk / Logto?目前倾向**自建 + 接口预留**(成本 + 数据主权)
- §9.3 账号合并是否要"敏感操作二次输密码"?(P0 不做,P1 加)
- §9.3 webhook 通知:第三方密码改了,要不要主动 revoke 对应 Identity?(P2)
- 登出 = 吊销 refresh + 通知各 provider revoke 各自的 token,P0 是否先做?(建议 P1)

---

## 附录:mock 文件清单

| 文件 | 用途 | 暗色 / 亮色 | 响应式 |
|---|---|---|---|
| `review/mocks/mock-home.html` | 首页 | ✅ toggle | ✅ |
| `review/mocks/mock-course-list.html` | 课程列表 | ✅ toggle | ✅ |
| `review/mocks/mock-course-detail.html` | 课程详情 | ✅ toggle | ✅ |
| `review/mocks/mock-learn.html` | 学习中心(三栏) | ✅ toggle | ✅ |
| `review/mocks/mock-auth.html` | 登录/注册 + 第三方按钮网格(Frank 硬要求) | ✅ toggle | ✅ |
| `review/mocks/mock-admin-overview.html` | 后台总览 | ✅ toggle | ✅ |
| `review/mocks/mock-admin-course-edit.html` | 后台课程编辑 | ✅ toggle | ✅ |

**所有 mock 共享**:Tailwind 3.4 CDN + 顶部导航 + 字体 Inter + 真实文案 + §2 视觉 tokens + 移动端 bottom tab 或汉堡。
