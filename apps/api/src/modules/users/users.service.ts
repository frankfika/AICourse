import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreateUserDto,
  UpdateUserDto,
  GrantCourseAccessDto,
  GrantDegreeAccessDto,
} from './users.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private userSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    avatarUrl: true,
    createdAt: true,
    updatedAt: true,
  };

  async findAll(params: {
    role?: UserRole;
    search?: string;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (params.role) where.role = params.role;
    if (params.search) {
      where.OR = [
        { email: { contains: params.search } },
        { name: { contains: params.search } },
      ];
    }

    const skip = (params.page - 1) * params.limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.userSelect,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page: params.page, limit: params.limit };
  }

  async findOne(id: string) {
    // P1-3 扩展:admin 详情抽屉需要 6 section — 一次查全减少 N+1
    // 注意:passwordHash 不返回(已在 userSelect 排除)
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.userSelect,
        enrollments: {
          include: { course: true, degree: true },
          orderBy: { enrolledAt: 'desc' },
          take: 20, // 最近 20 笔报名
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20, // 最近 20 笔订单
        },
        certificates: {
          orderBy: { issuedAt: 'desc' },
          take: 20, // 最近 20 张证书
        },
        pointTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20, // 最近 20 笔积分流水
        },
        _count: {
          select: {
            enrollments: true,
            orders: true,
            certificates: true,
            progressRecords: true,
            submissions: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role,
      },
      select: this.userSelect,
    });

    await this.auditLog.log({
      userId: user.id,
      action: 'USER_CREATE',
      entity: 'user',
      entityId: user.id,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    // 不允许通过 PATCH /users/:id 改 role / points / level / passwordHash, 这些字段是 admin 专用
    // 业务上, 普通用户改自己只能改 name / avatarUrl
    const safe: Partial<UpdateUserDto> = {};
    if (dto.name !== undefined) safe.name = dto.name;
    if (dto.avatarUrl !== undefined) safe.avatarUrl = dto.avatarUrl;

    // 软删用户不能改: 先 findFirst 查 (UserWhereUniqueInput 不支持 deletedAt)
    const before = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: this.userSelect,
    });
    if (!before) throw new NotFoundException('User not found or deleted');

    const updated = await this.prisma.user.update({
      where: { id },
      data: safe,
      select: this.userSelect,
    });

    await this.auditLog.log({
      userId: id,
      action: 'USER_UPDATE',
      entity: 'user',
      entityId: id,
      details: { before, after: updated },
    });

    return updated;
  }

  async delete(id: string) {
    // 软删: 改 deletedAt, 物理删除会触发 17 个外键 cascade 断数据
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found or already deleted');

    const deleted = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true, email: true, deletedAt: true },
    });

    await this.auditLog.log({
      userId: id,
      action: 'USER_SOFT_DELETE',
      entity: 'user',
      entityId: id,
    });

    return deleted;
  }

  async grantCourseAccess(userId: string, dto: GrantCourseAccessDto) {
    const enrollments = await this.prisma.$transaction(
      dto.courseIds.map((courseId) =>
        this.prisma.enrollment.upsert({
          where: { userId_courseId: { userId, courseId } },
          update: {},
          create: { userId, courseId, source: 'direct' },
        }),
      ),
    );

    await this.auditLog.log({
      userId,
      action: 'USER_GRANT_COURSE',
      entity: 'user',
      entityId: userId,
      details: { courseIds: dto.courseIds },
    });

    return { granted: enrollments.length };
  }

  async grantDegreeAccess(userId: string, dto: GrantDegreeAccessDto) {
    const enrollments = await this.prisma.$transaction(
      dto.degreeIds.map((degreeId) =>
        this.prisma.enrollment.upsert({
          where: { userId_degreeId: { userId, degreeId } },
          update: {},
          create: { userId, degreeId, source: 'direct' },
        }),
      ),
    );

    await this.auditLog.log({
      userId,
      action: 'USER_GRANT_DEGREE',
      entity: 'user',
      entityId: userId,
      details: { degreeIds: dto.degreeIds },
    });

    return { granted: enrollments.length };
  }
}
