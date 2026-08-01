# 生产部署运行手册

本目录与仓库根目录的 `Dockerfile`、`docker-compose.production.yml` 组成单机生产部署方案。Compose 只把 Web 绑定到宿主机 `127.0.0.1:8088`；公网 TLS 由宿主机 Nginx 或云负载均衡终止。

## 首次部署

```bash
cp .env.production.example .env.production
chmod 600 .env.production
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

必须替换模板中的所有 `replace-with-*` 值，并确保 `DATABASE_URL` 中的密码与 `MYSQL_PASSWORD` 完全一致。建议用 `openssl rand -hex 32` 分别生成数据库、Redis、JWT、MinIO 和加密密钥；不要复用密钥。

空数据库首次启动时会自动执行已提交迁移并创建初始平台数据。生产 seed 遇到已有业务数据会拒绝覆盖；管理员和示例学员首次登录都必须修改密码。完成初始化后，把 `BOOTSTRAP_DATA` 改为 `false`。

## 宿主机 Nginx

在现有 HTTPS `server` 块中加入：

```nginx
location / {
    proxy_pass http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`PUBLIC_URL`、`STORAGE_PUBLIC_HOST`、`STORAGE_PUBLIC_PORT` 和 `STORAGE_PUBLIC_SSL` 必须与浏览器实际访问的 HTTPS 域名一致，否则对象存储的预签名 URL 会失效。生产 HTTPS 响应还应由宿主机加入 HSTS。

## 发布与回滚

发布前先备份 MySQL 和 MinIO 数据卷。更新代码后执行：

```bash
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
