import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreateHackathonDto,
  UpdateHackathonDto,
  CreateTeamDto,
  CreateSubmissionDto,
  UpdateSubmissionDto,
  CreateAnnouncementDto,
  JudgeSubmissionDto,
} from './hackathons.dto';
import { HackathonStatus, SubmissionStatus } from '@prisma/client';

@Injectable()
export class HackathonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private baseSelect = {
    id: true,
    title: true,
    description: true,
    bannerUrl: true,
    status: true,
    startDate: true,
    endDate: true,
    registerDeadline: true,
    submissionDeadline: true,
    minTeamSize: true,
    maxTeamSize: true,
    location: true,
    rules: true,
    submissionRequirements: true,
    prizes: true,
    registrationUrl: true,
    registrationLabel: true,
    organizerId: true,
    createdAt: true,
    updatedAt: true,
  };

  private organizerSelect = {
    id: true,
    name: true,
    avatarUrl: true,
  };

  private userSelect = {
    id: true,
    name: true,
    avatarUrl: true,
  };

  private validateSchedule(input: {
    startDate: string | Date;
    endDate: string | Date;
    registerDeadline?: string | Date | null;
    submissionDeadline?: string | Date | null;
    minTeamSize: number;
    maxTeamSize: number;
  }) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (start >= end) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
    if (input.minTeamSize > input.maxTeamSize) {
      throw new BadRequestException('最小团队人数不能大于最大团队人数');
    }
    if (input.registerDeadline) {
      const deadline = new Date(input.registerDeadline);
      if (deadline > start) {
        throw new BadRequestException('报名截止时间不能晚于活动开始时间');
      }
    }
    if (input.submissionDeadline) {
      const deadline = new Date(input.submissionDeadline);
      if (deadline < start || deadline > end) {
        throw new BadRequestException('作品提交截止时间必须位于活动开始与结束时间之间');
      }
    }
  }

  /**
   * Keep public status consistent with the event dates even when an organizer
   * has not manually advanced an event. Judging/finished/cancelled remain
   * editorial states and are never inferred backwards from dates.
   */
  private effectiveStatus(hackathon: {
    status: HackathonStatus;
    startDate: Date;
    endDate: Date;
  }, now = new Date()): HackathonStatus {
    if (
      hackathon.status === HackathonStatus.cancelled ||
      hackathon.status === HackathonStatus.finished ||
      hackathon.status === HackathonStatus.judging
    ) {
      return hackathon.status;
    }

    if (now < hackathon.startDate) return HackathonStatus.upcoming;
    if (now <= hackathon.endDate) return HackathonStatus.active;
    return HackathonStatus.judging;
  }

  async findAll(params: {
    status?: HackathonStatus;
    search?: string;
    userId?: string;
  }) {
    const where: any = {};
    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { description: { contains: params.search } },
        { location: { contains: params.search } },
      ];
    }

    const hackathons = await this.prisma.hackathon.findMany({
      where,
      select: {
        ...this.baseSelect,
        organizer: { select: this.organizerSelect },
        _count: {
          select: {
            registrations: { where: { status: 'registered' } },
            teams: true,
          },
        },
        registrations: params.userId
          ? {
              where: { userId: params.userId },
              take: 1,
            }
          : undefined,
      },
      orderBy: { startDate: 'desc' },
      // P1-7 防御: 默认 50, max 100, 防 DoS (admin 后台 list 拉全表 OOM)
      take: 100,
    });

    const now = new Date();
    return hackathons
      .map((h) => ({
        ...h,
        status: this.effectiveStatus(h, now),
        myRegistration: h.registrations?.[0] ?? null,
        registrations: undefined,
      }))
      .filter((h) => !params.status || h.status === params.status);
  }

  async findOne(id: string, userId?: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
      select: {
        ...this.baseSelect,
        organizer: { select: this.organizerSelect },
        judges: true,
        _count: {
          select: {
            registrations: { where: { status: 'registered' } },
            teams: true,
            submissions: true,
          },
        },
      },
    });

    if (!hackathon) throw new NotFoundException('Hackathon not found');

    let myRegistration = null;
    if (userId) {
      myRegistration = await this.prisma.hackathonRegistration.findUnique({
        where: { hackathonId_userId: { hackathonId: id, userId } },
      });
    }

    return {
      ...hackathon,
      status: this.effectiveStatus(hackathon),
      myRegistration,
    };
  }

  async create(dto: CreateHackathonDto, organizerId: string) {
    this.validateSchedule({
      ...dto,
      minTeamSize: dto.minTeamSize ?? 1,
      maxTeamSize: dto.maxTeamSize ?? 5,
    });
    const hackathon = await this.prisma.hackathon.create({
      data: {
        ...dto,
        organizerId,
        minTeamSize: dto.minTeamSize ?? 1,
        maxTeamSize: dto.maxTeamSize ?? 5,
        status: dto.status ?? HackathonStatus.upcoming,
      },
      select: {
        ...this.baseSelect,
        organizer: { select: this.organizerSelect },
      },
    });

    await this.auditLog.log({
      userId: organizerId,
      action: 'HACKATHON_CREATE',
      entity: 'hackathon',
      entityId: hackathon.id,
      details: { title: hackathon.title },
    });

    return hackathon;
  }

  async update(id: string, dto: UpdateHackathonDto) {
    const current = await this.ensureExists(id);
    this.validateSchedule({
      startDate: dto.startDate ?? current.startDate,
      endDate: dto.endDate ?? current.endDate,
      registerDeadline: dto.registerDeadline ?? current.registerDeadline,
      submissionDeadline: dto.submissionDeadline ?? current.submissionDeadline,
      minTeamSize: dto.minTeamSize ?? current.minTeamSize,
      maxTeamSize: dto.maxTeamSize ?? current.maxTeamSize,
    });
    const hackathon = await this.prisma.hackathon.update({
      where: { id },
      data: dto,
      select: {
        ...this.baseSelect,
        organizer: { select: this.organizerSelect },
      },
    });

    await this.auditLog.log({
      action: 'HACKATHON_UPDATE',
      entity: 'hackathon',
      entityId: hackathon.id,
      details: { title: hackathon.title },
    });

    return hackathon;
  }

  async delete(id: string) {
    await this.ensureExists(id);
    await this.prisma.hackathon.delete({ where: { id } });

    await this.auditLog.log({
      action: 'HACKATHON_DELETE',
      entity: 'hackathon',
      entityId: id,
    });

    return { message: 'Hackathon deleted' };
  }

  async register(userId: string, hackathonId: string) {
    const hackathon = await this.ensureExists(hackathonId);

    if (hackathon.status === HackathonStatus.cancelled) {
      throw new ForbiddenException('该黑客松已取消');
    }

    if (
      hackathon.registerDeadline &&
      new Date(hackathon.registerDeadline) < new Date()
    ) {
      throw new ForbiddenException('报名已截止');
    }

    const existing = await this.prisma.hackathonRegistration.findUnique({
      where: { hackathonId_userId: { hackathonId, userId } },
    });

    if (existing?.status === 'registered') {
      return existing;
    }

    if (existing?.status === 'cancelled') {
      return this.prisma.hackathonRegistration.update({
        where: { hackathonId_userId: { hackathonId, userId } },
        data: { status: 'registered' },
      });
    }

    return this.prisma.hackathonRegistration.create({
      data: { hackathonId, userId, status: 'registered' },
    });
  }

  async cancelRegistration(userId: string, hackathonId: string) {
    await this.ensureExists(hackathonId);

    const existing = await this.prisma.hackathonRegistration.findUnique({
      where: { hackathonId_userId: { hackathonId, userId } },
    });

    if (!existing || existing.status !== 'registered') {
      throw new BadRequestException('尚未报名该黑客松');
    }

    return this.prisma.hackathonRegistration.update({
      where: { hackathonId_userId: { hackathonId, userId } },
      data: { status: 'cancelled' },
    });
  }

  async getMyRegistration(userId: string, hackathonId: string) {
    await this.ensureExists(hackathonId);
    return this.prisma.hackathonRegistration.findUnique({
      where: { hackathonId_userId: { hackathonId, userId } },
    });
  }

  async getAnnouncements(hackathonId: string) {
    await this.ensureExists(hackathonId);
    return this.prisma.announcement.findMany({
      where: { hackathonId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAnnouncement(
    hackathonId: string,
    dto: CreateAnnouncementDto,
    userId: string,
  ) {
    await this.ensureExists(hackathonId);
    const announcement = await this.prisma.announcement.create({
      data: {
        hackathonId,
        title: dto.title,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
      },
    });

    await this.auditLog.log({
      userId,
      action: 'HACKATHON_ANNOUNCEMENT_CREATE',
      entity: 'announcement',
      entityId: announcement.id,
      details: { hackathonId, title: announcement.title },
    });

    return announcement;
  }

  async getTeams(hackathonId: string) {
    await this.ensureExists(hackathonId);
    return this.prisma.team.findMany({
      where: { hackathonId },
      include: {
        members: {
          include: { user: { select: this.userSelect } },
        },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTeam(
    userId: string,
    hackathonId: string,
    dto: CreateTeamDto,
  ) {
    await this.ensureExists(hackathonId);
    await this.ensureRegistered(userId, hackathonId);

    const existingTeam = await this.prisma.team.findFirst({
      where: { hackathonId, name: dto.name },
    });
    if (existingTeam) {
      throw new BadRequestException('该黑客松下已存在同名队伍');
    }

    const existingMembership = await this.prisma.teamMember.findFirst({
      where: { userId, team: { hackathonId } },
    });
    if (existingMembership) {
      throw new BadRequestException('你已经加入了一个队伍');
    }

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          hackathonId,
          name: dto.name,
          slogan: dto.slogan,
          captainId: userId,
        },
      });
      await tx.teamMember.create({
        data: { teamId: team.id, userId, role: 'captain' },
      });
      return tx.team.findUnique({
        where: { id: team.id },
        include: {
          members: { include: { user: { select: this.userSelect } } },
        },
      });
    });
  }

  async joinTeam(userId: string, hackathonId: string, teamId: string) {
    const hackathon = await this.ensureExists(hackathonId);
    await this.ensureRegistered(userId, hackathonId);

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true, hackathon: { select: { maxTeamSize: true } } },
    });
    if (!team || team.hackathonId !== hackathonId) {
      throw new NotFoundException('Team not found');
    }

    const existingMembership = await this.prisma.teamMember.findFirst({
      where: { userId, team: { hackathonId } },
    });
    if (existingMembership) {
      throw new BadRequestException('你已经加入了一个队伍');
    }

    if (team.members.length >= (team.hackathon?.maxTeamSize ?? hackathon.maxTeamSize)) {
      throw new ForbiddenException('队伍已满');
    }

    return this.prisma.teamMember.create({
      data: { teamId, userId, role: 'member' },
      include: { user: { select: this.userSelect }, team: true },
    });
  }

  async leaveTeam(userId: string, hackathonId: string, teamId: string) {
    await this.ensureExists(hackathonId);

    const membership = await this.prisma.teamMember.findFirst({
      where: { userId, teamId, team: { hackathonId } },
      include: { team: true },
    });

    if (!membership) {
      throw new BadRequestException('你不是该队伍成员');
    }

    if (membership.role === 'captain') {
      // 队长退出则解散队伍
      await this.prisma.team.delete({ where: { id: teamId } });
      return { message: 'Team disbanded' };
    }

    await this.prisma.teamMember.delete({ where: { id: membership.id } });
    return { message: 'Left team' };
  }

  async getMySubmissions(userId: string, hackathonId: string) {
    await this.ensureExists(hackathonId);
    return this.prisma.submission.findMany({
      where: {
        hackathonId,
        OR: [{ userId }, { team: { members: { some: { userId } } } }],
      },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: this.userSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubmission(
    userId: string,
    hackathonId: string,
    dto: CreateSubmissionDto,
  ) {
    await this.ensureExists(hackathonId);
    await this.ensureRegistered(userId, hackathonId);

    let teamId: string | undefined = dto.teamId;
    if (teamId) {
      const membership = await this.prisma.teamMember.findFirst({
        where: { userId, teamId, team: { hackathonId } },
      });
      if (!membership) {
        throw new ForbiddenException('你不是该队伍成员');
      }
    }

    const isSubmitted = dto.status === SubmissionStatus.submitted;

    return this.prisma.submission.create({
      data: {
        hackathonId,
        userId: teamId ? undefined : userId,
        teamId,
        title: dto.title,
        description: dto.description,
        demoUrl: dto.demoUrl,
        repoUrl: dto.repoUrl,
        videoUrl: dto.videoUrl,
        status: dto.status ?? SubmissionStatus.draft,
        submittedAt: isSubmitted ? new Date() : undefined,
      },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: this.userSelect },
      },
    });
  }

  async updateSubmission(
    userId: string,
    hackathonId: string,
    submissionId: string,
    dto: UpdateSubmissionDto,
  ) {
    await this.ensureExists(hackathonId);

    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        hackathonId,
        OR: [{ userId }, { team: { members: { some: { userId } } } }],
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const isNowSubmitted = dto.status === SubmissionStatus.submitted;
    const wasSubmitted = submission.status === SubmissionStatus.submitted;

    return this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        ...dto,
        submittedAt: isNowSubmitted && !wasSubmitted ? new Date() : submission.submittedAt,
      },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: this.userSelect },
      },
    });
  }

  async getAllSubmissions(hackathonId: string) {
    await this.ensureExists(hackathonId);
    return this.prisma.submission.findMany({
      where: { hackathonId },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: this.userSelect },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async judgeSubmission(
    hackathonId: string,
    submissionId: string,
    dto: JudgeSubmissionDto,
  ) {
    await this.ensureExists(hackathonId);
    const submission = await this.prisma.submission.findFirst({
      where: { id: submissionId, hackathonId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    return this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback,
        status: dto.status ?? SubmissionStatus.under_review,
      },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: this.userSelect },
      },
    });
  }

  private async ensureExists(id: string) {
    const hackathon = await this.prisma.hackathon.findUnique({ where: { id } });
    if (!hackathon) throw new NotFoundException('Hackathon not found');
    return hackathon;
  }

  private async ensureRegistered(userId: string, hackathonId: string) {
    const registration = await this.prisma.hackathonRegistration.findUnique({
      where: { hackathonId_userId: { hackathonId, userId } },
    });
    if (!registration || registration.status !== 'registered') {
      throw new ForbiddenException('请先报名该黑客松');
    }
  }

  // ==================== P1 修复(2026-07-24): Judges ====================

  async listJudges(hackathonId: string) {
    return this.prisma.judge.findMany({
      where: { hackathonId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async addJudge(hackathonId: string, body: {
    name: string;
    title?: string;
    avatarUrl?: string;
    bio?: string;
    orderIndex?: number;
    role?: 'judge' | 'advisor' | 'host';
  }) {
    if (!body.name?.trim()) {
      throw new BadRequestException('judge.name 不能为空');
    }
    return this.prisma.judge.create({
      data: {
        hackathonId,
        name: body.name.trim(),
        title: body.title,
        avatarUrl: body.avatarUrl,
        bio: body.bio,
        orderIndex: body.orderIndex ?? 0,
        role: body.role ?? 'judge',
      },
    });
  }

  async updateJudge(hackathonId: string, judgeId: string, body: any) {
    return this.prisma.judge.update({
      where: { id: judgeId },
      data: body,
    });
  }

  async removeJudge(hackathonId: string, judgeId: string) {
    await this.prisma.judge.delete({ where: { id: judgeId } });
    return { message: 'Judge deleted' };
  }

  // ==================== P1 修复(2026-07-24): Sponsors ====================

  async listSponsors(hackathonId: string) {
    return this.prisma.sponsor.findMany({
      where: { hackathonId },
      orderBy: [{ tier: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async addSponsor(hackathonId: string, body: {
    name: string;
    logoUrl?: string;
    websiteUrl?: string;
    tier?: 'platinum' | 'gold' | 'silver' | 'bronze';
    orderIndex?: number;
  }) {
    if (!body.name?.trim()) {
      throw new BadRequestException('sponsor.name 不能为空');
    }
    return this.prisma.sponsor.create({
      data: {
        hackathonId,
        name: body.name.trim(),
        logoUrl: body.logoUrl,
        websiteUrl: body.websiteUrl,
        tier: body.tier ?? 'silver',
        orderIndex: body.orderIndex ?? 0,
      },
    });
  }

  async updateSponsor(hackathonId: string, sponsorId: string, body: any) {
    return this.prisma.sponsor.update({
      where: { id: sponsorId },
      data: body,
    });
  }

  async removeSponsor(hackathonId: string, sponsorId: string) {
    await this.prisma.sponsor.delete({ where: { id: sponsorId } });
    return { message: 'Sponsor deleted' };
  }
}
