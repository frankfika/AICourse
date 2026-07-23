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
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import {
  UpdateUserDto,
  GrantCourseAccessDto,
  GrantDegreeAccessDto,
  CreateUserDto,
} from './users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  async getMe(@Request() req: { user: { userId: string } }) {
    return this.usersService.findOne(req.user.userId);
  }

  @Get()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '用户列表（管理员）' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: '按角色过滤' })
  @ApiQuery({ name: 'search', required: false, description: '邮箱/姓名模糊搜索' })
  @ApiQuery({ name: 'page', required: false, description: '页码（默认 1）' })
  @ApiQuery({ name: 'limit', required: false, description: '每页大小（默认 20）' })
  async findAll(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.usersService.findAll({
      role,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '获取指定用户信息（管理员）' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '创建用户（管理员）' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用户（自己可改自己；管理员可改任意）' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async update(
    @Request() req: { user: { userId: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    // Users can update themselves; admins can update anyone
    // 之前返 { error: 'Forbidden' } + 200 → 前端以为成功, 改 throw ForbiddenException (403)
    if (req.user.role !== UserRole.admin && req.user.userId !== id) {
      throw new ForbiddenException('只能修改自己的账号');
    }
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '删除用户（管理员）' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/grant-course')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '给用户授权课程访问（管理员）' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async grantCourseAccess(
    @Param('id') userId: string,
    @Body() dto: GrantCourseAccessDto,
  ) {
    return this.usersService.grantCourseAccess(userId, dto);
  }

  @Post(':id/grant-degree')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: '给用户授权学位访问（管理员）' })
  @ApiParam({ name: 'id', description: '用户ID' })
  async grantDegreeAccess(
    @Param('id') userId: string,
    @Body() dto: GrantDegreeAccessDto,
  ) {
    return this.usersService.grantDegreeAccess(userId, dto);
  }
}
