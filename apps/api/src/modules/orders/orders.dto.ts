import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderType } from '@prisma/client';

export class CreateOrderDto {
  @IsEnum(OrderType)
  type: OrderType;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  degreeId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class MockPayDto {
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class RefundOrderDto {
  // mock: 当前无字段, 占位方便后续扩展 reason
  @IsOptional()
  @IsString()
  reason?: string;
}
