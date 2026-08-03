import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Plus, Server, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { aiProviderApi, type AiProvider, type UserAiProviderConfig } from '../../lib/aiProviderApi';

const PROVIDERS: Array<{ id: AiProvider; name: string; hint: string; defaultModel: string; baseUrl?: string }> = [
  { id: 'gemini', name: 'Google Gemini', hint: '适合轻量对话，支持 Gemini API Key', defaultModel: 'gemini-2.0-flash' },
  { id: 'openai', name: 'OpenAI', hint: '支持 GPT 系列模型', defaultModel: 'gpt-4o-mini' },
  { id: 'claude', name: 'Anthropic Claude', hint: '支持 Claude 系列模型', defaultModel: 'claude-3-5-sonnet-latest' },
  { id: 'openai-compatible', name: 'OpenAI 兼容接口', hint: 'DeepSeek、通义、硅基流动及自建网关', defaultModel: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'ollama', name: '本地 Ollama', hint: 'Key 可留空，适合本机模型', defaultModel: 'qwen2.5:7b', baseUrl: 'http://localhost:11434' },
];

export function AiSettingsPage() {
  const client = useQueryClient();
  const { data: configs = [], isLoading } = useQuery({ queryKey: ['ai-provider-configs'], queryFn: aiProviderApi.list });
  const [selected, setSelected] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const selectedMeta = useMemo(() => PROVIDERS.find((p) => p.id === selected)!, [selected]);
  const saved = configs.find((c) => c.provider === selected);
  useEffect(() => {
    if (isLoading) return;
    setModel(saved?.model || selectedMeta.defaultModel);
    setBaseUrl(saved?.baseUrl || selectedMeta.baseUrl || '');
  }, [isLoading, saved?.model, saved?.baseUrl, selectedMeta]);
  const save = useMutation({
    mutationFn: () => aiProviderApi.save({ provider: selected, apiKey: apiKey || undefined, model, baseUrl, isActive: true }),
    onSuccess: () => { setApiKey(''); void client.invalidateQueries({ queryKey: ['ai-provider-configs'] }); },
  });
  const remove = useMutation({
    mutationFn: () => aiProviderApi.remove(selected),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['ai-provider-configs'] }),
  });

  function choose(provider: AiProvider) {
    const meta = PROVIDERS.find((p) => p.id === provider)!;
    const current = configs.find((c) => c.provider === provider);
    setSelected(provider); setModel(current?.model || meta.defaultModel); setBaseUrl(current?.baseUrl || meta.baseUrl || ''); setApiKey(''); setShowKey(false);
  }

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 mb-8"><ArrowLeft className="w-4 h-4" />返回学习中心</Link>
        <div className="mb-8"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-[#171717] text-white flex items-center justify-center"><KeyRound className="w-5 h-5" /></div><div><h1 className="text-2xl font-semibold">AI 助教设置</h1><p className="text-sm text-neutral-500 mt-1">连接你自己的模型服务，Key 仅加密保存在你的账号下。</p></div></div></div>
        <div className="grid lg:grid-cols-[280px_1fr] gap-5">
          <section className="rounded-2xl border border-neutral-200 bg-white p-3 h-fit">
            <div className="px-3 py-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">接入方式</div>
            {PROVIDERS.map((provider) => {
              const active = configs.some((c) => c.provider === provider.id);
              return <button key={provider.id} onClick={() => choose(provider.id)} className={`w-full text-left rounded-xl p-3 flex items-center gap-3 transition ${selected === provider.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'}`}><span className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center"><Server className="w-4 h-4" /></span><span className="flex-1"><span className="block text-sm font-medium">{provider.name}</span><span className={`block text-xs mt-0.5 ${selected === provider.id ? 'text-neutral-300' : 'text-neutral-500'}`}>{active ? '已配置' : '未配置'}</span></span>{active && <Check className="w-4 h-4 text-emerald-500" />}</button>;
            })}
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4 mb-7"><div><h2 className="text-lg font-semibold">{selectedMeta.name}</h2><p className="text-sm text-neutral-500 mt-1">{selectedMeta.hint}</p></div>{saved && <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-3 py-1">已连接 · {saved.apiKeyMasked || '本地服务'}</span>}</div>
            <div className="space-y-5">
              {selected !== 'ollama' && <label className="block"><span className="text-sm font-medium">API Key {saved && <span className="text-neutral-400 font-normal">（留空则保留当前 Key）</span>}</span><div className="relative mt-2"><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type={showKey ? 'text' : 'password'} placeholder={saved?.apiKeyMasked || '粘贴你的 API Key'} className="w-full rounded-xl border border-neutral-200 px-4 py-3 pr-11 text-sm outline-none focus:border-neutral-900"/><button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-3 text-neutral-400">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></label>}
              <label className="block"><span className="text-sm font-medium">模型名称</span><input value={model} onChange={(e) => setModel(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" placeholder={selectedMeta.defaultModel} /></label>
              <label className="block"><span className="text-sm font-medium">Base URL <span className="text-neutral-400 font-normal">（可选）</span></span><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-900" placeholder={selectedMeta.baseUrl || '使用官方默认地址'} /></label>
            </div>
            <div className="mt-8 pt-5 border-t border-neutral-100 flex items-center justify-between"><p className="text-xs text-neutral-400 max-w-sm">你的 Key 不会展示给平台管理员，也不会写入浏览器本地存储。发送消息时由服务端安全转发。</p><div className="flex gap-2">{saved && <button onClick={() => remove.mutate()} className="rounded-xl px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4 inline mr-1" />移除</button>}<button onClick={() => save.mutate()} disabled={save.isPending || isLoading} className="rounded-xl px-5 py-2.5 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50"><Plus className="w-4 h-4 inline mr-1" />{save.isPending ? '保存中…' : '保存并启用'}</button></div></div>
            {save.isError && <p className="mt-3 text-sm text-red-600">保存失败，请检查配置后重试。</p>}
            {save.isSuccess && <p className="mt-3 text-sm text-emerald-600">已保存，AI 助教下次对话将使用此配置。</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
