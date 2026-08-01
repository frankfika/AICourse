import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HackathonsService } from './hackathons.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { HackathonStatus, SubmissionStatus } from '@prisma/client';

// Mock PrismaService. hackathons.service hits many tables; we lazy-add the
// ones we use as we go. For $transaction (createTeam), we mirror orders.spec:
// run the callback against the same mockPrisma so conditional paths can run.
const mockPrisma: any = {
  hackathon: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  hackathonRegistration: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  team: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  teamMember: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  submission: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  announcement: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};
mockPrisma.$transaction = jest.fn(async (cb: (tx: any) => any) => cb(mockPrisma));

const mockAuditLog: any = {
  log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
};

describe('HackathonsService', () => {
  let service: HackathonsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.hackathon.findUnique.mockReset();
    mockPrisma.hackathon.findMany.mockReset();
    mockPrisma.hackathon.create.mockReset();
    mockPrisma.hackathon.update.mockReset();
    mockPrisma.hackathon.delete.mockReset();
    mockPrisma.hackathonRegistration.findUnique.mockReset();
    mockPrisma.hackathonRegistration.create.mockReset();
    mockPrisma.hackathonRegistration.update.mockReset();
    mockPrisma.team.findUnique.mockReset();
    mockPrisma.team.findFirst.mockReset();
    mockPrisma.team.findMany.mockReset();
    mockPrisma.team.create.mockReset();
    mockPrisma.team.delete.mockReset();
    mockPrisma.teamMember.findFirst.mockReset();
    mockPrisma.teamMember.create.mockReset();
    mockPrisma.teamMember.delete.mockReset();
    mockPrisma.submission.findMany.mockReset();
    mockPrisma.submission.findFirst.mockReset();
    mockPrisma.submission.create.mockReset();
    mockPrisma.submission.update.mockReset();
    mockPrisma.announcement.findMany.mockReset();
    mockPrisma.announcement.create.mockReset();
    mockAuditLog.log.mockClear();
  });

  async function buildService(): Promise<HackathonsService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HackathonsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();
    return module.get<HackathonsService>(HackathonsService);
  }

  describe('findAll', () => {
    it('应根据日期修正未及时推进的 upcoming/active 状态并正确筛选', async () => {
      service = await buildService();
      const now = Date.now();
      const base = {
        title: 'Hackathon',
        registrations: [],
      };
      mockPrisma.hackathon.findMany.mockResolvedValue([
        {
          ...base,
          id: 'future',
          status: HackathonStatus.active,
          startDate: new Date(now + 86_400_000),
          endDate: new Date(now + 172_800_000),
        },
        {
          ...base,
          id: 'running',
          status: HackathonStatus.upcoming,
          startDate: new Date(now - 86_400_000),
          endDate: new Date(now + 86_400_000),
        },
        {
          ...base,
          id: 'ended',
          status: HackathonStatus.active,
          startDate: new Date(now - 172_800_000),
          endDate: new Date(now - 86_400_000),
        },
      ]);

      const result = await service.findAll({ status: HackathonStatus.active });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'running', status: HackathonStatus.active });
      expect(mockPrisma.hackathon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    it('应创建黑客松 + 默认 min/max team size + 默认 upcoming status', async () => {
      service = await buildService();
      mockPrisma.hackathon.create.mockResolvedValue({
        id: 'h1',
        title: 'AI Hack 2026',
        status: HackathonStatus.upcoming,
        minTeamSize: 1,
        maxTeamSize: 5,
      });

      const result = await service.create(
        {
          title: 'AI Hack 2026',
          description: 'desc',
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-15T00:00:00.000Z',
        } as any,
        'organizer-1',
      );

      expect(result).toMatchObject({
        id: 'h1',
        title: 'AI Hack 2026',
        status: HackathonStatus.upcoming,
      });
      expect(mockPrisma.hackathon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'AI Hack 2026',
            organizerId: 'organizer-1',
            minTeamSize: 1,
            maxTeamSize: 5,
            status: HackathonStatus.upcoming,
          }),
        }),
      );
      // 审计日志
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HACKATHON_CREATE',
          entity: 'hackathon',
          entityId: 'h1',
        }),
      );
    });
  });

  // ============================================================
  // register — 状态机核心
  // ============================================================
  describe('register', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('首次报名应 create + 返 registration', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
        registerDeadline: null,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue(null);
      mockPrisma.hackathonRegistration.create.mockResolvedValue({
        id: 'r1',
        hackathonId: 'h1',
        userId: 'u1',
        status: 'registered',
      });

      const result = await service.register('u1', 'h1');

      expect(result).toMatchObject({ id: 'r1', status: 'registered' });
      expect(mockPrisma.hackathonRegistration.create).toHaveBeenCalledWith({
        data: { hackathonId: 'h1', userId: 'u1', status: 'registered' },
      });
    });

    it('重复报名 (status=registered) 应幂等返现有记录, 不重复 create', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
        registerDeadline: null,
      });
      const existing = { id: 'r-existing', status: 'registered' };
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue(existing);

      const result = await service.register('u1', 'h1');

      expect(result).toEqual(existing);
      expect(mockPrisma.hackathonRegistration.create).not.toHaveBeenCalled();
      expect(mockPrisma.hackathonRegistration.update).not.toHaveBeenCalled();
    });

    it('已取消再报名应 update 回 registered', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
        registerDeadline: null,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        id: 'r-old',
        status: 'cancelled',
      });
      mockPrisma.hackathonRegistration.update.mockResolvedValue({
        id: 'r-old',
        status: 'registered',
      });

      const result = await service.register('u1', 'h1');

      expect(result).toMatchObject({ id: 'r-old', status: 'registered' });
      expect(mockPrisma.hackathonRegistration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hackathonId_userId: { hackathonId: 'h1', userId: 'u1' } },
          data: { status: 'registered' },
        }),
      );
    });

    it('已取消的 hackathon 应抛 ForbiddenException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.cancelled,
        registerDeadline: null,
      });

      await expect(service.register('u1', 'h1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.hackathonRegistration.create).not.toHaveBeenCalled();
    });

    it('registerDeadline 已过应抛 ForbiddenException (报名已截止)', async () => {
      service = await buildService();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.active,
        registerDeadline: pastDate,
      });

      await expect(service.register('u1', 'h1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.hackathonRegistration.create).not.toHaveBeenCalled();
    });

    it('registerDeadline 未到应放行 (active 状态可报)', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.active,
        registerDeadline: futureDate,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue(null);
      mockPrisma.hackathonRegistration.create.mockResolvedValue({ id: 'r1' });

      await expect(service.register('u1', 'h1')).resolves.toMatchObject({ id: 'r1' });
    });

    it('hackathon 不存在应抛 NotFoundException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue(null);

      await expect(service.register('u1', 'h-bad')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // cancelRegistration
  // ============================================================
  describe('cancelRegistration', () => {
    it('已报名应成功取消 (status: registered → cancelled)', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'registered',
      });
      mockPrisma.hackathonRegistration.update.mockResolvedValue({
        id: 'r1',
        status: 'cancelled',
      });

      const result = await service.cancelRegistration('u1', 'h1');

      expect(result).toMatchObject({ status: 'cancelled' });
      expect(mockPrisma.hackathonRegistration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'cancelled' },
        }),
      );
    });

    it('未报名应抛 BadRequestException (尚未报名)', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue(null);

      await expect(service.cancelRegistration('u1', 'h1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('已 cancelled 状态再取消应抛 BadRequestException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'cancelled',
      });

      await expect(service.cancelRegistration('u1', 'h1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================================
  // createTeam
  // ============================================================
  describe('createTeam', () => {
    it('应创建队伍 + captain teamMember (走 $transaction)', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'registered',
      });
      mockPrisma.team.findFirst.mockResolvedValue(null); // 无重名
      mockPrisma.teamMember.findFirst.mockResolvedValue(null); // 未加入其他队
      const team = { id: 't1', hackathonId: 'h1', name: 'Alpha', captainId: 'u1' };
      mockPrisma.team.create.mockResolvedValue(team);
      mockPrisma.teamMember.create.mockResolvedValue({
        teamId: 't1',
        userId: 'u1',
        role: 'captain',
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        ...team,
        members: [{ teamId: 't1', userId: 'u1', role: 'captain' }],
      });

      const result = await service.createTeam('u1', 'h1', {
        name: 'Alpha',
        slogan: 'go',
      });

      expect(result).toMatchObject({ id: 't1', name: 'Alpha' });
      // $transaction 必须被调用
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // tx.team.create + tx.teamMember.create 都在 callback 里跑
      expect(mockPrisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hackathonId: 'h1',
            name: 'Alpha',
            captainId: 'u1',
          }),
        }),
      );
      expect(mockPrisma.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: 't1',
            userId: 'u1',
            role: 'captain',
          }),
        }),
      );
    });

    it('未报名该 hackathon 应抛 ForbiddenException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue(null);

      await expect(
        service.createTeam('u1', 'h1', { name: 'Alpha' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('同 hackathon 已有同名队伍应抛 BadRequestException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        status: 'registered',
      });
      mockPrisma.team.findFirst.mockResolvedValue({ id: 't-other' });

      await expect(
        service.createTeam('u1', 'h1', { name: 'Alpha' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // joinTeam — 团队满员
  // ============================================================
  describe('joinTeam', () => {
    it('应成功加入队伍 (未满员)', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
        maxTeamSize: 5,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        status: 'registered',
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: 't1',
        hackathonId: 'h1',
        hackathon: { maxTeamSize: 5 },
        members: [
          { id: 'm1', userId: 'captain' },
          { id: 'm2', userId: 'other' },
        ],
      });
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);
      mockPrisma.teamMember.create.mockResolvedValue({
        teamId: 't1',
        userId: 'u1',
        role: 'member',
      });

      const result = await service.joinTeam('u1', 'h1', 't1');

      expect(result).toMatchObject({ teamId: 't1', userId: 'u1', role: 'member' });
    });

    it('队伍满员 (members.length >= maxTeamSize) 应抛 ForbiddenException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
        maxTeamSize: 2,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        status: 'registered',
      });
      // 队里 2 人 + hackathon maxTeamSize=2 → 满
      mockPrisma.team.findUnique.mockResolvedValue({
        id: 't1',
        hackathonId: 'h1',
        hackathon: { maxTeamSize: 2 },
        members: [{ id: 'm1' }, { id: 'm2' }],
      });
      mockPrisma.teamMember.findFirst.mockResolvedValue(null);

      await expect(service.joinTeam('u1', 'h1', 't1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.teamMember.create).not.toHaveBeenCalled();
    });

    it('已加入其他队伍应抛 BadRequestException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        status: 'registered',
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: 't1',
        hackathonId: 'h1',
        hackathon: { maxTeamSize: 5 },
        members: [],
      });
      mockPrisma.teamMember.findFirst.mockResolvedValue({ id: 'm-existing' });

      await expect(service.joinTeam('u1', 'h1', 't1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('team 不属于该 hackathon 应抛 NotFoundException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.upcoming,
      });
      mockPrisma.hackathonRegistration.findUnique.mockResolvedValue({
        status: 'registered',
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: 't1',
        hackathonId: 'h-OTHER', // 跨 hackathon
        hackathon: { maxTeamSize: 5 },
        members: [],
      });

      await expect(service.joinTeam('u1', 'h1', 't1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // judgeSubmission
  // ============================================================
  describe('judgeSubmission', () => {
    it('应更新 score / feedback / status', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.judging,
      });
      mockPrisma.submission.findFirst.mockResolvedValue({
        id: 's1',
        hackathonId: 'h1',
        status: SubmissionStatus.submitted,
      });
      mockPrisma.submission.update.mockResolvedValue({
        id: 's1',
        score: 88,
        feedback: 'good',
        status: SubmissionStatus.under_review,
      });

      const result = await service.judgeSubmission('h1', 's1', {
        score: 88,
        feedback: 'good',
      });

      expect(result).toMatchObject({ score: 88, status: SubmissionStatus.under_review });
      expect(mockPrisma.submission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: expect.objectContaining({
            score: 88,
            feedback: 'good',
            status: SubmissionStatus.under_review,
          }),
        }),
      );
    });

    it('submission 不存在应抛 NotFoundException', async () => {
      service = await buildService();
      mockPrisma.hackathon.findUnique.mockResolvedValue({
        id: 'h1',
        status: HackathonStatus.judging,
      });
      mockPrisma.submission.findFirst.mockResolvedValue(null);

      await expect(
        service.judgeSubmission('h1', 's-bad', { score: 50 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.submission.update).not.toHaveBeenCalled();
    });
  });
});
