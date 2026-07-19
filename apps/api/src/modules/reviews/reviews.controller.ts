/**
 * reviews.controller.ts — P1-3 评价路由
 *
 * 三个路由:
 *   - GET  /api/v1/courses/:id/reviews    公开(列表)
 *   - POST /api/v1/courses/:id/reviews    登录(写评价)
 *   - POST /api/v1/reviews/:id/helpful    登录(点赞)
 *
 * 注意:POST 写评价的 path 是 /api/v1/courses/:id/reviews
 *      (跟课程 detail 同 namespace 表达"是这门课的评价")
 *      点赞是单条评价维度的操作,挂 /api/v1/reviews/:id/helpful
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ListReviewsQueryDto } from './reviews.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

interface AuthedRequest {
  user: { id: string; role?: string };
}

@Controller({ path: 'courses', version: '1' })
export class CoursesReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':id/reviews')
  async list(
    @Param('id') courseId: string,
    @Query() query: ListReviewsQueryDto,
  ) {
    return this.reviewsService.findByCourse(
      courseId,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('id') courseId: string,
    @Req() req: AuthedRequest,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(req.user.id, courseId, dto);
  }
}

@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':id/helpful')
  @UseGuards(JwtAuthGuard)
  async helpful(
    @Param('id') reviewId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.reviewsService.markHelpful(req.user.id, reviewId);
  }

  /**
   * P1-3 admin 全量评价列表
   * GET /api/v1/reviews?page=1&limit=20&courseId=...&rating=5&onlyDeleted=false
   * 给 AdminReviewsPage 用:列全站评价 + 一键软删
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('courseId') courseId?: string,
    @Query('rating') rating?: string,
    @Query('onlyDeleted') onlyDeleted?: string,
  ) {
    return this.reviewsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      courseId,
      rating: rating ? parseInt(rating, 10) : undefined,
      onlyDeleted: onlyDeleted === 'true',
    });
  }

  /**
   * P1-3 admin 软删评价(content 置空 + 隐藏,不物理删保留审计)
   * 原因:合规要求保留用户行为痕迹;且有用作 review 训练数据
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async adminRemove(@Param('id') id: string) {
    return this.reviewsService.adminRemove(id);
  }
}
