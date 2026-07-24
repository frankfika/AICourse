/**
 * uploads.controller.ts — sign / complete 端点
 *
 * 2026-07-24: P0 — 视频上传管道
 *
 *   POST /api/v1/uploads/sign     body: { scope, filename, mimeType, size }
 *                                 → { uploadUrl, publicUrl, key, expiresIn, scope }
 *   POST /api/v1/uploads/complete body: { scope, key, refId }
 *                                 → { url, publicUrl, key }
 *
 * 全部 require auth (JwtAuthGuard). 业务权限 (role + scope) 走 uploads.service.
 * 前端流程: sign → PUT to uploadUrl (with file body) → complete → 用 publicUrl
 */
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { CompleteUploadDto, SignUploadDto } from './uploads.dto';
import type { Request } from 'express';

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('sign')
  @ApiOperation({ summary: '申请一个 presigned PUT URL (前端直传 MinIO/S3)' })
  async sign(@Body() dto: SignUploadDto, @Req() req: Request) {
    const user = req.user as { id: string; role: string };
    return this.uploads.sign(dto, user);
  }

  @Post('complete')
  @ApiOperation({ summary: '确认上传完成, 把 publicUrl 写到目标 entity 字段' })
  async complete(@Body() dto: CompleteUploadDto, @Req() req: Request) {
    const user = req.user as { id: string; role: string };
    return this.uploads.complete(dto, user);
  }
}
