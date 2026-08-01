import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController production payment guard', () => {
  const service = {
    mockPay: jest.fn(),
    refundOrder: jest.fn(),
  } as unknown as OrdersService;

  beforeEach(() => jest.clearAllMocks());

  it('rejects mock payment and refund in production', async () => {
    const config = { get: jest.fn(() => 'production') } as unknown as ConfigService;
    const controller = new OrdersController(service, config);
    const request = { user: { userId: 'u1' } };

    await expect(controller.pay(request, 'o1', {})).rejects.toThrow(ServiceUnavailableException);
    await expect(controller.refund(request, 'o1', {})).rejects.toThrow(ServiceUnavailableException);
    expect(service.mockPay).not.toHaveBeenCalled();
    expect(service.refundOrder).not.toHaveBeenCalled();
  });

  it('keeps development payment flows available for local testing', async () => {
    const config = { get: jest.fn(() => 'development') } as unknown as ConfigService;
    const controller = new OrdersController(service, config);
    const request = { user: { userId: 'u1' } };
    (service.mockPay as jest.Mock).mockResolvedValue({ id: 'o1', status: 'paid' });

    await expect(controller.pay(request, 'o1', { paymentMethod: 'alipay' })).resolves.toEqual({
      id: 'o1',
      status: 'paid',
    });
    expect(service.mockPay).toHaveBeenCalledWith('u1', 'o1', 'alipay');
  });
});
