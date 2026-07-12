import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole, CourseStatus, CourseType } from '@prisma/client';
import { CreateCourseDto, UpdateCourseDto } from './courses.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async findAll(
    @Query('status') status?: CourseStatus,
    @Query('courseType') courseType?: CourseType,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll({ status, courseType, search });
  }

  // Security: only admins can fetch draft/archived courses by id. Public
  // visitors always get the published version (or 404 if not published).
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @Req() req: { user?: { role?: UserRole } },
  ) {
    const includeDraft = req.user?.role === UserRole.admin;
    return this.coursesService.findOne(id, includeDraft);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async delete(@Param('id') id: string) {
    return this.coursesService.delete(id);
  }
}
