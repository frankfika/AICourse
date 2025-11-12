# 部署指南 - OpenCSG AI学院

## 🚀 部署概览

本项目支持本地开发和Vercel生产环境部署：
- **本地开发**: SQLite数据库（`file:./prisma/dev.db`）
- **生产环境**: PostgreSQL数据库（Neon/Vercel Postgres）

## ⚠️ 重要提示

**部署到Vercel前，需要将 `prisma/schema.prisma` 中的数据库provider从 `sqlite` 改为 `postgresql`**

## ✅ 已完成的准备工作

1. ✅ Vercel 配置文件已创建
2. ✅ 项目已推送到 GitHub
3. ✅ Vercel 项目已创建：`opencsg-ai-academy`
4. ✅ 数据库已配置（Neon PostgreSQL）

## 📝 数据库配置步骤

### 方案A：使用 Vercel Postgres（推荐，完全集成）

1. 访问 Vercel 控制台：https://vercel.com/dashboard
2. 找到项目：`opencsg-ai-academy`
3. 进入 **Storage** 标签
4. 点击 **Create Database** → 选择 **Postgres**
5. 按提示创建数据库（免费套餐包含：256MB 存储，60小时计算时间/月）
6. 创建完成后，环境变量会自动添加到项目中

### 方案B：使用 Neon（免费 PostgreSQL）

1. 访问 https://neon.tech 并注册（免费）
2. 创建新项目：
   - 项目名称：`OpenCSG-AI-Academy`
   - 区域：选择离您最近的（如 AWS Asia Pacific Singapore）
3. 创建后，复制连接字符串（格式：`postgresql://user:pass@xxx.neon.tech/dbname?sslmode=require`）
4. 回到 Vercel 项目设置：
   - https://vercel.com/franks-projects-a4189b1b/opencsg-ai-academy/settings/environment-variables
5. 添加环境变量：
   - **Name**: `DATABASE_URL`
   - **Value**: 粘贴从 Neon 获取的连接字符串
   - **Environments**: 选择 Production, Preview, Development

### 方案C：使用 Supabase（免费 PostgreSQL + 更多功能）

1. 访问 https://supabase.com 并注册
2. 创建新项目（免费套餐：500MB 数据库，1GB 文件存储）
3. 进入项目设置 → Database → Connection string
4. 复制 Connection string（使用 Transaction 模式）
5. 在 Vercel 中添加环境变量（同方案B第4-5步）

## 🔧 环境变量配置

需要添加的环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host/db` |

可选环境变量：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SESSION_SECRET` | 会话加密密钥 | 随机生成的字符串 |

生成 SESSION_SECRET：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 🚀 部署项目

配置好环境变量后，在本地运行：

```bash
cd /Users/fangchen/Baidu/GitHub/CourseAI
vercel --prod
```

或者在 Vercel 控制台中点击 **Redeploy** 按钮。

## 🗄️ 初始化数据库

部署成功后，需要初始化数据库：

### 1. 在本地生成 Prisma 客户端并推送 schema：

```bash
# 设置环境变量（使用你的数据库 URL）
export DATABASE_URL="postgresql://your-connection-string"

# 推送 schema 到数据库
npx prisma db push

# 运行种子数据（可选）
npm run db:seed
```

### 2. 或者在 Vercel 部署后通过 Vercel CLI：

```bash
# 连接到 Vercel 项目环境
vercel env pull .env.local

# 推送 schema
npx prisma db push

# 运行种子数据
npm run db:seed
```

## 🌐 访问部署的网站

部署完成后，您的网站将在以下地址可用：

- 生产环境：`https://opencsg-ai-academy.vercel.app`
- 或您自定义的域名（在 Vercel 项目设置中配置）

## 🔐 管理后台登录

管理后台地址：`https://opencsg-ai-academy.vercel.app/admin/login`

默认管理员账号（如果运行了 seed 脚本）：
- 用户名：admin
- 密码：admin123

**⚠️ 重要：部署后请立即修改默认密码！**

## 🎯 下一步

1. ✅ 配置数据库
2. ✅ 设置环境变量
3. ✅ 部署项目
4. ✅ 初始化数据库
5. ⬜ 配置自定义域名（可选）
6. ⬜ 设置 Analytics（可选）
7. ⬜ 配置备份策略

## 📚 相关资源

- Vercel 文档：https://vercel.com/docs
- Neon 文档：https://neon.tech/docs
- Prisma 文档：https://www.prisma.io/docs
- Next.js 文档：https://nextjs.org/docs

## 🆘 常见问题

### Q: 部署失败，提示数据库连接错误？
A: 检查 DATABASE_URL 是否正确配置，确保包含 `?sslmode=require` 参数。

### Q: 部署成功但页面显示错误？
A: 确认已运行 `prisma db push` 初始化数据库表结构。

### Q: 如何查看部署日志？
A: 访问 Vercel 项目页面 → Deployments → 点击具体的部署 → 查看 Function Logs。

### Q: 如何更新代码？
A: 只需推送到 GitHub，Vercel 会自动重新部署：
```bash
git add .
git commit -m "Update"
git push origin main
```

## 📞 技术支持

如遇到问题，请查看：
- Vercel 部署日志
- Prisma Studio（数据库管理）：`npx prisma studio`
- GitHub Issues

