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
} from '@nestjs/common';
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

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: { user: { userId: string } }) {
    return this.usersService.findOne(req.user.userId);
  }

  @Get()
  @Roles(UserRole.admin)
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
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin)
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  async update(
    @Request() req: { user: { userId: string; role: UserRole } },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    // Users can update themselves; admins can update anyone
    if (req.user.role !== UserRole.admin && req.user.userId !== id) {
      return { error: 'Forbidden' };
    }
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/grant-course')
  @Roles(UserRole.admin)
  async grantCourseAccess(
    @Param('id') userId: string,
    @Body() dto: GrantCourseAccessDto,
  ) {
    return this.usersService.grantCourseAccess(userId, dto);
  }

  @Post(':id/grant-degree')
  @Roles(UserRole.admin)
  async grantDegreeAccess(
    @Param('id') userId: string,
    @Body() dto: GrantDegreeAccessDto,
  ) {
    return this.usersService.grantDegreeAccess(userId, dto);
  }
}
