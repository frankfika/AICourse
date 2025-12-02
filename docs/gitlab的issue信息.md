# 【部署需求】OpenCSG Academy 在线教育平台上线

## 背景

我们开发了一个在线教育平台 **OpenCSG Academy**，用于 AI 和大模型相关课程的展示和学习，现需要部署上线。

## 仓库信息

- **仓库地址**：https://github.com/frankfika/AICourse
- **技术栈**：React 19 + TypeScript + Vite + Supabase (PostgreSQL)
- **默认管理员**：admin@opencsg.com / admin123

## 产品功能

**用户端**：
- 课程浏览与视频学习
- Nano Degree 学位路径
- 免费课程注册、付费课程购买
- AI 智能助教（基于 Gemini）

**管理后台**（登录后右上角入口）：
- 课程/学位增删改
- 用户权限管理
- 封面图片上传

## 部署要求

### 第一阶段：上线

1. **前端部署**
   ```bash
   npm install && npm run build
   # 产物在 dist/ 目录，部署到 Nginx / CDN
   ```

2. **数据库**
   - 已配置 Supabase 云数据库
   - 需执行 `supabase/schema.sql` 初始化（如未执行）

3. **详细配置**：见仓库 `docs/部署指南.md`

### 第二阶段：主站集成（后续）

如需对接主站：
- 用户系统：SSO 单点登录
- 支付系统：对接主站支付流程
- 详见 `docs/系统对接文档.md`

## 相关文档

| 文档 | 说明 |
|------|------|
| `docs/部署指南.md` | Nginx/Docker/Vercel 部署配置 |
| `docs/系统对接文档.md` | SSO/支付 API 对接方案 |
| `docs/课程信息收集模板.md` | 课程内容填写规范 |

## 期望

- [ ] 评估第一阶段部署工作量
- [ ] 给个大致排期
- [ ] 第二阶段如涉及后端对接，拉群讨论

/label ~部署 ~Academy
/assign @运维
