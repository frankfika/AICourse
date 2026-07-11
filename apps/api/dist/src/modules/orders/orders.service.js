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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let OrdersService = class OrdersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findMyOrders(userId) {
        return this.prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                course: { select: { id: true, title: true, thumbnail: true } },
                degree: { select: { id: true, title: true, thumbnail: true } },
            },
        });
    }
    async createOrder(userId, dto) {
        let amount = 0;
        let costType;
        if (dto.type === client_1.OrderType.course) {
            if (!dto.courseId)
                throw new common_1.BadRequestException('courseId required');
            const course = await this.prisma.course.findUnique({
                where: { id: dto.courseId },
            });
            if (!course)
                throw new common_1.NotFoundException('Course not found');
            costType = course.costType;
            const existing = await this.prisma.enrollment.findUnique({
                where: { userId_courseId: { userId, courseId: dto.courseId } },
            });
            if (existing)
                throw new common_1.ConflictException('Already enrolled');
            if (costType === client_1.CostType.free) {
                const enrollment = await this.prisma.enrollment.create({
                    data: { userId, courseId: dto.courseId, source: 'direct' },
                });
                return { enrolled: true, enrollment };
            }
            amount = Number(course.price);
        }
        else if (dto.type === client_1.OrderType.degree) {
            if (!dto.degreeId)
                throw new common_1.BadRequestException('degreeId required');
            const degree = await this.prisma.nanoDegree.findUnique({
                where: { id: dto.degreeId },
            });
            if (!degree)
                throw new common_1.NotFoundException('Degree not found');
            costType = degree.costType;
            const existing = await this.prisma.enrollment.findUnique({
                where: { userId_degreeId: { userId, degreeId: dto.degreeId } },
            });
            if (existing)
                throw new common_1.ConflictException('Already enrolled');
            if (costType === client_1.CostType.free) {
                const enrollment = await this.prisma.enrollment.create({
                    data: { userId, degreeId: dto.degreeId, source: 'direct' },
                });
                await this.enrollAllDegreeCourses(userId, dto.degreeId);
                return { enrolled: true, enrollment };
            }
            amount = Number(degree.price);
        }
        else {
            throw new common_1.BadRequestException('Invalid order type');
        }
        const order = await this.prisma.order.create({
            data: {
                userId,
                type: dto.type,
                courseId: dto.courseId,
                degreeId: dto.degreeId,
                amount,
                currency: 'CNY',
                paymentMethod: dto.paymentMethod ?? null,
                status: client_1.OrderStatus.pending,
            },
            include: {
                course: { select: { id: true, title: true, thumbnail: true } },
                degree: { select: { id: true, title: true, thumbnail: true } },
            },
        });
        return { enrolled: false, order };
    }
    async mockPay(userId, orderId, paymentMethod) {
        const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!existing)
            throw new common_1.NotFoundException('Order not found');
        if (existing.userId !== userId)
            throw new common_1.BadRequestException('Not your order');
        if (existing.status === client_1.OrderStatus.paid) {
            throw new common_1.ConflictException('Order already paid');
        }
        if (existing.status === client_1.OrderStatus.expired || existing.status === client_1.OrderStatus.refunded) {
            throw new common_1.BadRequestException('Order is no longer payable');
        }
        const transactionId = `mock_${this.randomTransactionId()}`;
        const paidOrder = await this.prisma.$transaction(async (tx) => {
            const updateResult = await tx.order.updateMany({
                where: { id: orderId, status: client_1.OrderStatus.pending },
                data: {
                    status: client_1.OrderStatus.paid,
                    paidAt: new Date(),
                    paymentMethod: paymentMethod ?? existing.paymentMethod ?? 'mock',
                    transactionId,
                },
            });
            if (updateResult.count === 0) {
                throw new common_1.ConflictException('Order already processed');
            }
            if (existing.type === client_1.OrderType.course && existing.courseId) {
                await tx.enrollment.upsert({
                    where: {
                        userId_courseId: {
                            userId,
                            courseId: existing.courseId,
                        },
                    },
                    update: {},
                    create: { userId, courseId: existing.courseId, source: 'order' },
                });
            }
            else if (existing.type === client_1.OrderType.degree && existing.degreeId) {
                await tx.enrollment.upsert({
                    where: {
                        userId_degreeId: {
                            userId,
                            degreeId: existing.degreeId,
                        },
                    },
                    update: {},
                    create: { userId, degreeId: existing.degreeId, source: 'order' },
                });
                await this.enrollAllDegreeCoursesTx(tx, userId, existing.degreeId);
            }
            return tx.order.findUnique({ where: { id: orderId } });
        });
        return paidOrder;
    }
    randomTransactionId() {
        const { randomBytes } = require('crypto');
        return randomBytes(8).toString('hex');
    }
    async cancel(userId, orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.userId !== userId)
            throw new common_1.BadRequestException('Not your order');
        if (order.status === client_1.OrderStatus.paid) {
            throw new common_1.BadRequestException('Paid order cannot be cancelled');
        }
        return this.prisma.order.update({
            where: { id: orderId },
            data: { status: client_1.OrderStatus.expired },
        });
    }
    async enrollAllDegreeCourses(userId, degreeId) {
        const links = await this.prisma.degreeCourse.findMany({
            where: { degreeId },
            select: { courseId: true },
        });
        for (const link of links) {
            await this.prisma.enrollment.upsert({
                where: {
                    userId_courseId: { userId, courseId: link.courseId },
                },
                update: {},
                create: { userId, courseId: link.courseId, source: 'order' },
            });
        }
    }
    async enrollAllDegreeCoursesTx(tx, userId, degreeId) {
        const links = await tx.degreeCourse.findMany({
            where: { degreeId },
            select: { courseId: true },
        });
        for (const link of links) {
            await tx.enrollment.upsert({
                where: {
                    userId_courseId: { userId, courseId: link.courseId },
                },
                update: {},
                create: { userId, courseId: link.courseId, source: 'order' },
            });
        }
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map