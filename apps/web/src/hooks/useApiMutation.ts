/**
 * useApiMutation — 统一错误处理的 useMutation 封装
 *
 * 自动 toast 错误 (从 axios 错误中提取后端 message), 简化 admin 页面 4 个 mutation 全无 onError 的问题。
 *
 * 用法:
 *   const createMutation = useApiMutation({
 *     mutationFn: (payload) => hackathonsApi.create(payload),
 *     successMessage: '已创建',
 *     invalidateKeys: [['admin-hackathons'], ['hackathons']],
 *     onSuccess: () => resetForm(),
 *   });
 */
import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '../components/auth/Toast';

/**
 * 从 Axios 错误响应中提取后端 message
 * 后端 AllExceptionsFilter 返 { statusCode, message, timestamp }
 */
function extractErrorMessage(err: any): string {
  // Axios 错误响应
  const data = err?.response?.data;
  if (data?.message) {
    // message 可能是 string 或 string[]
    if (Array.isArray(data.message)) {
      return data.message.join('; ');
    }
    return data.message;
  }
  if (err?.message) return err.message;
  return '操作失败';
}

interface UseApiMutationOptions<TData, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, any, TVariables, TContext>, 'onSuccess' | 'onError'> {
  /** 成功后 toast, 传 null/false 禁用 */
  successMessage?: string | false | null;
  /** 失败时 toast, 默认启用 (用后端 message), 传 false 禁用 */
  errorMessage?: string | false;
  /** 成功后自动 invalidate 这些 query keys */
  invalidateKeys?: ReadonlyArray<ReadonlyArray<unknown>>;
  /** 透传给 onSuccess 的额外回调 */
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
}

export function useApiMutation<
  TData = unknown,
  TVariables = void,
  TContext = unknown,
>(options: UseApiMutationOptions<TData, TVariables, TContext>) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const {
    successMessage,
    errorMessage = true,
    invalidateKeys = [],
    onSuccess: userOnSuccess,
    ...restOptions
  } = options;

  return useMutation<TData, any, TVariables, TContext>({
    ...restOptions,
    onSuccess: (data, variables, context) => {
      if (successMessage) {
        showToast(successMessage, 'success');
      }
      // 自动 invalidate
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key as unknown[] });
      }
      // 用户自定义 onSuccess
      userOnSuccess?.(data, variables, context);
    },
    onError: (err) => {
      if (errorMessage !== false) {
        const msg = typeof errorMessage === 'string' ? errorMessage : extractErrorMessage(err);
        showToast(msg, 'error');
      }
    },
  });
}
