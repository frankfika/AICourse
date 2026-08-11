import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, KeyRound, Pencil, PlugZap, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useToast } from '../../components/auth/Toast';

interface AiConfigRow {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  isActive: boolean;
  verifiedAt: string | null;
  lastVerifyError: string | null;
  apiKeyMasked: string;
}

const PRESETS = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  qwen: {
    label: '通义千问 / DashScope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  siliconflow: {
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
  },
  gemini: {
    label: 'Gemini（OpenAI 兼容接口）',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
  },
} as const;

type PresetKey = keyof typeof PRESETS | 'custom';

interface AiConfigForm {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  isActive: boolean;
}

const emptyForm: AiConfigForm = {
  provider: 'openai',
  apiKey: '',
  model: PRESETS.openai.model,
  baseUrl: PRESETS.openai.baseUrl,
  isActive: true,
};

export function AdminAiPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<PresetKey>('openai');
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [form, setForm] = useState<AiConfigForm>(emptyForm);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['admin-ai-config'],
    queryFn: async () => (await api.get<AiConfigRow[]>('/api/v1/admin/ai/config')).data ?? [],
  });

  const saveMutation = useApiMutation({
    mutationFn: () => api.put<AiConfigRow>('/api/v1/admin/ai/config', form),
    successMessage: '配置已加密保存，请执行 Verify 后投入使用',
    invalidateKeys: [['admin-ai-config']],
    onSuccess: () => {
      setEditingProvider(form.provider);
      setForm((current) => ({ ...current, apiKey: '' }));
    },
  });

  const verifyMutation = useApiMutation({
    mutationFn: async (provider: string) => {
      let data: { ok: boolean; sample?: string; error?: string };
      try {
        data = (await api.post<typeof data>(
          `/api/v1/admin/ai/config/${encodeURIComponent(provider)}/verify`,
        )).data;
      } finally {
        // 成功、上游验证失败或 HTTP 异常都刷新持久化的验证状态。
        await queryClient.invalidateQueries({ queryKey: ['admin-ai-config'] });
      }
      if (!data.ok) {
        throw new Error(data.error || '连接验证失败');
      }
      return data;
    },
    successMessage: '验证通过，平台 AI 功能已可使用',
    invalidateKeys: [['admin-ai-config']],
  });

  const deleteMutation = useApiMutation({
    mutationFn: (provider: string) => api.delete(`/api/v1/admin/ai/config/${encodeURIComponent(provider)}`),
    successMessage: 'AI 配置已删除',
    invalidateKeys: [['admin-ai-config']],
  });

  const choosePreset = (next: PresetKey) => {
    setPreset(next);
    if (next === 'custom') {
      setForm({ provider: 'custom', apiKey: '', model: '', baseUrl: '', isActive: true });
      return;
    }
    const selected = PRESETS[next];
    setForm({ provider: next, apiKey: '', model: selected.model, baseUrl: selected.baseUrl, isActive: true });
  };

  const edit = (row: AiConfigRow) => {
    setEditingProvider(row.provider);
    setPreset((row.provider in PRESETS ? row.provider : 'custom') as PresetKey);
    setForm({
      provider: row.provider,
      apiKey: '',
      model: row.model,
      baseUrl: row.baseUrl ?? '',
      isActive: row.isActive,
    });
  };

  const reset = () => {
    setEditingProvider(null);
    setPreset('openai');
    setForm(emptyForm);
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-2">
          / Admin · AI
        </div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">AI 配置</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          平台统一使用 OpenAI-compatible API。Key 由管理员在这里填写并加密入库，不从业务配置文件读取。
          保存后必须 Verify；验证通过的 active 配置才会用于课程、学位和全局 AI 助手。
        </p>
      </header>

      <section className="border-2 border-neutral-900 bg-white p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-black uppercase tracking-widest">当前配置</h3>
          <span className="text-xs text-neutral-500">Key 永远只显示末 4 位</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-neutral-500">加载中…</p>
        ) : configs.length === 0 ? (
          <div className="border border-dashed border-neutral-400 p-4 text-sm text-neutral-600">
            尚未配置 AI 服务。请在下方选择预设或填写任意 OpenAI-compatible 接口。
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((row) => (
              <article key={row.id} className="border border-neutral-300 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-black uppercase">{PRESETS[row.provider as keyof typeof PRESETS]?.label ?? row.provider}</strong>
                      {row.isActive && <span className="bg-neutral-900 px-2 py-0.5 text-[10px] font-black uppercase text-white">Active</span>}
                      {row.verifiedAt ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                          <CircleAlert className="h-4 w-4" /> 待验证
                        </span>
                      )}
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-neutral-600">{row.baseUrl}</p>
                    <p className="mt-1 font-mono text-xs">{row.model} · {row.apiKeyMasked}</p>
                    {row.verifiedAt && <p className="mt-1 text-xs text-neutral-500">验证时间：{new Date(row.verifiedAt).toLocaleString()}</p>}
                    {row.lastVerifyError && <p className="mt-2 text-xs text-red-700">上次验证失败：{row.lastVerifyError}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => verifyMutation.mutate(row.provider)} disabled={verifyMutation.isPending}
                      className="inline-flex items-center gap-1 border border-neutral-900 px-3 py-2 text-xs font-black uppercase hover:bg-neutral-900 hover:text-white disabled:opacity-50">
                      <PlugZap className="h-4 w-4" /> Verify
                    </button>
                    <button type="button" onClick={() => edit(row)} className="inline-flex items-center gap-1 border border-neutral-900 px-3 py-2 text-xs font-black uppercase hover:bg-neutral-100">
                      <Pencil className="h-4 w-4" /> 编辑
                    </button>
                    <button type="button" onClick={() => {
                      if (window.confirm(`确认删除 ${row.provider} 配置？`)) deleteMutation.mutate(row.provider);
                    }} className="inline-flex items-center gap-1 border border-red-700 px-3 py-2 text-xs font-black uppercase text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" /> 删除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={(event) => {
        event.preventDefault();
        if (!editingProvider && form.apiKey.trim().length < 8) {
          showToast('请输入有效的 API Key', 'error');
          return;
        }
        if (!form.provider.trim() || !form.model.trim() || !form.baseUrl.trim()) {
          showToast('Provider、Base URL 和 Model 都不能为空', 'error');
          return;
        }
        saveMutation.mutate();
      }} className="border-2 border-neutral-900 bg-white p-5">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound className="h-5 w-5" />
          <h3 className="font-black uppercase tracking-widest">{editingProvider ? `编辑 ${editingProvider}` : '新增 AI 配置'}</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-600">服务预设</span>
            <select value={preset} onChange={(event) => choosePreset(event.target.value as PresetKey)} disabled={!!editingProvider}
              className="w-full border border-neutral-900 bg-white px-4 py-3 text-sm disabled:opacity-60">
              {Object.entries(PRESETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              <option value="custom">自定义 OpenAI-compatible 服务</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-600">Provider ID</span>
            <input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value.toLowerCase() })}
              disabled={!!editingProvider || preset !== 'custom'} placeholder="my-provider"
              className="w-full border border-neutral-900 px-4 py-3 text-sm font-mono disabled:opacity-60" />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-600">Model</span>
            <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="model-name"
              className="w-full border border-neutral-900 px-4 py-3 text-sm font-mono" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-600">OpenAI-compatible Base URL</span>
            <input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              placeholder="https://api.example.com/v1" className="w-full border border-neutral-900 px-4 py-3 text-sm font-mono" />
            <span className="mt-1 block text-xs text-neutral-500">系统会自动请求 Base URL + /chat/completions</span>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-neutral-600">
              API Key {editingProvider && <span className="normal-case tracking-normal text-neutral-400">（留空保留原 Key）</span>}
            </span>
            <input type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              placeholder="sk-..." autoComplete="new-password" className="w-full border border-neutral-900 px-4 py-3 text-sm font-mono" />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            保存为平台 active 配置（同一时间只允许一个）
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={saveMutation.isPending}
            className="bg-neutral-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50">
            {saveMutation.isPending ? '保存中…' : editingProvider ? '保存修改' : '加密保存'}
          </button>
          {editingProvider && <button type="button" onClick={reset} className="border border-neutral-900 px-5 py-3 text-xs font-black uppercase tracking-widest">取消</button>}
        </div>
      </form>
    </div>
  );
}
