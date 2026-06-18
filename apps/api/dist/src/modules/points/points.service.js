"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsService = void 0;
exports.calculateLevel = calculateLevel;
exports.levelThreshold = levelThreshold;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function calculateLevel(points) {
    return Math.floor(Math.sqrt(points / 100)) + 1;
}
function levelThreshold(level) {
    return Math.max(0, (level - 1) ** 2 * 100);
}
let PointsService = class PointsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUserPoints(userId) {
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
    async award(userId, amount, reason, refType, refId) {
        if (amount === 0)
            return null;
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
            if (existing)
                return null;
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
};
exports.PointsService = PointsService;
exports.PointsService = PointsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PointsService);
//# sourceMappingURL=points.service.js.map