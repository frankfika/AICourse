# AI Academy

AI Academy 是一个现代化的在线教育平台，专注于 AI 和大模型技术培训。

## 产品功能

### 🎓 课程学习
- **单独课程**：独立的技术课程，支持视频播放（YouTube、Bilibili、本地）
- **Nano Degree 学位**：体系化学习路径，包含多门课程的学位套餐
- **课程类型**：免费课程 / 公益项目 / 专业版付费
- **学习资源**：支持 PDF、代码、外链等资源下载

### 🤖 AI 智能助教
- 基于 Google Gemini 的课程专属 AI 助手
- 上下文对话记忆，友好的中文交互
- 用简单易懂的方式解释复杂概念

### 👤 用户系统
- 登录 / 注册功能
- 角色区分（管理员 / 学员）
- 免费课程即时学习
- 付费课程购买流程

### ⚙️ 管理后台
登录管理员账号后，右上角出现「管理后台」入口：
- **课程管理**：新增、编辑、删除课程，上传封面图片
- **学位管理**：新增、编辑、删除学位，关联课程
- **用户权限**：按邮箱授权课程/学位访问权限

---

## 技术架构

| 层面 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite |
| 样式方案 | Tailwind CSS |
| 数据库 | Supabase (PostgreSQL) |
| AI 能力 | Google Gemini AI |

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置数据库

项目使用 Supabase 作为数据库。首次部署需要：

1. 创建 [Supabase](https://supabase.com) 项目
2. 在 SQL Editor 中执行 `supabase/schema.sql` 初始化表结构
3. 修改 `lib/supabase.ts` 中的连接配置

### 3. 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:3000
```

### 4. 构建生产版本

```bash
npm run build
# 产物在 dist/ 目录
```

---

## 测试账号

| 角色 | 邮箱 | 密码 | 说明 |
|------|------|------|------|
| 管理员 | admin\@ai-academy.local | admin123 | 可访问管理后台 |
| 学员 | 自行注册 | 自定义 | 普通学员账号 |

---

## 文档索引

| 文档 | 用途 | 适用人员 |
|------|------|---------|
| [部署指南](./docs/部署指南.md) | 如何部署到服务器（Nginx/Docker/Vercel）、HTTPS配置、数据库配置 | **运维 / 后端** |
| [系统对接文档](./docs/系统对接文档.md) | 如何对接主站用户系统（SSO）、支付系统、API设计 | **后端开发** |
| [课程信息收集模板](./docs/课程信息收集模板.md) | 新增课程/学位时需要填写的信息模板 | **内容运营** |
| [GitLab部署需求](./docs/gitlab部署需求.md) | 提交给研发部门的部署需求文档 | **项目经理** |

---

## 项目结构

```
├── App.tsx                 # 主应用（页面 + 逻辑）
├── lib/
│   ├── supabase.ts         # Supabase 配置
│   └── database.ts         # 数据库操作封装
├── components/
│   ├── Components.tsx      # 通用 UI 组件
│   └── AiTutor.tsx         # AI 助教组件
├── services/
│   └── geminiService.ts    # Gemini AI 服务
├── supabase/
│   └── schema.sql          # 数据库表结构
├── docs/                   # 项目文档
└── public/                 # 静态资源
```

---

## License

MIT
