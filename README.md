# 🎓 OpenCSG AI学院

<div align="center">

**一个现代化的AI课程管理和学习平台**

[![Next.js](https://img.shields.io/badge/Next.js-15.5.6-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://vercel.com)

[🌐 在线演示](https://opencsg-ai-academy-4uj36br7t-franks-projects-a4189b1b.vercel.app) · [📖 使用文档](#-快速开始) · [🐛 反馈问题](https://github.com/frankfika/AICourse/issues)

![OpenCSG AI Academy](https://img.shields.io/badge/OpenCSG-AI%20Academy-10B981?style=for-the-badge)

</div>

---

## 📖 目录

- [✨ 核心特性](#-核心特性)
- [🛠️ 技术栈](#️-技术栈)
- [📦 快速开始](#-快速开始)
- [📁 项目结构](#-项目结构)
- [🚀 部署指南](#-部署指南)
- [🎯 功能详解](#-功能详解)
- [🔧 常用命令](#-常用命令)
- [🔒 安全性](#-安全性)
- [🤝 贡献指南](#-贡献指南)

---

## ✨ 核心特性

### 🎓 学习者功能

- **🏠 现代化首页**
  - 响应式Banner轮播
  - 课程分类导航
  - 精选课程/项目展示
  - 简洁优雅的绿色主题设计

- **📚 完整课程系统**
  - 课程列表与详情页面
  - 高级筛选和搜索
  - **"即将开始"功能**（开课日期 + 邮箱订阅）
  - 学习进度追踪
  - 章节视频播放
  - 课程评价和FAQ

- **🎖️ 认证项目（Nano Degree）**
  - 完整学习路径
  - 课程组合展示
  - 证书颁发系统
  - 进度统计

- **👤 用户中心**
  - 注册/登录
  - 我的课程
  - 我的订单
  - 我的证书
  - 个人资料管理

- **📱 响应式设计**
  - 完美适配桌面、平板、移动端
  - 流畅的动画和交互

### ⚙️ 管理员功能

- **📊 数据仪表盘**
  - 实时统计数据
  - 热门课程展示
  - 用户活跃度分析

- **📝 内容管理**
  - **课程管理**: CRUD、章节管理、FAQ、开课日期设置
  - **Nano Degree管理**: 课程组合、证书配置、完成标准
  - **讲师管理**: 讲师资料、社交链接
  - **分类管理**: 分类排序、课程数量统计
  - **Banner管理**: 轮播图、链接、显示控制

- **📧 等待列表管理**
  - 查看课程预约邮箱
  - 导出订阅数据
  - 通知管理

- **🔐 安全认证**
  - Session基础的管理员系统
  - 密码加密存储
  - 权限验证

### 🎨 设计亮点

- 🎨 现代化绿色主题，AI风格设计
- ✨ 流畅的过渡动画和悬停效果
- 🎯 清晰的视觉层次和信息架构
- 🛡️ 全局错误处理和错误边界
- 🔧 开发工具（慢渲染检测、控制台过滤）

---

## 🛠️ 技术栈

<div align="center">

| 类别 | 技术 |
|------|------|
| **核心框架** | Next.js 15.5.6 (App Router) + React 18.3 + TypeScript 5.4 |
| **样式** | Tailwind CSS 3.4 + Shadcn/UI + Lucide Icons |
| **数据库** | PostgreSQL (Neon) / SQLite (本地开发) |
| **ORM** | Prisma 5.22 |
| **认证** | iron-session + bcryptjs |
| **表单** | React Hook Form + Zod |
| **部署** | Vercel (自动化CI/CD) |

</div>

---

## 📦 快速开始

### 环境要求

- Node.js 18.x 或更高版本
- npm / pnpm / yarn
- Git

### 本地开发

#### 1️⃣ 克隆项目

```bash
git clone https://github.com/frankfika/AICourse.git
cd CourseAI
```

#### 2️⃣ 安装依赖

```bash
npm install
```

#### 3️⃣ 配置环境变量

创建 `.env` 文件：

```env
# 数据库配置（开发环境使用SQLite）
DATABASE_URL="file:./prisma/dev.db"

# 会话密钥（至少32字符，请修改为随机字符串）
SESSION_SECRET="your-super-secret-key-change-this-in-production-32chars"

# 可选配置
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

> 💡 **提示**: 生成安全的SESSION_SECRET：`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

#### 4️⃣ 初始化数据库

```bash
# 推送数据库schema到SQLite
npx prisma db push

# 填充示例数据（包含管理员账号）
npm run db:seed
```

#### 5️⃣ 启动开发服务器

```bash
npm run dev
```

访问 **[http://localhost:3000](http://localhost:3000)** 查看网站 🎉

#### 6️⃣ 访问管理后台

- 地址: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- 用户名: `admin`
- 密码: `admin123`

> ⚠️ **重要**: 生产环境请立即修改默认密码！

---

## 📁 项目结构

```
CourseAI/
├── 📂 app/                      # Next.js App Router
│   ├── (auth)/                  # 用户认证页面组
│   │   ├── login/               # 登录页
│   │   └── register/            # 注册页
│   ├── admin/                   # 🔐 管理后台
│   │   ├── banners/             # Banner管理
│   │   ├── categories/          # 分类管理
│   │   ├── courses/             # 课程管理
│   │   ├── instructors/         # 讲师管理
│   │   ├── nano-degrees/        # Nano Degree管理
│   │   ├── login/               # 管理员登录
│   │   └── page.tsx             # 仪表盘
│   ├── api/                     # API路由
│   │   ├── admin/               # 后台API
│   │   ├── auth/                # 认证API
│   │   ├── courses/             # 课程API
│   │   ├── nano-degrees/        # 项目API
│   │   └── orders/              # 订单API
│   ├── courses/                 # 课程前台
│   │   ├── [slug]/              # 课程详情
│   │   └── page.tsx             # 课程列表
│   ├── nano-degrees/            # 认证项目前台
│   ├── learn/[slug]/            # 📚 学习页面
│   ├── my-courses/              # 我的课程
│   ├── my-orders/               # 我的订单
│   ├── my-certificates/         # 我的证书
│   └── page.tsx                 # 🏠 首页
├── 📂 components/               # React组件
│   ├── ui/                      # 基础UI组件
│   ├── layout/                  # 布局组件
│   ├── home/                    # 首页组件
│   ├── courses/                 # 课程组件
│   ├── admin/                   # 后台组件
│   ├── error-boundary.tsx       # 错误边界
│   └── providers.tsx            # 全局Provider
├── 📂 lib/                      # 工具库
│   ├── auth.ts                  # 管理员认证
│   ├── user-auth.ts             # 用户认证
│   ├── db.ts                    # Prisma Client
│   ├── password.ts              # 密码加密
│   ├── error-filter.ts          # 错误过滤
│   ├── dev-tools.ts             # 开发工具
│   └── utils.ts                 # 通用工具
├── 📂 prisma/                   # 数据库
│   ├── schema.prisma            # 数据模型
│   ├── seed.ts                  # 数据填充脚本
│   └── dev.db                   # SQLite数据库（本地）
├── 📂 public/images/            # 静态资源
├── 📄 DEPLOYMENT.md             # 部署文档
├── 📄 README.md                 # 项目文档
└── 📄 package.json              # 项目依赖
```

---

## 🚀 部署指南

### 快速部署到Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/frankfika/AICourse)

#### 步骤说明

1. **准备数据库**
   - 推荐使用 [Neon](https://neon.tech)（免费Serverless PostgreSQL）
   - 或使用 Vercel Postgres

2. **配置环境变量**
   - 在Vercel项目设置中添加：
     - `DATABASE_URL`: PostgreSQL连接字符串
     - `SESSION_SECRET`: 随机生成的密钥（至少32字符）

3. **初始化数据库**
   ```bash
   # 拉取Vercel环境变量
   vercel env pull .env.production
   
   # 使用生产数据库URL
   export $(cat .env.production | grep DATABASE_URL | xargs)
   
   # 推送schema
   npx prisma db push
   
   # 填充数据
   npm run db:seed
   ```

4. **部署**
   - 推送代码到GitHub main分支
   - Vercel自动构建和部署

📖 **详细部署文档**: [DEPLOYMENT.md](DEPLOYMENT.md)

### 线上演示

🌐 **生产环境**: https://opencsg-ai-academy-4uj36br7t-franks-projects-a4189b1b.vercel.app

---

## 🎯 功能详解

### 🚀 课程"即将开始"功能

为即将开课的课程提供预约和倒计时功能：

1. **后台设置**: 在课程编辑页面设置 `开课日期`
2. **前台展示**: 
   - 显示倒计时（天、时、分、秒）
   - 邮箱订阅表单
   - "即将开始"标签
3. **邮箱收集**: 自动保存到 `CourseWaitlist` 表
4. **自动解锁**: 开课日期到达后，课程内容自动解锁

### 📊 学习进度追踪

- 章节完成状态记录（`ChapterProgress`）
- 视频播放位置保存
- 课程整体完成度计算
- 个人学习数据统计

### 💳 订单和支付系统

- 订单创建和管理（`Order`模型）
- 模拟支付流程（可扩展接入真实支付）
- 支付成功自动开通课程访问
- 订单历史和状态追踪

### 🏆 证书系统

- 课程/项目完成后自动生成证书
- 唯一证书编号（`certificateNo`）
- 公开证书验证页面
- 证书查看和下载

---

## 🔧 常用命令

### 开发

```bash
npm run dev              # 启动开发服务器 (http://localhost:3000)
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # 运行ESLint检查
```

### 数据库

```bash
npm run db:push          # 推送schema到数据库（开发环境）
npm run db:seed          # 填充示例数据
npm run db:studio        # 打开Prisma Studio（数据库可视化工具）
npm run db:migrate       # 创建migration（生产环境）
```

### 部署

```bash
vercel                   # 部署到Vercel预览环境
vercel --prod            # 部署到生产环境
vercel env pull          # 拉取环境变量
```

---

## 🗄️ 数据库模型

### 核心模型

| 模型 | 说明 |
|------|------|
| `Category` | 课程分类（机器学习、深度学习等） |
| `Instructor` | 讲师信息和简介 |
| `Course` | 课程（含章节、FAQ、开课日期） |
| `Chapter` | 课程章节 |
| `CourseFAQ` | 课程常见问题 |
| `CourseWaitlist` | 课程等待列表（邮箱订阅） |
| `NanoDegree` | 认证项目 |
| `Banner` | 首页轮播图 |
| `Admin` | 管理员账号 |

### 用户相关模型

| 模型 | 说明 |
|------|------|
| `User` | 用户账号 |
| `Enrollment` | 课程注册记录 |
| `NanoDegreeEnrollment` | 项目注册记录 |
| `ChapterProgress` | 章节学习进度 |
| `Order` | 订单 |
| `Certificate` | 证书 |

查看完整数据模型：[prisma/schema.prisma](prisma/schema.prisma)

---

## 📊 示例数据

运行 `npm run db:seed` 后会自动创建：

| 类型 | 数量 | 说明 |
|------|------|------|
| 📁 课程分类 | 5 | 机器学习、深度学习、NLP、CV、强化学习 |
| 👨‍🏫 讲师 | 4 | 完整的讲师资料 |
| 📚 课程 | 7 | 每门课程含章节、FAQ、开课日期 |
| 🎖️ 认证项目 | 3 | AI工程师、深度学习专家、CV工程师 |
| 🖼️ Banner | 3 | 首页轮播图 |
| 🔐 管理员 | 1 | admin账号 |

---

## 🔒 安全性

- ✅ 密码使用 **bcrypt** 加密存储（Salt Rounds: 10）
- ✅ **Session**基础的身份验证（iron-session）
- ✅ API路由权限验证
- ✅ **SQL注入防护**（Prisma ORM参数化查询）
- ✅ **XSS防护**（React自动转义）
- ✅ 全局错误处理和过滤
- ⚠️ **生产环境请务必**：
  - 修改默认管理员密码
  - 生成强SESSION_SECRET
  - 配置HTTPS
  - 启用CORS策略

---

## 📈 性能优化

- ⚡ Next.js自动代码分割和懒加载
- 🖼️ Next.js Image组件自动图片优化（AVIF/WebP）
- 📦 Webpack配置优化
- 🛡️ 全局错误边界和错误过滤
- 🔍 开发工具（慢渲染检测、控制台过滤）
- 🗜️ Gzip压缩
- 🎯 Tree-shaking和按需导入

---

## 🧪 测试

### 运行测试

```bash
# 类型检查
npx tsc --noEmit

# 构建测试
npm run build

# 启动生产服务器测试
npm run start
```

### 测试账号

**管理员账号**:
- 用户名: `admin`
- 密码: `admin123`

---

## 🤝 贡献指南

欢迎贡献代码、提交Issue和Pull Request！

### 贡献流程

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 组件使用函数式组件 + Hooks
- 使用 Tailwind CSS utility classes
- API 路由使用 try-catch 错误处理

---

## 📄 许可证

本项目采用 **MIT** 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 👥 作者

**OpenCSG AI学院团队**

- GitHub: [@frankfika](https://github.com/frankfika)
- 项目链接: [https://github.com/frankfika/AICourse](https://github.com/frankfika/AICourse)

---

## 🙏 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React 应用框架
- [Vercel](https://vercel.com/) - 部署和托管平台
- [Prisma](https://www.prisma.io/) - 下一代 ORM
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Shadcn/UI](https://ui.shadcn.com/) - 精美UI组件
- [Neon](https://neon.tech/) - Serverless PostgreSQL
- [Lucide](https://lucide.dev/) - 图标库

---

## 📞 联系我们

- 💬 问题反馈: [GitHub Issues](https://github.com/frankfika/AICourse/issues)
- 📧 邮箱: support@opencsg-ai-academy.com
- 🌐 官网: https://opencsg-ai-academy-4uj36br7t-franks-projects-a4189b1b.vercel.app

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给它一个星标！⭐**

Made with ❤️ by OpenCSG AI学院

[![GitHub stars](https://img.shields.io/github/stars/frankfika/AICourse?style=social)](https://github.com/frankfika/AICourse/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/frankfika/AICourse?style=social)](https://github.com/frankfika/AICourse/network/members)

[🏠 返回顶部](#-opencsg-ai学院)

</div>
