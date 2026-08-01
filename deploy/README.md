# 生产部署运行手册

本目录与仓库根目录的 `Dockerfile`、`docker-compose.production.yml` 组成单机生产部署方案。Compose 只把 Web 绑定到宿主机 `127.0.0.1:8088`；公网 TLS 由宿主机 Nginx 或云负载均衡终止。生产 Compose 的所有运行镜像都从 GHCR 拉取，避免中国区服务器依赖 Docker Hub。

## 首次部署

若宿主机是 Ubuntu 22.04，先安装 Docker、Certbot、release 目录和 HTTP 验证站点：

```bash
CONFIRM_BOOTSTRAP=install-aicourse-host \
  ./deploy/bootstrap-host-ubuntu.sh aicourse.49.234.25.35.sslip.io ubuntu /opt/aicourse
```

该脚本遇到已有冲突容器包会停止，不会自动卸载；安装完成后重新登录 SSH，使 Docker 用户组生效。然后用生成器一次性创建权限为 `0600` 的生产环境文件；它会拒绝覆盖已有文件，并为数据库、Redis、JWT、MinIO、AI 密钥和初始账号分别生成独立随机值：

```bash
pnpm deploy:generate-env -- \
  --output /opt/aicourse/shared/.env.production \
  --domain aicourse.49.234.25.35.sslip.io \
  --admin-email you@company.cn \
  --student-email student@company.cn \
  --image-sha <已通过 CI 的完整 40 位提交 SHA>
node deploy/validate-production-env.mjs /opt/aicourse/shared/.env.production
```

应用健康后再签发证书并切换到完整 TLS 配置：

```bash
CONFIRM_TLS=enable-aicourse-tls \
  ./deploy/enable-host-tls.sh aicourse.49.234.25.35.sslip.io you@company.cn
```

必须使用独立的 HTTPS 域名，替换模板中的所有占位值，并确保 `DATABASE_URL` 中的协议、用户、密码和库名与 MySQL 配置完全一致。`pnpm deploy:validate` 会在构建前检查域名、密钥格式与复用、数据库身份、对象存储地址、初始密码和 OAuth 回调的一致性。建议用 `openssl rand -hex 32` 分别生成数据库、Redis、JWT、MinIO 和加密密钥；不要复用密钥。初始账号密码还必须包含大小写字母、数字和符号。

默认只启用邮箱密码登录。启用 Google 或 GitHub 时，把对应 provider 加入 `AUTH_PROVIDERS`，并填写 client ID、secret 和与 `PUBLIC_URL` 同源的 `/auth/oauth/callback`；缺少任一配置时 API 会拒绝启动，避免展示不可用的登录按钮。

自助密码重置使用 Resend 邮件 API。配置 `RESEND_API_KEY` 与 `MAIL_FROM` 后，忘记密码页会自动开放；发件域名必须先在 Resend 验证。未配置时页面明确引导联系管理员，后台仍可签发一次性临时密码。
若同时配置 `ENTERPRISE_NOTIFY_EMAIL`，新企业咨询也会发送到该地址；投递异常不会丢失已保存的咨询记录。

空数据库首次启动时会自动执行已提交迁移并创建初始平台数据。生产 seed 遇到已有业务数据会拒绝覆盖；管理员和示例学员首次登录都必须修改密码。完成初始化后，把 `BOOTSTRAP_DATA` 改为 `false`。

## 宿主机 Nginx

首次签发证书前使用 [`host-nginx-http.conf.example`](./host-nginx-http.conf.example)；
签发后切换到 [`host-nginx.conf.example`](./host-nginx.conf.example)。两个模板都使用
精确域名，不会抢占已有的 Nginx 默认站点。完整模板保留 5GB 上传、流式响应、原始
Host 和 HTTPS 协议头；不要使用只有 `proxy_pass` 的简化配置，否则大文件上传、
预签名地址或流式接口可能失效。

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

发布前先备份 MySQL 和 MinIO 持久数据。仓库提供的脚本只读取运行中的服务，并在 `backups/<UTC 时间>/` 生成 SQL、对象文件和提交清单：

```bash
./deploy/backup-production.sh
```

备份目录出现 `.incomplete` 表示导出未完成，不能用于恢复。`main` 的 CI 全绿后会把两个镜像发布到 GHCR，并同时用提交 SHA 和 `main` 标记。生产发布应优先使用提交 SHA；服务器只拉取镜像，不在低内存主机上编译。备份完成后再更新代码并执行：

```bash
pnpm deploy:validate
docker compose --env-file .env.production -f docker-compose.production.yml pull
docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-build --wait
curl --fail http://127.0.0.1:8088/healthz
curl --fail http://127.0.0.1:8088/api/v1/health/ready
```

仓库的 `Deploy production` 工作流只允许手动触发，并要求输入 `deploy-production`、通过 GitHub `production` environment，以及配置 `DEPLOY_SSH_KEY` 与 `DEPLOY_KNOWN_HOSTS`。它会把当前提交打成不可变 release 包上传到 `/opt/aicourse/releases/<sha>`，不要求生产机访问 GitHub；随后备份现有数据、从公开只读的 GHCR 按提交 SHA 拉取镜像、等待健康并切换 `current` 软链接。若健康检查失败，会尽力恢复上一个 release 记录的镜像。

服务器目录只保留运行状态与不可变 release：共享环境位于 `/opt/aicourse/shared/.env.production`，备份位于 `/opt/aicourse/shared/backups/`，当前版本由 `/opt/aicourse/current` 指向 `/opt/aicourse/releases/<sha>`。不要把密钥写入 release 包或仓库。

镜像和迁移都验证通过后再切公网流量。应用迁移只允许前向执行；如果发布失败，回滚应用镜像前必须确认新迁移与旧代码兼容，不要删除生产数据卷。恢复数据库或覆盖对象存储属于破坏性操作，必须人工核对 `manifest.txt`、目标环境和恢复窗口后执行，本脚本不会自动恢复。

## 上线验收

- `docker compose ps` 中 MySQL、Redis、MinIO、API、Web 均为运行或健康状态。
- `/healthz` 与 `/api/v1/health/ready` 返回 200。
- 注册、登录、课程浏览、报名、学习进度、证书和管理后台完成真实浏览器冒烟。
- 上传文件后，返回的公开 URL 可从外网读取。
- HTTP 自动跳转 HTTPS，HTTPS 包含 CSP、HSTS、`nosniff`、防嵌入和权限策略。
- 生产支付入口保持关闭，直到真实支付网关和 webhook 验签完成。
