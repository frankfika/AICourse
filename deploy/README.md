# 生产部署运行手册

本目录与仓库根目录的 `Dockerfile`、`docker-compose.production.yml` 组成单机生产部署方案。Compose 只把 Web 绑定到宿主机 `127.0.0.1:8088`；公网 TLS 由宿主机 Nginx 或云负载均衡终止。

## 首次部署

```bash
cp .env.production.example .env.production
chmod 600 .env.production
pnpm deploy:validate
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

必须使用独立的 HTTPS 域名，替换模板中的所有占位值，并确保 `DATABASE_URL` 中的密码与 `MYSQL_PASSWORD` 完全一致。`pnpm deploy:validate` 会在构建前检查域名、密钥强度、数据库密码、对象存储地址和 OAuth 回调的一致性。建议用 `openssl rand -hex 32` 分别生成数据库、Redis、JWT、MinIO 和加密密钥；不要复用密钥。

默认只启用邮箱密码登录。启用 Google 或 GitHub 时，把对应 provider 加入 `AUTH_PROVIDERS`，并填写 client ID、secret 和与 `PUBLIC_URL` 同源的 `/auth/oauth/callback`；缺少任一配置时 API 会拒绝启动，避免展示不可用的登录按钮。

自助密码重置使用 Resend 邮件 API。配置 `RESEND_API_KEY` 与 `MAIL_FROM` 后，忘记密码页会自动开放；发件域名必须先在 Resend 验证。未配置时页面明确引导联系管理员，后台仍可签发一次性临时密码。
若同时配置 `ENTERPRISE_NOTIFY_EMAIL`，新企业咨询也会发送到该地址；投递异常不会丢失已保存的咨询记录。

空数据库首次启动时会自动执行已提交迁移并创建初始平台数据。生产 seed 遇到已有业务数据会拒绝覆盖；管理员和示例学员首次登录都必须修改密码。完成初始化后，把 `BOOTSTRAP_DATA` 改为 `false`。

## 宿主机 Nginx

使用 [`host-nginx.conf.example`](./host-nginx.conf.example) 创建独立站点。先把其中的
`academy.example.com` 全部替换为真实域名并签发证书，再安装到独立的 Nginx
`server` 块。模板保留 5GB 上传、流式响应、原始 Host 和 HTTPS 协议头；不要使用
只有 `proxy_pass` 的简化配置，否则大文件上传、预签名地址或流式接口可能失效。

反向代理的核心配置如下：

```nginx
location / {
    proxy_pass http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

`PUBLIC_URL`、`STORAGE_PUBLIC_HOST`、`STORAGE_PUBLIC_PORT` 和 `STORAGE_PUBLIC_SSL` 必须与浏览器实际访问的 HTTPS 域名一致，否则对象存储的预签名 URL 会失效。生产 HTTPS 响应还应由宿主机加入 HSTS。

## 发布与回滚

发布前先备份 MySQL 和 MinIO 数据卷。更新代码后执行：

```bash
pnpm deploy:validate
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
curl --fail http://127.0.0.1:8088/healthz
curl --fail http://127.0.0.1:8088/api/v1/health/ready
```

镜像和迁移都验证通过后再切公网流量。应用迁移只允许前向执行；如果发布失败，回滚应用镜像前必须确认新迁移与旧代码兼容，不要删除生产数据卷。

## 上线验收

- `docker compose ps` 中 MySQL、Redis、MinIO、API、Web 均为运行或健康状态。
- `/healthz` 与 `/api/v1/health/ready` 返回 200。
- 注册、登录、课程浏览、报名、学习进度、证书和管理后台完成真实浏览器冒烟。
- 上传文件后，返回的公开 URL 可从外网读取。
- HTTP 自动跳转 HTTPS，HTTPS 包含 CSP、HSTS、`nosniff`、防嵌入和权限策略。
- 生产支付入口保持关闭，直到真实支付网关和 webhook 验签完成。
