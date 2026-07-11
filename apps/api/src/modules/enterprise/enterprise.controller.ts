import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EnterpriseService } from './enterprise.service';
import { CreateEnterpriseInquiryDto, UpdateInquiryStatusDto } from './enterprise.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('enterprise')
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  // Security: tight rate limit on the public inquiry endpoint to prevent spam.
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('inquiries')
  async create(@Body() dto: CreateEnterpriseInquiryDto) {
    return this.enterpriseService.create(dto);
  }

  // 管理后台：查看所有咨询
  @Get('inquiries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async findAll() {
    return this.enterpriseService.findAll();
  }

  @Patch('inquiries/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateInquiryStatusDto) {
    return this.enterpriseService.updateStatus(id, dto);
  }

  @Delete('inquiries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  async delete(@Param('id') id: string) {
    return this.enterpriseService.delete(id);
  }
}
