import { OrdersService } from './orders.service';
import { CreateOrderDto, MockPayDto } from './orders.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    myOrders(req: {
        user: {
            userId: string;
        };
    }): Promise<({
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
    create(req: {
        user: {
            userId: string;
        };
    }, dto: CreateOrderDto): Promise<{
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
    pay(req: {
        user: {
            userId: string;
        };
    }, id: string, dto: MockPayDto): Promise<{
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
    cancel(req: {
        user: {
            userId: string;
        };
    }, id: string): Promise<{
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
}
