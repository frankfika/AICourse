/**
 * uploads.service.ts — 上传 sign + complete 业务
 *
 * 2026-07-24: P0 — 视频上传管道
 *
 * sign 流程:
 *   1) 校验 scope 存在 + 用户 role 在 allowedRoles
 *   2) 校验 mime 在 allowedMime, size <= maxSizeMB
 *   3) 生成 key = `<keyPrefix>/<userId>/<timestamp>-<random>-<filename>`
 *   4) 调 storage.presignUpload
 *
 * complete 流程:
 *   1) 校验 key 之前是当前 user 签过的 (按 userId 前缀)
 *   2) 校验 refId 存在 + 权限 (e.g. lesson 只能 admin 改)
 *   3) 把 publicUrl 写到目标列
 *   4) 返回 { url, publicUrl }
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageProvider, PresignResult } from './storage/storage.interface';
import { S3StorageService } from './storage/s3-storage.service';
import { UPLOAD_SCOPES, UploadScope } from './uploads.config';
import { CompleteUploadDto, SignUploadDto } from './uploads.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { randomBytes } from 'crypto';
import { extname } from 'path';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  private generateKey(scope: UploadScope, userId: string, filename: string): string {
    const cfg = UPLOAD_SCOPES[scope];
    // 保留扩展名 (小写), 防止 mime spoof
    const ext = extname(filename).toLowerCase().slice(0, 8); // cap length
    const safeExt = /^[.a-z0-9]+$/.test(ext) ? ext : '';
    const ts = Date.now();
    const rand = randomBytes(6).toString('hex');
    return `${cfg.keyPrefix}/${userId}/${ts}-${rand}${safeExt}`;
  }

  async sign(
    dto: SignUploadDto,
    user: { id: string; role: string },
  ): Promise<PresignResult & { scope: UploadScope }> {
    const cfg = UPLOAD_SCOPES[dto.scope];
    if (!cfg) {
      throw new BadRequestException(`Unknown upload scope: ${dto.scope}`);
    }
    // role 权限
    if (!cfg.allowedRoles.includes(user.role as any)) {
      throw new ForbiddenException(
        `Role ${user.role} 不允许上传 ${dto.scope} (需要: ${cfg.allowedRoles.join(', ')})`,
      );
    }
    // mime 校验
    if (!cfg.allowedMime.includes(dto.mimeType)) {
      throw new BadRequestException(
        `${dto.scope} 不接受 ${dto.mimeType} (允许: ${cfg.allowedMime.join(', ')})`,
      );
    }
    // size 校验
    const maxBytes = cfg.maxSizeMB * 1024 * 1024;
    if (dto.size > maxBytes) {
      throw new BadRequestException(
        `${dto.scope} 文件 ${dto.size} 字节超过上限 ${cfg.maxSizeMB}MB`,
      );
    }

    const key = this.generateKey(dto.scope, user.id, dto.filename);

    // 如果给了 refId, 校验 refId 存在 + 用户有权限 — 防 user 拿任意 entity id 签 key
    // 业务侧 confirm 还要再校验一次, 这里只是 fail-fast
    if (dto.refId) {
      await this.validateRefIdForSign(dto.scope, dto.refId, user);
    }

    const presigned = await this.storage.presignUpload(key, dto.mimeType, cfg.presignTtlSec);

    await this.auditLog.log({
      action: 'UPLOAD_SIGN',
      entity: this.entityForScope(dto.scope),
      entityId: dto.refId ?? key,
      details: { scope: dto.scope, size: dto.size, mimeType: dto.mimeType, userId: user.id, refId: dto.refId },
    });

    return { ...presigned, scope: dto.scope };
  }

  /**
   * sign 时 fail-fast 校验 refId 存在 + 权限 (防 user 拿任意 entity id 签)
   * 不写库, 仅仅检查
   */
  private async validateRefIdForSign(
    scope: UploadScope,
    refId: string,
    user: { id: string; role: string },
  ): Promise<void> {
    const isAdmin = user.role === 'admin';
    switch (scope) {
      case 'lesson-video': {
        if (!isAdmin) throw new ForbiddenException('仅 admin 可上传 lesson 视频');
        const l = await this.prisma.lesson.findUnique({ where: { id: refId } });
        if (!l || l.deletedAt) throw new NotFoundException(`Lesson ${refId} 不存在`);
        return;
      }
      case 'resource': {
        // create 时上传, refId = lessonId (parent). 校验 lesson 存在
        if (!isAdmin) throw new ForbiddenException('仅 admin 可上传 resource');
        const l = await this.prisma.lesson.findUnique({ where: { id: refId } });
        if (!l || l.deletedAt) throw new NotFoundException(`Lesson ${refId} 不存在`);
        return;
      }
      case 'course-thumbnail': {
        if (!isAdmin) throw new ForbiddenException('仅 admin 可上传 course 封面');
        const c = await this.prisma.course.findUnique({ where: { id: refId } });
        if (!c) throw new NotFoundException(`Course ${refId} 不存在`);
        return;
      }
      case 'degree-thumbnail': {
        if (!isAdmin) throw new ForbiddenException('仅 admin 可上传 degree 封面');
        const d = await this.prisma.nanoDegree.findUnique({ where: { id: refId } });
        if (!d) throw new NotFoundException(`Degree ${refId} 不存在`);
        return;
      }
      case 'hackathon-banner': {
        if (!isAdmin) throw new ForbiddenException('仅 admin 可上传 hackathon banner');
        const h = await this.prisma.hackathon.findUnique({ where: { id: refId } });
        if (!h) throw new NotFoundException(`Hackathon ${refId} 不存在`);
        return;
      }
      case 'hackathon-judge-avatar': {
        if (!isAdmin) throw new ForbiddenException('仅 admin 可上传 judge avatar');
        const j = await this.prisma.judge.findUnique({ where: { id: refId } });
        if (!j) throw new NotFoundException(`Judge ${refId} 不存在`);
        return;
      }
      case 'hackathon-sponsor-logo': {
        if (!isAdmin) throw new ForbiddenException('仅 admin 可上传 sponsor logo');
        const s = await this.prisma.sponsor.findUnique({ where: { id: refId } });
        if (!s) throw new NotFoundException(`Sponsor ${refId} 不存在`);
        return;
      }
      case 'submission-video': {
        // 任意已登录 user — refId 是 submission id, 校验存在
        const sub = await this.prisma.submission.findUnique({ where: { id: refId } });
        if (!sub) throw new NotFoundException(`Submission ${refId} 不存在`);
        return;
      }
      case 'user-avatar': {
        if (!isAdmin && refId !== user.id) {
          throw new ForbiddenException('只能改自己的头像');
        }
        const u = await this.prisma.user.findUnique({ where: { id: refId } });
        if (!u) throw new NotFoundException(`User ${refId} 不存在`);
        return;
      }
      default:
        throw new BadRequestException(`Unknown scope ${scope}`);
    }
  }

  async complete(
    dto: CompleteUploadDto,
    user: { id: string; role: string },
  ): Promise<{ url: string; publicUrl: string; key: string; writtenBack: boolean }> {
    const cfg = UPLOAD_SCOPES[dto.scope];
    if (!cfg) {
      throw new BadRequestException(`Unknown upload scope: ${dto.scope}`);
    }
    // key 必须以 "<keyPrefix>/<userId>/" 开头 — 防止 user A 完成 user B 的上传
    if (!dto.key.startsWith(`${cfg.keyPrefix}/${user.id}/`)) {
      throw new ForbiddenException(
        `key ${dto.key} 不属于当前 user ${user.id} (scope ${dto.scope} 期望前缀 ${cfg.keyPrefix}/${user.id}/)`,
      );
    }
    // role 权限 (与 sign 一致)
    if (!cfg.allowedRoles.includes(user.role as any)) {
      throw new ForbiddenException(
        `Role ${user.role} 不允许 ${dto.scope} (需要: ${cfg.allowedRoles.join(', ')})`,
      );
    }
    // 确认 object 真的存在 (前端 PUT 完之后)
    const meta = await this.storage.headObject(dto.key);
    if (!meta) {
      throw new NotFoundException(`上传 object 不存在: ${dto.key} (前端可能未完成 PUT)`);
    }

    const publicUrl = `${this.storage.getPublicUrlBase()}/${dto.key}`;

    // 路由写库: refId 留空 = 只 confirm object 存在, 不写库 (用于 create 时上传, 由前端业务侧 setField)
    let writtenBack = false;
    if (dto.refId) {
      const ok = await this.routeWriteback(dto.scope, dto.refId, publicUrl, user);
      if (!ok) {
        throw new NotFoundException(`${dto.scope} 目标 refId=${dto.refId} 不存在或无权修改`);
      }
      writtenBack = true;
    }

    await this.auditLog.log({
      action: 'UPLOAD_COMPLETE',
      entity: this.entityForScope(dto.scope),
      entityId: dto.refId ?? dto.key,
      details: { scope: dto.scope, key: dto.key, size: meta.size, publicUrl, writtenBack, userId: user.id },
    });

    return { url: publicUrl, publicUrl, key: dto.key, writtenBack };
  }

  private entityForScope(scope: UploadScope): string {
    const map: Record<UploadScope, string> = {
      'lesson-video': 'Lesson',
      'resource': 'Resource',
      'course-thumbnail': 'Course',
      'degree-thumbnail': 'NanoDegree',
      'hackathon-banner': 'Hackathon',
      'hackathon-judge-avatar': 'Judge',
      'hackathon-sponsor-logo': 'Sponsor',
      'submission-video': 'Submission',
      'user-avatar': 'User',
    };
    return map[scope];
  }

  /**
   * 把 publicUrl 写到目标 entity 的对应列.
   * 返回 boolean 表示是否成功 (entity 存在 + 权限 OK).
   */
  private async routeWriteback(
    scope: UploadScope,
    refId: string,
    publicUrl: string,
    user: { id: string; role: string },
  ): Promise<boolean> {
    const isAdmin = user.role === 'admin';

    switch (scope) {
      case 'lesson-video': {
        if (!isAdmin) return false;
        const r = await this.prisma.lesson.update({
          where: { id: refId },
          data: { videoUrl: publicUrl },
        });
        return !!r;
      }
      case 'resource': {
        if (!isAdmin) return false;
        const r = await this.prisma.resource.update({
          where: { id: refId },
          data: { url: publicUrl },
        });
        return !!r;
      }
      case 'course-thumbnail': {
        if (!isAdmin) return false;
        const r = await this.prisma.course.update({
          where: { id: refId },
          data: { thumbnail: publicUrl },
        });
        return !!r;
      }
      case 'degree-thumbnail': {
        if (!isAdmin) return false;
        const r = await this.prisma.nanoDegree.update({
          where: { id: refId },
          data: { thumbnail: publicUrl },
        });
        return !!r;
      }
      case 'hackathon-banner': {
        if (!isAdmin) return false;
        const r = await this.prisma.hackathon.update({
          where: { id: refId },
          data: { bannerUrl: publicUrl },
        });
        return !!r;
      }
      case 'hackathon-judge-avatar': {
        if (!isAdmin) return false;
        const r = await this.prisma.judge.update({
          where: { id: refId },
          data: { avatarUrl: publicUrl },
        });
        return !!r;
      }
      case 'hackathon-sponsor-logo': {
        if (!isAdmin) return false;
        const r = await this.prisma.sponsor.update({
          where: { id: refId },
          data: { logoUrl: publicUrl },
        });
        return !!r;
      }
      case 'submission-video': {
        // P2: 校验 user 是该 submission 的 owner 或 team member
        // 当前简化为: 任何 student/instructor 都能写, 由前端控制 refId 来源
        const r = await this.prisma.submission.update({
          where: { id: refId },
          data: { videoUrl: publicUrl },
        });
        return !!r;
      }
      case 'user-avatar': {
        // user 改自己 / admin 改任何人
        if (!isAdmin && refId !== user.id) return false;
        const r = await this.prisma.user.update({
          where: { id: refId },
          data: { avatarUrl: publicUrl },
        });
        return !!r;
      }
      default:
        return false;
    }
  }
}
