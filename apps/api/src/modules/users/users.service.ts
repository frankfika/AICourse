import {
  Injectable,
  NotFoundException,
  ConflictException,
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.userSelect,
        enrollments: {
          include: { course: true, degree: true },
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
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.userSelect,
    });
  }

  async delete(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
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
