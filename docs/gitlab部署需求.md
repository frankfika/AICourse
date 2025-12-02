---
标题: 【部署需求】OpenCSG Academy 在线教育平台上线

---

## 项目简介

Hi 研发同学们好！

我们开发了一个在线教育平台 **OpenCSG Academy**，主要用于 AI 和大模型相关课程的展示和学习。现在希望能够部署上线。

**仓库地址**：https://github.com/frankfika/AICourse

## 技术栈

- **前端**：React 19 + TypeScript + Vite
- **样式**：Tailwind CSS
- **数据存储**：当前版本使用 localStorage（演示用），后续需对接后端数据库

## 核心功能

### 用户端
- 课程浏览与学习
- Nano Degree 学位路径
- 免费课程注册、付费课程购买
- 个人中心（已注册/购买的课程）

### 管理后台（/admin）
- **课程管理**：新增、编辑、删除课程
- **学位管理**：新增、编辑、删除学位
- **用户权限**：按邮箱授权课程/学位访问权限
- **资源上传**：课程封面图片、学位封面图片、课程视频

## 部署需求

### 第一阶段：演示版本上线（优先）

希望能先将当前版本部署上线，让业务方可以先看到效果、收集反馈。

当前版本数据存储在浏览器 localStorage 中，可以独立运行，适合作为演示版本先行上线。

- 构建命令：`npm run build`，产物在 `dist/` 目录
- 部署方式：静态文件部署（Nginx / CDN）
- 详细配置可参考：[部署指南](./部署指南.md)

### 第二阶段：后端对接（后续迭代）

演示版上线后，需要逐步与主站系统对接：

#### 1. 管理后台 API

需要提供独立的管理接口，支持课程和学位的配置管理：

```
POST   /api/admin/courses          # 创建课程
PUT    /api/admin/courses/:id      # 更新课程
DELETE /api/admin/courses/:id      # 删除课程

POST   /api/admin/degrees          # 创建学位
PUT    /api/admin/degrees/:id      # 更新学位
DELETE /api/admin/degrees/:id      # 删除学位

POST   /api/admin/permissions      # 授权用户权限
```

#### 2. 资源上传与存储

课程和学位涉及图片、视频上传，需要：

- **图片上传接口**：课程封面、学位封面
  ```
  POST /api/upload/image
  返回：{ url: "https://cdn.xxx.com/images/xxx.jpg" }
  ```

- **视频上传接口**：课程视频（或对接现有视频服务）
  ```
  POST /api/upload/video
  返回：{ url: "https://cdn.xxx.com/videos/xxx.mp4" }
  ```

- **存储方案建议**：
  - 图片：OSS / CDN 存储，返回可访问的 URL
  - 视频：可对接现有视频服务，或使用 OSS 存储
  - 当前前端使用 Base64 存储图片（仅适合演示），生产环境需改为 URL 引用

#### 3. 用户系统对接
- 对接现有用户认证（SSO 单点登录）
- 用户数据存储到后端数据库

#### 4. 支付系统对接
- 对接现有支付流程
- 订单数据持久化

#### 5. 课程数据后端化
- 课程、学位数据迁移到数据库
- 提供查询 API 接口

接口设计和对接方案已整理：[系统对接文档](./系统对接文档.md)

## 相关文档

所有文档在仓库 `docs/` 目录：

| 文档 | 说明 |
|------|------|
| [部署指南](./部署指南.md) | Nginx/Docker 部署配置 |
| [系统对接文档](./系统对接文档.md) | 后端 API 设计、SSO/支付对接方案 |
| [课程信息收集模板](./课程信息收集模板.md) | 课程内容填写规范 |

## 本地运行

```bash
git clone https://github.com/frankfika/AICourse.git
cd AICourse
npm install
npm run dev
# 访问 http://localhost:3000
```

**管理后台入口**：使用 admin@opencsg.com 登录后，右上角出现「管理后台」入口

## 期望

1. 能否先评估一下第一阶段部署的工作量？
2. 方便的话给个大致的时间排期
3. 第二阶段涉及后端 API 和资源存储，需要哪位同学负责，可以先拉个对接群讨论

辛苦各位了，有任何问题随时沟通！
