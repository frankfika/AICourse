import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('me')
  async getMyEnrollments(@Request() req: { user: { userId: string } }) {
    return this.enrollmentsService.findByUser(req.user.userId);
  }

  @Post('courses/:id/free')
  async enrollFreeCourse(
    @Request() req: { user: { userId: string } },
    @Param('id') courseId: string,
  ) {
    return this.enrollmentsService.enrollFreeCourse(req.user.userId, courseId);
  }
}
