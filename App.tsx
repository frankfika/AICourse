
import React, { useState, useEffect } from 'react';
import { 
  Terminal, Code2, Cpu, ShieldCheck, Menu, GraduationCap, Zap, ChevronRight, Clock,
  User as UserIcon, Plus, ArrowLeft, Link as LinkIcon, Sparkles, BookOpen, Search,
  Layers, PlayCircle, Lock, Download, FileText, Github, Globe, Settings, Save,
  Heart, CheckCircle2, List, Trash2, Youtube, LogOut, Users, MessageSquare,
  CheckSquare, Square, Award, Key, Quote, Smile
} from 'lucide-react';
import { Course, NanoDegree, ViewState, CostType, Resource, User } from './types';
import { Button, Card, Badge } from './components/Components';
import { AiTutor } from './components/AiTutor';

// --- ICONS & HELPERS ---
// Changed to Brand Color
const ICON_MAP: Record<string, React.ReactNode> = {
  shield: <ShieldCheck className="w-10 h-10 text-brand-600" />,
  sparkles: <Sparkles className="w-10 h-10 text-brand-600" />,
  layers: <Layers className="w-10 h-10 text-brand-600" />,
  terminal: <Terminal className="w-10 h-10 text-brand-600" />,
  cpu: <Cpu className="w-10 h-10 text-brand-600" />,
  code: <Code2 className="w-10 h-10 text-brand-600" />,
  globe: <Globe className="w-10 h-10 text-brand-600" />
};

const getEmbedUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    return url.replace('watch?v=', 'embed/');
  }
  if (url.includes('youtu.be/')) {
    return url.replace('youtu.be/', 'youtube.com/embed/');
  }
  return url;
};

// --- MOCK DATA ---
const INITIAL_COURSES: Course[] = [
  {
    id: 'c1',
    title: '数字机密：安全基础',
    description: '好奇密码是如何工作的吗？学习如何在线保护你的数据安全。不需要数学学位就能听懂！本课程将带你深入了解黑客的攻击手段以及如何构建坚不可摧的防御体系。',
    learningPoints: ['理解公钥与私钥加密机制', '掌握密码管理器的使用与双因素认证', '识别网络钓鱼与社会工程学攻击', '基础的网络流量分析与隐私保护'],
    instructor: 'Alice 博士',
    level: 'Beginner',
    duration: '4 周',
    videoDuration: 120,
    thumbnail: 'https://picsum.photos/seed/sec/800/400',
    tags: ['安全', '适合所有人'],
    costType: 'charity',
    price: 0,
    videoUrl: 'https://www.youtube.com/embed/36YgDDJ7Xsc', 
    resources: [{ title: '安全检查清单', url: '#', type: 'pdf' }, { title: '密码管理器指南', url: '#', type: 'link' }]
  },
  {
    id: 'c2',
    title: '全民 AI',
    description: '揭开人工智能的神秘面纱。了解 ChatGPT 这样的工具是如何工作的，无需编写一行复杂的代码。我们将探讨生成式 AI 的伦理、应用场景以及未来发展。',
    learningPoints: ['大型语言模型 (LLM) 的基本原理', '提示词工程 (Prompt Engineering) 入门', 'AI 在创意写作与图像生成中的应用', '人工智能的局限性与偏见'],
    instructor: 'Sarah C.',
    level: 'Beginner',
    duration: '6 周',
    videoDuration: 180,
    thumbnail: 'https://picsum.photos/seed/ai-easy/800/400',
    tags: ['AI', '概念', '未来'],
    costType: 'free',
    price: 0,
    videoUrl: 'https://www.youtube.com/embed/ADEgC6s4gFM',
    resources: []
  },
  {
    id: 'c3',
    title: '构建你的第一个网站',
    description: '在互联网上创造属于你的一角。HTML 和样式设计的循序渐进指南，让你的网站在任何设备上都好看。从零开始编写代码，发布你的个人主页。',
    learningPoints: ['HTML5 语义化标签结构', 'CSS3 布局与 Flexbox', '响应式设计基础 (Mobile First)', '使用 Git 进行版本控制与部署'],
    instructor: 'Neo',
    level: 'Beginner',
    duration: '4 周',
    videoDuration: 240,
    thumbnail: 'https://picsum.photos/seed/web/800/400',
    tags: ['创意', '设计', 'Web'],
    costType: 'paid',
    price: 49.99,
    videoUrl: 'https://www.youtube.com/embed/pQN-pnXPaVg',
    resources: [{ title: '启动模板代码', url: '#', type: 'code' }, { title: 'HTML 速查表', url: '#', type: 'pdf' }]
  },
  {
    id: 'c4',
    title: 'Python：友好的编程语言',
    description: '用 Python 开启你的编程之旅，这种语言以易读和有趣著称。我们将编写自动化脚本、处理数据，并制作简单的小游戏。',
    learningPoints: ['Python 基础语法与变量', '控制流：循环与条件判断', '函数式编程初步', '使用第三方库处理文件与网络请求'],
    instructor: 'Guido',
    level: 'Beginner',
    duration: '8 周',
    videoDuration: 320,
    thumbnail: 'https://picsum.photos/seed/python/800/400',
    tags: ['编程', 'Python', '逻辑'],
    costType: 'paid',
    price: 59.99,
    videoUrl: 'https://www.youtube.com/embed/_uQrJ0TkZlc',
    resources: []
  },
  {
    id: 'c5',
    title: '白帽黑客：数字防御',
    description: '通过了解黑客的思维方式来保护自己。现代数字时代的实用安全技能。这门课将教你如何进行渗透测试和漏洞扫描。',
    learningPoints: ['Linux 命令行基础', '常见 Web 漏洞 (SQL 注入, XSS)', '网络嗅探与分析', '道德黑客的法律边界'],
    instructor: 'Mr. Robot',
    level: 'Intermediate',
    duration: '5 周',
    videoDuration: 200,
    thumbnail: 'https://picsum.photos/seed/hack/800/400',
    tags: ['安全', '防御'],
    costType: 'paid',
    price: 79.99,
    videoUrl: '', 
    resources: []
  },
  {
    id: 'c6',
    title: '云图：理解云计算',
    description: '你的照片到底存哪儿了？了解驱动现代世界的全球计算机网络。AWS, Azure, Google Cloud 核心概念解析。',
    learningPoints: ['IaaS, PaaS, SaaS 的区别', '虚拟化与容器技术 (Docker 简介)', '无服务器架构 (Serverless)', '云端数据库与存储'],
    instructor: 'Sky Walker',
    level: 'Beginner',
    duration: '3 周',
    videoDuration: 90,
    thumbnail: 'https://picsum.photos/seed/cloud/800/400',
    tags: ['基础设施', '概念'],
    costType: 'free',
    price: 0,
    videoUrl: '',
    resources: []
  }
];

