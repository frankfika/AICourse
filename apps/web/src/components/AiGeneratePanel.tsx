import { useState } from 'react';
import { Sparkles, Loader2, X, Wand2 } from 'lucide-react';

interface AiGeneratePanelProps {
  type: 'course' | 'degree';
  onApply: (draft: any) => void;
  onGenerate: (topic: string, hint?: string) => Promise<any>;
  placeholder?: string;
}

/**
 * AI 智能填充面板
 * 管理员输入主题 → 后端生成草稿 → 一键应用到表单 → 仍可手动修改
 */
export function AiGeneratePanel({
  type,
  onApply,
  onGenerate,
  placeholder,
}: AiGeneratePanelProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('请输入主题或题目');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await onGenerate(topic.trim(), hint.trim() || undefined);
      setDraft(result);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '生成失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!draft) return;
    onApply(draft);
    setOpen(false);
    setDraft(null);
    setTopic('');
    setHint('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        AI 智能填充
      </button>
    );
  }

  return (
    <div className="border-2 border-[#171717] bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            AI 智能填充 · {type === 'course' ? '课程' : '学位'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDraft(null);
            setError(null);
          }}
          className="p-1 hover:bg-[#EEEDE9] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-[#666666] mb-4 leading-relaxed">
        输入一个题目或主题，AI 会自动生成标题、描述、学习要点、标签、缩略图等元数据。生成后仍可在下方表单自由修改。
      </p>

      <div className="space-y-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={placeholder ?? '例：RAG 系统实战：从零搭建企业知识库'}
          className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
        />
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          rows={2}
          placeholder="附加要求（可选）：如目标受众、难度、风格、必含模块..."
          className="w-full px-4 py-3 border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors resize-none"
        />

        {error && (
          <div className="px-3 py-2 border border-red-600 bg-red-50 text-red-700 text-xs">
            {error}
          </div>
        )}

        {draft && (
          <div className="border border-[#171717] p-4 bg-[#F5F4F0] space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2">
              / AI Generated Draft
            </div>
            <DraftRow label="标题" value={draft.title} />
            <DraftRow label="讲师" value={draft.instructor} />
            <DraftRow label="难度" value={draft.level} />
            <DraftRow label="时长" value={draft.duration} />
            <DraftRow label="类型" value={draft.costType} />
            {draft.price !== undefined && <DraftRow label="价格" value={`¥${draft.price}`} />}
            <DraftRow label="标签" value={draft.tags} />
            <DraftRow label="描述" value={draft.description} multiline />
            {draft.learningPoints && (
              <DraftRow label="学习要点" value={draft.learningPoints} multiline />
            )}
            {draft.thumbnail && (
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] w-16 shrink-0">
                  封面
                </span>
                <img src={draft.thumbnail} alt="draft" className="w-32 h-20 object-cover border border-[#171717]" />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!draft ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> 生成中
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> 生成草稿
                </>
              )}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors"
              >
                应用到表单
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#EEEDE9] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                重新生成
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] w-16 shrink-0 mt-0.5">
        {label}
      </span>
      <span className={`text-sm font-medium flex-1 ${multiline ? 'whitespace-pre-wrap leading-relaxed' : ''}`}>
        {value}
      </span>
    </div>
  );
}
