import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '../../lib/ordersApi';
import { useAuthStore } from '../../stores/authStore';
import { usePageSettings, useI18n, pickPage } from '../../lib/cms';

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

  // CMS-driven copy
  const { t } = useI18n();
  const { data: pageData } = usePageSettings('purchase', [
    'confirm_title_template', 'confirm_desc_template',
    'success_title_template', 'success_desc_template',
    'go_learn', 'pay_now', 'enroll_now',
  ]);
  const isFree = costType === 'free' || costType === 'charity';
  // 简化版 title: 用两个独立 key(避免 i18n template 复杂度)
  const confirmTitle = isFree
    ? pickPage(pageData, 'confirm_title_free', 'zh-CN', t('purchase.confirm_title_free', '确认报名'))
    : pickPage(pageData, 'confirm_title_paid', 'zh-CN', t('purchase.confirm_title_paid', '确认下单'));
  const confirmDesc = isFree
    ? pickPage(pageData, 'confirm_desc_free', 'zh-CN', t('purchase.confirm_desc_free', '该内容免费,注册后即可开始学习'))
    : pickPage(pageData, 'confirm_desc_paid', 'zh-CN', t('purchase.confirm_desc_paid', '请确认订单信息,支付后立即开通学习权限'));
  const successTitle = isFree
    ? pickPage(pageData, 'success_title_free', 'zh-CN', t('purchase.success_title_free', '报名成功'))
    : pickPage(pageData, 'success_title_paid', 'zh-CN', t('purchase.success_title_paid', '支付成功'));
  const successDesc = type === 'degree'
    ? pickPage(pageData, 'success_desc_degree', 'zh-CN', t('purchase.success_desc_degree', '已同步开通学位下所有课程,立即开始学习吧'))
    : pickPage(pageData, 'success_desc_course', 'zh-CN', t('purchase.success_desc_course', '课程已开通,去个人中心开始学习吧'));
  const goLearn = pickPage(pageData, 'go_learn', 'zh-CN', t('purchase.go_learn', '开始学习'));

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

  const handleConfirm = async () => {
    const res = await createMutation.mutateAsync();
    if (res.enrolled) {
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

  const handleGoLearn = () => {
    close();
    navigate('/profile');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
      <div className="bg-white border-2 border-[#171717] max-w-md w-full p-6 md:p-8 relative animate-in zoom-in-95">
        <button
          onClick={close}
          className="absolute top-3 right-3 p-2 hover:bg-[#EEEDE9]"
        >
          <X className="w-4 h-4" />
        </button>

        {step === 'confirm' && (
          <>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2">
              / {isFree ? t('purchase.eyebrow.enroll', 'Enroll') : t('purchase.eyebrow.checkout', 'Checkout')}
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">
              {confirmTitle}
            </h2>
            <p className="text-sm text-[#666666] mb-6">
              {confirmDesc}
            </p>

            <div className="border-2 border-[#171717] p-5 mb-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-1">
                / {type === 'course' ? t('purchase.field.course', 'Course') : t('purchase.field.degree', 'Degree')}
              </div>
              <div className="font-black text-lg mb-4 tracking-tight">{title}</div>
              <div className="flex items-center justify-between pt-4 border-t border-[#171717]">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
                  {isFree ? t('purchase.label.free', 'Free') : t('purchase.label.total', 'Total')}
                </span>
                <span className="text-2xl font-black tracking-tighter">
                  {isFree ? t('purchase.label.free_zh', '免费') : `¥${Number(price).toFixed(2)}`}
                </span>
              </div>
            </div>

            {!user && (
              <div className="text-sm font-medium border-2 border-[#171717] px-3 py-2 mb-4 bg-[#F5F4F0]">
                {t('purchase.guest_warning', '请先登录后再购买')}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={close}
                className="flex-1 py-3 border-2 border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
              >
                {t('purchase.cancel', '取消')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!user || createMutation.isPending}
                className="flex-1 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : isFree ? (
                  t('purchase.enroll_now', '立即报名')
                ) : (
                  t('purchase.pay_now', '立即支付')
                )}
              </button>
            </div>

            {createMutation.error && (
              <div className="text-sm text-red-600 mt-3 text-center">
                {(createMutation.error as any)?.response?.data?.message ?? t('purchase.error.fail', '操作失败')}
              </div>
            )}
          </>
        )}

        {step === 'paying' && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#171717] mb-4" />
            <div className="font-black text-lg tracking-tight">{t('common.paying', '支付中…')}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mt-2">
              {t('common.paying.suffix', '支付通道待接入 · 当前为测试环境')}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto bg-[#171717] text-white flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black tracking-tighter mb-2">
              {successTitle}
            </h2>
            <p className="text-sm text-[#666666] mb-6">
              {successDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={close}
                className="flex-1 py-3 border-2 border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors"
              >
                {t('purchase.later', '稍后')}
              </button>
              <button
                onClick={handleGoLearn}
                className="flex-1 py-3 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
              >
                {goLearn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
