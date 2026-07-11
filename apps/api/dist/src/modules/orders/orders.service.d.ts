import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './orders.dto';
export declare class OrdersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findMyOrders(userId: string): Promise<({
        course: {
            id: string;
            title: string;
            thumbnail: string;
        } | null;
        degree: {
            id: string;
            title: string;
            thumbnail: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.OrderStatus;
        type: import("@prisma/client").$Enums.OrderType;
        userId: string;
        courseId: string | null;
        degreeId: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentMethod: string | null;
        currency: string;
        transactionId: string | null;
        paidAt: Date | null;
    })[]>;
    createOrder(userId: string, dto: CreateOrderDto): Promise<{
        enrolled: boolean;
        enrollment: {
            id: string;
            userId: string;
            expiresAt: Date | null;
            courseId: string | null;
            degreeId: string | null;
            enrolledAt: Date;
            source: import("@prisma/client").$Enums.EnrollmentSource;
        };
        order?: undefined;
    } | {
        enrolled: boolean;
        order: {
            course: {
                id: string;
                title: string;
                thumbnail: string;
            } | null;
            degree: {
                id: string;
                title: string;
                thumbnail: string | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.OrderStatus;
            type: import("@prisma/client").$Enums.OrderType;
            userId: string;
            courseId: string | null;
            degreeId: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            paymentMethod: string | null;
            currency: string;
            transactionId: string | null;
            paidAt: Date | null;
        };
        enrollment?: undefined;
    }>;
    mockPay(userId: string, orderId: string, paymentMethod?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.OrderStatus;
        type: import("@prisma/client").$Enums.OrderType;
        userId: string;
        courseId: string | null;
        degreeId: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentMethod: string | null;
        currency: string;
        transactionId: string | null;
        paidAt: Date | null;
    } | null>;
    private randomTransactionId;
    cancel(userId: string, orderId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.OrderStatus;
        type: import("@prisma/client").$Enums.OrderType;
        userId: string;
        courseId: string | null;
        degreeId: string | null;
        amount: import("@prisma/client/runtime/library").Decimal;
        paymentMethod: string | null;
        currency: string;
        transactionId: string | null;
        paidAt: Date | null;
    }>;
    private enrollAllDegreeCourses;
    private enrollAllDegreeCoursesTx;
}
