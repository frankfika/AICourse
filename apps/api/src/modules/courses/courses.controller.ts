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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole, CourseStatus, CourseType } from '@prisma/client';
import { CreateCourseDto, UpdateCourseDto } from './courses.dto';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: '获取课程列表（公开）' })
  @ApiQuery({ name: 'status', required: false, enum: CourseStatus, description: '课程状态过滤' })
  @ApiQuery({ name: 'courseType', required: false, enum: CourseType, description: '课程类型过滤' })
  @ApiQuery({ name: 'search', required: false, description: '标题/描述/讲师模糊搜索' })
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
  @ApiOperation({ summary: '获取课程详情（公开；管理员可见草稿）' })
  @ApiParam({ name: 'id', description: '课程ID' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建课程（管理员）' })
  async create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新课程（管理员）' })
  @ApiParam({ name: 'id', description: '课程ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除课程（管理员）' })
  @ApiParam({ name: 'id', description: '课程ID' })
  async delete(@Param('id') id: string) {
    return this.coursesService.delete(id);
  }
}
