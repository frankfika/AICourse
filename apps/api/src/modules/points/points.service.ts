import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 根据累计积分计算等级（曲线递增） */
export function calculateLevel(points: number): number {
  return Math.floor(Math.sqrt(points / 100)) + 1;
}

/** 当前等级起始积分 */
export function levelThreshold(level: number): number {
  return Math.max(0, (level - 1) ** 2 * 100);
}

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取当前用户积分、等级与升级进度 */
  async getUserPoints(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, points: true, level: true },
    });

    if (!user) {
      return {
        points: 0,
        level: 1,
        currentLevelPoints: 0,
        nextLevelPoints: 100,
        pointsToNextLevel: 100,
        recentTransactions: [],
      };
    }

    const level = calculateLevel(user.points);
    const currentLevelPoints = levelThreshold(level);
    const nextLevelPoints = levelThreshold(level + 1);
    const pointsToNextLevel = Math.max(0, nextLevelPoints - user.points);

    const recentTransactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      points: user.points,
      level,
      currentLevelPoints,
      nextLevelPoints,
      pointsToNextLevel,
      recentTransactions,
    };
  }

  /**
   * 发放积分（幂等）
   * @returns 成功发放的 transaction，若已存在则返回 null
   */
  async award(
    userId: string,
    amount: number,
    reason: string,
    refType?: string | null,
    refId?: string | null,
  ) {
    if (amount === 0) return null;

    // 幂等：同一来源不重复发放
    if (refType && refId) {
      const existing = await this.prisma.pointTransaction.findUnique({
        where: {
          userId_refType_refId: {
            userId,
            refType,
            refId,
          },
        },
      });
      if (existing) return null;
    }

    const transaction = await this.prisma.pointTransaction.create({
      data: {
        userId,
        amount,
        reason,
        refType: refType ?? null,
        refId: refId ?? null,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (user) {
      const newPoints = user.points + amount;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          points: newPoints,
          level: calculateLevel(newPoints),
        },
      });
    }

    return transaction;
  }
}
