# CourseAI - AI 课程学习平台

一个功能完整的 AI 课程管理和学习平台，支持课程展示、Nano Degree 认证项目，以及完善的后台管理系统。

## 🚀 项目特性

### 前台功能
- ✅ **首页**: Banner 轮播、课程分类导航、热门课程展示、Nano Degree 项目
- ✅ **课程模块**: 课程列表、详情页、分类筛选、搜索排序
- ✅ **Nano Degree**: 认证项目列表、详情页、学习路径可视化
- ✅ **响应式设计**: 完美支持桌面端和移动端

### 后台管理
- ✅ **仪表盘**: 数据统计、最近活动、热门内容
- ✅ **课程管理**: CRUD 操作、富文本编辑、章节管理、FAQ 管理
- ✅ **Nano Degree 管理**: 课程组合、证书配置、学习路径设置
- ✅ **讲师管理**: 讲师信息维护
- ✅ **分类管理**: 课程分类维护
- ✅ **Banner 管理**: 首页轮播图管理
- ✅ **认证系统**: Session 基础的管理员登录

## 🛠 技术栈

### 核心框架
- **Next.js 14** (App Router)
- **TypeScript**
- **React 18**

### 数据库 & ORM
- **SQLite** (本地数据库)
- **Prisma** (ORM)

### UI & 样式
- **Tailwind CSS**
- **Shadcn/UI** (组件库)
- **Lucide React** (图标)

### 功能库
- **React-Quill** (富文本编辑器)
- **iron-session** (会话管理)
- **bcryptjs** (密码加密)
- **date-fns** (日期处理)

## 📦 快速开始

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 2. 配置环境变量

项目根目录已有 `.env` 文件，包含以下配置：

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="courseai-secret-key-min-32-characters-long-for-security"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
MAX_FILE_SIZE=10485760
ENABLE_VIEW_COUNT=true
```

### 3. 初始化数据库

```bash
# 运行数据库迁移
npx prisma migrate dev

# 填充模拟数据（已完成）
npx tsx prisma/seed.ts
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看前台页面

### 5. 访问后台管理

访问 http://localhost:3000/admin/login

**默认管理员账号:**
- 用户名: `admin`
- 密码: `admin123`

## 📁 项目结构

```
CourseAI/
├── app/                      # Next.js App Router 目录
│   ├── (pages)/             # 前台页面组
│   │   ├── page.tsx         # 首页
│   │   ├── courses/         # 课程模块
│   │   └── nano-degrees/    # Nano Degree 模块
│   ├── admin/               # 后台管理页面
│   │   ├── login/           # 登录页
│   │   ├── page.tsx         # 仪表盘
│   │   ├── courses/         # 课程管理
│   │   ├── nano-degrees/    # Nano Degree 管理
│   │   ├── instructors/     # 讲师管理
│   │   ├── categories/      # 分类管理
│   │   ├── banners/         # Banner 管理
│   │   └── settings/        # 设置
│   ├── api/                 # API 路由
│   │   └── admin/           # 后台 API
│   ├── globals.css          # 全局样式
│   └── layout.tsx           # 根布局
├── components/              # React 组件
│   ├── ui/                  # UI 基础组件
│   ├── layout/              # 布局组件
│   ├── courses/             # 课程相关组件
│   ├── nano-degrees/        # Nano Degree 组件
│   └── admin/               # 后台组件
├── lib/                     # 工具库
│   ├── db.ts               # Prisma Client
│   ├── auth.ts             # 认证工具
│   ├── password.ts         # 密码加密
│   ├── utils.ts            # 通用工具
│   └── constants.ts        # 常量定义
├── prisma/                  # Prisma 配置
│   ├── schema.prisma       # 数据库 Schema
│   ├── seed.ts             # 数据填充脚本
│   └── dev.db              # SQLite 数据库文件
└── public/                  # 静态资源

```

## 🗄 数据库模型

### 核心模型
- **Category**: 课程分类
- **Instructor**: 讲师
- **Course**: 课程（含章节和 FAQ）
- **Chapter**: 课程章节
- **CourseFAQ**: 课程常见问题
- **NanoDegree**: Nano Degree 认证项目
- **NanoDegreeCourse**: Nano Degree 与课程关联
- **NanoDegreeFAQ**: Nano Degree 常见问题
- **Banner**: 首页轮播图
- **SiteConfig**: 网站配置
- **Admin**: 管理员

## 🎨 功能模块

### 前台功能

#### 1. 首页 (`/`)
- Banner 轮播展示
- 数据统计展示（课程数、认证数、讲师数）
- 课程分类导航
- 热门课程网格
- Nano Degree 项目展示

#### 2. 课程列表 (`/courses`)
- 搜索功能
- 分类筛选
- 难度筛选
- 排序（最新、热门、时长）
- 课程卡片展示（封面、标题、描述、讲师、时长、浏览量）

