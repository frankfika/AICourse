/**
 * auditLogsApi — 审计日志读
 *
 * GET /api/v1/audit-logs?userId=&entity=&action=&page=&limit=
 *   仅 admin 可读(后端 guard)
 */
import { api } from './api';

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export const auditLogsApi = {
  list: async (params: {
    userId?: string;
    entity?: string;
    action?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<AuditLogListResponse> => {
    const { data } = await api.get('/api/v1/audit-logs', { params });
    return data;
  },
};
