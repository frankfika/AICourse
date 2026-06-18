import { OrderType } from '@prisma/client';
export declare class CreateOrderDto {
    type: OrderType;
    courseId?: string;
    degreeId?: string;
    paymentMethod?: string;
}
export declare class MockPayDto {
    paymentMethod?: string;
}
