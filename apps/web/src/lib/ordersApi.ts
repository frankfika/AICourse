import api from './api';
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  OrderWithItems,
} from '@opencsg/shared-types';

export const ordersApi = {
  myOrders: async (): Promise<OrderWithItems[]> => {
    const { data } = await api.get<OrderWithItems[]>('/api/v1/orders/me');
    return data;
  },
  // P1-8 新增: 单订单详情
  get: async (orderId: string): Promise<OrderWithItems> => {
    const { data } = await api.get<OrderWithItems>(`/api/v1/orders/${orderId}`);
    return data;
  },
  create: async (req: CreateOrderRequest): Promise<CreateOrderResponse> => {
    const { data } = await api.post<CreateOrderResponse>('/api/v1/orders', req);
    return data;
  },
  pay: async (orderId: string, paymentMethod = 'mock'): Promise<OrderWithItems> => {
    const { data } = await api.post<OrderWithItems>(`/api/v1/orders/${orderId}/pay`, {
      paymentMethod,
    });
    return data;
  },
  cancel: async (orderId: string): Promise<OrderWithItems> => {
    const { data } = await api.post<OrderWithItems>(`/api/v1/orders/${orderId}/cancel`);
    return data;
  },
  // P1-8 新增: 申请退款 (mock)
  refund: async (orderId: string, reason?: string): Promise<OrderWithItems> => {
    const { data } = await api.post<OrderWithItems>(`/api/v1/orders/${orderId}/refund`, {
      reason,
    });
    return data;
  },
};
