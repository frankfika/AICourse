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
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ListReviewsQueryDto } from './reviews.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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
}
