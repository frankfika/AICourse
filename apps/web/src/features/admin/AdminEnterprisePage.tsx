import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Trash2, Mail, Phone } from 'lucide-react';
import api from '../../lib/api';
import { useEnum } from '../../lib/cms';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  company: string;
  teamSize: string;
  phone?: string;
  topic: string;
  description?: string;
  status: 'pending' | 'contacted' | 'qualified' | 'closed' | 'archived';
  createdAt: string;
}

const STATUS_OPTIONS: Inquiry['status'][] = ['pending', 'contacted', 'qualified', 'closed', 'archived'];

export function AdminEnterprisePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Inquiry['status'] | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { getLabel: getInquiryLabel } = useEnum('inquiry_status');

  const { data: inquiries } = useQuery({
    queryKey: ['admin-enterprise'],
    queryFn: async () => {
      const { data } = await api.get<Inquiry[]>('/api/v1/enterprise/inquiries');
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Inquiry['status'] }) =>
      api.patch(`/api/v1/enterprise/inquiries/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-enterprise'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/enterprise/inquiries/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-enterprise'] }),
  });

  const filtered = inquiries?.filter((i) => filter === 'all' || i.status === filter);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] dark:text-neutral-400 mb-2">
            / Admin · Enterprise
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">企业咨询</h2>
        </div>

        {/* Filter */}
        <div className="flex border border-[#171717] dark:border-neutral-50">
          {(['all', ...STATUS_OPTIONS] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                filter === s ? 'bg-[#171717] text-white' : 'bg-white dark:bg-neutral-100 text-[#171717] dark:text-neutral-50 hover:bg-[#EEEDE9] dark:hover:bg-neutral-800'
              } ${i < STATUS_OPTIONS.length ? 'border-r border-[#171717] dark:border-neutral-50' : ''}`}
            >
              {s === 'all' ? '全部' : getInquiryLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100">
        <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] dark:border-neutral-50 text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400">
          <div className="col-span-12 md:col-span-1">#</div>
          <div className="col-span-12 md:col-span-3">Company</div>
          <div className="col-span-12 md:col-span-2">Contact</div>
          <div className="col-span-12 md:col-span-2">Topic</div>
          <div className="col-span-12 md:col-span-1">Team</div>
          <div className="col-span-12 md:col-span-2">Status</div>
          <div className="col-span-12 md:col-span-1 text-right">Action</div>
        </div>
        {filtered?.map((inq, i) => (
          <div
            key={inq.id}
            className={`border-b border-[#EEEDE9] ${
              expanded === inq.id ? 'bg-[#F5F4F0] dark:bg-neutral-800' : 'hover:bg-[#F5F4F0] dark:hover:bg-neutral-800'
            } transition-colors`}
          >
            <div
              className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center text-sm cursor-pointer"
              onClick={() => setExpanded(expanded === inq.id ? null : inq.id)}
            >
              <div className="col-span-12 md:col-span-1 text-[10px] font-black text-[#A3A3A3]">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="col-span-12 md:col-span-3 font-black tracking-tight truncate flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 shrink-0" /> {inq.company}
              </div>
              <div className="col-span-12 md:col-span-2 text-xs">
                <div className="font-bold">{inq.name}</div>
                <div className="text-[#666666] dark:text-neutral-400">{inq.email}</div>
              </div>
              <div className="col-span-12 md:col-span-2 text-xs text-[#666666] dark:text-neutral-400 truncate">{inq.topic}</div>
              <div className="col-span-12 md:col-span-1 text-[10px] font-black uppercase tracking-widest">
                {inq.teamSize}
              </div>
              <div className="col-span-12 md:col-span-2" onClick={(e) => e.stopPropagation()}>
                <select
                  value={inq.status}
                  onChange={(e) =>
                    updateMutation.mutate({ id: inq.id, status: e.target.value as Inquiry['status'] })
                  }
                  className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100 ${
                    inq.status === 'pending' ? '' : ''
                  }`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {getInquiryLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => deleteMutation.mutate(inq.id)}
                  className="p-2 hover:bg-[#171717] hover:text-white transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expanded === inq.id && (
              <div className="px-6 pb-6 border-t border-[#EEEDE9]">
                <div className="grid md:grid-cols-2 gap-6 mt-4 text-sm">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 mb-2">
                      / Contact
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[#666666] dark:text-neutral-400 w-16 text-[10px] font-black uppercase tracking-widest">姓名</span>
                        <span className="font-bold">{inq.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#666666] dark:text-neutral-400 w-16 text-[10px] font-black uppercase tracking-widest">邮箱</span>
                        <a href={`mailto:${inq.email}`} className="font-medium hover:underline flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {inq.email}
                        </a>
                      </div>
                      {inq.phone && (
                        <div className="flex items-center gap-2">
                          <span className="text-[#666666] dark:text-neutral-400 w-16 text-[10px] font-black uppercase tracking-widest">电话</span>
                          <a href={`tel:${inq.phone}`} className="font-medium hover:underline flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {inq.phone}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[#666666] dark:text-neutral-400 w-16 text-[10px] font-black uppercase tracking-widest">公司</span>
                        <span className="font-bold">{inq.company}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#666666] dark:text-neutral-400 w-16 text-[10px] font-black uppercase tracking-widest">团队</span>
                        <span className="font-bold">{inq.teamSize} 人</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 mb-2">
                      / Topic
                    </div>
                    <div className="font-bold mb-3">{inq.topic}</div>
                    {inq.description && (
                      <>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] dark:text-neutral-400 mb-2">
                          / Description
                        </div>
                        <p className="text-[#666666] dark:text-neutral-400 leading-relaxed whitespace-pre-wrap">{inq.description}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#EEEDE9] text-[10px] font-black uppercase tracking-widest text-[#A3A3A3]">
                  提交时间 / {new Date(inq.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
            )}
          </div>
        ))}
        {(!filtered || filtered.length === 0) && (
          <div className="p-16 text-center text-sm text-[#666666] dark:text-neutral-400">暂无企业咨询</div>
        )}
      </div>
    </div>
  );
}
