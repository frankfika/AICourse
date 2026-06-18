import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateOrderDto, MockPayDto } from './orders.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('me')
  @ApiOperation({ summary: '我的订单' })
  async myOrders(@Request() req: { user: { userId: string } }) {
    return this.ordersService.findMyOrders(req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: '创建订单（免费商品会直接注册）' })
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(req.user.userId, dto);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Mock 支付（标记为已支付并完成注册）' })
  async pay(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: MockPayDto,
  ) {
    return this.ordersService.mockPay(req.user.userId, id, dto.paymentMethod);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '取消未支付订单' })
  async cancel(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.ordersService.cancel(req.user.userId, id);
  }
}