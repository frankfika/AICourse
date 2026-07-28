# P1-2 scope enum 改造准备报告 (2026-07-24)

## schema (`prisma/schema.prisma`)

新增 5 enum (L644-676, I18nCategory 后):
- L647 `AppSettingScope { global, page, user }`
- L653 `DateFormatTemplateScope { global, locale }`
- L658 `SiteSettingScope { global, page, user }`
- L664 `QuickPromptScope { lesson, course, degree, global }`
- L671 `HotKeywordScope { courses, home, search, all }`

5 model scope 改 enum (保留 default):
- L1203 `AppSetting.scope AppSettingScope @default(global)`
- L1227 `DateFormatTemplate.scope DateFormatTemplateScope`
- L1241 `SiteSetting.scope SiteSettingScope @default(global)`
- L1317 `QuickPrompt.scope QuickPromptScope @default(lesson)`
- L1357 `HotKeyword.scope HotKeywordScope @default(courses)`

## service (3 文件, 全部 `as XxxScope` cast, 不重构签名)

- `apps/api/src/modules/cms/cms-config.service.ts` L6/17/29/39/56/83/94
- `apps/api/src/modules/cms/cms-enum.service.ts` L8/66/74/78/84/91
- `apps/api/src/modules/cms/cms-content.service.ts` L10/96/174

## DTO (`apps/api/src/modules/cms/cms-admin.dto.ts`)

- L34-40 import 5 prisma enum
- AppSetting Create/Update L84/102 `@IsEnum(AppSettingScope)`
- SiteSetting Create/Update L128/146 `@IsEnum(SiteSettingScope)`
- DateFormatTemplate L262 `@IsEnum(DateFormatTemplateScope)` (必填)
- QuickPrompt Create/Update L504/531 `@IsEnum(QuickPromptScope)`
- HotKeyword Create/Update L612/632: **修了 DTO 之前错的 enum 列表** `['homepage','search','course','all']` → 同步 prisma `['courses','home','search','all']`

## seed (`apps/api/prisma/seed-cms.ts`)

- L24-35 import 3 prisma enum
- L454 quickPrompts `scope: QuickPromptScope`
- L490 hotKeywords `scope: HotKeywordScope`
- L660 dateFormatTemplates `as any` cast (见风险 1)

## 验证 (全 0 错)

| 步骤 | 结果 |
|---|---|
| `prisma format` | ✅ |
| `prisma generate` | ✅ Prisma Client v6.2.0 |
| `apps/api pnpm build` | ✅ |
| `apps/api pnpm test` | ✅ 14 suites / 154 tests |
| `apps/web pnpm tsc --noEmit` | ✅ |

## migrate 命令 (留给 Frank)

```bash
cd /Users/fangchen/Baidu/GitHub/AICourse
./node_modules/.bin/prisma migrate dev --name p1_2_scope_enum
```

## ⚠️ 风险 3 条

1. **DateFormatTemplate scope 数据 vs enum 不兼容**: seed 现有值是 `admin.users.list` / `common.date` / `dashboard.lesson.duration` (string 风格 key), 任务 spec enum 只 `{ global, locale }`. migrate 后跑 `db:seed` 会因 enum 校验崩溃. 我用 `as any` 临时让 build 过, **不修 seed 数据**. Frank 决策: (a) enum 加值; (b) seed scope 简化为 `global`/`locale`; (c) 这表别 enum 化.

2. **HotKeyword DTO enum 之前是错的**: sub-agent 写的 `['homepage','search','course','all']`, 跟 prisma default `courses` + LIST_FALLBACK 用 `courses` (`apps/web/src/lib/cms.ts:590-594`) 都不一致. 我对齐成 `['courses','home','search','all']` — **breaking change**: 之前 admin 提交 `homepage`/`course` 会变 400. 如果生产有数据用旧值, migrate 前先:
   ```sql
   UPDATE hot_keywords SET scope='courses' WHERE scope IN ('homepage','course');
   ```

3. **DB 已有 String scope 数据 migrate 必查**: 5 张表任何 scope 值不在新 enum 集合内, `prisma migrate dev` 会失败 + 弹"清空还是默认值". migrate 前先跑:
   ```sql
   SELECT DISTINCT scope FROM app_settings;
   SELECT DISTINCT scope FROM site_settings;
   SELECT DISTINCT scope FROM date_format_templates;
   SELECT DISTINCT scope FROM quick_prompts;
   SELECT DISTINCT scope FROM hot_keywords;
   ```
   全部在 enum 集合内再 migrate.
