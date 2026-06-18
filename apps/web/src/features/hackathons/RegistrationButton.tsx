import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, UserCheck, XCircle } from 'lucide-react';
import type { HackathonListItem, HackathonWithDetails } from '@opencsg/shared-types';
import { hackathonsApi } from '../../lib/hackathonsApi';

interface RegistrationButtonProps {
  hackathon: HackathonWithDetails | HackathonListItem;
}

export function RegistrationButton({ hackathon }: RegistrationButtonProps) {
  const queryClient = useQueryClient();

  const registerMutation = useMutation({
    mutationFn: () => hackathonsApi.register(hackathon.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon', hackathon.id] });
      queryClient.invalidateQueries({ queryKey: ['hackathons'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => hackathonsApi.cancelRegistration(hackathon.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon', hackathon.id] });
      queryClient.invalidateQueries({ queryKey: ['hackathons'] });
    },
  });

  const isRegistered = hackathon.myRegistration?.status === 'registered';
  const isCancelled = hackathon.myRegistration?.status === 'cancelled';
  const isPastDeadline =
    hackathon.registerDeadline && new Date(hackathon.registerDeadline) < new Date();
  const canRegister =
    !isRegistered && hackathon.status !== 'cancelled' && hackathon.status !== 'finished';

  if (isRegistered) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <CheckCircle className="w-4 h-4" /> 已报名
        </span>
        <button
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
          className="flex items-center gap-1.5 text-sm font-medium text-[#666666] hover:text-red-600 px-3 py-1.5 rounded-full border border-[#EEEDE9] hover:border-red-200 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" /> 取消报名
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => registerMutation.mutate()}
      disabled={!canRegister || isPastDeadline || registerMutation.isPending}
      className="flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-full text-sm font-bold hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <UserCheck className="w-4 h-4" />
      {isCancelled ? '重新报名' : isPastDeadline ? '报名已截止' : '立即报名'}
    </button>
  );
}
