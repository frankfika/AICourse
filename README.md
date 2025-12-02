# Nexus Academy

一个现代化的在线教育平台，集成 AI 智能助教功能。

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite
- **样式方案**: Tailwind CSS
- **图标库**: Lucide React
- **AI 能力**: Google Gemini AI (gemini-2.5-flash)

## 功能特性

### 课程系统
- 单独课程浏览与详情展示
- Nano Degree 职业学位路径（课程集合）
- 多种课程类型：免费 / 公益项目 / 专业版付费
- 课程资源下载（PDF、代码、外链）
- 视频播放（支持 YouTube 嵌入）

### AI 智能助教
- 基于 Google Gemini 的课程专属 AI 助手
- 上下文对话记忆
- 友好的中文交互体验
- 用简单易懂的方式解释复杂概念

### 用户系统
- 登录 / 注册功能
- 角色区分（管理员 / 学员）
- 课程权限管理
- 管理后台（用户权限分配）

### 其他
- 黑客松活动页面
- 响应式设计
- 现代化 UI 交互动效

## 快速开始

### 环境要求

- Node.js 18+

### 安装依赖

```bash
npm install
```

### 配置环境变量

在 `.env.local` 文件中设置你的 Gemini API Key：

```
GEMINI_API_KEY=your_api_key_here
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
├── App.tsx                 # 主应用组件
├── index.tsx               # 入口文件
├── index.html              # HTML 模板
├── types.ts                # TypeScript 类型定义
├── components/
│   ├── Components.tsx      # 通用 UI 组件 (Button, Card, Badge)
│   └── AiTutor.tsx         # AI 助教聊天组件
├── services/
│   └── geminiService.ts    # Gemini AI 服务封装
└── vite.config.ts          # Vite 配置
```

## 测试账号

| 角色 | 邮箱 | 说明 |
|------|------|------|
| 管理员 | admin@nexus.com | 可访问管理后台 |
| 学员 | student@test.com | 普通学员账号 |

## License

MIT
