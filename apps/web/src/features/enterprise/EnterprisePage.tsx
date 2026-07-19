import { useState } from 'react';
import {
  Building2,
  ArrowUpRight,
  Check,
  Mail,
  Phone,
  User as UserIcon,
  Building,
  Target,
  Sparkles,
  Send,
  Zap,
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import api from '../../lib/api';

interface InquiryForm {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  phone: string;
  topic: string;
  description: string;
}

const initialForm: InquiryForm = {
  name: '',
  email: '',
  company: '',
  teamSize: '1-10',
  phone: '',
  topic: '',
  description: '',
};

const TEAM_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

export function EnterprisePage() {
  const [form, setForm] = useState<InquiryForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/v1/enterprise/inquiries', form);
      setSuccess(true);
      setForm(initialForm);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '提交失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F5F4F0] text-[#171717]">
      {/* ==================== HERO (FULL BLACK) ==================== */}
      <section className="border-b border-[#171717] bg-[#171717] text-white">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> / Enterprise Training
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-[8rem] font-black tracking-tighter uppercase leading-[0.9] mb-8">
            Build
            <br />
            Your
            <br />
            <span className="text-white/40">AI Team.</span>
          </h1>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-3xl mb-12">
            1v1 咨询 + 定制化课程路径。从战略对齐到实战交付，我们与你的团队并肩作战，把 AI 真正变成生产力。
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#inquiry"
              className="inline-flex items-center justify-between gap-6 bg-white text-[#171717] px-6 py-5 font-black uppercase tracking-wider text-sm hover:bg-[#EEEDE9] transition-colors"
            >
              <span>Book 1v1 Consultation</span>
              <ArrowUpRight className="w-5 h-5" />
            </a>
            <a
              href="#cases"
              className="inline-flex items-center justify-between gap-6 border border-white/30 text-white px-6 py-5 font-black uppercase tracking-wider text-sm hover:bg-white/10 transition-colors"
            >
              <span>View Cases</span>
              <ArrowUpRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ==================== STATS BAR ==================== */}
      <section className="border-b border-[#171717] bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {[
            { num: '50+', label: 'Enterprise Clients' },
            { num: '10K+', label: 'Trained Engineers' },
            { num: '98%', label: 'Satisfaction Rate' },
            { num: '12+', label: 'Industries Covered' },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`p-8 md:p-10 ${i < 3 ? 'border-r border-[#171717]' : ''} ${
                i < 2 ? 'border-b md:border-b-0 border-[#171717]' : ''
              }`}
            >
              <div className="text-4xl md:text-5xl font-black tracking-tighter mb-2">{s.num}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== METHODOLOGY (3-STEP) ==================== */}
      <section className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
            / 01 Method
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none mb-12">
            How We<br />Work
          </h2>

          <div className="border-t border-l border-[#171717]">
            {[
              {
                num: '01',
                icon: Target,
                title: '战略对齐',
                desc: '深入理解业务目标与团队现状，识别 AI 应用的高价值场景，输出定制化能力地图。',
                bullets: ['业务场景调研', 'AI 能力评估', 'ROI 测算', '实施路线图'],
              },
              {
                num: '02',
                icon: GraduationCap,
                title: '路径设计',
                desc: '基于岗位与职级，定制从入门到专家的培养路径，理论与实战项目深度结合。',
                bullets: ['岗位能力模型', '课程组合设计', '实战项目选题', '考核评估机制'],
              },
              {
                num: '03',
                icon: Briefcase,
                title: '实战交付',
                desc: '用真实业务问题驱动学习，导师全程陪跑，交付可量化的业务成果。',
                bullets: ['1v1 导师陪跑', '项目代码评审', '业务指标达成', '长期社区支持'],
              },
            ].map(({ num, icon: Icon, title, desc, bullets }) => (
              <div
                key={num}
                className="grid grid-cols-1 md:grid-cols-12 border-b border-r border-[#171717] hover:bg-[#EEEDE9] transition-colors"
              >
                <div className="md:col-span-3 p-8 border-b md:border-b-0 md:border-r border-[#171717] flex flex-col gap-4 justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A3A3A3]">
                    Step
                  </span>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-7xl font-black tracking-tighter leading-[0.85] text-[#171717]">
                      {num}
                    </span>
                    <Icon className="w-7 h-7 text-[#171717]" />
                  </div>
                </div>
                <div className="md:col-span-5 p-8 border-b md:border-b-0 md:border-r border-[#171717]">
                  <h3 className="text-2xl font-black tracking-tight mb-3">{title}</h3>
                  <p className="text-sm text-[#666666] leading-relaxed">{desc}</p>
                </div>
                <div className="md:col-span-4 p-8 flex flex-col gap-2 justify-center">
                  {bullets.map((b) => (
                    <div
                      key={b}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#171717]"
                    >
                      <Check className="w-3.5 h-3.5" /> {b}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CASES (BENTO) ==================== */}
      <section id="cases" className="border-b border-[#171717]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-3">
                / 02 Cases
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">
                Trusted By
              </h2>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#666666]">
              Industries We Serve
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-[#171717]">
            {[
              { label: '金融 / Fintech', desc: '风控、量化、智能客服' },
              { label: '电商 / Retail', desc: '推荐系统、搜索、营销' },
              { label: '制造 / Manufacturing', desc: '质检、排产、预测维护' },
              { label: '医疗 / Healthcare', desc: '影像诊断、临床辅助' },
              { label: '教育 / Education', desc: '个性化学习、智能评测' },
              { label: '政企 / Government', desc: '文档处理、数据分析' },
              { label: '汽车 / Auto', desc: '自动驾驶、智能座舱' },
              { label: '媒体 / Media', desc: '内容生成、推荐分发' },
            ].map(({ label, desc }) => (
              <div
                key={label}
                className="p-6 border-b border-r border-[#171717] hover:bg-[#EEEDE9] transition-colors"
              >
                <div className="text-base font-black tracking-tight leading-tight mb-2">
                  {label}
                </div>
                <div className="text-xs text-[#666666] leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== INQUIRY FORM (SPLIT) ==================== */}
      <section id="inquiry" className="border-b border-[#171717] bg-[#171717] text-white">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: pitch */}
          <div className="p-10 md:p-16 lg:p-20 border-b lg:border-b-0 lg:border-r border-white/20 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 mb-8 w-fit">
              <span className="w-2 h-2 bg-white" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
                Get In Touch
              </span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.95] mb-6">
              Start<br />The<br />Conversation
            </h2>
            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
              填写右侧表单，我们的解决方案顾问会在 1 个工作日内联系你，提供 1v1 定制咨询。
            </p>

            <div className="space-y-4 border-t border-white/20 pt-8">
              <div className="flex items-center gap-4 text-sm font-medium text-white/70">
                <Mail className="w-4 h-4 text-white/50" />
                <span>enterprise@opencsg.com</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-medium text-white/70">
                <Phone className="w-4 h-4 text-white/50" />
                <span>+86 400-xxx-xxxx</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-medium text-white/70">
                <Building2 className="w-4 h-4 text-white/50" />
                <span>OpenCSG · Beijing · Shanghai · Shenzhen</span>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div className="p-10 md:p-16 lg:p-20 bg-[#F5F4F0] text-[#171717]">
            {success ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-[#171717] text-white flex items-center justify-center mb-6">
                  <Check className="w-8 h-8" strokeWidth={3} />
                </div>
                <h3 className="text-3xl font-black tracking-tighter mb-3 break-words">收到！</h3>
                <p className="text-[#666666] mb-8 max-w-md">
                  我们的解决方案顾问会在 1 个工作日内通过邮件或电话联系你。
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="text-[10px] font-black uppercase tracking-widest text-[#171717] hover:underline"
                >
                  再次提交 →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-6">
                  / 03 Inquiry
                </div>
                <h3 className="text-3xl font-black tracking-tighter mb-8 break-words">告诉我们你的需求</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="姓名"
                    icon={UserIcon}
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    required
                  />
                  <Field
                    label="邮箱"
                    icon={Mail}
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    required
                  />
                  <Field
                    label="公司"
                    icon={Building}
                    value={form.company}
                    onChange={(v) => setForm({ ...form, company: v })}
                    required
                  />
                  <Field
                    label="电话"
                    icon={Phone}
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-2 block">
                    团队规模
                  </label>
                  <div className="flex flex-wrap border border-[#171717]">
                    {TEAM_SIZES.map((size, i) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setForm({ ...form, teamSize: size })}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                          form.teamSize === size
                            ? 'bg-[#171717] text-white'
                            : 'bg-white text-[#171717] hover:bg-[#EEEDE9]'
                        } ${i < TEAM_SIZES.length - 1 ? 'border-r border-[#171717]' : ''}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <Field
                  label="培训主题"
                  icon={Zap}
                  value={form.topic}
                  onChange={(v) => setForm({ ...form, topic: v })}
                  placeholder="例：LLM 应用开发 / RAG 系统 / Agent 工程化"
                  required
                />

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-2 block">
                    详细描述
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    placeholder="简单描述你的团队现状、痛点、想要达成的目标..."
                    className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors resize-none"
                  />
                </div>

                {error && (
                  <div className="px-4 py-3 border border-red-600 bg-red-50 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-between gap-6 bg-[#171717] text-white px-6 py-5 font-black uppercase tracking-wider text-sm hover:bg-[#262626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{submitting ? '提交中...' : '提交咨询'}</span>
                  <Send className="w-5 h-5" />
                </button>

                <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] flex items-center gap-2">
                  <Sparkles className="w-3 h-3" /> AI Pre-fill supported in admin
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#666666] mb-2 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 bg-white border border-[#171717] text-sm focus:outline-none focus:bg-[#EEEDE9] transition-colors"
      />
    </div>
  );
}
