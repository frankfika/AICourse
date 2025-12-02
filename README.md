# OpenCSG Academy

OpenCSG Academy 是一个现代化的在线教育平台，专注于 AI 和大模型技术培训，集成 AI 智能助教功能。

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite
- **样式方案**: Tailwind CSS (CDN)
- **图标库**: Lucide React
- **AI 能力**: Google Gemini AI (gemini-2.5-flash)

## 功能特性

### 课程系统
- 单独课程浏览与详情展示
- Nano Degree 职业学位路径（课程集合）
- 多种课程类型：免费 / 公益项目 / 专业版付费
- 课程资源下载（PDF、代码、外链）
- 视频播放（支持 YouTube、Bilibili、本地视频）
- 课程封面图片上传

### Nano Degree 学位系统
- 体系化学习路径
- 包含多门课程的学位套餐
- 学位封面图片支持
- 自动计算总课程时长

### AI 智能助教
- 基于 Google Gemini 的课程专属 AI 助手
- 上下文对话记忆
- 友好的中文交互体验
- 用简单易懂的方式解释复杂概念

### 用户系统
- 登录 / 注册功能
- 角色区分（管理员 / 学员）
- 课程权限管理
- 学位权限管理
- 免费课程注册学习
- 付费课程购买流程

### 管理后台
- 课程 CRUD 管理
- 学位 CRUD 管理
- 用户权限分配
- 课程/学位权限授权

### 其他
- 黑客松活动页面（Coming Soon）
- 联系我们弹窗（微信二维码）
- 响应式设计
- 现代化 UI 交互动效

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env.local` 文件：

```env
# Gemini AI API Key（可选，用于 AI 助教功能）
API_KEY=your_gemini_api_key_here
```

### 启动开发服务器

```bash
npm run dev
```

默认访问地址：http://localhost:3000

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 预览生产版本

```bash
npm run preview
```

## 项目结构

```
├── App.tsx                 # 主应用组件（包含所有页面和逻辑）
├── index.tsx               # 入口文件
├── index.html              # HTML 模板
├── types.ts                # TypeScript 类型定义
├── components/
│   ├── Components.tsx      # 通用 UI 组件 (Button, Card, Badge)
│   └── AiTutor.tsx         # AI 助教聊天组件
├── services/
│   └── geminiService.ts    # Gemini AI 服务封装
├── public/
│   └── wechat-qr.jpg       # 微信联系二维码
├── docs/
│   ├── 课程信息收集模板.md    # 课程信息收集文档
│   ├── 部署指南.md           # 部署文档
│   └── 系统对接文档.md        # 支付和用户系统对接文档
└── vite.config.ts          # Vite 配置
```

## 测试账号

| 角色 | 邮箱 | 密码 | 说明 |
|------|------|------|------|
| 管理员 | admin@opencsg.com | 任意 | 可访问管理后台 |
| 学员 | 自行注册 | 自定义 | 普通学员账号 |

## 数据存储

当前版本使用 localStorage 进行数据持久化，适用于演示和小规模使用。生产环境建议对接后端数据库。

存储键名：
- `opencsg_users` - 用户数据
- `opencsg_courses` - 课程数据
- `opencsg_degrees` - 学位数据

## 文档

所有文档位于 `docs/` 目录：

| 文档 | 说明 | 适用人员 |
|------|------|---------|
| [部署指南](./docs/部署指南.md) | Nginx/Docker/云平台部署、HTTPS配置、CI/CD | 运维工程师 |
| [系统对接文档](./docs/系统对接文档.md) | 用户系统、支付系统 API 对接、SSO 集成 | 后端开发 |
| [课程信息收集模板](./docs/课程信息收集模板.md) | 课程和学位信息填写模板 | 内容运营 |

## License

MIT