const INITIAL_DEGREES: NanoDegree[] = [
  {
    id: 'nd1',
    title: '数字安全卫士',
    description: '成为每个人都信赖的技术守护者。在一个简单的课程计划中掌握安全基础和道德防御。本学位将为你开启网络安全分析师的职业道路。',
    learningPoints: ['构建个人与企业的数字防御体系', '掌握基础渗透测试工具', '分析并响应网络安全事件', '获得 Nexus 认证初级安全分析师资格'],
    courses: ['c1', 'c5'],
    price: 399,
    icon: 'shield',
    costType: 'paid'
  },
  {
    id: 'nd2',
    title: '未来科技探索者',
    description: '从理解 AI 到编写你的第一行代码。这个计划旨在带你从“零基础”变身“英雄”。适合所有希望在这个 AI 时代不被淘汰的终身学习者。',
    learningPoints: ['熟练使用 Generative AI 工具提升效率', '掌握 Python 编程基础', '理解云计算与互联网基础设施', '培养计算思维与解决问题的能力'],
    courses: ['c2', 'c4', 'c6'],
    price: 499,
    icon: 'sparkles',
    costType: 'paid'
  }
];

const INITIAL_USERS: User[] = [
    { id: 'u_admin', email: 'admin@nexus.com', name: 'Nexus Admin', role: 'admin', permissions: [] },
    { id: 'u_student', email: 'student@test.com', name: '测试学员', role: 'student', permissions: ['c1'] }
];

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedDegreeId, setSelectedDegreeId] = useState<string | null>(null);
  const [activeDegreeId, setActiveDegreeId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [degrees, setDegrees] = useState<NanoDegree[]>(INITIAL_DEGREES);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');

  const navTo = (v: ViewState) => { setView(v); setIsMobileMenuOpen(false); window.scrollTo(0, 0); };
  const handleCourseClick = (id: string, fromDegreeId?: string) => { setSelectedCourseId(id); setActiveDegreeId(fromDegreeId || null); navTo(ViewState.COURSE_DETAIL); };
  const handleDegreeClick = (id: string) => { setSelectedDegreeId(id); setActiveDegreeId(null); navTo(ViewState.NANO_DEGREE); };
  const getCourse = (id: string) => courses.find(c => c.id === id);
  const getDegreeForCourse = (courseId: string) => degrees.find(d => d.courses.includes(courseId));
  const hasAccessToCourse = (course: Course) => { if (!currentUser) return false; if (currentUser.role === 'admin') return true; if (course.costType === 'free' || course.costType === 'charity') return true; return currentUser.permissions.includes(course.id); };
  const handleLogin = (email: string, name?: string) => { const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase()); if (existingUser) { setCurrentUser(existingUser); } else { const newUser: User = { id: `u_${Date.now()}`, email, name: name || email.split('@')[0], role: 'student', permissions: [] }; setUsers([...users, newUser]); setCurrentUser(newUser); } setIsLoginModalOpen(false); setLoginEmail(''); };
  const handleLogout = () => { setCurrentUser(null); navTo(ViewState.HOME); };

  const CostBadge: React.FC<{ type: CostType }> = ({ type }) => {
      if (type === 'charity') return <span className="flex items-center gap-1 bg-cyan-100 text-cyan-700 border border-cyan-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"><Heart size={10} className="fill-cyan-700"/> 公益项目</span>;
      if (type === 'paid') return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide">专业版</span>;
      return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide">免费 & 公开</span>;
  };

  // --- MODALS ---
  const LoginModal = () => {
      const [email, setEmail] = useState(loginEmail);
      const [name, setName] = useState('');
      const [step, setStep] = useState<'email' | 'name'>('email');
      useEffect(() => { if (loginEmail) setEmail(loginEmail); }, [loginEmail]);
      const handleSubmit = () => { if (step === 'email') { if (!email) return; const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase()); if (exists) { handleLogin(email); } else { setStep('name'); } } else { if (!name) return; handleLogin(email, name); } };
      if (!isLoginModalOpen) return null;
      return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white border border-slate-100 w-full max-w-md p-8 relative rounded-2xl shadow-2xl">
                  <button onClick={() => setIsLoginModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-2"><LogOut size={16} className="rotate-180"/></button>
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4"><UserIcon className="w-8 h-8 text-brand-600" /></div>
                      <h2 className="text-2xl font-bold text-slate-800">欢迎回来</h2>
                      <p className="text-slate-500 text-sm mt-2">登录或注册以开启您的学习旅程。</p>
                  </div>
                  <div className="space-y-5">
                      {step === 'email' ? (
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">电子邮件地址</label>
                              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" placeholder="user@example.com" autoFocus />
                              <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100"><span className="block mb-1 font-bold text-slate-600">测试账号 (点击填入):</span><div className="flex gap-2"><span className="text-brand-600 cursor-pointer hover:underline" onClick={() => setEmail('admin@nexus.com')}>管理员</span><span className="text-slate-300">|</span><span className="text-brand-600 cursor-pointer hover:underline" onClick={() => setEmail('student@test.com')}>学员</span></div></div>
                          </div>
                      ) : (
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">新朋友，怎么称呼您？</label>
                              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" placeholder="您的昵称" autoFocus />
                          </div>
                      )}
                      <Button onClick={handleSubmit} className="w-full justify-center py-3">{step === 'email' ? '继续 (登录 / 注册)' : '完成注册'}</Button>
                  </div>
              </div>
          </div>
      );
  };

  const ContactModal = () => {
      if (!showContactModal) return null;
      return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white border border-slate-100 w-full max-w-md p-8 relative rounded-2xl shadow-2xl">
                  <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-2">✕</button>
                  <div className="text-center">
                      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldCheck className="w-8 h-8 text-amber-500" /></div>
                      <h2 className="text-2xl font-bold text-slate-800 mb-3">解锁专业版内容</h2>
                      <p className="text-slate-500 mb-6 text-sm leading-relaxed">该课程属于 <span className="text-amber-600 font-bold">专业版 (Pro)</span> 内容。请添加管理员微信以激活您的学习权限。</p>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6"><div className="text-xs text-slate-500 font-bold mb-2 uppercase">管理员 (WeChat)</div><div className="text-2xl text-brand-600 font-mono font-bold select-all cursor-pointer">NEXUS_HELPER</div><div className="text-[10px] text-slate-400 mt-2">点击微信号可复制</div></div>
                      <p className="text-xs text-slate-400">验证时请备注您的注册邮箱: <br/> <span className="text-slate-600 font-mono mt-1 block">{currentUser?.email}</span></p>
                  </div>
              </div>
          </div>
      );
  };

  const CertificateCard = ({ title, type }: { title: string, type: 'Course' | 'Degree' }) => (
      <div className="mt-8 border border-slate-200 bg-white p-8 relative overflow-hidden rounded-2xl group hover:border-brand-200 hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 transform scale-150 pointer-events-none"><Award className="w-64 h-64 text-brand-600" /></div>
          <div className="relative z-10 flex flex-col items-center">
              <div className="mb-6"><Badge>结业证书预览</Badge></div>
              <div className="border-[12px] border-double border-slate-200 bg-white text-slate-900 p-10 w-full max-w-lg text-center relative shadow-sm">
                  <div className="text-slate-400 font-serif italic mb-4 opacity-70 tracking-widest">Certificate of Completion</div>
                  <h4 className="text-3xl font-bold text-slate-900 mb-6 font-serif">{title}</h4>
                  <div className="h-px w-24 bg-slate-300 mx-auto my-6"></div>
                  <div className="text-xs text-slate-500 font-mono mb-8 leading-relaxed">THIS CERTIFIES THAT THE STUDENT HAS SUCCESSFULLY COMPLETED THE {type === 'Degree' ? 'NANO DEGREE PROGRAM' : 'PROFESSIONAL COURSE'}.</div>
                  <div className="flex justify-between items-end mt-4 px-4"><div className="text-center"><div className="h-px w-24 bg-slate-300 mb-2"></div><div className="text-[9px] text-slate-400 uppercase tracking-wider">Instructor</div></div><Award className="w-12 h-12 text-amber-400" /><div className="text-center"><div className="h-px w-24 bg-slate-300 mb-2"></div><div className="text-[9px] text-slate-400 uppercase tracking-wider">Director</div></div></div>
              </div>
              <p className="text-center text-xs text-slate-400 mt-6 font-mono max-w-md">完成所有课程并通过项目审核后，您将获得此证书的数字版（支持区块链验证）。</p>
          </div>
      </div>
  );

  // --- SUB-PAGES ---
  const HomePage = () => (
    <div className="animate-in fade-in duration-700 pb-20">
      <section className="relative py-32 px-6 md:px-12 overflow-hidden bg-white">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-50 to-transparent pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10 text-center md:text-left">
          <div className="inline-block mb-4"><Badge>Nexus Academy 2.0</Badge></div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight text-slate-900 tracking-tight mb-6">
            从零开始，<br /><span className="text-brand-600">重塑你的职业未来</span>。
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl leading-relaxed mb-10 md:mx-0 mx-auto">
            不论你是想转行进入科技领域，还是渴望掌握 AI 时代的核心技能。这里没有枯燥的理论，只有动手的项目和贴心的 AI 导师。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Button onClick={() => navTo(ViewState.ALL_DEGREES)} className="px-8 py-4 text-base shadow-lg shadow-brand-500/20">探索 Nano Degree</Button>
             <Button variant="secondary" onClick={() => navTo(ViewState.ALL_COURSES)} className="px-8 py-4 text-base">浏览所有课程</Button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-12">
          <div><h2 className="text-3xl font-bold text-slate-900 mb-2">热门职业路径</h2><p className="text-slate-500">系统化的 Nano Degree，助你从入门到精通</p></div>
          <Button variant="secondary" onClick={() => navTo(ViewState.ALL_DEGREES)} className="hidden md:flex">查看全部 <ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {degrees.slice(0, 2).map(degree => (
            <Card key={degree.id} className="hover:border-brand-200 cursor-pointer h-full flex flex-col group">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-brand-50 rounded-xl text-brand-600">{ICON_MAP[degree.icon] || ICON_MAP['shield']}</div>
                <Badge>{degree.courses.length} 门核心课</Badge>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-brand-600 transition-colors">{degree.title}</h3>
              <p className="text-slate-500 mb-8 flex-grow leading-relaxed">{degree.description}</p>
              <div className="flex justify-between items-center border-t border-slate-100 pt-6 mt-auto">
                <div><div className="text-xs text-slate-400 uppercase font-bold mb-1">Total Value</div><span className="text-2xl font-mono text-slate-900 font-bold">${degree.price}</span></div>
                <Button onClick={() => handleDegreeClick(degree.id)} variant="secondary">查看详情</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-20 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">他们都在这里改变了人生</h2>
                  <p className="text-slate-500">加入超过 10,000 名终身学习者的社区</p>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                  {[
                      { name: "李明", role: "前端工程师", text: "Nexus 的课程非常实战。我以前完全不懂代码，跟着'全栈创作者'路径学完后，我成功拿到了第一份开发 Offer。", icon: <Code2 /> },
                      { name: "Sarah Wang", role: "数据分析师", text: "这里的 AI 助教太棒了！无论多晚，遇到问题都能立刻得到解答，就像有个私人导师在身边。", icon: <Sparkles /> },
                      { name: "陈志强", role: "安全研究员", text: "很多安全课程都很枯燥，但这里的'数字防御'课程像是在玩解谜游戏，非常上瘾。", icon: <ShieldCheck /> }
                  ].map((item, idx) => (
                      <div key={idx} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative">
                          <Quote className="absolute top-6 right-6 text-slate-100 w-10 h-10" />
                          <div className="flex items-center gap-4 mb-6">
                              <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">{item.icon}</div>
                              <div><div className="font-bold text-slate-900">{item.name}</div><div className="text-xs text-slate-500">{item.role}</div></div>
                          </div>
                          <p className="text-slate-600 leading-relaxed text-sm">"{item.text}"</p>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-12">
          <div><h2 className="text-3xl font-bold text-slate-900 mb-2">探索单项技能</h2><p className="text-slate-500">短平快的高质量课程，补充你的技能库</p></div>
          <Button variant="secondary" onClick={() => navTo(ViewState.ALL_COURSES)} className="hidden md:flex">全部课程 <ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {courses.slice(0, 4).map(course => {
             return (
              <div key={course.id} onClick={() => handleCourseClick(course.id)} className="bg-white border border-slate-100 hover:border-brand-200 hover:-translate-y-1 transition-all cursor-pointer overflow-hidden group flex flex-col relative rounded-2xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50">
                <div className="h-40 overflow-hidden relative">
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <div className="absolute top-3 right-3"><CostBadge type={course.costType} /></div>
                  <div className="absolute bottom-3 left-3 right-3"><h3 className="text-lg font-bold text-white leading-tight">{course.title}</h3></div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <div className="flex items-center gap-1"><Clock size={12}/> {course.duration}</div>
                      <div className="flex items-center gap-1"><UserIcon size={12}/> {course.instructor}</div>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 flex-grow mb-4">{course.description}</p>
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${course.level === 'Beginner' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{course.level === 'Beginner' ? '入门' : '进阶'}</span>
                      <span className="text-brand-600 text-xs font-bold group-hover:underline">查看大纲 →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const AllDegreesPage = () => (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
        <div className="mb-12"><h1 className="text-4xl font-bold text-slate-900 mb-3">Nano Degree 目录</h1><p className="text-slate-500 text-lg">体系化的学习路径，带你从入门到精通。</p></div>
        <div className="grid md:grid-cols-2 gap-8">
          {degrees.map(degree => (
            <Card key={degree.id} className="cursor-pointer flex flex-col">
              <div className="flex justify-between items-start mb-6">
                 <div className="p-3 bg-brand-50 rounded-xl text-brand-600">{ICON_MAP[degree.icon] || ICON_MAP['shield']}</div>
                 <div className="flex flex-col items-end gap-2"><Badge>{degree.courses.length} 门课程</Badge><CostBadge type={degree.costType} /></div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-brand-600 transition-colors">{degree.title}</h3>
              <p className="text-slate-500 mb-6 flex-grow leading-relaxed">{degree.description}</p>
              <div className="flex justify-between items-center border-t border-slate-100 pt-6 mt-auto"><span className="text-2xl font-mono text-slate-900 font-bold">${degree.price}</span><Button onClick={() => handleDegreeClick(degree.id)} variant="secondary">查看详情</Button></div>
            </Card>
          ))}
        </div>
    </div>
  );

  const AllCoursesPage = () => {
    // (Reuse logic)
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLevel, setFilterLevel] = useState('All');
    const [filterCost, setFilterCost] = useState<'All' | 'Free' | 'PublicGood' | 'Pro'>('All');
    const filteredCourses = courses.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || c.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesLevel = filterLevel === 'All' || c.level === filterLevel;
        let matchesCost = true;
        if (filterCost === 'Free') matchesCost = c.costType === 'free' || c.costType === 'charity';
        else if (filterCost === 'PublicGood') matchesCost = c.costType === 'charity';
        else if (filterCost === 'Pro') matchesCost = c.costType === 'paid';
        return matchesSearch && matchesLevel && matchesCost;
    });

    return (
      <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
        <div className="flex flex-col gap-8 mb-12">
            <div><h1 className="text-4xl font-bold text-slate-900 mb-3">课程目录</h1><p className="text-slate-500 text-lg">探索我们的完整课程库，发现新技能。</p></div>
            <div className="flex items-center gap-4 border-b border-slate-200 pb-1 overflow-x-auto">
                {['All', 'Free', 'PublicGood', 'Pro'].map(f => (
                    <button key={f} onClick={() => setFilterCost(f as any)} className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${filterCost === f ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                        {f === 'All' ? '全部课程' : f === 'Free' ? '免费 & 公开' : f === 'PublicGood' ? '公益项目' : '专业版'}
                    </button>
                ))}
            </div>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" placeholder="搜索主题..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border border-slate-200 text-slate-900 pl-10 pr-4 py-2.5 rounded-lg font-sans text-sm w-full focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none shadow-sm" /></div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0"><span className="text-xs text-slate-500 font-bold mr-2">难度:</span>{['All', 'Beginner', 'Intermediate'].map(level => (<button key={level} onClick={() => setFilterLevel(level)} className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${filterLevel === level ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>{level === 'All' ? '全部' : level === 'Beginner' ? '入门' : '进阶'}</button>))}</div>
            </div>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCourses.map(course => {
             const parentDegree = getDegreeForCourse(course.id);
             return (
              <div key={course.id} onClick={() => handleCourseClick(course.id)} className="bg-white border border-slate-100 hover:border-brand-200 hover:-translate-y-1 transition-all cursor-pointer overflow-hidden group flex flex-col relative rounded-2xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50">
                <div className="h-40 overflow-hidden relative">
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <div className="absolute top-3 right-3"><CostBadge type={course.costType} /></div>
                  <div className="absolute bottom-3 left-3 right-3"><h3 className="text-base font-bold text-white leading-tight">{course.title}</h3></div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  {parentDegree && (<div className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-md w-fit"><LinkIcon size={10} /> {parentDegree.title.split(' ')[0]}...</div>)}
                  <h3 className="text-base font-bold mb-2 text-slate-800 group-hover:text-brand-600 transition-colors line-clamp-1">{course.title}</h3>
                  <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between text-xs text-slate-500"><span>{course.duration}</span><span>{course.instructor}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const NanoDegreePage = () => {
    const degree = degrees.find(d => d.id === selectedDegreeId);
    if (!degree) return <div>Data Error</div>;
    const degreeCourses = degree.courses.map(id => courses.find(c => c.id === id)).filter(Boolean) as Course[];
    const scrollToCurriculum = () => { const element = document.getElementById('curriculum-list'); if (element) { element.scrollIntoView({ behavior: 'smooth' }); } };

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white border-b border-slate-200 py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <Button onClick={() => navTo(ViewState.ALL_DEGREES)} variant="secondary" className="mb-8 pl-4 pr-6"><ArrowLeft className="w-4 h-4 mr-2" /> 返回 Nano Degree</Button>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="p-6 bg-brand-50 rounded-3xl text-brand-600 shadow-inner">{ICON_MAP[degree.icon]}</div>
              <div>
                <Badge>职业学位</Badge>
                <h1 className="text-4xl font-bold text-slate-900 mt-4 mb-4">{degree.title}</h1>
                <p className="text-slate-500 text-lg leading-relaxed mb-6">{degree.description}</p>
                <div className="flex flex-wrap gap-6 mb-8 text-sm text-slate-600">
                   <div className="flex items-center gap-2"><BookOpen className="text-brand-600 w-4 h-4" /> {degree.courses.length} 门必修课</div>
                   <div className="flex items-center gap-2"><Award className="text-brand-600 w-4 h-4" /> 官方认证证书</div>
                   <div className="flex items-center gap-2"><Users className="text-brand-600 w-4 h-4" /> 私人助教辅导</div>
                </div>
                <Button onClick={() => { if(degree.costType === 'paid' && !currentUser) setIsLoginModalOpen(true); else setShowContactModal(true); }} className="shadow-lg shadow-brand-500/30">
                  立即加入 - ${degree.price}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
           <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2"><TargetIcon /> 学习目标</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                  {degree.learningPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                          <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                          <span className="text-slate-600 text-sm">{point}</span>
                      </div>
                  ))}
              </div>
           </section>

           <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-6" id="curriculum-list">包含课程</h2>
              <div className="space-y-4">
                  {degreeCourses.map((course, index) => (
                      <div key={course.id} onClick={() => handleCourseClick(course.id, degree.id)} className="flex items-center gap-6 p-5 bg-white border border-slate-200 rounded-xl hover:border-brand-300 hover:shadow-md cursor-pointer group transition-all">
                          <div className="text-2xl font-bold text-slate-300 w-8 text-center">0{index + 1}</div>
                          <img src={course.thumbnail} alt="" className="w-24 h-16 object-cover rounded-lg shadow-sm" />
                          <div className="flex-grow">
                              <h3 className="text-lg font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{course.title}</h3>
                              <div className="text-xs text-slate-500 mt-1">{course.duration} • {course.level}</div>
                          </div>
                          <ChevronRight className="text-slate-300 group-hover:text-brand-600" />
                      </div>
                  ))}
              </div>
           </section>
           <CertificateCard title={degree.title} type="Degree" />
        </div>
      </div>
    );
  };

  const CourseDetailPage = () => {
    const course = courses.find(c => c.id === selectedCourseId);
    if (!course) return <div>Data Error</div>;
    const isUnlocked = hasAccessToCourse(course);
    const degree = activeDegreeId ? degrees.find(d => d.id === activeDegreeId) : getDegreeForCourse(course.id);
    const [activeTab, setActiveTab] = useState<'overview' | 'resources'>('overview');

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
         <div className="bg-slate-900 w-full relative group">
             {isUnlocked && course.videoUrl ? (
                 <div className="aspect-video w-full max-w-5xl mx-auto bg-black relative shadow-2xl"><iframe src={getEmbedUrl(course.videoUrl)} title={course.title} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>
             ) : (
                 <div className="aspect-video w-full max-w-5xl mx-auto relative overflow-hidden flex items-center justify-center">
                     <img src={course.thumbnail} alt={course.title} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" />
                     <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
                     <div className="relative z-10 text-center p-8 max-w-lg">
                         <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/20"><Lock className="w-8 h-8 text-white" /></div>
                         <h2 className="text-3xl font-bold text-white mb-4">解锁完整课程</h2>
                         <p className="text-slate-300 mb-8">本课程属于 {degree?.title ? <span className="text-brand-400 font-bold">{degree.title}</span> : '专业版内容'}。{course.price > 0 && ` 单购价格: $${course.price}`}</p>
                         <div className="flex gap-4 justify-center">{!currentUser ? (<Button onClick={() => setIsLoginModalOpen(true)}>登录以继续</Button>) : (<Button onClick={() => setShowContactModal(true)} variant="primary">解锁课程</Button>)}</div>
                     </div>
                 </div>
             )}
         </div>

         <div className="max-w-5xl mx-auto px-6 py-8">
             <div className="flex flex-col md:flex-row gap-8">
                 <div className="flex-grow">
                     <div className="mb-8">
                         {degree && <div onClick={() => handleDegreeClick(degree.id)} className="text-xs font-bold text-brand-600 mb-2 cursor-pointer hover:underline uppercase tracking-wide">Included in {degree.title}</div>}
                         <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{course.title}</h1>
                         <div className="flex items-center gap-4 text-sm text-slate-500">
                             <div className="flex items-center gap-1"><Clock size={14}/> {course.duration}</div>
                             <div className="flex items-center gap-1"><UserIcon size={14}/> {course.instructor}</div>
                             <div className={`px-2 py-0.5 rounded text-xs font-bold ${course.level === 'Beginner' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{course.level}</div>
                         </div>
                     </div>

                     <div className="flex gap-8 border-b border-slate-200 mb-8">
                         <button onClick={() => setActiveTab('overview')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>课程概览</button>
                         <button onClick={() => setActiveTab('resources')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'resources' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>学习资源 ({course.resources?.length || 0})</button>
                     </div>

                     {activeTab === 'overview' ? (
                         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                             <div className="prose prose-slate max-w-none text-slate-600"><p className="text-lg leading-relaxed">{course.description}</p></div>
                             <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                                 <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><TargetIcon/> 本课要点</h3>
                                 <ul className="grid sm:grid-cols-2 gap-4">
                                     {course.learningPoints.map((point, i) => (<li key={i} className="flex items-start gap-3 text-sm text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 shrink-0"></div>{point}</li>))}
                                 </ul>
                             </div>
                             {isUnlocked && <AiTutor courseTitle={course.title} />}
                         </div>
                     ) : (
                         <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                             {!isUnlocked ? (
                                 <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200"><Lock className="w-8 h-8 mx-auto mb-3 opacity-50" /><p>资源仅对学员开放下载</p></div>
                             ) : (course.resources && course.resources.length > 0) ? (
                                 course.resources.map((res, idx) => (
                                     <a key={idx} href={res.url} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-brand-200 hover:shadow-md group transition-all">
                                         <div className="p-3 bg-slate-50 rounded-lg text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                                             {res.type === 'pdf' ? <FileText size={20} /> : res.type === 'code' ? <Code2 size={20} /> : <LinkIcon size={20} />}
                                         </div>
                                         <div className="flex-grow">
                                             <div className="font-bold text-slate-800">{res.title}</div>
                                             <div className="text-xs text-slate-500 uppercase mt-0.5">{res.type}</div>
                                         </div>
                                         <Download className="text-slate-400 group-hover:text-brand-600" size={18} />
                                     </a>
                                 ))
                             ) : (<div className="text-center py-8 text-slate-500">暂无附加资源</div>)}
                         </div>
                     )}
                 </div>
                 <div className="w-full md:w-80 shrink-0 space-y-6">
                     <div className="bg-white border border-slate-200 rounded-xl p-5 sticky top-24 shadow-sm">
                         <h4 className="font-bold text-slate-900 mb-4 text-sm">课程信息</h4>
                         <div className="space-y-4 text-sm">
                             <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">时长</span><span className="text-slate-800 font-mono">{course.duration}</span></div>
                             <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">难度</span><span className="text-slate-800">{course.level}</span></div>
                             <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">更新时间</span><span className="text-slate-800 font-mono">2024.10</span></div>
                             <div className="pt-2"><span className="text-slate-500 block mb-2">标签</span><div className="flex flex-wrap gap-2">{course.tags.map(t => <span key={t} className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">{t}</span>)}</div></div>
                         </div>
                     </div>
                 </div>
             </div>
         </div>
      </div>
    );
  };

  const HackathonPage = () => (
    <div className="animate-in fade-in duration-500">
        <div className="relative py-24 px-6 border-b border-slate-200 overflow-hidden bg-slate-900 text-white">
             <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/hackathon/1600/600')] bg-cover bg-center opacity-20"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
             <div className="max-w-4xl mx-auto text-center relative z-10">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-bold mb-6">
                     <Zap size={12} fill="currentColor" /> 正在进行中
                 </div>
                 <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">NEXUS <span className="text-brand-400">HACK 2077</span></h1>
                 <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">48小时。代码、咖啡与荣耀。与全球顶尖极客同台竞技，赢取高达 $10,000 的奖金池。</p>
                 <div className="flex flex-col sm:flex-row justify-center gap-4"><Button className="px-8 py-4 text-lg">立即报名</Button><Button variant="secondary" className="px-8 py-4 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30">查看规则</Button></div>
             </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
                 <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Award /></div>
                 <div className="text-2xl font-bold text-slate-900 mb-1">$10,000</div><div className="text-slate-500 text-sm">总奖金池</div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Users /></div>
                 <div className="text-2xl font-bold text-slate-900 mb-1">500+</div><div className="text-slate-500 text-sm">参赛极客</div>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
                 <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4"><CalendarIcon /></div>
                 <div className="text-2xl font-bold text-slate-900 mb-1">Oct 24-26</div><div className="text-slate-500 text-sm">比赛时间</div>
            </div>
        </div>
    </div>
  );

  const AdminPage = () => {
    if (currentUser?.role !== 'admin') return <div className="p-12 text-center text-red-500">Access Denied</div>;
    const togglePermission = (userId: string, courseId: string) => { setUsers(users.map(u => { if (u.id === userId) { const hasPerm = u.permissions.includes(courseId); return { ...u, permissions: hasPerm ? u.permissions.filter(p => p !== courseId) : [...u.permissions, courseId] }; } return u; })); };

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3"><Settings className="text-brand-600"/> 管理控制台</h1>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center"><h2 className="font-bold text-slate-800">用户管理</h2><Badge>{users.length} Users</Badge></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="bg-slate-50 text-slate-700 uppercase text-xs"><tr><th className="px-6 py-4">用户</th><th className="px-6 py-4">角色</th><th className="px-6 py-4">已解锁课程</th><th className="px-6 py-4">操作</th></tr></thead>
                        <tbody className="divide-y divide-slate-200">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900"><div>{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span></td>
                                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{user.permissions.length === 0 && <span className="text-slate-400 italic">无</span>}{user.permissions.map(pid => (<span key={pid} className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[10px] border border-emerald-100">{pid}</span>))}</div></td>
                                    <td className="px-6 py-4"><div className="flex gap-2">{courses.slice(0, 3).map(c => { const has = user.permissions.includes(c.id); return (<button key={c.id} onClick={() => togglePermission(user.id, c.id)} className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${has ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} title={`Toggle ${c.title}`}>{has ? <CheckSquare size={12}/> : <Square size={12}/>}</button>) })}</div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };
  
  // Helper Icons for inside components
  const TargetIcon = () => <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
  const CalendarIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;

  return (
    <div className="min-h-screen font-sans bg-slate-50 selection:bg-brand-100 selection:text-brand-900">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navTo(ViewState.HOME)}>
            <div className="relative"><Cpu className="w-8 h-8 text-brand-600" /></div>
            <span className="text-xl font-bold tracking-tight text-slate-900">NEXUS ACADEMY</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button onClick={() => navTo(ViewState.ALL_DEGREES)} className={`transition-colors ${view === ViewState.ALL_DEGREES ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900'}`}>Nano Degree</button>
            <button onClick={() => navTo(ViewState.ALL_COURSES)} className={`transition-colors ${view === ViewState.ALL_COURSES ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900'}`}>课程库</button>
            <button onClick={() => navTo(ViewState.HACKATHON)} className={`transition-colors ${view === ViewState.HACKATHON ? 'text-brand-600' : 'text-slate-500 hover:text-slate-900'}`}>黑客松</button>
            {currentUser?.role === 'admin' && (<button onClick={() => navTo(ViewState.ADMIN)} className="text-amber-600 hover:text-amber-700 ml-2">管理后台</button>)}
          </div>
          <div className="hidden md:flex items-center gap-4">
             {currentUser ? (
                 <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                     <div className="text-right"><div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">学员</div><div className="text-sm font-bold text-slate-900">{currentUser.name}</div></div>
                     <Button variant="secondary" onClick={handleLogout} className="px-4 py-1.5 text-xs">注销</Button>
                 </div>
             ) : (<Button onClick={() => setIsLoginModalOpen(true)} className="shadow-none">登录 / 注册</Button>)}
          </div>
          <button className="md:hidden text-slate-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu className="w-6 h-6" /></button>
        </div>
        {isMobileMenuOpen && (
            <div className="md:hidden border-t border-slate-200 bg-white p-4 space-y-2 shadow-lg">
                <button onClick={() => navTo(ViewState.ALL_DEGREES)} className="block w-full text-left py-3 px-4 rounded-xl hover:bg-slate-50 text-slate-600 font-medium">Nano Degree</button>
                <button onClick={() => navTo(ViewState.ALL_COURSES)} className="block w-full text-left py-3 px-4 rounded-xl hover:bg-slate-50 text-slate-600 font-medium">课程库</button>
                <div className="pt-4 mt-4 border-t border-slate-100">{currentUser ? <Button onClick={handleLogout} className="w-full" variant="secondary">注销</Button> : <Button onClick={() => setIsLoginModalOpen(true)} className="w-full">登录</Button>}</div>
            </div>
        )}
      </nav>

      <main className="min-h-[calc(100vh-300px)]">
        {view === ViewState.HOME && <HomePage />}
        {view === ViewState.ALL_DEGREES && <AllDegreesPage />}
        {view === ViewState.ALL_COURSES && <AllCoursesPage />}
        {view === ViewState.NANO_DEGREE && <NanoDegreePage />}
        {view === ViewState.COURSE_DETAIL && <CourseDetailPage />}
        {view === ViewState.HACKATHON && <HackathonPage />}
        {view === ViewState.ADMIN && <AdminPage />}
      </main>

      <LoginModal />
      <ContactModal />

      <footer className="bg-slate-900 text-slate-400 py-16 px-6 mt-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4"><Cpu className="w-6 h-6 text-brand-400" /><span className="font-bold text-white text-lg">NEXUS ACADEMY</span></div>
                <p className="text-slate-500 text-sm leading-relaxed max-w-sm">我们致力于让科技教育变得触手可及。通过 AI 辅助和项目驱动的教学模式，帮助每个人在这个快速变化的时代找到自己的位置。</p>
            </div>
            <div>
                <h4 className="text-white font-bold mb-4">探索</h4>
                <ul className="space-y-2 text-sm">
                    <li className="hover:text-brand-400 cursor-pointer transition-colors" onClick={() => navTo(ViewState.ALL_DEGREES)}>Nano Degree</li>
                    <li className="hover:text-brand-400 cursor-pointer transition-colors" onClick={() => navTo(ViewState.ALL_COURSES)}>最新课程</li>
                    <li className="hover:text-brand-400 cursor-pointer transition-colors" onClick={() => navTo(ViewState.HACKATHON)}>黑客松活动</li>
                </ul>
            </div>
            <div>
                <h4 className="text-white font-bold mb-4">关于</h4>
                <ul className="space-y-2 text-sm">
                    <li className="hover:text-brand-400 cursor-pointer transition-colors">关于我们</li>
                    <li className="hover:text-brand-400 cursor-pointer transition-colors">联系方式</li>
                    <li><button onClick={() => { setLoginEmail('admin@nexus.com'); setIsLoginModalOpen(true); }} className="flex items-center gap-2 hover:text-white transition-colors mt-4 pt-4 border-t border-slate-800"><Lock size={12} /> 管理员入口</button></li>
                </ul>
            </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-slate-800 pt-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-xs text-slate-600">
            <span>© 2077 Nexus Academy. All rights reserved.</span>
            <div className="flex gap-6 mt-4 md:mt-0"><a href="#" className="hover:text-slate-400 transition-colors">隐私政策</a><a href="#" className="hover:text-slate-400 transition-colors">服务条款</a></div>
        </div>
      </footer>
    </div>
  );
}
