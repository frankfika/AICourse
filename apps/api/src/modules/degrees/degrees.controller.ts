import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DegreesService } from './degrees.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole, CourseStatus } from '@prisma/client';
import { CreateDegreeDto, UpdateDegreeDto, LinkCoursesDto } from './degrees.dto';

@Controller('degrees')
export class DegreesController {
  constructor(private readonly degreesService: DegreesService) {}

  @Get()
  async findAll(
    @Query('status') status?: CourseStatus,
    @Query('search') search?: string,
  ) {
    return this.degreesService.findAll({ status, search });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.degreesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async create(@Body() dto: CreateDegreeDto) {
    return this.degreesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async update(@Param('id') id: string, @Body() dto: UpdateDegreeDto) {
    return this.degreesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async delete(@Param('id') id: string) {
    return this.degreesService.delete(id);
  }

  @Post(':id/courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async linkCourses(@Param('id') id: string, @Body() dto: LinkCoursesDto) {
    return this.degreesService.linkCourses(id, dto);
  }
}
