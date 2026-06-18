import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '../../lib/ordersApi';
import { useAuthStore } from '../../stores/authStore';

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  type: 'course' | 'degree';
  itemId: string;
  title: string;
  price: number;
  costType: 'free' | 'paid' | 'charity';
}

type Step = 'confirm' | 'paying' | 'success';

export function PurchaseModal({
  open,
  onClose,
  type,
  itemId,
  title,
  price,
  costType,
}: PurchaseModalProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('confirm');

  const createMutation = useMutation({
    mutationFn: () =>
      ordersApi.create({
        type,
        courseId: type === 'course' ? itemId : undefined,
        degreeId: type === 'degree' ? itemId : undefined,
      }),
  });

  const payMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.pay(orderId, 'mock'),
  });

  if (!open) return null;

  const isFree = costType === 'free' || costType === 'charity';

  const handleConfirm = async () => {
    const res = await createMutation.mutateAsync();
    if (res.enrolled) {
      // 免费直接注册成功
      setStep('success');
      qc.invalidateQueries({ queryKey: ['enrollments', 'me'] });
      return;
    }
    if (res.order) {
      setStep('paying');
      try {
        await payMutation.mutateAsync(res.order.id);
        setStep('success');
        qc.invalidateQueries({ queryKey: ['enrollments', 'me'] });
      } catch {
        setStep('confirm');
      }
    }
  };

  const close = () => {
    setStep('confirm');
    onClose();
  };

  const goLearn = () => {
    close();
    navigate('/profile');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 md:p-8 relative animate-in zoom-in-95">
        <button
          onClick={close}
          className="absolute top-4 right-4 p-2 hover:bg-[#F5F4F0] rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'confirm' && (
          <>
            <h2 className="text-2xl font-bold mb-2">
              {isFree ? '确认报名' : '确认下单'}
            </h2>
            <p className="text-sm text-[#666666] mb-6">
              {isFree ? '该内容免费，注册后即可开始学习' : '请确认订单信息，支付后立即开通学习权限'}
            </p>

            <div className="bg-[#F5F4F0] rounded-xl p-5 mb-6">
              <div className="text-xs text-[#666666] mb-1">
                {type === 'course' ? '课程' : '学位'}
              </div>
              <div className="font-bold text-lg mb-4">{title}</div>
              <div className="flex items-center justify-between pt-4 border-t border-[#EEEDE9]">
                <span className="text-sm text-[#666666]">应付金额</span>
                <span className="text-2xl font-bold">
                  {isFree ? '免费' : `¥${Number(price).toFixed(2)}`}
                </span>
              </div>
            </div>

            {!user && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                请先登录后再购买
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={close}
                className="flex-1 py-3 rounded-xl border border-[#EEEDE9] font-bold text-[#666666] hover:bg-[#F5F4F0]"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!user || createMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-[#171717] text-white font-bold hover:bg-[#333] disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : isFree ? (
                  '立即报名'
                ) : (
                  '立即支付'
                )}
              </button>
            </div>

            {createMutation.error && (
              <div className="text-sm text-red-600 mt-3 text-center">
                {(createMutation.error as any)?.response?.data?.message ?? '操作失败'}
              </div>
            )}
          </>
        )}

        {step === 'paying' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#171717] mb-4" />
            <div className="font-bold text-lg">支付中…</div>
            <div className="text-sm text-[#666666] mt-2">Mock 支付，实际未发生扣款</div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {isFree ? '报名成功' : '支付成功'}
            </h2>
            <p className="text-sm text-[#666666] mb-6">
              {type === 'degree'
                ? '已同步开通学位下所有课程，立即开始学习吧'
                : '课程已开通，去个人中心开始学习吧'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={close}
                className="flex-1 py-3 rounded-xl border border-[#EEEDE9] font-bold text-[#666666] hover:bg-[#F5F4F0]"
              >
                稍后
              </button>
              <button
                onClick={goLearn}
                className="flex-1 py-3 rounded-xl bg-[#171717] text-white font-bold hover:bg-[#333]"
              >
                开始学习
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}