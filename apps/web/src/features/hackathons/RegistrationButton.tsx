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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest bg-white text-[#171717] px-3 py-2 border border-white">
          <CheckCircle className="w-3.5 h-3.5" /> Registered
        </span>
        <button
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/70 hover:text-white border border-white/30 px-3 py-2 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => registerMutation.mutate()}
      disabled={!canRegister || isPastDeadline || registerMutation.isPending}
      className="inline-flex items-center justify-between gap-6 bg-white text-[#171717] px-6 py-4 font-black uppercase tracking-wider text-sm hover:bg-[#EEEDE9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="flex items-center gap-2">
        <UserCheck className="w-4 h-4" />
        {isCancelled ? 'Re-Register' : isPastDeadline ? 'Closed' : 'Register Now'}
      </span>
    </button>
  );
}
