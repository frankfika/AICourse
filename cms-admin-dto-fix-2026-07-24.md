# cms-admin DTO 加固 — 2026-07-24

P0-1 修 `apps/api/src/modules/cms/cms-admin.controller.ts` 22 个 createX/updateX endpoint
无 class-validator 校验问题。

## 改的 endpoint (文件:行)

`apps/api/src/modules/cms/cms-admin.controller.ts` — 22 个 POST/PATCH 全部
`@Body() body: Record<string, unknown>` 替换为 `@Body() dto: XxxDto`, 删 `as never` 强转:

| 行 | endpoint | DTO |
|----|----------|-----|
| 96  | POST app-settings        | CreateAppSettingDto |
| 110 | PATCH app-settings/:key  | UpdateAppSettingDto |
| 152 | POST enum-translations   | CreateEnumTranslationDto |
| 166 | PATCH enum-translations/:id | UpdateEnumTranslationDto |
| 196 | POST date-format-templates | CreateDateFormatTemplateDto |
| 210 | PATCH date-format-templates/:id | UpdateDateFormatTemplateDto |
| 232 | POST site-settings       | CreateSiteSettingDto |
| 245 | PATCH site-settings/:key | UpdateSiteSettingDto |
| 268 | POST page-settings       | CreatePageSettingDto |
| 281 | PATCH page-settings/:id  | UpdatePageSettingDto |
| 303 | POST industries          | CreateIndustryDto |
| 312 | PATCH industries/:id     | UpdateIndustryDto |
| 326 | POST enterprise-methods  | CreateEnterpriseMethodDto |
| 335 | PATCH enterprise-methods/:id | UpdateEnterpriseMethodDto |
| 349 | POST testimonials        | CreateTestimonialDto |
| 358 | PATCH testimonials/:id   | UpdateTestimonialDto |
| 372 | POST quick-prompts       | CreateQuickPromptDto |
| 381 | PATCH quick-prompts/:id  | UpdateQuickPromptDto |
| 395 | POST course-categories   | CreateCourseCategoryDto |
| 404 | PATCH course-categories/:id | UpdateCourseCategoryDto |
| 418 | POST popular-searches    | CreatePopularSearchDto |
| 427 | PATCH popular-searches/:id | UpdatePopularSearchDto |
| 441 | POST hot-keywords        | CreateHotKeywordDto |
| 450 | PATCH hot-keywords/:id   | UpdateHotKeywordDto |
| 464 | POST auth-providers      | CreateAuthProviderDto |
| 473 | PATCH auth-providers/:id | UpdateAuthProviderDto |
| 487 | POST top-nav             | CreateTopNavItemDto (path 走 assertSafeNavPath) |
| 496 | PATCH top-nav/:id        | UpdateTopNavItemDto (path 走 assertSafeNavPath) |
| 510 | POST footer-columns      | CreateFooterColumnDto (links[].path 走 assertSafeNavPath) |
| 519 | PATCH footer-columns/:id | UpdateFooterColumnDto (links[].path 走 assertSafeNavPath) |
| 538 | POST i18n/messages       | CreateI18nMessageDto |
| 547 | PATCH i18n/messages/:id  | UpdateI18nMessageDto (+ key/locale 拆分校验) |

## 新增的 DTO class

`apps/api/src/modules/cms/cms-admin.dto.ts` (17125 bytes, 12 resource × 2 + FooterLinkDto):

- AppSetting / SiteSetting / PageSetting — valueJson 跑 `@TransformJsonField`
  (validateJsonValue + assertJsonSize, 防 DoS)
- DateFormatTemplate — template @MaxLength(200)
- EnumTranslation — label @IsNotEmpty @MaxLength(100), colorClass/icon 限长
- Industry / EnterpriseMethod — bullets @IsArray @ArrayMaxSize(20) + 元素限长
- Testimonial — quote @MaxLength(500)
- QuickPrompt — prompt @MaxLength(2000)
- CourseCategory / PopularSearch / HotKeyword — order @IsInt @Min(0)
  HotKeyword scope 限定 enum (homepage/search/course/all)
- AuthProvider — config 走 `@TransformJsonField` 防塞循环引用 / 超 64KB
- TopNavItem — path 走 `assertSafeNavPath` (白名单: `/`, `http(s)://`, `#`,
  `mailto:`, `tel:`; 拒 `javascript:` / `data:` / `vbscript:` / `//evil.com`)
- FooterColumn — links @IsArray @ArrayMaxSize(20) + @ValidateNested 嵌套校验,
  每条 link.path 跑 `assertSafeNavPath`
- I18nMessage — value @MaxLength(2000), category 限 enum

helper:
- `assertSafeNavPath(value, fieldName)` — 与 apps/web/src/lib/cms.ts:1070-1085
  前后端白名单一致
- `@TransformJsonField()` — 给 valueJson / config 字段用, 自动跑 size+depth 校验

## build + tsc 结果

```
$ pnpm --filter @opencsg/academy-api build
> @opencsg/academy-api@1.5.0 build /Users/fangchen/Baidu/GitHub/AICourse/apps/api
> nest build
(0 errors)

$ ./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
(0 errors)
```

## 未改的部分 (按约束保留)

- service 层 4 个文件 (cms-config / cms-content / cms-enum / cms-i18n) — 签名不变
- schema.prisma — 不动
- 22 个 endpoint 路径 / HTTP method / RolesGuard / JwtAuthGuard — 全保留
- `as never` 仍出现在 controller 调 service 处 (后续 task 才动 service 签名)
