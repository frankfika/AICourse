/**
 * AuditLogController — 审计日志读 API
 *
 * 路径:`/api/v1/audit-logs`
 * - GET 列表(分页 + 按 userId/entity/action 过滤)
 *
 * 角色:admin 才能读(操作审计是高权限数据)
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller({ path: 'audit-logs', version: '1' })
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: '审计日志列表(分页 + 过滤)' })
  list(
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.auditLogService.list({
      userId,
      entity,
      action,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }
}
