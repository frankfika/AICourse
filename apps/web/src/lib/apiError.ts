/**
 * ApiError — 统一的 API 错误类型
 *
 * 跟 axios error 配合使用:BindingsPage / auth 页面 catch 时 instanceof ApiError
 *
 * 用法:
 *   try { await api.post(...) } catch (err) {
 *     if (err instanceof ApiError) showToast(err.message, 'error');
 *   }
 */
import type { AxiosError } from 'axios';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(opts: {
    message: string;
    status: number;
    code?: string;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }

  static fromAxios(err: unknown, fallbackMessage = '网络错误'): ApiError {
    const ax = err as AxiosError<{ message?: string; code?: string }> | undefined;
    if (ax?.response) {
      return new ApiError({
        message: ax.response.data?.message ?? ax.message ?? fallbackMessage,
        status: ax.response.status,
        code: ax.response.data?.code,
        details: ax.response.data,
      });
    }
    if (ax?.message) {
      return new ApiError({ message: ax.message, status: 0 });
    }
    return new ApiError({
      message: err instanceof Error ? err.message : fallbackMessage,
      status: 0,
    });
  }
}
