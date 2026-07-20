# OpenCSG Academy 管理员手册

> 给 admin / super_admin 角色使用的后台操作指南。覆盖课程 / 学位 / 用户 / 黑客松 / 徽章 / 企业咨询 / 看板 / 审核 全部后台模块。
>
> 适用版本:v1.0.x
> 角色要求:`admin` 或 `super_admin`(只能 `super_admin` 创建新 admin)

---

## 目录

1. [角色与权限](#1-角色与权限)
2. [进入后台](#2-进入后台)
3. [看板 (Dashboard)](#3-看板-dashboard)
4. [课程管理](#4-课程管理)
5. [学位管理](#5-学位管理)
6. [用户管理](#6-用户管理)
7. [黑客松管理](#7-黑客松管理)
8. [徽章管理](#8-徽章管理)
9. [企业咨询 (Enterprise Inquiries)](#9-企业咨询-enterprise-inquiries)
10. [审计日志(规划中)](#10-审计日志规划中)
11. [系统设置(规划中)](#11-系统设置规划中)
12. [审核工作流](#12-审核工作流)
13. [数据导入 / 导出](#13-数据导入--导出)
14. [常见任务清单](#14-常见任务清单)

---

## 1. 角色与权限

| 角色 (enum) | 描述 | 权限范围 |
|------|------|----------|
| `student` | 默认角色 (DB 枚举值,前端展示为「学员」) | 前台全部功能,无后台 |
| `instructor` | 讲师 (DB 枚举值,可创建/管理自己课程) | 前台 + 自有课程管理 (UI 在 P2+) |
| `admin` | 运营 / 内容编辑 | 后台 7 个模块(无系统设置) |

> ⚠️ **Schema 实际只有 3 个 role**:`student` / `instructor` / `admin`(`prisma/schema.prisma` `enum UserRole`)。
> 文档之前提到的 `super_admin` / `user` 是早期设计草稿,代码中**不存在**这两个角色。
> 当前所有 admin 都是同一权限级别,无 super_admin 区分(后续 P2+ 加 `super_admin` 角色区分)。
>
> **历史说明**:
> - `user` → 重命名为 `student`(更符合教育场景)
> - `super_admin` → 暂未实现,所有 admin 平等

### 1.1 创建 admin

当前无 UI,需直接改 DB:

```bash
# TODO: AdminUsersPage 加 "变更角色" 下拉(P2+ 才有 UI)
UPDATE users SET role = 'admin' WHERE email = '<email>';
```

### 1.2 权限边界

| 模块 | student | instructor | admin |
|------|:-------:|:----------:|:-----:|
| 前台学习 | ✓ | ✓ | ✓ |
| 自有课程管理 | ✗ | ✓ (P2+) | ✓ |
| 后台 /admin/* | ✗ | ✗ | ✓ |
| 修改平台配置 | ✗ | ✗ | ✗ (P2+ 加 super_admin 才放开) |

---

## 2. 进入后台

### 2.1 入口

- 直接访问:`/admin` → 自动跳 `/admin/dashboard`
- 顶部 nav:头像下拉 → 「管理后台」(需 admin+ 角色)

### 2.2 路由保护

未登录或角色不够:

- 未登录 → 重定向到 `/auth/login`
- 非 admin → 重定向到 `/` (首页)
- admin 但不是 super_admin 访问 super_admin 专属页 → 重定向到 `/admin/dashboard`

实现见 `router.tsx` 的 `ProtectedRoute` 组件 + `requireAdmin` 参数。

### 2.3 侧栏导航

`AdminLayout` 侧栏 nav,顺序按 mock 调整:

```
📊  看板       /admin/dashboard
📚  课程       /admin/courses
🎓  学位       /admin/degrees
👥  用户       /admin/users
🏆  黑客松     /admin/hackathons
🏢  企业       /admin/enterprise
🎖  徽章       /admin/badges
📜  审计日志   [即将推出]
⚙️  系统设置   [即将推出]
```

> 「即将推出」2 项目前不可点(后续 P2)。

---

## 3. 看板 (Dashboard)

`/admin/dashboard` — 后台首页,P0-8 加的 4 KPI + 4 图表。

### 3.1 4 个 KPI 卡片

- **今日 GMV**(含较昨日 ↑↓,单位 CNY)
- **新增用户**(今日注册数 + 付费转化率)
- **活跃学员 (DAU)**(今日活跃 + 平均学习时长)
- **AI token 成本**(当月 + 预算占比)

### 3.2 4 个图表

- **用户增长趋势**(折线图,30 天)
- **课程报名 Top 10**(柱状图)
- **收入构成**(饼图,按课程类型 free/paid/charity)
- **学位完成率**(漏斗图,注册 → 开始 → 完成)

### 3.3 待办

管理员可快速处理:
- 待审草稿课程(从 URL 导入的)
- 待回复企业咨询
- 黑客松待发布

### 3.4 系统状态

- API 状态
- 数据库连接
- Redis 状态
- 最近一次部署时间

> ⚠️ **当前版本**:P0-8 看板数据为 mock,接 `/api/v1/admin/stats` 待实现。

---

## 4. 课程管理

`/admin/courses` — 课程列表 + 编辑,后台最复杂模块。

### 4.1 列表模式

默认 `/admin/courses` 显示课程表格:

| 列 | 说明 |
|----|------|
| 封面缩略图 | 80×60 |
| 标题 | 搜索关键词高亮 |
| 讲师 | 头像 + 名字 |
| 难度 | chip (Beginner/Intermediate/Advanced/Expert) |
| 收费 | chip (免费/付费/公益) |
| 状态 | chip (草稿/已发布/已下架) |
| 报名数 | 整数 |
| 评分 | ★ + 数字 |
| 创建时间 | 相对时间 |
| 操作 | 编辑 / 上下架 / 复制 / 删除 |

**搜索**:标题 / 讲师名 模糊匹配,300ms debounce。

**筛选**:状态 / 难度 / 收费 / 创建时间区间。

**批量操作**(多选后):批量发布 / 批量下架 / 批量删除(二次确认)。

### 4.2 新建课程

点 **「+ 新建课程」** → 跳编辑模式 `?tab=info` → 见 §4.3 5 tab。

### 4.3 编辑模式 5 tab

`/admin/courses?tab=...&id=<id>` 路由,5 tab 切换:

#### Tab 1:info — 基本信息

- 标题
- 副标题
- 讲师(下拉选已有,或输入新讲师邮箱邀请)
- 难度(4 选 1)
- 时长(hh:mm)
- 标签(可多选 + 自定义)
- 试看链接(YouTube / Bilibili 嵌入 URL)
- 封面图(上传 / 粘贴 URL)

#### Tab 2:chapters — 章节大纲

左侧 **Chapter → Lesson** 树:
- 增 / 删 / 拖拽排序
- 每个 chapter 下挂 lesson
- 每个 lesson 有:标题 / 时长 / 视频 URL / 试看开关

中间 **编辑器**:选中 lesson 后编辑
右侧 **字段面板**:lesson 元数据(视频 URL、描述/笔记、试看、**附加资源**)

**附加资源段(v1.3.0)**: 选中具体课时 → 右侧面板「附加资源」段
- 5 种类型:PDF / 代码 / 链接 / 视频 / 音频
- 每条资源:标题 + 类型 + URL + 锁/公开(默认锁 = 报名后下载)
- 增 / 删 / 打开新窗口
- 后端: `GET/POST /api/v1/lessons/:lessonId/resources` + `PATCH/DELETE /api/v1/resources/:id`

> v1.3.0 整合:章节树一次拉取返回 lesson.resources(无需单独 query)。

#### Tab 3:pricing — 价格(原 Tab 4)

3 选 1 radio card:免费 / 买断 / 订阅,接 PATCH `/api/v1/courses/:id`。

#### Tab 4:publish — 发布(原 Tab 5)

- 状态 switch:草稿 ↔ 已发布 ↔ 已下架
- 发布时间 picker(可预设未来自动发布)
- 接 PATCH `/api/v1/courses/:id` (status 字段)

### 4.4 从 URL 导入

> P1 阶段新增的 AI 加速功能。

`/admin/courses?tab=info` 顶部点 **「从 URL 导入」**:

**支持的 URL**:
- YouTube:`https://www.youtube.com/watch?v=xxx`
- YouTube short:`https://www.youtube.com/shorts/xxx`
- YouTube 短链:`https://youtu.be/xxx`
- Bilibili:`https://www.bilibili.com/video/BVxxxxxxxxxx`
- Bilibili:`https://www.bilibili.com/video/avxxxxxx`
- B 站短链:`https://b23.tv/xxx`

**行为**:
1. 系统抓取视频元数据(标题 / 作者 / 封面)
2. **Gemini AI** 自动补全:描述 / 学习要点(5 条) / 难度 / 时长 / 标签 / 价格
3. 自动去重:同一视频二次导入提示「该视频已导入过」
4. 草稿状态:`status=draft`,不会出现在前台
5. **8 秒超时**,抓取失败自动重试 1 次

**批量导入**:一次最多 20 条 URL(每行一条),结果分类:
- `created`:新草稿
- `duplicate`:已导入过
- `failed`:抓取失败(含原因)

**SSRF 防护**:
- 后端不直接转发用户 URL
- 只解析已知平台的 host
- 只调用硬编码的上游 API(`www.youtube.com/oembed`、`api.bilibili.com`)

### 4.5 发布流程

```
新建 / 编辑
    ↓
保存草稿(自动)
    ↓
预览(只对 admin 可见,前台 404)
    ↓
切到 publish tab → 「发布」
    ↓
状态 → published
    ↓
前台可见(课程列表 / 搜索)
```

### 4.6 删除

- 软删除:从列表隐藏,数据库保留
- 硬删除:从数据库彻底删除(需 super_admin + 二次确认)
- **注意**:已有人报名的课程**不能硬删**,会先弹警告

---

## 5. 学位管理

`/admin/degrees` — 学位 CRUD。

### 5.1 列表

表格列:
- 学位图标(emoji)
- 标题
- 描述(单行省略)
- 课程数 / 预估学时
- 价格
- 在学人数
- 完成数(历史累计)
- 状态
- 操作

### 5.2 创建学位

- 标题
- 描述
- 图标(emoji 选择器)
- 选课程(从已有课程池多选,会按选择顺序生成学习路径)
- 价格
- 状态(草稿 / 发布)

### 5.3 编辑学位

`/admin/degrees/:id` 编辑模式:

- 基本信息(同创建)
- **学习路径 stage**:可调整课程顺序、增删 stage
- **Capstone 要求**:markdown 编辑器,描述需提交的作品
- **毕业条件**:除了课程完成 + capstone 提交,可选加「最低平均分」

### 5.4 学位与课程的关系

- 学位是「**学习路径元数据**」,不复制课程内容
- 学员报名学位后,需**单独报名每门课**(免费课直接开,付费课要单独买)
- 完成全部课程 + capstone → 颁发学位证书

### 5.5 注意事项

- 改学位的课程列表,不影响已报名的学员(他们按报名时的快照)
- 删除学位**不删除关联课程**(课程独立存在)
- 已有学员的学位**不能删除**,只能下架

---

## 6. 用户管理

`/admin/users` — 用户列表 + 详情。

### 6.1 列表

表格列:
- 头像
- 邮箱
- 昵称
- 角色(user / admin / super_admin)
- 注册时间
- 最后登录
- 学习时长(累计)
- 订单数 / 证书数
- 操作(查看详情 / 改角色 / 封号)

**搜索**:邮箱 / 昵称模糊匹配。

**筛选**:角色 / 注册时间区间 / 是否封禁。

### 6.2 用户详情

点行「详情」按钮 → 右侧抽屉弹出(`Drawer` 组件,480px 宽,ESC / 遮罩 / X 关闭)。7 个 section:

- **基本信息**:用户 ID / 角色 chip / 注册时间 / 最后登录 / 当前积分+等级 / 是否需重置密码
- **学习概况**:6 个统计盒(报名数 / 订单 / 证书 / 进度记录 / 作品 / 积分)+ 最近 10 笔报名列表
- **订单**:最近 10 笔(订单号 / 类型 / 金额 / 状态 chip)
- **证书**:最近 10 张(标题 / 编号 / 颁发日期)
- **积分**:当前积分 + 最近 10 笔流水(delta 正负色)
- **授权课程**:点按钮展开输入,逗号分隔课程 ID,批量授权
- **活动日志**:Phase 2+ 接 audit-log 读 API

后端 `GET /api/v1/users/:id` 已扩展,一次返回 enrollments / orders / certificates / pointTransactions / _count 全部数据(避免 N+1)。

### 6.3 修改角色

抽屉内「角色」下拉,所有 admin 可见(无 super_admin 区分)。可选:
- `student`(学员)
- `instructor`(讲师)
- `admin`(运营)

切换通过 `PATCH /api/v1/users/:id { role }`,**不立即踢出该用户的会话**(refresh token 仍有效,只有重新登录或手动 logout 才失效)。如需强制踢,可在「重置密码」后让用户下次登录。

### 6.4 封号

> ⚠️ **Phase 2+ 实现**(schema 暂不支持 `banned` 字段)。当前抽屉显示「封号功能 Phase 2+」提示。
> 临时方案:用「修改角色」把用户降为 `student` 限制后台访问,或「重置密码」强制其改密。

### 6.5 手动授权课程

抽屉「授权课程」section:
- 点「授权新课程」按钮 → 展开输入框
- 输入课程 ID(逗号分隔,批量)
- 「确认授权」→ `POST /api/v1/users/:id/grant-course` → 写入 enrollments 表 → 用户立即可学
- 失败:用户已是 admin 报「Email already registered」类冲突

> 用于客服补偿(用户付款失败但已扣款)或合作方免费送课。

### 6.6 重置密码

抽屉顶部「重置密码」按钮:
- 自动生成 16 位临时密码(crypto.getRandomValues)
- 调 `PATCH /api/v1/users/:id { passwordResetRequired: true, password: temp }`
- toast 显示「临时密码:xxxx(请复制告知用户,刷新页面后消失)」15 秒
- 用户下次登录会强制改密码

### 6.7 删除用户

- 软删除:封号 + 隐藏(可恢复)
- 硬删除:彻底删(需 super_admin + 二次确认 + 输「确认删除」)
- **注意**:硬删会**联动删除**所有 enrollments / orders / certificates(数据脱敏保留 90 天审计)

---

## 7. 黑客松管理

`/admin/hackathons` — 黑客松 CRUD + 评审。

### 7.1 列表

表格列:
- 封面缩略图
- 标题
- 状态(upcoming / active / judging / finished)
- 时间区间
- 参赛队伍数
- 作品数
- 奖金池
- 操作

### 7.2 创建黑客松

- 基本信息:标题 / 描述 / 封面 / 规则(markdown)
- 时间:报名开始 / 报名截止 / 比赛开始 / 比赛结束 / 评审截止
- 队伍:min / max 人数
- 地点:线上 / 线下(线下需填详细地址)
- 奖品:分级奖金 + 赞助商奖品(JSON 数组)
- 评审标准:多维度 + 权重

### 7.3 状态机

```
draft → upcoming(报名中) → active(进行中) → judging(评审中) → finished(已结束)
                                  ↓
                              cancelled(取消,可从任何状态)
```

- 状态切换有定时器(到时间自动切)
- 也可手动强制切换(立即生效)

### 7.4 评审

`/admin/hackathons/:id/judging` — 评审模式:

- 左侧:参赛作品列表(按提交时间倒序)
- 中间:作品详情(仓库 / 演示 / 视频 / 描述)
- 右侧:评分表(各维度 0-100 分 + 评语)

评审进度:
- 未评分 / 已评分 / 锁分
- 多人评审取平均 / 加权(取决于比赛配置)

### 7.5 公布结果

`/admin/hackathons/:id/results`:

- 排名(按总分)
- 颁发证书:
  - 冠军 / 亚军 / 季军 → 「黑客松证书-金/银/铜」
  - 参与奖 → 「黑客松证书-参与」
- 公布方式:站内公告 + 邮件 + (可选)公众号推送

---

## 8. 徽章管理

`/admin/badges` — 徽章 CRUD。

### 8.1 列表

- 徽章图标
- 名称
- 描述
- 解锁条件(规则表达式)
- 已解锁人数
- 状态
- 操作

### 8.2 徽章类型

- **课程徽章**:绑定特定课程,完成课程解锁
- **学位徽章**:绑定特定学位,完成解锁
- **黑客松徽章**:绑定特定黑客松,完赛/获奖解锁
- **成就徽章**:基于条件(连续学习 N 天 / 累计 X 积分 / 解锁 5 门课等)

### 8.3 解锁条件(规则 DSL)— v1.1.0 升级

**两种模式**:
- **简单模式**:`criteriaType` + `criteriaValue`(单条件,默认值 = 1)
- **嵌套模式**:`criteriaJson` JSON 字段(AND / OR / NOT 组合,优先级高)

**嵌套规则 shape**:

```json
{
  "op": "and",
  "rules": [
    { "type": "lessons_completed", "value": 3 },
    {
      "op": "or",
      "rules": [
        { "type": "streak_days", "value": 7 },
        { "type": "points_reached", "value": 100 }
      ]
    }
  ]
}
```

**叶子节点**:`{ type: BadgeCriteriaType, value?: number }`(`value` 缺省 = 1)

**支持的规则类型**:
- `course_completed` — 累计完成 N 门课
- `lessons_completed` — 累计完成 N 课时
- `streak_days` — 连续学习 N 天
- `first_enrollment` — 首次报名(任何课程)
- `practice_completed` — 完成 N 次实践项目
- `points_reached` — 积分 ≥ N

**组合操作符**:
- `and` — 所有子规则都通过
- `or` — 任一子规则通过
- `not` — 所有子规则都不通过

**评估函数**:`BadgesService.evaluateCriteria(criteriaJson, userStats)`
返回 `{ passed, current, target }`,给徽章墙进度条用。

**UI 编辑**:在 `AdminBadgesPage` 表单顶部开启「高级 · 嵌套条件 DSL」开关,出现 RuleBuilder 树状编辑器
(组合 / 叶子互转、加/删子规则、深度缩进)。

### 8.4 创建徽章

- 图标(上传 PNG / SVG,推荐 200×200)
- 名称 / 描述
- 规则 DSL(可点「测试」按钮验证规则)
- 解锁时积分奖励
- 状态(草稿 / 启用)

---

## 9. 企业咨询 (Enterprise Inquiries)

`/admin/enterprise` — 企业培训咨询表的管理后台。

### 9.1 列表

- 提交时间
- 公司名
- 联系人 / 职位
- 团队规模
- 培训主题(multi-select)
- 联系方式
- 状态(新提交 / 已联系 / 已报价 / 已成交 / 已放弃)
- 操作

### 9.2 处理流程

```
新提交(自动)
    ↓
BD 认领 → 状态「已联系」
    ↓
需求沟通(邮件/电话) → 状态「已报价」
    ↓
签约 → 状态「已成交」
    ↓
    或 拒绝 → 状态「已放弃」(填原因)
```

### 9.3 详情

每条咨询可看:
- 完整表单内容
- 联系历史(沟通记录,BD 手动添加)
- 内部备注(仅 admin 可见)
- 关联订单(签约后,自动建一个 enterprise 订单)

### 9.4 统计

- 本月新咨询数
- 转化率(咨询 → 签约)
- 平均成交周期
- Top 行业

---

## 10. 评价管理(Admin Reviews)— v1.1.0 新增

入口:`/admin/reviews` · API:`GET /api/v1/reviews` / `DELETE /api/v1/reviews/:id`

**功能**:
- 全站评价列表,4 维过滤(评分 / courseId / 仅已删 / 时间)
- 一键软删(合规留痕:content → `[已删除]`, userId 保留审计)
- 评分分布(1-5 星)、helpful 数、用户/课程上下文

**典型场景**:
- 用户投诉某评价违规 → 在「仅显示已删」tab 关闭前先核对 → 软删
- 找出全站 1 星评价 → 按 rating=1 过滤 → 排查问题

---

## 11. 审计日志(Audit Logs)— v1.1.0 新增

入口:`/admin/audit` · API:`GET /api/v1/audit-logs`

**功能**:
- 4 tab 过滤:全部 / 订单(`entity=Order`) / 评价(`entity=Review`) / 课程(`entity=Course`)
- 按 userId / action 关键字过滤
- 分页(默认 20 / 页)
- details 字段以 JSON 展示

**典型场景**:
- 用户反馈订单异常 → audit tab 选「订单」,输入 userId,查 `order.create` / `order.refund` 流
- 找出最近所有 `chapter.reorder` 操作(action 关键字过滤)

> 后端 `AuditLogService.log()` 已在所有 admin 写操作埋点(course / chapter / lesson / review / order)。

---

## 12. 系统设置(规划中)

> 占位。Phase 2+ 上线,仅 super_admin 可见。

预计功能:
- 平台名称 / Logo / 主题色
- 邮件模板(SES 配置)
- 支付通道配置(Stripe / 支付宝 / 微信)
- 第三方 OAuth 凭据
- 限流阈值
- 维护模式开关

---

## 13. 审核工作流

### 13.1 课程审核(草稿 → 发布)

1. 草稿创建(从 URL 导入 / 手动)
2. admin 填写完整信息
3. admin 自审(看预览,跑一遍流程)
4. 点「提交审核」→ 状态 `pending_review`
5. super_admin 或指定 reviewer 审核
6. 审核通过 → 状态 `published`,前台可见
7. 审核拒绝 → 状态 `draft` + 拒因注释

> 当前版本:无显式 pending_review 状态,admin 自审通过后直接 publish。

### 13.2 评论 / 评价审核

(规划中)用户提交课程评价后,先进 pending 状态,admin 审核通过才公开。

### 13.3 黑客松作品审核

(规划中)参赛团队提交作品后,需 admin 确认格式合规才进入评审。

---

## 14. 数据导入 / 导出

### 14.1 导出

`/admin/users` 顶部「导出」:
- CSV:用户表
- JSON:含学习行为 / 订单(完整数据)

`/admin/orders` 顶部「导出」:
- CSV:订单表
- 财务对账用

### 14.2 批量导入

- 用户:CSV 格式(邮箱 / 昵称 / 角色),可批量授权课程
- 课程:暂无批量导入(从 URL 导入见 §4.4)

### 14.3 数据备份

(运维侧,不在后台)每日 MySQL 全量备份 + 异地存储,保留 30 天。

---

## 15. 常见任务清单

### 15.1 我是新人 admin,今天该做什么?

1. 看 `/admin/dashboard` 看板,了解平台状态
2. 检查「待审草稿」处理 P1 阶段从 URL 导入的课程
3. 检查「企业咨询」回复新提交
4. 检查「黑客松」状态,确认时间正常推进
5. 查「用户」异常账号(被举报 / 异常登录)

### 15.2 用户反馈「证书没拿到」

1. `/admin/users` 搜用户邮箱
2. 进用户详情,看 enrollments 表
3. 确认该用户所有课时 `progress = 100%`
4. 看「证书」tab,有证书 → 让用户重试;无证书 → 看订单 / 课程状态
5. 若课程状态正常但证书未签发 → 手动 `INSERT INTO certificates ...`(临时方案,Phase 2+ 上 UI 按钮)

### 15.3 用户反馈「付款成功但课程没开通」

1. `/admin/orders` 搜订单号 / 邮箱
2. 看订单状态:`paid` 但无 enrollment → 手动补:
   ```bash
   # TODO: admin 端 UI 按钮
   # 直接 DB 补(临时)
   INSERT INTO enrollments (user_id, course_id, created_at) VALUES (...);
   ```
3. 通知用户已开通

### 15.4 黑客松时间要改

1. `/admin/hackathons/:id/edit`
2. 改时间 → 强制重新发通知给已报名团队
3. 站内公告 + 邮件

### 15.5 撤下违规课程

1. `/admin/courses/:id/edit`
2. publish tab → 状态切「下架」
3. 写撤下原因(用户可见)
4. 已报名学员不退款,但保留学习访问(直到课程正常结束)
5. 通知学员邮件

### 15.6 给某用户手动开通学位

(Phase 2+ 会有 UI 按钮)临时方案:
1. `/admin/users/:id` 抽屉
2. 「授权」选学位 + 过期时间
3. 系统写入 `enrollments` 表 + 颁发学位证书

### 15.7 删一条评价

1. `/admin/courses/:id/reviews` (Phase 2+)
2. 选违规评价 → 删
3. 写删因 + 通知用户

---

## 附录:安全 checklist

- [ ] 每周检查 admin 列表,清退离职人员
- [ ] 每月 review 审计日志(P2 上线后)
- [ ] 不在前端 bundle 写 GEMINI_API_KEY / STRIPE_SECRET_KEY
- [ ] 操作前看 URL 二次确认
- [ ] 删数据前先备份(联系 super_admin)
- [ ] 客服场景避免直接「重置密码」,引导用户自助

---

**文档版本**:v1.0 · 2026-07-19
**对应 commit**:ad5a9d2
