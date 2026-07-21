/**
 * CmsAdminController — Admin CRUD (16 个 resource 全部覆盖)
 *
 * 全部需 admin 角色 (JwtAuthGuard + RolesGuard).
 * 路径: /api/v1/admin/cms/<resource>
 *
 * Resource 列表:
 *   - app-settings, enum-translations, site-settings, page-settings
 *   - industries, enterprise-methods, testimonials, quick-prompts
 *   - course-categories, popular-searches, hot-keywords
 *   - auth-providers, top-nav, footer-columns
 *   - i18n-messages
 *
 * enum-translations 主键是组合 (enumType, enumValue, locale), 路径用复合 ID
 *   即 :id 形式为 "course_level:Beginner:zh-CN", 拆分后调 service.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { CmsEnumService } from './cms-enum.service';
import { CmsConfigService } from './cms-config.service';
import { CmsContentService } from './cms-content.service';
import { CmsI18nService } from './cms-i18n.service';

@ApiTags('cms-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller({ path: 'admin/cms', version: '1' })
export class CmsAdminController {
  constructor(
    private readonly cmsEnumService: CmsEnumService,
    private readonly cmsConfigService: CmsConfigService,
    private readonly cmsContentService: CmsContentService,
    private readonly cmsI18nService: CmsI18nService,
  ) {}

  // ==================== app_settings ====================

  @Get('app-settings')
  @ApiOperation({ summary: 'Admin: 列出 app_settings' })
  listAppSettings() {
    return this.cmsConfigService.listAppSettings();
  }

  @Post('app-settings')
  @ApiOperation({ summary: 'Admin: 创建 app_setting' })
  createAppSetting(
    @Body()
    body: {
      key: string;
      valueJson: unknown;
      scope?: string;
      description?: string;
    },
  ) {
    return this.cmsConfigService.createAppSetting({
      key: body.key,
      valueJson: body.valueJson as never,
      scope: body.scope,
      description: body.description,
    });
  }

  @Patch('app-settings/:key')
  @ApiOperation({ summary: 'Admin: 更新 app_setting' })
  updateAppSetting(
    @Param('key') key: string,
    @Body() body: { valueJson?: unknown; scope?: string; description?: string },
  ) {
    return this.cmsConfigService.updateAppSetting(key, {
      valueJson: body.valueJson as never,
      scope: body.scope,
      description: body.description,
    });
  }

  @Delete('app-settings/:key')
  @ApiOperation({ summary: 'Admin: 删除 app_setting' })
  deleteAppSetting(@Param('key') key: string) {
    return this.cmsConfigService.deleteAppSetting(key);
  }

  // ==================== enum_translations ====================
  // 复合主键: id 形式 "enumType:enumValue:locale"

  @Get('enum-translations')
  @ApiOperation({ summary: 'Admin: 列出 enum_translations' })
  listEnumTranslations(
    @Query('type') type?: string,
    @Query('locale') locale?: string,
  ) {
    return this.cmsEnumService.listEnumTranslations(type, locale);
  }

  @Post('enum-translations')
  @ApiOperation({ summary: 'Admin: 创建 enum_translation' })
  createEnumTranslation(
    @Body()
    body: {
      enumType: string;
      enumValue: string;
      locale: string;
      label: string;
      colorClass?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    return this.cmsEnumService.createEnumTranslation(body);
  }

  @Patch('enum-translations/:id')
  @ApiOperation({ summary: 'Admin: 更新 enum_translation' })
  updateEnumTranslation(
    @Param('id') id: string,
    @Body() body: { label?: string; colorClass?: string; icon?: string; sortOrder?: number },
  ) {
    const [enumType, enumValue, locale] = id.split(':');
    return this.cmsEnumService.updateEnumTranslation(enumType, enumValue, locale, body);
  }

  @Delete('enum-translations/:id')
  @ApiOperation({ summary: 'Admin: 删除 enum_translation' })
  deleteEnumTranslation(@Param('id') id: string) {
    const [enumType, enumValue, locale] = id.split(':');
    return this.cmsEnumService.deleteEnumTranslation(enumType, enumValue, locale);
  }

  // ==================== date_format_templates ====================

  @Get('date-format-templates')
  @ApiOperation({ summary: 'Admin: 列出 date_format_templates' })
  listDateFormatTemplates() {
    return this.cmsEnumService.listDateFormatTemplates();
  }

  @Post('date-format-templates')
  @ApiOperation({ summary: 'Admin: 创建 date_format_template' })
  createDateFormatTemplate(
    @Body() body: { scope: string; locale: string; template: string },
  ) {
    return this.cmsEnumService.createDateFormatTemplate(body);
  }

  @Patch('date-format-templates/:id')
  @ApiOperation({ summary: 'Admin: 更新 date_format_template' })
  updateDateFormatTemplate(
    @Param('id') id: string,
    @Body() body: { template: string },
  ) {
    const [scope, locale] = id.split(':');
    return this.cmsEnumService.updateDateFormatTemplate(scope, locale, body);
  }

  @Delete('date-format-templates/:id')
  @ApiOperation({ summary: 'Admin: 删除 date_format_template' })
  deleteDateFormatTemplate(@Param('id') id: string) {
    const [scope, locale] = id.split(':');
    return this.cmsEnumService.deleteDateFormatTemplate(scope, locale);
  }

  // ==================== site_settings ====================

  @Get('site-settings')
  @ApiOperation({ summary: 'Admin: 列出 site_settings' })
  listSiteSettings() {
    return this.cmsConfigService.listSiteSettings();
  }

  @Post('site-settings')
  @ApiOperation({ summary: 'Admin: 创建 site_setting' })
  createSiteSetting(
    @Body() body: { key: string; value: unknown; scope?: string; description?: string },
  ) {
    return this.cmsConfigService.createSiteSetting({
      key: body.key,
      value: body.value as never,
      scope: body.scope,
      description: body.description,
    });
  }

  @Patch('site-settings/:key')
  @ApiOperation({ summary: 'Admin: 更新 site_setting' })
  updateSiteSetting(
    @Param('key') key: string,
    @Body() body: { value?: unknown; scope?: string; description?: string },
  ) {
    return this.cmsConfigService.updateSiteSetting(key, {
      value: body.value as never,
      scope: body.scope,
      description: body.description,
    });
  }

  @Delete('site-settings/:key')
  @ApiOperation({ summary: 'Admin: 删除 site_setting' })
  deleteSiteSetting(@Param('key') key: string) {
    return this.cmsConfigService.deleteSiteSetting(key);
  }

  // ==================== page_settings ====================

  @Get('page-settings')
  @ApiOperation({ summary: 'Admin: 列出 page_settings' })
  listPageSettings() {
    return this.cmsConfigService.listPageSettings();
  }

  @Post('page-settings')
  @ApiOperation({ summary: 'Admin: 创建 page_setting' })
  createPageSetting(
    @Body() body: { page: string; key: string; value: unknown; description?: string },
  ) {
    return this.cmsConfigService.createPageSetting({
      page: body.page,
      key: body.key,
      value: body.value as never,
      description: body.description,
    });
  }

  @Patch('page-settings/:id')
  @ApiOperation({ summary: 'Admin: 更新 page_setting' })
  updatePageSetting(
    @Param('id') id: string,
    @Body() body: { value?: unknown; description?: string },
  ) {
    const [page, key] = id.split(':');
    return this.cmsConfigService.updatePageSetting(page, key, {
      value: body.value as never,
      description: body.description,
    });
  }

  @Delete('page-settings/:id')
  @ApiOperation({ summary: 'Admin: 删除 page_setting' })
  deletePageSetting(@Param('id') id: string) {
    const [page, key] = id.split(':');
    return this.cmsConfigService.deletePageSetting(page, key);
  }

  // ==================== industries ====================

  @Get('industries')
  @ApiOperation({ summary: 'Admin: 列出 industries' })
  listIndustries() {
    return this.cmsContentService.listIndustries();
  }

  @Post('industries')
  @ApiOperation({ summary: 'Admin: 创建 industry' })
  createIndustry(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createIndustry(body as never);
  }

  @Patch('industries/:id')
  @ApiOperation({ summary: 'Admin: 更新 industry' })
  updateIndustry(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateIndustry(id, body as never);
  }

  @Delete('industries/:id')
  @ApiOperation({ summary: 'Admin: 删除 industry' })
  deleteIndustry(@Param('id') id: string) {
    return this.cmsContentService.deleteIndustry(id);
  }

  // ==================== enterprise_methods ====================

  @Get('enterprise-methods')
  @ApiOperation({ summary: 'Admin: 列出 enterprise_methods' })
  listEnterpriseMethods() {
    return this.cmsContentService.listEnterpriseMethods();
  }

  @Post('enterprise-methods')
  @ApiOperation({ summary: 'Admin: 创建 enterprise_method' })
  createEnterpriseMethod(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createEnterpriseMethod(body as never);
  }

  @Patch('enterprise-methods/:id')
  @ApiOperation({ summary: 'Admin: 更新 enterprise_method' })
  updateEnterpriseMethod(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateEnterpriseMethod(id, body as never);
  }

  @Delete('enterprise-methods/:id')
  @ApiOperation({ summary: 'Admin: 删除 enterprise_method' })
  deleteEnterpriseMethod(@Param('id') id: string) {
    return this.cmsContentService.deleteEnterpriseMethod(id);
  }

  // ==================== testimonials ====================

  @Get('testimonials')
  @ApiOperation({ summary: 'Admin: 列出 testimonials' })
  listTestimonials() {
    return this.cmsContentService.listTestimonials();
  }

  @Post('testimonials')
  @ApiOperation({ summary: 'Admin: 创建 testimonial' })
  createTestimonial(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createTestimonial(body as never);
  }

  @Patch('testimonials/:id')
  @ApiOperation({ summary: 'Admin: 更新 testimonial' })
  updateTestimonial(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateTestimonial(id, body as never);
  }

  @Delete('testimonials/:id')
  @ApiOperation({ summary: 'Admin: 删除 testimonial' })
  deleteTestimonial(@Param('id') id: string) {
    return this.cmsContentService.deleteTestimonial(id);
  }

  // ==================== quick_prompts ====================

  @Get('quick-prompts')
  @ApiOperation({ summary: 'Admin: 列出 quick_prompts' })
  listQuickPrompts() {
    return this.cmsContentService.listQuickPrompts();
  }

  @Post('quick-prompts')
  @ApiOperation({ summary: 'Admin: 创建 quick_prompt' })
  createQuickPrompt(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createQuickPrompt(body as never);
  }

  @Patch('quick-prompts/:id')
  @ApiOperation({ summary: 'Admin: 更新 quick_prompt' })
  updateQuickPrompt(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateQuickPrompt(id, body as never);
  }

  @Delete('quick-prompts/:id')
  @ApiOperation({ summary: 'Admin: 删除 quick_prompt' })
  deleteQuickPrompt(@Param('id') id: string) {
    return this.cmsContentService.deleteQuickPrompt(id);
  }

  // ==================== course_categories ====================

  @Get('course-categories')
  @ApiOperation({ summary: 'Admin: 列出 course_categories' })
  listCourseCategories() {
    return this.cmsContentService.listCourseCategories();
  }

  @Post('course-categories')
  @ApiOperation({ summary: 'Admin: 创建 course_category' })
  createCourseCategory(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createCourseCategory(body as never);
  }

  @Patch('course-categories/:id')
  @ApiOperation({ summary: 'Admin: 更新 course_category' })
  updateCourseCategory(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateCourseCategory(id, body as never);
  }

  @Delete('course-categories/:id')
  @ApiOperation({ summary: 'Admin: 删除 course_category' })
  deleteCourseCategory(@Param('id') id: string) {
    return this.cmsContentService.deleteCourseCategory(id);
  }

  // ==================== popular_searches ====================

  @Get('popular-searches')
  @ApiOperation({ summary: 'Admin: 列出 popular_searches' })
  listPopularSearches() {
    return this.cmsContentService.listPopularSearches();
  }

  @Post('popular-searches')
  @ApiOperation({ summary: 'Admin: 创建 popular_search' })
  createPopularSearch(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createPopularSearch(body as never);
  }

  @Patch('popular-searches/:id')
  @ApiOperation({ summary: 'Admin: 更新 popular_search' })
  updatePopularSearch(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updatePopularSearch(id, body as never);
  }

  @Delete('popular-searches/:id')
  @ApiOperation({ summary: 'Admin: 删除 popular_search' })
  deletePopularSearch(@Param('id') id: string) {
    return this.cmsContentService.deletePopularSearch(id);
  }

  // ==================== hot_keywords ====================

  @Get('hot-keywords')
  @ApiOperation({ summary: 'Admin: 列出 hot_keywords' })
  listHotKeywords() {
    return this.cmsContentService.listHotKeywords();
  }

  @Post('hot-keywords')
  @ApiOperation({ summary: 'Admin: 创建 hot_keyword' })
  createHotKeyword(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createHotKeyword(body as never);
  }

  @Patch('hot-keywords/:id')
  @ApiOperation({ summary: 'Admin: 更新 hot_keyword' })
  updateHotKeyword(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateHotKeyword(id, body as never);
  }

  @Delete('hot-keywords/:id')
  @ApiOperation({ summary: 'Admin: 删除 hot_keyword' })
  deleteHotKeyword(@Param('id') id: string) {
    return this.cmsContentService.deleteHotKeyword(id);
  }

  // ==================== auth_providers ====================

  @Get('auth-providers')
  @ApiOperation({ summary: 'Admin: 列出 auth_providers' })
  listAuthProviders() {
    return this.cmsContentService.listAuthProviders();
  }

  @Post('auth-providers')
  @ApiOperation({ summary: 'Admin: 创建 auth_provider' })
  createAuthProvider(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createAuthProvider(body as never);
  }

  @Patch('auth-providers/:id')
  @ApiOperation({ summary: 'Admin: 更新 auth_provider' })
  updateAuthProvider(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateAuthProvider(id, body as never);
  }

  @Delete('auth-providers/:id')
  @ApiOperation({ summary: 'Admin: 删除 auth_provider' })
  deleteAuthProvider(@Param('id') id: string) {
    return this.cmsContentService.deleteAuthProvider(id);
  }

  // ==================== top_nav ====================

  @Get('top-nav')
  @ApiOperation({ summary: 'Admin: 列出 top_nav_items' })
  listTopNav() {
    return this.cmsContentService.listTopNavItems();
  }

  @Post('top-nav')
  @ApiOperation({ summary: 'Admin: 创建 top_nav_item' })
  createTopNavItem(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createTopNavItem(body as never);
  }

  @Patch('top-nav/:id')
  @ApiOperation({ summary: 'Admin: 更新 top_nav_item' })
  updateTopNavItem(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateTopNavItem(id, body as never);
  }

  @Delete('top-nav/:id')
  @ApiOperation({ summary: 'Admin: 删除 top_nav_item' })
  deleteTopNavItem(@Param('id') id: string) {
    return this.cmsContentService.deleteTopNavItem(id);
  }

  // ==================== footer_columns ====================

  @Get('footer-columns')
  @ApiOperation({ summary: 'Admin: 列出 footer_columns' })
  listFooterColumns() {
    return this.cmsContentService.listFooterColumns();
  }

  @Post('footer-columns')
  @ApiOperation({ summary: 'Admin: 创建 footer_column' })
  createFooterColumn(@Body() body: Record<string, unknown>) {
    return this.cmsContentService.createFooterColumn(body as never);
  }

  @Patch('footer-columns/:id')
  @ApiOperation({ summary: 'Admin: 更新 footer_column' })
  updateFooterColumn(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cmsContentService.updateFooterColumn(id, body as never);
  }

  @Delete('footer-columns/:id')
  @ApiOperation({ summary: 'Admin: 删除 footer_column' })
  deleteFooterColumn(@Param('id') id: string) {
    return this.cmsContentService.deleteFooterColumn(id);
  }

  // ==================== i18n_messages ====================

  @Get('i18n/messages')
  @ApiOperation({ summary: 'Admin: 列出 i18n_messages' })
  listI18nMessages(
    @Query('locale') locale?: string,
    @Query('category') category?: string,
  ) {
    return this.cmsI18nService.listMessages(locale, category);
  }

  @Post('i18n/messages')
  @ApiOperation({ summary: 'Admin: 创建 i18n_message' })
  createI18nMessage(@Body() body: Record<string, unknown>) {
    return this.cmsI18nService.createMessage(body as never);
  }

  @Patch('i18n/messages/:id')
  @ApiOperation({ summary: 'Admin: 更新 i18n_message' })
  updateI18nMessage(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const [key, locale] = id.split(':');
    return this.cmsI18nService.updateMessage(key, locale, body as never);
  }

  @Delete('i18n/messages/:id')
  @ApiOperation({ summary: 'Admin: 删除 i18n_message' })
  deleteI18nMessage(@Param('id') id: string) {
    const [key, locale] = id.split(':');
    return this.cmsI18nService.deleteMessage(key, locale);
  }
}