#### 3. 课程详情 (`/courses/[slug]`)
- 课程头部信息
- 5 个 Tab:
  - 课程介绍（学习目标、亮点、适合人群、先修要求）
  - 课程大纲（章节列表、时长）
  - 讲师介绍（简介、经验）
  - FAQ
  - 相关推荐（相关课程、包含的 Nano Degree）

#### 4. Nano Degree 列表 (`/nano-degrees`)
- 认证项目卡片展示
- 显示课程数量、时长、难度

#### 5. Nano Degree 详情 (`/nano-degrees/[slug]`)
- 项目头部（带证书预览）
- 5 个 Tab:
  - 项目介绍（技能、亮点、适合人群）
  - 学习路径（课程列表、顺序、可调整）
  - 证书信息（证书类型、说明、获得条件）
  - 学习建议（学习计划）
  - FAQ

### 后台功能

#### 1. 认证系统
- 登录页面（`/admin/login`）
- Session 管理
- 密码加密存储

#### 2. 仪表盘 (`/admin`)
- 统计数据卡片（课程数、Nano Degree 数、讲师数、总浏览量）
- 最新课程列表
- 热门课程排行

#### 3. 课程管理 (`/admin/courses`)
- 课程列表（表格展示）
- 创建/编辑课程
- 5 个 Tab 表单:
  - 基本信息（标题、slug、分类、讲师、难度、时长等）
  - 内容详情（富文本介绍、学习目标、亮点、先修要求）
  - 课程大纲（动态添加章节、主题）
  - FAQ（动态添加问答）
  - 设置（发布状态、热门标记）

#### 4. Nano Degree 管理 (`/admin/nano-degrees`)
- 列表展示
- 创建/编辑
- 5 个 Tab 表单:
  - 基本信息
  - 内容详情（技能、亮点、学习路径）
  - 课程选择（双栏选择、拖拽排序）
  - 证书信息
  - FAQ

#### 5. 讲师管理 (`/admin/instructors`)
- 讲师卡片展示
- 创建/编辑讲师信息
- 富文本编辑教学经验

#### 6. 分类管理 (`/admin/categories`)
- 分类列表
- 显示课程数量
- 排序管理

#### 7. Banner 管理 (`/admin/banners`)
- Banner 列表展示
- 图片预览
- 启用/禁用状态
- 排序管理

#### 8. 网站配置 (`/admin/settings`)
- 网站基本信息展示

## 📊 模拟数据

项目已通过 `seed.ts` 填充了丰富的模拟数据：

- ✅ **5 个课程分类**: 机器学习、深度学习、自然语言处理、计算机视觉、强化学习
- ✅ **4 位讲师**: 包含详细简介和经验
- ✅ **7 门课程**: 每门课程包含：
  - 完整的课程信息
  - 3-4 个章节
  - 2-3 个 FAQ
- ✅ **3 个 Nano Degree 项目**: 
  - AI 工程师认证
  - 深度学习专家认证
  - 计算机视觉工程师认证
- ✅ **3 个 Banner**: 首页轮播图
- ✅ **1 个管理员账户**: admin / admin123

## 🧪 测试状态

### 构建测试
```bash
✅ npm run build - 编译成功
✅ 类型检查 - 无错误
✅ Tailwind CSS - 正常编译
```

### 功能测试

#### 前台测试
- ✅ 首页加载正常
- ✅ 课程列表展示
- ✅ 课程详情页面
- ✅ Nano Degree 列表
- ✅ Nano Degree 详情
- ✅ 筛选和搜索功能
- ✅ 响应式布局

#### 后台测试
- ✅ 登录功能（admin/admin123）
- ✅ 仪表盘数据展示
- ✅ 课程管理（列表、创建、编辑）
- ✅ Nano Degree 管理
- ✅ 讲师管理
- ✅ 富文本编辑器集成（React-Quill）
- ✅ 表单验证
- ✅ API 响应正常

## 📝 开发说明

### 添加新课程
1. 访问 `/admin/courses/new`
2. 填写基本信息和内容详情
3. 添加课程大纲章节
4. （可选）添加 FAQ
5. 设置发布状态并保存

### 创建 Nano Degree
1. 访问 `/admin/nano-degrees/new`
2. 填写项目基本信息
3. 从左侧课程列表选择课程
4. 拖拽调整课程顺序
5. 配置证书信息
6. 保存发布

### 数据库管理
```bash
# 查看数据库
npx prisma studio

# 重置数据库
npx prisma migrate reset

# 重新填充数据
npx tsx prisma/seed.ts
```

## 🎯 下一步优化

- [ ] 添加图片上传功能
- [ ] 实现搜索高亮
- [ ] 添加分页功能
- [ ] 实现 404 和错误页面
- [ ] SEO 优化（sitemap、robots.txt）
- [ ] 添加加载状态和骨架屏
- [ ] 性能优化（图片懒加载、代码分割）
- [ ] 添加单元测试

## 📄 License

MIT

## 👨‍💻 Author

CourseAI Team

---

**🎉 项目已就绪，可以开始使用！**

访问 http://localhost:3000 开始探索！

