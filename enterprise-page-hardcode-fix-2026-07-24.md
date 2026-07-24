# EnterprisePage 零硬编码改造 (audit 2026-07-24)

**日期**: 2026-07-24
**改的文件**: `apps/web/src/features/enterprise/EnterprisePage.tsx` (主), `apps/web/src/lib/cms.ts` (加 fallback), `apps/web/src/lib/cmsApi.ts` (加 endpoint key)

## 11 处修法

| # | 原行号 | 修法 |
|---|---|---|
| 1 | L67 `TEAM_SIZES` 数组 | 删 inline 常量;`useList('team-sizes')` + `LIST_FALLBACK['team-sizes']` 兜底;`cmsApi.ts:294` 加 endpoint,`cms.ts:611-617` 加 fallback |
| 2 | L108-117 8 行业 inline | 改用 `LIST_FALLBACK.industries` 作为 fallback source(原结构保留) |
| 3 | L120 `FALLBACK_ICONS` | 删;新增 `ICON_MAP: Record<string, ComponentType>` (L23-29),把 CMS 数据里 `icon: 'Target'` 字符串映射到 lucide-react |
| 4 | L129-153 3 步法 inline | 改用 `LIST_FALLBACK['enterprise-methods']` 兜底,icon 字段走 `ICON_MAP` |
| 5 | L184 `['Beijing','Shanghai','Shenzhen']` | 改成空数组 `[]` fallback,没配 site_settings 就不显示地址行 (L441) |
| 6 | L186 `enterprise@opencsg.com` | 改成 `import.meta.env.VITE_PUBLIC_ENTERPRISE_EMAIL?.trim() ?? ''`,没设时不渲染邮箱行 (L424) |
| 7 | L263-266 4 stat label | 走 `pickPage(entPages, 'stat.*', 'zh-CN', t('company.stat.*', ''))` (L196-199) |
| 8 | L440 `/ 03 Inquiry` 硬编号 | 改用 `pickPage(entPages, 'inquiry.eyebrow.form', ..., '/ Inquiry')` (L218) |
| 9 | L446-508 7 form label | 走 `pickPage(entPages, 'form.{name,email,company,phone,team_size,topic,description}', ..., t('company.contact.field.*', ''))` (L202-209) |
| 10 | L502 + L514 2 placeholder | 走 `pickPage(entPages, 'form.placeholder.{topic,description}', ..., t('company.contact.{topic.placeholder,form.desc}', ''))` (L212-213) |
| 11 | L535 "AI Pre-fill supported in admin" | 改 `t('company.contact.prefill.supported', 'AI Pre-fill supported in admin')` (L549) |

## 关键设计点

- **ICON_MAP 模式**:`LIST_FALLBACK` 保持纯数据,icon 字段是 string 名称,组件顶部建一个 string→Component 映射表
- **空字符串兜底**:`pickPage(data, key, locale, t('...', ''))` — 都没设时显示空,不假数据
- **CMS 渲染守卫**:email / addressCities 都加 `?` 条件渲染,空数据不显示该行
- **类型兼容**:`Record<ListResource, any[]>` 要求 key 在 `LIST_ENDPOINTS`,所以 cmsApi.ts 也加了 `'team-sizes'` (后端暂无此 endpoint,但 useList 走 `retry: 0` 优雅 fallback 到 LIST_FALLBACK)

## 验证结果

- `tsc --noEmit`: **0 个新错误** (仅 2 个 pre-existing 错误:`DashboardPage.tsx:649` + `NotFoundPage.tsx:136`,与本次改动无关)
- `pnpm build`: pre-existing lightningcss CSS minify 错误 (audit spec 已声明跳过,与本任务无关)
