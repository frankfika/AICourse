/**
 * CmsContentController — 公开 GET endpoint (10 个 list resource)
 *
 * - GET /api/v1/industries
 * - GET /api/v1/enterprise-methods
 * - GET /api/v1/testimonials
 * - GET /api/v1/quick-prompts?scope=lesson
 * - GET /api/v1/course-categories
 * - GET /api/v1/popular-searches
 * - GET /api/v1/hot-keywords?scope=courses
 * - GET /api/v1/auth-providers
 * - GET /api/v1/top-nav
 * - GET /api/v1/footer-columns
 *
 * 不走 JwtAuthGuard. 默认只返回 isActive=true 的.
 */
import { Controller, Get, Query, ParseBoolPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CmsContentService } from './cms-content.service';

@ApiTags('cms-content')
@Controller({ path: '', version: '1' })
export class CmsContentController {
  constructor(private readonly cmsContentService: CmsContentService) {}

  private parseActive(active?: string): { isActive?: boolean } | undefined {
    if (active === undefined) return { isActive: true }; // default: only active
    if (active === 'true' || active === '1') return { isActive: true };
    if (active === 'false' || active === '0') return { isActive: false };
    return undefined;
  }

  @Get('industries')
  @ApiOperation({ summary: '行业列表 (含 methodology)' })
  listIndustries(@Query('active') active?: string) {
    return this.cmsContentService.listIndustries(this.parseActive(active));
  }

  @Get('enterprise-methods')
  @ApiOperation({ summary: '企业方法论 3 步法' })
  listEnterpriseMethods(@Query('active') active?: string) {
    return this.cmsContentService.listEnterpriseMethods(this.parseActive(active));
  }

  @Get('testimonials')
  @ApiOperation({ summary: '学员故事 / 证言' })
  listTestimonials(@Query('active') active?: string) {
    return this.cmsContentService.listTestimonials(this.parseActive(active));
  }

  @Get('quick-prompts')
  @ApiOperation({ summary: 'AI 快捷 prompt' })
  listQuickPrompts(@Query('scope') scope?: string, @Query('active') active?: string) {
    const filter = this.parseActive(active);
    return this.cmsContentService.listQuickPrompts({
      ...filter,
      ...(scope ? { promptScope: scope } : {}),
    });
  }

  @Get('course-categories')
  @ApiOperation({ summary: '课程分类 (6 类)' })
  listCourseCategories(@Query('active') active?: string) {
    return this.cmsContentService.listCourseCategories(this.parseActive(active));
  }

  @Get('popular-searches')
  @ApiOperation({ summary: '热门搜索词' })
  listPopularSearches(@Query('active') active?: string) {
    return this.cmsContentService.listPopularSearches(this.parseActive(active));
  }

  @Get('hot-keywords')
  @ApiOperation({ summary: '热词 (按 scope)' })
  listHotKeywords(@Query('scope') scope?: string, @Query('active') active?: string) {
    const filter = this.parseActive(active);
    return this.cmsContentService.listHotKeywords({
      ...filter,
      ...(scope ? { keywordScope: scope } : {}),
    });
  }

  @Get('auth-providers')
  @ApiOperation({ summary: '第三方登录 provider 列表' })
  listAuthProviders() {
    return this.cmsContentService.listAuthProviders();
  }

  @Get('top-nav')
  @ApiOperation({ summary: '顶部导航项' })
  listTopNav(@Query('active') active?: string) {
    return this.cmsContentService.listTopNavItems(this.parseActive(active));
  }

  @Get('footer-columns')
  @ApiOperation({ summary: 'Footer 列' })
  listFooterColumns(@Query('active') active?: string) {
    return this.cmsContentService.listFooterColumns(this.parseActive(active));
  }
}
