
import React, { useState, useEffect } from 'react';
import {
 Terminal, Code2, Cpu, ShieldCheck, Menu, GraduationCap, Zap, ChevronRight, Clock,
 User as UserIcon, Plus, ArrowLeft, Link as LinkIcon, Sparkles, BookOpen, Search,
 Layers, PlayCircle, Lock, Download, FileText, Github, Globe, Settings, Save,
 Heart, CheckCircle2, List, Trash2, Youtube, LogOut, Users, MessageSquare,
 CheckSquare, Square, Award, Key, Quote, Smile, X, Gift, Star, Edit2, Copy, Rocket, Loader2
} from 'lucide-react';
import { Course, NanoDegree, ViewState, CostType, Resource, User } from './types';
import { Button, Card, Badge } from './components/Components';
import * as db from './lib/database';
// AI 助教功能已禁用（需要 Gemini API Key）
// import { AiTutor } from './components/AiTutor';

// --- ICONS & HELPERS ---
// Changed to Brand Color
const ICON_MAP: Record<string, React.ReactNode> = {
 shield: <ShieldCheck className="w-10 h-10 text-[#171717]" />,
 sparkles: <Sparkles className="w-10 h-10 text-[#171717]" />,
 layers: <Layers className="w-10 h-10 text-[#171717]" />,
 terminal: <Terminal className="w-10 h-10 text-[#171717]" />,
 cpu: <Cpu className="w-10 h-10 text-[#171717]" />,
 code: <Code2 className="w-10 h-10 text-[#171717]" />,
 globe: <Globe className="w-10 h-10 text-[#171717]" />
};

const getEmbedUrl = (url: string) => {
 if (!url) return '';
 // YouTube
 if (url.includes('youtube.com/watch?v=')) {
 return url.replace('watch?v=', 'embed/');
 }
 if (url.includes('youtu.be/')) {
 return url.replace('youtu.be/', 'youtube.com/embed/');
 }
 // Bilibili - 支持多种格式
 if (url.includes('bilibili.com/video/')) {
 const bvMatch = url.match(/BV[\w]+/);
 if (bvMatch) {
 return `//player.bilibili.com/player.html?bvid=${bvMatch[0]}&high_quality=1`;
 }
 }
 if (url.includes('b23.tv/')) {
 // 短链接，直接返回，需要用户提供完整embed链接
 return url;
 }
 return url;
};

// 判断是否为本地视频文件（包括上传的blob URL）
const isLocalVideo = (url: string) => {
 if (!url) return false;
 return url.startsWith('blob:') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg') || url.startsWith('/videos/') || url.startsWith('./');
};

// 从时长字符串中提取分钟数
const parseDurationMinutes = (duration: string): number => {
 if (!duration) return 0;
 const match = duration.match(/(\d+)/);
 return match ? parseInt(match[1]) : 0;
};

// 格式化总时长为"X小时Y分钟"
const formatTotalDuration = (totalMinutes: number): string => {
 if (totalMinutes === 0) return '0 分钟';
 const hours = Math.floor(totalMinutes / 60);
 const minutes = totalMinutes % 60;
 if (hours === 0) return `${minutes} 分钟`;
 if (minutes === 0) return `${hours} 小时`;
 return `${hours} 小时 ${minutes} 分钟`;
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
 duration: '45 分钟',
 videoDuration: 120,
 thumbnail: 'https://picsum.photos/seed/sec/800/400',
 tags: ['安全', '适合所有人'],
 costType: 'free',
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
 duration: '60 分钟',
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
 duration: '45 分钟',
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
 duration: '90 分钟',
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
 duration: '55 分钟',
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
 duration: '30 分钟',
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
 learningPoints: ['构建个人与企业的数字防御体系', '掌握基础渗透测试工具', '分析并响应网络安全事件', '获得 OpenCSG 认证初级安全分析师资格'],
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
 { id: 'u_admin', email: 'admin@opencsg.com', password: 'admin123', name: 'OpenCSG Admin', role: 'admin', permissions: [], degreePermissions: [] },
 { id: 'u_student', email: 'student@test.com', password: '123456', name: '测试学员', role: 'student', permissions: ['c1'], degreePermissions: [] }
];

export default function App() {
 const [view, setView] = useState<ViewState>(ViewState.HOME);
 const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
 const [selectedDegreeId, setSelectedDegreeId] = useState<string | null>(null);
 const [activeDegreeId, setActiveDegreeId] = useState<string | null>(null);
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const [courses, setCourses] = useState<Course[]>([]);
 const [degrees, setDegrees] = useState<NanoDegree[]>([]);
 const [users, setUsers] = useState<User[]>([]);
 const [currentUser, setCurrentUser] = useState<User | null>(() => {
 const saved = localStorage.getItem('opencsg_currentUser');
 if (saved) {
 try {
 return JSON.parse(saved);
 } catch {
 return null;
 }
 }
 return null;
 });
 const [isLoading, setIsLoading] = useState(true);

 // 从 Supabase 加载数据
 useEffect(() => {
 const loadData = async () => {
 setIsLoading(true);
 console.log('[Supabase] 开始加载数据...');
 try {
 const [dbCourses, dbDegrees, dbUsers] = await Promise.all([
 db.getCourses(),
 db.getNanoDegrees(),
 db.getUsers()
 ]);
 console.log('[Supabase] 加载完成:', {
 courses: dbCourses.length,
 degrees: dbDegrees.length,
 users: dbUsers.length
 });

 if (dbCourses.length > 0) {
 console.log('[Supabase] 设置课程:', dbCourses.map(c => c.title));
 setCourses(dbCourses);
 }
 if (dbDegrees.length > 0) {
 console.log('[Supabase] 设置学位:', dbDegrees.map(d => d.title));
 setDegrees(dbDegrees);
 }
 if (dbUsers.length > 0) {
 console.log('[Supabase] 设置用户:', dbUsers.map(u => u.email));
 setUsers(dbUsers);
 }

 // 如果有登录用户，刷新其数据
 if (currentUser) {
 const freshUser = dbUsers.find(u => u.id === currentUser.id);
 if (freshUser) setCurrentUser(freshUser);
 }
 } catch (error) {
 console.error('[Supabase] 加载失败:', error);
 } finally {
 setIsLoading(false);
 }
 };
 loadData();
 }, []);

 // 保持当前用户到 localStorage（用于刷新后恢复登录状态）
 useEffect(() => {
 if (currentUser) {
 localStorage.setItem('opencsg_currentUser', JSON.stringify(currentUser));
 } else {
 localStorage.removeItem('opencsg_currentUser');
 }
 }, [currentUser]);
 const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
 const [showContactModal, setShowContactModal] = useState(false);
 const [loginEmail, setLoginEmail] = useState('');
 const [showAdminTip, setShowAdminTip] = useState(true);

 const navTo = (v: ViewState) => { setView(v); setIsMobileMenuOpen(false); window.scrollTo(0, 0); };
 const handleCourseClick = (id: string, fromDegreeId?: string) => { setSelectedCourseId(id); setActiveDegreeId(fromDegreeId || null); navTo(ViewState.COURSE_DETAIL); };
 const handleDegreeClick = (id: string) => { setSelectedDegreeId(id); setActiveDegreeId(null); navTo(ViewState.NANO_DEGREE); };
 const getCourse = (id: string) => courses.find(c => c.id === id);
 const getDegreeForCourse = (courseId: string) => degrees.find(d => d.courses.includes(courseId));
 const hasAccessToCourse = (course: Course) => {
 // 免费课程无需登录，直接可以访问
 if (course.costType === 'free' || course.costType === 'charity') return true;
 // 付费课程需要登录
 if (!currentUser) return false;
 if (currentUser.role === 'admin') return true;
 // 检查是否直接拥有课程权限
 if (currentUser.permissions.includes(course.id)) return true;
 // 检查是否通过学位拥有课程权限
 const userDegrees = currentUser.degreePermissions || [];
 for (const degreeId of userDegrees) {
 const degree = degrees.find(d => d.id === degreeId);
 if (degree && degree.courses.includes(course.id)) return true;
 }
 return false;
 };

 const hasAccessToDegree = (degree: NanoDegree) => {
 // 免费学位无需登录，直接可以访问
 if (degree.costType === 'free' || degree.costType === 'charity') return true;
 // 付费学位需要登录
 if (!currentUser) return false;
 if (currentUser.role === 'admin') return true;
 return (currentUser.degreePermissions || []).includes(degree.id);
 };

 // 检查用户是否已注册某个课程（用于免费课程的注册状态显示）
 const isEnrolledInCourse = (courseId: string) => {
 if (!currentUser) return false;
 if (currentUser.role === 'admin') return true;
 // 检查是否在用户的权限列表中
 if (currentUser.permissions.includes(courseId)) return true;
 // 检查是否通过学位拥有
 const userDegrees = currentUser.degreePermissions || [];
 for (const degreeId of userDegrees) {
 const degree = degrees.find(d => d.id === degreeId);
 if (degree && degree.courses.includes(courseId)) return true;
 }
 return false;
 };

 // 注册免费课程
 const enrollFreeCourse = async (courseId: string) => {
 if (!currentUser) return;
 if (currentUser.permissions.includes(courseId)) return; // 已注册
 const updatedUser = {
 ...currentUser,
 permissions: [...currentUser.permissions, courseId]
 };
 setCurrentUser(updatedUser);
 setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
 // 保存到数据库
 await db.updateUser(updatedUser);
 };

 const handleLogin = async (email: string, password: string): Promise<string | null> => {
 // 先从数据库查询
 const dbUser = await db.getUserByEmail(email);
 if (dbUser) {
 if (dbUser.password !== password) {
 return '密码错误';
 }
 setCurrentUser(dbUser);
 setIsLoginModalOpen(false);
 setLoginEmail('');
 return null;
 }
 // 再从本地状态查询（兼容）
 const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
 if (existingUser) {
 if (existingUser.password !== password) {
 return '密码错误';
 }
 setCurrentUser(existingUser);
 setIsLoginModalOpen(false);
 setLoginEmail('');
 return null;
 }
 return '账号不存在';
 };

 const handleRegister = async (email: string, password: string, name: string): Promise<string | null> => {
 const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
 if (existingUser) {
 return '该邮箱已被注册';
 }
 const newUser: User = {
 id: `u_${Date.now()}`,
 email,
 password,
 name: name || email.split('@')[0],
 role: 'student',
 permissions: [],
 degreePermissions: []
 };
 // 保存到数据库
 const savedUser = await db.createUser(newUser);
 if (!savedUser) {
 return '注册失败，请稍后重试';
 }
 setUsers(prev => [...prev, savedUser]);
 setCurrentUser(savedUser);
 setIsLoginModalOpen(false);
 setLoginEmail('');
 return null;
 };
 const handleLogout = () => { setCurrentUser(null); navTo(ViewState.HOME); };

 // ESC 键关闭弹窗
 useEffect(() => {
 const handleEsc = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 setIsLoginModalOpen(false);
 setShowContactModal(false);
 }
 };
 window.addEventListener('keydown', handleEsc);
 return () => window.removeEventListener('keydown', handleEsc);
 }, []);

 const CostBadge: React.FC<{ type: CostType }> = ({ type }) => {
 if (type === 'paid') return <span className="bg-[#F5F4F0] text-[#171717] border border-[#EEEDE9] px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide">专业版</span>;
 return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide">免费</span>;
 };

 // --- MODALS ---
 const LoginModal = () => {
 const [mode, setMode] = useState<'login' | 'register'>('login');
 const [email, setEmail] = useState(loginEmail);
 const [password, setPassword] = useState('');
 const [name, setName] = useState('');
 const [error, setError] = useState('');

 useEffect(() => { if (loginEmail) setEmail(loginEmail); }, [loginEmail]);
 useEffect(() => {
 if (!isLoginModalOpen) {
 setEmail(''); setPassword(''); setName(''); setError(''); setMode('login');
 }
 }, [isLoginModalOpen]);

 const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

 const handleSubmit = () => {
 setError('');
 if (!email.trim()) { setError('请输入邮箱'); return; }
 if (!validateEmail(email)) { setError('邮箱格式不正确'); return; }
 if (!password.trim()) { setError('请输入密码'); return; }
 if (password.length < 6) { setError('密码至少6位'); return; }

 if (mode === 'login') {
 const err = handleLogin(email, password);
 if (err) setError(err);
 } else {
 if (!name.trim()) { setError('请输入昵称'); return; }
 const err = handleRegister(email, password, name);
 if (err) setError(err);
 }
 };

 const fillDemo = (type: 'admin' | 'student') => {
 if (type === 'admin') {
 setEmail('admin@opencsg.com');
 setPassword('admin123');
 } else {
 setEmail('student@test.com');
 setPassword('123456');
 }
 setError('');
 setMode('login');
 };

 if (!isLoginModalOpen) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200" onClick={() => setIsLoginModalOpen(false)}>
 <div className="bg-white border border-[#EEEDE9] w-full max-w-sm p-6 relative animate-in slide-in-from-bottom-4 duration-300 rounded-2xl" onClick={e => e.stopPropagation()}>
 <button onClick={() => setIsLoginModalOpen(false)} className="absolute top-3 right-3 text-[#999999] hover:text-[#171717] p-1.5 hover:bg-[#F5F4F0] rounded-full">
 <X size={16} />
 </button>

 <div className="text-center mb-6">
 <h2 className="text-xl font-bold text-[#171717] tracking-tight">{mode === 'login' ? '登录' : '注册'}</h2>
 <p className="text-[#666666] text-sm mt-1 font-medium">
 {mode === 'login' ? '欢迎回来' : '创建新账号'}
 </p>
 </div>

 <div className="space-y-3">
 <input
 type="email"
 value={email}
 onChange={e => { setEmail(e.target.value); setError(''); }}
 className="w-full border border-[#EEEDE9] bg-[#F5F4F0] rounded-lg px-4 py-2.5 text-[#171717] focus:outline-none focus:border-[#171717]"
 placeholder="邮箱"
 />
 <input
 type="password"
 value={password}
 onChange={e => { setPassword(e.target.value); setError(''); }}
 onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleSubmit()}
 className="w-full border border-[#EEEDE9] bg-[#F5F4F0] rounded-lg px-4 py-2.5 text-[#171717] focus:outline-none focus:border-[#171717]"
 placeholder="密码"
 />
 {mode === 'register' && (
 <input
 type="text"
 value={name}
 onChange={e => { setName(e.target.value); setError(''); }}
 onKeyDown={e => e.key === 'Enter' && handleSubmit()}
 className="w-full border border-[#EEEDE9] bg-[#F5F4F0] rounded-lg px-4 py-2.5 text-[#171717] focus:outline-none focus:border-[#171717]"
 placeholder="昵称"
 />
 )}

 {error && <p className="text-[#E00000] text-sm text-center font-medium">{error}</p>}

 <Button onClick={handleSubmit} className="w-full justify-center py-2.5">
 {mode === 'login' ? '登录' : '注册'}
 </Button>

 <p className="text-center text-sm text-[#666666] font-medium">
 {mode === 'login' ? '没有账号？' : '已有账号？'}
 <button
 onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
 className="text-[#171717] font-bold ml-1 hover:underline"
 >
 {mode === 'login' ? '立即注册' : '去登录'}
 </button>
 </p>

 {/* 演示账号 */}
 <div className="pt-4 border-t border-[#EEEDE9]">
 <p className="text-xs text-[#999999] text-center mb-3 font-medium">演示账号（点击自动填入）</p>
 <div className="flex gap-2">
 <button onClick={() => fillDemo('admin')} className="flex-1 py-2 bg-[#F5F4F0] text-[#171717] border border-[#EEEDE9] rounded-lg text-xs font-bold hover:bg-[#EEEDE9]">
 管理员
 </button>
 <button onClick={() => fillDemo('student')} className="flex-1 py-2 bg-[#171717] text-white rounded-lg text-xs font-bold hover:bg-black">
 学员
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 };

 const ContactModal = () => {
 if (!showContactModal) return null;
 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200" onClick={() => setShowContactModal(false)}>
 <div className="bg-white border border-[#EEEDE9] w-full max-w-sm p-6 relative rounded-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
 <button onClick={() => setShowContactModal(false)} className="absolute top-3 right-3 text-[#999999] hover:text-[#171717] hover:bg-[#F5F4F0] rounded-full p-1.5">
 <X size={16} />
 </button>
 <div className="text-center">
 <h2 className="text-xl font-bold text-[#171717] mb-2 tracking-tight">联系管理员开通</h2>
 <p className="text-[#666666] mb-4 text-sm font-medium">扫描下方二维码添加管理员微信</p>

 {/* 微信二维码 */}
 <div className="bg-white border-2 border-[#EEEDE9] rounded-xl p-3 mb-4 inline-block">
 <img
 src="/wechat-qr.jpg"
 alt="管理员微信二维码"
 className="w-48 h-48 object-contain rounded-lg"
 onError={(e) => {
 const target = e.target as HTMLImageElement;
 target.style.display = 'none';
 target.parentElement!.innerHTML = `
 <div class="w-48 h-48 bg-[#F5F4F0] rounded-lg flex flex-col items-center justify-center text-[#999999] text-sm">
 <svg class="w-12 h-12 mb-2 text-[#EEEDE9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <span>请添加二维码</span>
 <span class="text-xs mt-1 font-mono">public/wechat-qr.jpg</span>
 </div>
 `;
 }}
 />
 </div>

 <div className="bg-[#F5F4F0] border border-[#EEEDE9] rounded-lg p-3 mb-4">
 <p className="text-xs text-[#171717]">
 <span className="font-bold">添加时请备注：</span>
 <span className="font-mono ml-1 font-bold">AI课程</span>
 </p>
 </div>

 <p className="text-[11px] text-[#999999] leading-relaxed font-medium">
 付费后管理员将为您开通对应课程或学位的访问权限
 </p>
 </div>
 </div>
 </div>
 );
 };

 // 管理员快速入口提示
 const AdminQuickTip = () => {
 if (!currentUser || currentUser.role !== 'admin' || !showAdminTip || view === ViewState.ADMIN) return null;
 return (
 <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500">
 <div className="bg-[#171717] border border-[#262626] rounded-2xl p-4 max-w-xs">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center shrink-0">
 <Settings className="w-5 h-5 text-white" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-bold text-white mb-1">管理员模式已激活</p>
 <p className="text-xs text-[#A3A3A3] mb-3 font-medium">您已以管理员身份登录，可以管理用户权限和课程内容。</p>
 <div className="flex gap-2">
 <button
 onClick={() => { navTo(ViewState.ADMIN); setShowAdminTip(false); }}
 className="text-xs font-bold text-white hover:underline"
 >
 进入后台 →
 </button>
 <button
 onClick={() => setShowAdminTip(false)}
 className="text-xs text-[#666666] hover:text-[#999999] ml-auto font-medium"
 >
 知道了
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 };

 const CertificateCard = ({ title, type }: { title: string, type: 'Course' | 'Degree' }) => (
 <div className="mt-8 border border-[#EEEDE9] bg-[#F5F4F0] p-8 relative overflow-hidden rounded-2xl group duration-500">
 <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 transform scale-150 pointer-events-none"><Award className="w-64 h-64 text-[#171717]" /></div>
 <div className="relative z-10 flex flex-col items-center">
 <div className="mb-6"><Badge>结业证书预览</Badge></div>
 <div className="border-[12px] border-double border-[#EEEDE9] bg-white text-[#171717] p-10 w-full max-w-lg text-center relative">
 <div className="text-[#999999] font-serif italic mb-4 tracking-widest">Certificate of Completion</div>
 <h4 className="text-3xl font-bold text-[#171717] mb-6 font-serif">{title}</h4>
 <div className="h-px w-24 bg-[#EEEDE9] mx-auto my-6"></div>
 <div className="text-xs text-[#666666] font-mono mb-8 leading-relaxed">THIS CERTIFIES THAT THE STUDENT HAS SUCCESSFULLY COMPLETED THE {type === 'Degree' ? 'NANO DEGREE PROGRAM' : 'PROFESSIONAL COURSE'}.</div>
 <div className="flex justify-between items-end mt-4 px-4"><div className="text-center"><div className="h-px w-24 bg-[#EEEDE9] mb-2"></div><div className="text-[9px] text-[#999999] uppercase tracking-wider font-bold">Instructor</div></div><Award className="w-12 h-12 text-[#171717]" /><div className="text-center"><div className="h-px w-24 bg-[#EEEDE9] mb-2"></div><div className="text-[9px] text-[#999999] uppercase tracking-wider font-bold">Director</div></div></div>
 </div>
 <p className="text-center text-xs text-[#999999] mt-6 font-mono max-w-md font-medium">完成所有课程并通过项目审核后，您将获得此证书的数字版（支持区块链验证）。</p>
 </div>
 </div>
 );

 // --- SUB-PAGES ---
 const HomePage = () => (
 <div className="animate-in fade-in duration-700 pb-20">
   
 <section className="relative overflow-hidden bg-transparent border-b border-[#171717]">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
   <div className="col-span-1 lg:col-span-2 p-8 md:p-16 lg:p-24 border-r border-[#171717] bg-[#F5F4F0] flex flex-col justify-center">
     <div className="inline-block mb-8 w-fit"><span className="inline-flex items-center px-3 py-1 rounded-full border border-[#171717] bg-[#171717] text-[#F5F4F0] text-[10px] font-black uppercase tracking-widest">OpenCSG Academy</span></div>
     <h1 className="text-6xl md:text-8xl lg:text-[100px] font-black leading-[0.9] text-[#171717] tracking-tighter mb-8 uppercase">
       MASTER AI.<br />OWN THE FUTURE.
     </h1>
     <p className="text-xl md:text-2xl text-[#666666] max-w-2xl leading-relaxed mb-12 font-medium">
       从 Prompt 工程到 Agent 开发，从模型微调到企业级应用。体系化 AI 课程 + 实战项目 + 智能助教。
     </p>
     <div className="flex flex-col sm:flex-row gap-4">
       <button onClick={() => navTo(ViewState.ALL_DEGREES)} className="bg-[#171717] text-white px-8 py-5 font-bold text-lg hover:bg-black transition-colors rounded-none border border-[#171717] uppercase tracking-wider">探索 Nano Degree</button>
       <button onClick={() => navTo(ViewState.ALL_COURSES)} className="bg-[#F5F4F0] text-[#171717] px-8 py-5 font-bold text-lg hover:bg-[#EEEDE9] transition-colors rounded-none border border-[#171717] uppercase tracking-wider">浏览所有课程</button>
     </div>
   </div>
   <div className="col-span-1 flex flex-col">
      <div className="flex-1 p-8 lg:p-12 border-b border-[#171717] bg-white flex flex-col justify-center">
        <div className="text-xs font-black tracking-widest text-[#999999] uppercase mb-4">Users</div>
        <div className="text-7xl lg:text-8xl font-black text-[#171717] tracking-tighter">10K+</div>
        <p className="text-[#666666] font-bold uppercase tracking-widest mt-2 text-xs">全球学习者</p>
      </div>
      <div className="flex-1 p-8 lg:p-12 bg-[#F5F4F0] flex flex-col justify-center">
        <div className="text-xs font-black tracking-widest text-[#999999] uppercase mb-4">Courses</div>
        <div className="text-7xl lg:text-8xl font-black text-[#171717] tracking-tighter">50+</div>
        <p className="text-[#666666] font-bold uppercase tracking-widest mt-2 text-xs">专业内容</p>
      </div>
   </div>
 </div>
 </section>

 <section className="max-w-[1600px] mx-auto px-0 py-0 border-b border-[#171717]">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
 <div className="col-span-1 lg:col-span-3 p-8 border-b border-[#171717] bg-[#171717] flex items-center justify-between">
 <h2 className="text-3xl md:text-5xl font-black text-[#F5F4F0] tracking-tighter uppercase">热门职业路径</h2>
 <button onClick={() => navTo(ViewState.ALL_DEGREES)} className="hidden md:flex items-center gap-2 text-[#F5F4F0] font-bold tracking-widest uppercase text-sm border border-[#F5F4F0] px-4 py-2 hover:bg-[#F5F4F0] hover:text-[#171717] transition-colors">VIEW ALL <ChevronRight className="w-4 h-4" /></button>
 </div>
 {degrees.slice(0, 3).map((degree, index) => (
 <div key={degree.id} className={`col-span-1 border-[#171717] p-8 lg:p-12 bg-white flex flex-col group cursor-pointer hover:bg-[#F5F4F0] transition-colors ${index !== 2 ? 'border-b lg:border-b-0 lg:border-r' : ''}`} onClick={() => handleDegreeClick(degree.id)}>
 <div className="flex justify-between items-start mb-12">
 <div className="p-4 border border-[#171717] bg-[#171717] text-[#F5F4F0]">{ICON_MAP[degree.icon] || ICON_MAP['shield']}</div>
 <span className="px-3 py-1 border border-[#171717] text-[10px] font-black uppercase tracking-widest">{degree.courses.length} CORE COURSES</span>
 </div>
 <h3 className="text-3xl font-black text-[#171717] mb-4 tracking-tighter uppercase leading-none">{degree.title}</h3>
 <p className="text-[#666666] mb-12 flex-grow font-medium leading-relaxed">{degree.description}</p>
 <div className="flex justify-between items-end border-t border-[#171717] pt-8 mt-auto">
 <div><div className="text-[10px] text-[#999999] uppercase font-black mb-1 tracking-widest">Investment</div><span className="text-3xl font-black text-[#171717]">¥{degree.price}</span></div>
 <ArrowRight className="w-8 h-8 text-[#171717] group-hover:translate-x-2 transition-transform" />
 </div>
 </div>
 ))}
 </div>
 </section>

 <section className="bg-[#171717] text-white">
 <div className="grid grid-cols-1 lg:grid-cols-2">
 <div className="p-12 lg:p-24 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-[#262626]">
 <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">THEY BUILT<br/>THE FUTURE</h2>
 <p className="text-[#A3A3A3] font-medium text-xl leading-relaxed">加入超过 10,000 名终身学习者的社区</p>
 </div>
 <div className="flex flex-col">
 {[
 { name: "李明", role: "前端工程师", text: "OpenCSG 的课程非常实战。我以前完全不懂代码，跟着'全栈创作者'路径学完后，我成功拿到了第一份开发 Offer。", icon: <Code2 /> },
 { name: "Sarah Wang", role: "数据分析师", text: "这里的 AI 助教太棒了！无论多晚，遇到问题都能立刻得到解答，就像有个私人导师在身边。", icon: <Sparkles /> }
 ].map((item, idx) => (
 <div key={idx} className={`p-8 lg:p-12 relative flex flex-col justify-between ${idx === 0 ? 'border-b border-[#262626]' : ''}`}>
 <Quote className="absolute top-8 right-8 text-[#262626] w-16 h-16" />
 <p className="text-2xl font-bold leading-relaxed mb-8 relative z-10">"{item.text}"</p>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 border border-[#262626] flex items-center justify-center text-white">{item.icon}</div>
 <div><div className="font-black uppercase tracking-widest">{item.name}</div><div className="text-xs text-[#A3A3A3] uppercase tracking-widest font-bold">{item.role}</div></div>
 </div>
  </div>
  ))}
  </div>
  </div>
  </section>

 <section className="max-w-[1600px] mx-auto px-0 py-0 border-b border-[#171717] bg-[#F5F4F0]">
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
 <div className="col-span-1 lg:col-span-4 p-8 border-b border-[#171717] bg-white flex items-center justify-between">
 <h2 className="text-3xl md:text-5xl font-black text-[#171717] tracking-tighter uppercase">探索单项技能</h2>
 <button onClick={() => navTo(ViewState.ALL_COURSES)} className="hidden md:flex items-center gap-2 text-[#F5F4F0] font-bold tracking-widest uppercase text-sm border border-[#171717] bg-[#171717] px-4 py-2 hover:bg-black transition-colors">VIEW ALL <ChevronRight className="w-4 h-4" /></button>
 </div>
 {courses.slice(0, 4).map((course, index) => (
 <div key={course.id} onClick={() => handleCourseClick(course.id)} className={`col-span-1 border-[#171717] bg-white flex flex-col group cursor-pointer hover:bg-[#EEEDE9] transition-colors ${index !== 3 ? 'border-b lg:border-b-0 lg:border-r' : ''}`}>
 <div className="h-48 overflow-hidden relative border-b border-[#171717]">
 <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
 <div className="absolute top-4 right-4"><CostBadge type={course.costType} /></div>
 </div>
 <div className="p-8 flex-1 flex flex-col">
 <div className="flex items-center justify-between text-[10px] font-black tracking-widest uppercase text-[#999999] mb-4">
 <div className="flex items-center gap-1"><Clock size={12}/> {course.duration}</div>
 <div className="flex items-center gap-1"><UserIcon size={12}/> {course.instructor}</div>
 </div>
 <h3 className="text-xl font-black text-[#171717] leading-tight mb-4 uppercase">{course.title}</h3>
 <p className="text-[13px] text-[#666666] line-clamp-2 flex-grow mb-6 font-medium leading-relaxed">{course.description}</p>
 <div className="pt-6 border-t border-[#171717] flex items-center justify-between">
 <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-1 border ${course.level === 'Beginner' ? 'border-[#171717] text-[#171717]' : 'bg-[#171717] border-[#171717] text-[#F5F4F0]'}`}>{course.level === 'Beginner' ? '入门' : '进阶'}</span>
 {course.costType === 'paid' ? (
 <div className="flex items-center gap-2">
 {!currentUser && <Lock className="w-3 h-3 text-[#171717]" />}
 <span className="text-[#171717] font-black text-lg">¥{course.price}</span>
 </div>
 ) : <span className="text-[#171717] text-xs font-black tracking-widest uppercase group-hover:underline">DETAILS →</span>}
 </div>
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* 未登录用户 CTA 区域 */}
 {!currentUser && (
 <section className="bg-white border-b border-[#171717]">
 <div className="grid grid-cols-1 lg:grid-cols-2">
 <div className="p-12 lg:p-24 border-b lg:border-b-0 lg:border-r border-[#171717] bg-[#171717] text-white flex flex-col justify-center">
 <div className="inline-block mb-8 w-fit"><span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest"><Sparkles size={12} /> 限时免费</span></div>
 <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">开启你的<br/>学习之旅</h2>
 <p className="text-[#A3A3A3] font-medium text-lg leading-relaxed mb-12">
 注册即可免费访问所有免费课程，获取学习进度追踪、AI 助教辅导、社区讨论等完整功能。
 </p>
              <div className="flex flex-col sm:flex-row gap-4">
               <button onClick={() => setIsLoginModalOpen(true)} className="bg-white text-[#171717] px-8 py-5 font-bold text-lg hover:bg-[#EEEDE9] transition-colors rounded-none border border-white uppercase tracking-wider">立即免费注册</button>
               <button onClick={() => navTo(ViewState.ALL_COURSES)} className="bg-transparent text-white px-8 py-5 font-bold text-lg hover:bg-white/10 transition-colors rounded-none border border-white uppercase tracking-wider">先看看课程</button>
             </div>
 </div>
 <div className="p-12 lg:p-24 bg-[#F5F4F0] flex flex-col justify-center">
 <div className="border border-[#171717] bg-white p-8 mb-8">
 <div className="flex items-center gap-4 mb-8">
 <div className="w-16 h-16 bg-[#171717] flex items-center justify-center">
 <GraduationCap className="w-8 h-8 text-white" />
 </div>
 <div>
 <div className="text-[#171717] text-4xl font-black tracking-tighter">10,000+</div>
 <div className="text-[#999999] text-xs font-black uppercase tracking-widest mt-1">学员已加入</div>
 </div>
 </div>
 <div className="space-y-4">
 {['完成安全基础课程', '获得第一个认证', '加入学习小组'].map((item, i) => (
 <div key={i} className="flex items-center gap-3 text-[13px] text-[#171717] font-bold uppercase tracking-widest border-b border-[#EEEDE9] pb-4 last:border-0 last:pb-0">
 <CheckCircle2 className="w-5 h-5 text-[#171717]" />
 <span>{item}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </section>
 )}
 </div>
 );

 const AllDegreesPage = () => (
 <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
 <div className="mb-12"><h1 className="text-4xl font-bold text-[#171717] mb-3 tracking-tight">Nano Degree 目录</h1><p className="text-[#666666] text-lg font-medium">体系化的学习路径，带你从入门到精通。</p></div>
 <div className="grid md:grid-cols-2 gap-8">
 {degrees.map(degree => (
 <Card key={degree.id} className="cursor-pointer flex flex-col hover:bg-[#FAFAFA]" onClick={() => handleDegreeClick(degree.id)}>
 {degree.thumbnail && (
 <div className="h-40 -mx-6 -mt-6 mb-6 overflow-hidden rounded-t-[15px] border-b border-[#EEEDE9]">
 <img src={degree.thumbnail} alt={degree.title} className="w-full h-full object-cover" />
 </div>
 )}
 <div className="flex justify-between items-start mb-6">
 <div className="p-3 bg-[#F5F4F0] rounded-xl text-[#171717] border border-[#EEEDE9]">{ICON_MAP[degree.icon] || ICON_MAP['shield']}</div>
 <div className="flex flex-col items-end gap-2"><Badge>{degree.courses.length} 门课程</Badge><CostBadge type={degree.costType} /></div>
 </div>
 <h3 className="text-2xl font-bold text-[#171717] mb-3 tracking-tight">{degree.title}</h3>
 <p className="text-[#666666] font-medium mb-6 flex-grow leading-relaxed">{degree.description}</p>
 <div className="flex justify-between items-center border-t border-[#EEEDE9] pt-6 mt-auto"><span className="text-2xl font-mono text-[#171717] font-bold">¥{degree.price}</span><Button onClick={(e) => { e.stopPropagation(); handleDegreeClick(degree.id); }} variant="secondary">查看详情</Button></div>
 </Card>
 ))}
 </div>
 </div>
 );

 const AllCoursesPage = () => {
 // (Reuse logic)
 const [searchTerm, setSearchTerm] = useState('');
 const [filterLevel, setFilterLevel] = useState('All');
 const [filterCost, setFilterCost] = useState<'All' | 'Free' | 'Pro'>('All');
 const filteredCourses = courses.filter(c => {
 const searchLower = searchTerm.toLowerCase();
 const matchesSearch = c.title.toLowerCase().includes(searchLower) ||
 c.description.toLowerCase().includes(searchLower) ||
 c.tags.some(t => t.toLowerCase().includes(searchLower)) ||
 c.instructor.toLowerCase().includes(searchLower);
 const matchesLevel = filterLevel === 'All' || c.level === filterLevel;
 let matchesCost = true;
 if (filterCost === 'Free') matchesCost = c.costType === 'free' || c.costType === 'charity';
 else if (filterCost === 'Pro') matchesCost = c.costType === 'paid';
 return matchesSearch && matchesLevel && matchesCost;
 });

 return (
 <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
 <div className="flex flex-col gap-8 mb-12">
 <div><h1 className="text-4xl font-bold text-[#171717] mb-3 tracking-tight">课程目录</h1><p className="text-[#666666] font-medium text-lg">探索我们的完整课程库，发现新技能。</p></div>
 <div className="flex items-center gap-4 border-b border-[#EEEDE9] pb-1 overflow-x-auto">
 {['All', 'Free', 'Pro'].map(f => (
 <button key={f} onClick={() => setFilterCost(f as any)} className={`px-4 py-3 text-[15px] font-bold border-b-[3px] ${filterCost === f ? 'border-[#171717] text-[#171717]' : 'border-transparent text-[#999999] hover:text-[#171717]'}`}>
 {f === 'All' ? '全部课程' : f === 'Free' ? '免费课程' : '专业版'}
 </button>
 ))}
 </div>
 <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
 <div className="relative w-full md:w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" /><input type="text" placeholder="搜索主题..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border border-[#EEEDE9] text-[#171717] pl-10 pr-4 py-2.5 rounded-lg font-sans text-sm w-full focus:border-[#171717] focus:ring-[#171717] focus:outline-none" /></div>
 <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0"><span className="text-xs text-[#999999] font-bold mr-2 uppercase tracking-wider">难度</span>{['All', 'Beginner', 'Intermediate'].map(level => (<button key={level} onClick={() => setFilterLevel(level)} className={`px-3 py-1.5 rounded-[999px] text-xs font-bold border whitespace-nowrap ${filterLevel === level ? 'bg-[#171717] text-white border-[#171717]' : 'bg-white text-[#666666] border-[#EEEDE9] hover:border-[#171717] hover:text-[#171717]'}`}>{level === 'All' ? '全部' : level === 'Beginner' ? '入门' : '进阶'}</button>))}</div>
 </div>
 </div>
 {filteredCourses.length === 0 ? (
 <div className="col-span-full text-center py-20">
 <Search className="w-12 h-12 text-[#999999] mx-auto mb-4" />
 <h3 className="text-xl font-bold text-[#171717] mb-2">未找到匹配的课程</h3>
 <p className="text-[#999999]">尝试调整筛选条件或搜索关键词</p>
 </div>
 ) : (
 <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
 {filteredCourses.map(course => {
 const parentDegree = getDegreeForCourse(course.id);
 return (
 <div key={course.id} className="bg-white border border-[#EEEDE9] rounded-2xl cursor-pointer overflow-hidden flex flex-col relative hover:bg-[#FAFAFA] group p-0">
 <div className="h-40 overflow-hidden relative" onClick={() => handleCourseClick(course.id)}>
 <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover duration-700 group-" />
 <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10"></div>
 <div className="absolute top-3 right-3"><CostBadge type={course.costType} /></div>
 <div className="absolute bottom-3 left-3 right-3"><h3 className="text-base font-bold text-white leading-tight drop-">{course.title}</h3></div>
 </div>
 <div className="p-4 flex-1 flex flex-col" onClick={() => handleCourseClick(course.id)}>
 {parentDegree && (<div className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#171717] bg-[#F5F4F0] border border-[#EEEDE9] px-2 py-0.5 rounded-md w-fit"><LinkIcon size={10} /> {parentDegree.title.split(' ')[0]}...</div>)}
 <h3 className="text-base font-bold mb-2 text-[#171717] tracking-tight line-clamp-1">{course.title}</h3>
 <div className="mt-auto pt-3 border-t border-[#EEEDE9] flex justify-between items-center text-xs text-[#999999] font-medium">
 <span>{course.duration}</span>
 <span>{course.instructor}</span>
 </div>
 </div>
 {/* 购买/解锁按钮 */}
 {course.costType === 'paid' && !hasAccessToCourse(course) && (
 <div className="px-4 pb-4">
 <button
 onClick={(e) => {
 e.stopPropagation();
 if (!currentUser) {
 setIsLoginModalOpen(true);
 } else {
 setShowContactModal(true);
 }
 }}
 className="w-full py-2.5 bg-[#171717] text-white text-[13px] font-medium rounded-full hover:bg-black flex items-center justify-center gap-2 active:scale-[0.98]"
 >
 <span>¥{course.price}</span>
 <span>·</span>
 <span>{!currentUser ? '登录购买' : '立即购买'}</span>
 </button>
 </div>
 )}
 {/* 已解锁标记 */}
 {course.costType === 'paid' && hasAccessToCourse(course) && (
 <div className="px-4 pb-4">
 <div className="w-full py-2 bg-[#F5F4F0] text-[#171717] text-xs font-bold rounded-[999px] flex items-center justify-center gap-1">
 <CheckCircle2 size={12} /> 已解锁
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 };

 const NanoDegreePage = () => {
 const degree = degrees.find(d => d.id === selectedDegreeId);
 if (!degree) return <div>Data Error</div>;
 const degreeCourses = degree.courses.map(id => courses.find(c => c.id === id)).filter(Boolean) as Course[];
 const totalMinutes = degreeCourses.reduce((sum, c) => sum + parseDurationMinutes(c.duration), 0);
 const scrollToCurriculum = () => { const element = document.getElementById('curriculum-list'); if (element) { element.scrollIntoView({ behavior: 'smooth' }); } };

 return (
 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="bg-[#F5F4F0] border-b border-[#EEEDE9] py-16 px-6">
 <div className="max-w-4xl mx-auto">
 <Button onClick={() => navTo(ViewState.ALL_DEGREES)} variant="secondary" className="mb-8 pl-4 pr-6 rounded-[999px]"><ArrowLeft className="w-4 h-4 mr-2" /> 返回 Nano Degree</Button>
 <div className="flex flex-col md:flex-row gap-8 items-start">
 <div className="p-6 bg-white border border-[#EEEDE9] rounded-2xl text-[#171717]">{ICON_MAP[degree.icon]}</div>
 <div>
 <Badge>职业学位</Badge>
 <h1 className="text-4xl md:text-5xl font-bold text-[#171717] mt-4 mb-4 tracking-tight">{degree.title}</h1>
 <p className="text-[#666666] text-lg leading-relaxed mb-6 font-medium">{degree.description}</p>
 <div className="flex flex-wrap gap-6 mb-8 text-[13px] text-[#666666] font-medium">
 <div className="flex items-center gap-2"><BookOpen className="text-[#171717] w-4 h-4" /> {degree.courses.length} 门必修课</div>
 <div className="flex items-center gap-2"><Clock className="text-[#171717] w-4 h-4" /> {formatTotalDuration(totalMinutes)}</div>
 <div className="flex items-center gap-2"><Award className="text-[#171717] w-4 h-4" /> 官方认证证书</div>
 </div>
 <Button onClick={() => { if(degree.costType === 'paid' && !currentUser) setIsLoginModalOpen(true); else setShowContactModal(true); }} className="px-8 py-3">
 立即加入 - ¥{degree.price}
 </Button>
 </div>
 </div>
 </div>
 </div>

 <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
 <section>
 <h2 className="text-2xl font-bold text-[#171717] mb-6 flex items-center gap-2 tracking-tight"><TargetIcon /> 学习目标</h2>
 <div className="grid sm:grid-cols-2 gap-4">
 {degree.learningPoints.map((point, i) => (
 <div key={i} className="flex items-start gap-3 p-5 bg-white border border-[#EEEDE9] rounded-xl">
 <CheckCircle2 className="w-5 h-5 text-[#171717] shrink-0 mt-0.5" />
 <span className="text-[#666666] text-[15px] font-medium leading-relaxed">{point}</span>
 </div>
 ))}
 </div>
 </section>

 <section>
 <h2 className="text-2xl font-bold text-[#171717] mb-6 tracking-tight" id="curriculum-list">包含课程</h2>
 <div className="space-y-4">
 {degreeCourses.map((course, index) => (
 <div key={course.id} onClick={() => handleCourseClick(course.id, degree.id)} className="flex items-center gap-6 p-5 bg-white border border-[#EEEDE9] rounded-2xl hover:bg-[#FAFAFA] cursor-pointer group">
 <div className="text-2xl font-bold text-[#EEEDE9] w-8 text-center font-mono">{String(index + 1).padStart(2, '0')}</div>
 <img src={course.thumbnail} alt="" className="w-24 h-16 object-cover rounded-lg border border-[#EEEDE9]" />
 <div className="flex-grow">
 <h3 className="text-lg font-bold text-[#171717] group-hover:underline tracking-tight">{course.title}</h3>
 <div className="text-xs text-[#999999] mt-1 font-medium">{course.duration} • {course.level === 'Beginner' ? '入门' : '进阶'}</div>
 </div>
 <ChevronRight className="text-[#999999] group-hover:text-[#171717]" />
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
 const [activeTab, setActiveTab] = useState<'video' | 'overview' | 'resources'>('overview');

 return (
 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
 <div className="max-w-5xl mx-auto px-6 py-8">
 <Button onClick={() => {
 if (activeDegreeId) {
 setSelectedDegreeId(activeDegreeId);
 navTo(ViewState.NANO_DEGREE);
 } else {
 navTo(ViewState.ALL_COURSES);
 }
 }} variant="secondary" className="mb-6 pl-4 pr-6 rounded-[999px]">
 <ArrowLeft className="w-4 h-4 mr-2" /> {activeDegreeId ? '返回 Nano Degree' : '返回课程库'}
 </Button>

 {/* 课程标题区域 */}
 <div className="mb-8">
 {degree && <div onClick={() => handleDegreeClick(degree.id)} className="text-[11px] font-bold text-[#666666] mb-3 cursor-pointer hover:text-[#171717] hover:underline uppercase tracking-widest border border-[#EEEDE9] bg-white px-3 py-1 rounded-full w-fit">Included in {degree.title}</div>}
 <h1 className="text-3xl md:text-5xl font-bold text-[#171717] mb-6 tracking-tight leading-tight">{course.title}</h1>
 <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#666666] font-medium">
 <div className="flex items-center gap-1.5"><Clock size={14}/> {course.duration}</div>
 <div className="flex items-center gap-1.5"><UserIcon size={14}/> {course.instructor}</div>
 <div className={`px-2.5 py-0.5 rounded border ${course.level === 'Beginner' ? 'bg-white border-[#EEEDE9] text-[#171717]' : 'bg-[#171717] border-[#171717] text-white'}`}>{course.level === 'Beginner' ? '入门' : '进阶'}</div>
 <div className="ml-auto"><CostBadge type={course.costType} /></div>
 </div>
 </div>

 <div className="flex flex-col md:flex-row gap-8">
 <div className="flex-grow">
 {/* Tab 导航 */}
 <div className="flex gap-6 border-b border-[#EEEDE9] mb-8">
 <button onClick={() => setActiveTab('overview')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 ${activeTab === 'overview' ? 'border-[#171717] text-[#171717]' : 'border-transparent text-[#666666] hover:text-[#171717]'}`}>
 <BookOpen size={16} /> 课程概览
 </button>
 <button onClick={() => setActiveTab('video')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 ${activeTab === 'video' ? 'border-[#171717] text-[#171717]' : 'border-transparent text-[#666666] hover:text-[#171717]'}`}>
 <PlayCircle size={16} /> 视频课程
 </button>
 <button onClick={() => setActiveTab('resources')} className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 ${activeTab === 'resources' ? 'border-[#171717] text-[#171717]' : 'border-transparent text-[#666666] hover:text-[#171717]'}`}>
 <FileText size={16} /> 学习资源 ({course.resources?.length || 0})
 </button>
 </div>

 {/* 视频 Tab */}
 {activeTab === 'video' && (
 <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
 {isUnlocked && course.videoUrl ? (
 <div className="aspect-video w-full bg-[#171717] rounded-xl overflow-hidden">
 {isLocalVideo(course.videoUrl) ? (
 <video src={course.videoUrl} controls className="w-full h-full" controlsList="nodownload">
 您的浏览器不支持视频播放
 </video>
 ) : (
 <iframe src={getEmbedUrl(course.videoUrl)} title={course.title} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
 )}
 </div>
 ) : !isUnlocked ? (
 <div className="aspect-video w-full bg-[#171717] rounded-xl overflow-hidden relative flex items-center justify-center">
 <img src={course.thumbnail} alt={course.title} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm" />
 <div className="absolute inset-0"></div>
 <div className="relative z-10 text-center p-8 max-w-md">
 {!currentUser ? (
 <>
 <div className="w-16 h-16 bg-[#171717]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#666666]/30">
 <UserIcon className="w-7 h-7 text-[#666666]" />
 </div>
 <h3 className="text-xl font-bold text-white mb-2">登录后继续学习</h3>
 <p className="text-[#999999] text-sm mb-4">
 {course.costType === 'paid'
 ? '本课程为专业版内容，登录后可查看详情并解锁'
 : '登录后即可开始学习此课程'}
 </p>
 <div className="bg-white/10 rounded-lg p-3 mb-6 text-left">
 <p className="text-xs text-[#999999] mb-2">登录后您将获得：</p>
 <ul className="space-y-1.5 text-sm text-[#999999]">
 <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 学习进度自动保存</li>
 <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> AI 助教随时答疑</li>
 <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 下载学习资料</li>
 </ul>
 </div>
 <div className="flex flex-col gap-2">
 <Button onClick={() => setIsLoginModalOpen(true)} className="text-sm w-full">
 免费注册 / 登录
 </Button>
 <p className="text-xs text-[#666666]">已有账号？点击上方按钮即可登录</p>
 </div>
 </>
 ) : (
 <>
 <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
 <Lock className="w-7 h-7 text-white" />
 </div>
 <h3 className="text-xl font-bold text-white mb-2">解锁完整课程</h3>
 <p className="text-[#999999] text-sm mb-6">
 本课程属于 {degree?.title ? <span className="text-[#666666] font-bold">{degree.title}</span> : '专业版内容'}。
 {course.price > 0 && ` 单购价格: ¥${course.price}`}
 </p>
 <Button onClick={() => setShowContactModal(true)} className="text-sm">解锁课程</Button>
 </>
 )}
 </div>
 </div>
 ) : (
 <div className="aspect-video w-full bg-[#F5F4F0] rounded-xl overflow-hidden relative flex items-center justify-center border border-[#EEEDE9]">
 <img src={course.thumbnail} alt={course.title} className="absolute inset-0 w-full h-full object-cover opacity-50" />
 <div className="absolute inset-0 bg-white/60"></div>
 <div className="relative z-10 text-center p-8">
 <PlayCircle className="w-16 h-16 text-[#999999] mx-auto mb-4" />
 <p className="text-[#666666]">视频即将上线</p>
 </div>
 </div>
 )}
 </div>
 )}

 {/* 课程概览 Tab */}
 {activeTab === 'overview' && (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="prose prose-slate max-w-none text-[#171717] font-medium"><p className="text-lg leading-relaxed">{course.description}</p></div>
 <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
 <h3 className="text-lg font-bold text-[#171717] mb-4 flex items-center gap-2"><TargetIcon/> 本课要点</h3>
 <ul className="grid sm:grid-cols-2 gap-4">
 {course.learningPoints.map((point, i) => (<li key={i} className="flex items-start gap-3 text-sm text-[#666666] font-medium"><div className="w-1.5 h-1.5 rounded-full bg-[#171717] mt-2 shrink-0"></div>{point}</li>))}
 </ul>
 </div>
 </div>
 )}

 {/* 学习资源 Tab */}
 {activeTab === 'resources' && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 {!isUnlocked ? (
 <div className="text-center py-12 text-[#999999] bg-[#F5F4F0] rounded-xl border border-dashed border-[#EEEDE9]"><Lock className="w-8 h-8 mx-auto mb-3 opacity-50" /><p>资源仅对学员开放下载</p></div>
 ) : (course.resources && course.resources.length > 0) ? (
 course.resources.map((res, idx) => (
 <a key={idx} href={res.url} className="flex items-center gap-4 p-4 bg-white border border-[#EEEDE9] rounded-xl hover:border-[#EEEDE9] hover: group">
 <div className="p-3 bg-[#F5F4F0] rounded-lg text-[#171717] group-hover:bg-[#171717] group-hover:text-white">
 {res.type === 'pdf' ? <FileText size={20} /> : res.type === 'code' ? <Code2 size={20} /> : <LinkIcon size={20} />}
 </div>
 <div className="flex-grow">
 <div className="font-bold text-[#171717]">{res.title}</div>
 <div className="text-xs text-[#666666] uppercase mt-0.5">{res.type}</div>
 </div>
 <Download className="text-[#999999] group-hover:text-[#171717]" size={18} />
 </a>
 ))
 ) : (<div className="text-center py-8 text-[#666666]">暂无附加资源</div>)}
 </div>
 )}
 </div>

 {/* 右侧边栏 */}
 <div className="w-full md:w-80 shrink-0 space-y-6">
 {/* 价格/购买卡片 */}
 {!isUnlocked && course.costType === 'paid' && (
 <div className="bg-[#171717] text-white rounded-2xl p-6 border border-[#262626]">
 <div className="text-[13px] text-[#A3A3A3] mb-1 font-medium">课程价格</div>
 <div className="text-3xl font-bold mb-4">¥{course.price}</div>
 <Button onClick={() => !currentUser ? setIsLoginModalOpen(true) : setShowContactModal(true)} className="w-full bg-white text-[#171717] hover:bg-[#F5F4F0] font-bold">
 {!currentUser ? '登录购买' : '立即购买'}
 </Button>
 {!currentUser && (
 <p className="text-xs text-[#A3A3A3] text-center mt-4">
 注册免费，登录后可解锁课程
 </p>
 )}
 </div>
 )}
 {/* 免费课程注册卡片 */}
 {(course.costType === 'free' || course.costType === 'charity') && (
 <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
 <div className="text-[13px] text-[#666666] mb-1 font-medium">课程价格</div>
 <div className="text-3xl font-bold mb-4 text-[#171717]">免费</div>
 {!currentUser ? (
 <>
 <Button onClick={() => setIsLoginModalOpen(true)} className="w-full">
 登录注册学习
 </Button>
 <p className="text-xs text-[#999999] text-center mt-4 font-medium">
 登录后可保存学习进度
 </p>
 </>
 ) : !isEnrolledInCourse(course.id) ? (
 <Button onClick={() => enrollFreeCourse(course.id)} className="w-full">
 注册学习
 </Button>
 ) : (
 <div className="w-full py-2.5 bg-[#F5F4F0] text-[#171717] text-sm font-bold rounded-full flex items-center justify-center gap-2 border border-[#EEEDE9]">
 <CheckCircle2 size={16} /> 已注册
 </div>
 )}
 </div>
 )}

 <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6">
 <h4 className="font-bold text-[#171717] mb-4 text-[15px]">课程信息</h4>
 <div className="space-y-4 text-sm font-medium">
 <div className="flex justify-between py-3 border-b border-[#F5F4F0]"><span className="text-[#666666]">时长</span><span className="text-[#171717] font-mono">{course.duration}</span></div>
 <div className="flex justify-between py-3 border-b border-[#F5F4F0]"><span className="text-[#666666]">难度</span><span className="text-[#171717]">{course.level === 'Beginner' ? '入门' : '进阶'}</span></div>
 <div className="flex justify-between py-3 border-b border-[#F5F4F0]"><span className="text-[#666666]">讲师</span><span className="text-[#171717]">{course.instructor}</span></div>
 <div className="flex justify-between py-3 border-b border-[#F5F4F0]"><span className="text-[#666666]">更新时间</span><span className="text-[#171717] font-mono">2024.10</span></div>
 <div className="pt-2"><span className="text-[#666666] block mb-3">标签</span><div className="flex flex-wrap gap-2">{course.tags.map(t => <span key={t} className="px-2.5 py-1 bg-[#F5F4F0] border border-[#EEEDE9] rounded-[999px] text-xs text-[#171717] font-medium">{t}</span>)}</div></div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 };

 const HackathonPage = () => (
 <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
 {/* Hero Section */}
 <div className="relative rounded-[32px] overflow-hidden bg-[#171717] border border-[#262626] p-12 md:p-20 mb-12">
 <div className="relative z-10 text-center">
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium mb-6 border border-white/20">
 <Sparkles size={14} className="text-[#A3A3A3]" /> 即将推出
 </div>
 <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
 Hackathon
 </h1>
 <p className="text-xl md:text-2xl text-[#A3A3A3] max-w-2xl mx-auto leading-relaxed">
 代码、创意与激情的碰撞<br className="hidden md:block" />
 一场属于开发者的狂欢即将开启
 </p>
 </div>
 </div>

 {/* Info Cards */}
 <div className="grid md:grid-cols-3 gap-6 mb-12">
 <div className="bg-white rounded-2xl p-8 border border-[#EEEDE9] hover: transition-shadow">
 <div className="w-14 h-14 rounded-2xl bg-[#F5F4F0] flex items-center justify-center mb-6">
 <Code2 className="w-7 h-7 text-[#171717]" />
 </div>
 <h3 className="text-xl font-bold text-[#171717] mb-3 tracking-tight">编程挑战</h3>
 <p className="text-[#666666] leading-relaxed font-medium">限时编程、算法竞赛、项目开发，多种赛道等你来战</p>
 </div>
 <div className="bg-white rounded-2xl p-8 border border-[#EEEDE9] hover: transition-shadow">
 <div className="w-14 h-14 rounded-2xl bg-[#F5F4F0] flex items-center justify-center mb-6">
 <Award className="w-7 h-7 text-[#171717]" />
 </div>
 <h3 className="text-xl font-bold text-[#171717] mb-3 tracking-tight">丰厚奖励</h3>
 <p className="text-[#666666] leading-relaxed font-medium">现金大奖、实习机会、技术周边，为优秀选手准备</p>
 </div>
 <div className="bg-white rounded-2xl p-8 border border-[#EEEDE9] hover: transition-shadow">
 <div className="w-14 h-14 rounded-2xl bg-[#F5F4F0] flex items-center justify-center mb-6">
 <Users className="w-7 h-7 text-[#171717]" />
 </div>
 <h3 className="text-xl font-bold text-[#171717] mb-3 tracking-tight">团队协作</h3>
 <p className="text-[#666666] leading-relaxed font-medium">组队参赛、认识志同道合的伙伴，拓展你的技术圈子</p>
 </div>
 </div>

 {/* Coming Soon Box */}
 <div className="bg-white rounded-2xl p-12 text-center border border-[#EEEDE9]">
 <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#F5F4F0] mb-6">
 <Rocket className="w-10 h-10 text-[#171717]" />
 </div>
 <h2 className="text-2xl font-bold text-[#171717] mb-3 tracking-tight">活动筹备中</h2>
 <p className="text-[#666666] mb-8 max-w-md mx-auto font-medium">
 我们正在精心筹备，敬请关注后续通知。<br/>
 有任何问题欢迎联系我们！
 </p>
 <Button onClick={() => setShowContactModal(true)}>
 <MessageSquare size={16} className="mr-2" /> 联系我们
 </Button>
 </div>
 </div>
 );

 // 用户个人中心
 const ProfilePage = () => {
 if (!currentUser) {
 return (
 <div className="min-h-[60vh] flex items-center justify-center">
 <div className="text-center">
 <UserIcon className="w-12 h-12 text-[#999999] mx-auto mb-4" />
 <p className="text-[#666666] mb-4 font-medium">请先登录</p>
 <Button onClick={() => setIsLoginModalOpen(true)}>登录</Button>
 </div>
 </div>
 );
 }

 // 使用 isEnrolledInCourse 计算已注册的课程
 const myCourses = courses.filter(c => isEnrolledInCourse(c.id));
 const myPaidCourses = courses.filter(c => c.costType === 'paid' && isEnrolledInCourse(c.id));
 // 学位也需要检查是否在用户的 degreePermissions 中
 const myDegrees = degrees.filter(d => (currentUser.degreePermissions || []).includes(d.id));

 return (
 <div className="max-w-4xl mx-auto px-6 py-10 animate-in fade-in duration-300">
 {/* 用户信息卡片 */}
 <div className="bg-white border border-[#EEEDE9] rounded-2xl p-6 mb-8">
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 bg-[#171717] rounded-full flex items-center justify-center">
 <span className="text-2xl font-bold text-white">{currentUser.name.charAt(0).toUpperCase()}</span>
 </div>
 <div className="flex-1">
 <h1 className="text-xl font-bold text-[#171717]">{currentUser.name}</h1>
 <p className="text-[#666666] text-sm font-medium">{currentUser.email}</p>
 <span className={`inline-block mt-2 text-xs px-2.5 py-1 rounded font-bold ${
 currentUser.role === 'admin' ? 'bg-[#171717] text-white' : 'bg-[#F5F4F0] text-[#171717] border border-[#EEEDE9]'
 }`}>
 {currentUser.role === 'admin' ? '管理员' : '学员'}
 </span>
 </div>
 <Button variant="secondary" onClick={handleLogout} className="text-sm">
 <LogOut size={14} className="mr-1.5" /> 退出登录
 </Button>
 </div>
 </div>

 {/* 统计 */}
 <div className="grid grid-cols-3 gap-4 mb-8">
 <div className="bg-white border border-[#EEEDE9] rounded-xl p-4 text-center">
 <div className="text-2xl font-bold text-[#171717] font-mono">{myCourses.length}</div>
 <div className="text-xs text-[#666666] font-medium">已注册课程</div>
 </div>
 <div className="bg-white border border-[#EEEDE9] rounded-xl p-4 text-center">
 <div className="text-2xl font-bold text-[#171717] font-mono">{myPaidCourses.length}</div>
 <div className="text-xs text-[#666666] font-medium">付费课程</div>
 </div>
 <div className="bg-white border border-[#EEEDE9] rounded-xl p-4 text-center">
 <div className="text-2xl font-bold text-[#171717] font-mono">{myDegrees.length}</div>
 <div className="text-xs text-[#666666] font-medium">已购学位</div>
 </div>
 </div>

 {/* 我的课程 */}
 <div className="bg-white border border-[#EEEDE9] rounded-xl mb-8">
 <div className="px-5 py-4 border-b border-[#EEEDE9] flex items-center justify-between">
 <h2 className="font-bold text-[#171717]">我的课程</h2>
 <span className="text-xs text-[#999999] font-medium">{myCourses.length} 门课程</span>
 </div>
 <div className="divide-y divide-[#EEEDE9]">
 {myCourses.length === 0 ? (
 <div className="px-5 py-8 text-center text-[#999999] text-sm font-medium">暂无课程</div>
 ) : (
 myCourses.map(course => (
 <div
 key={course.id}
 onClick={() => handleCourseClick(course.id)}
 className="px-5 py-3 flex items-center gap-4 hover:bg-[#FAFAFA] cursor-pointer"
 >
 <img src={course.thumbnail} alt="" className="w-16 h-10 object-cover rounded border border-[#EEEDE9]" />
 <div className="flex-1 min-w-0">
 <div className="font-bold text-[#171717] truncate tracking-tight">{course.title}</div>
 <div className="text-xs text-[#666666] font-medium">{course.instructor} · {course.duration}</div>
 </div>
 <CostBadge type={course.costType} />
 <ChevronRight size={16} className="text-[#999999]" />
 </div>
 ))
 )}
 </div>
 </div>

 {/* 我的学位 */}
 <div className="bg-white border border-[#EEEDE9] rounded-xl">
 <div className="px-5 py-4 border-b border-[#EEEDE9] flex items-center justify-between">
 <h2 className="font-bold text-[#171717]">我的 Nano Degree</h2>
 <span className="text-xs text-[#999999] font-medium">{myDegrees.length} 个学位</span>
 </div>
 <div className="divide-y divide-[#EEEDE9]">
 {myDegrees.length === 0 ? (
 <div className="px-5 py-8 text-center text-[#999999] text-sm font-medium">
 <p>暂无可获得的学位</p>
 <p className="text-xs mt-1">解锁学位中的所有课程即可获得证书</p>
 </div>
 ) : (
 myDegrees.map(degree => (
 <div
 key={degree.id}
 onClick={() => handleDegreeClick(degree.id)}
 className="px-5 py-4 hover:bg-[#FAFAFA] cursor-pointer"
 >
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-[#F5F4F0] rounded-lg flex items-center justify-center border border-[#EEEDE9]">
 {ICON_MAP[degree.icon] || <Award className="w-5 h-5 text-[#171717]" />}
 </div>
 <div className="flex-1">
 <div className="font-bold text-[#171717] tracking-tight">{degree.title}</div>
 <div className="text-xs text-[#666666] font-medium">{degree.courses.length} 门课程</div>
 </div>
 <div className="flex items-center gap-2 text-[#171717] text-xs font-bold bg-[#F5F4F0] px-2.5 py-1 rounded-full border border-[#EEEDE9]">
 <CheckCircle2 size={14} /> 已解锁
 </div>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 );
 };

 const AdminPage = () => {
 const [activeTab, setActiveTab] = useState<'courses' | 'degrees' | 'users'>('courses');
 const [editingCourse, setEditingCourse] = useState<Course | null>(null);
 const [editingDegree, setEditingDegree] = useState<NanoDegree | null>(null);
 const [showCourseModal, setShowCourseModal] = useState(false);
 const [showDegreeModal, setShowDegreeModal] = useState(false);

 if (currentUser?.role !== 'admin') return (
 <div className="min-h-[60vh] flex items-center justify-center">
 <div className="text-center">
 <Lock className="w-12 h-12 text-[#999999] mx-auto mb-4" />
 <p className="text-[#666666] font-medium">无权限访问</p>
 </div>
 </div>
 );

 const togglePermission = async (userId: string, courseId: string) => {
 const user = users.find(u => u.id === userId);
 if (!user) return;
 const hasPerm = user.permissions.includes(courseId);
 const updatedUser = {
 ...user,
 permissions: hasPerm ? user.permissions.filter(p => p !== courseId) : [...user.permissions, courseId]
 };
 setUsers(users.map(u => u.id === userId ? updatedUser : u));
 await db.updateUser(updatedUser);
 };

 const toggleDegreePermission = async (userId: string, degreeId: string) => {
 const user = users.find(u => u.id === userId);
 if (!user) return;
 const currentDegrees = user.degreePermissions || [];
 const hasPerm = currentDegrees.includes(degreeId);
 const updatedUser = {
 ...user,
 degreePermissions: hasPerm ? currentDegrees.filter(p => p !== degreeId) : [...currentDegrees, degreeId]
 };
 setUsers(users.map(u => u.id === userId ? updatedUser : u));
 await db.updateUser(updatedUser);
 };

 const paidCourses = courses.filter(c => c.costType === 'paid');
 const paidDegrees = degrees.filter(d => d.costType === 'paid');

 // 课程编辑表单
 const CourseModal = () => {
 const isNew = !editingCourse;
 const [form, setForm] = useState<Partial<Course>>(editingCourse || {
 id: `c${Date.now()}`,
 title: '',
 description: '',
 learningPoints: [''],
 instructor: '',
 level: 'Beginner',
 duration: '45 分钟',
 thumbnail: 'https://picsum.photos/seed/new/800/400',
 tags: [],
 costType: 'free',
 price: 0,
 videoUrl: '',
 resources: []
 });

 const handleSave = async () => {
 if (!form.title?.trim()) return alert('请输入课程标题');
 const courseData = form as Course;
 if (isNew) {
 const saved = await db.createCourse(courseData);
 if (saved) {
 setCourses([...courses, saved]);
 } else {
 setCourses([...courses, courseData]); // 降级到本地
 }
 } else {
 const saved = await db.updateCourse(courseData);
 if (saved) {
 setCourses(courses.map(c => c.id === saved.id ? saved : c));
 } else {
 setCourses(courses.map(c => c.id === courseData.id ? courseData : c));
 }
 }
 setShowCourseModal(false);
 setEditingCourse(null);
 };

 const updateLearningPoint = (index: number, value: string) => {
 const points = [...(form.learningPoints || [])];
 points[index] = value;
 setForm({ ...form, learningPoints: points });
 };

 const addLearningPoint = () => {
 setForm({ ...form, learningPoints: [...(form.learningPoints || []), ''] });
 };

 const removeLearningPoint = (index: number) => {
 setForm({ ...form, learningPoints: form.learningPoints?.filter((_, i) => i !== index) });
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#171717]/60 p-4" onClick={() => { setShowCourseModal(false); setEditingCourse(null); }}>
 <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl" onClick={e => e.stopPropagation()}>
 <div className="sticky top-0 bg-white px-6 py-4 border-b border-[#EEEDE9] flex items-center justify-between">
 <h2 className="text-lg font-bold text-[#171717]">{isNew ? '添加课程' : '编辑课程'}</h2>
 <button onClick={() => { setShowCourseModal(false); setEditingCourse(null); }} className="text-[#999999] hover:text-[#171717]">
 <X size={20} />
 </button>
 </div>
 <div className="p-6 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">课程标题 *</label>
 <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder="输入课程名称" />
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">讲师</label>
 <input value={form.instructor || ''} onChange={e => setForm({ ...form, instructor: e.target.value })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder="讲师姓名" />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">课程描述</label>
 <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm h-20 resize-none" placeholder="课程简介..." />
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">学习要点</label>
 {form.learningPoints?.map((point, i) => (
 <div key={i} className="flex gap-2 mb-2">
 <input value={point} onChange={e => updateLearningPoint(i, e.target.value)} className="flex-1 border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder={`要点 ${i + 1}`} />
 <button onClick={() => removeLearningPoint(i)} className="text-red-400 hover:text-red-600 px-2"><Trash2 size={16} /></button>
 </div>
 ))}
 <button onClick={addLearningPoint} className="text-xs text-[#171717] hover:underline flex items-center gap-1"><Plus size={14} /> 添加要点</button>
 </div>
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">难度</label>
 <select value={form.level || 'Beginner'} onChange={e => setForm({ ...form, level: e.target.value as Course['level'] })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm">
 <option value="Beginner">入门</option>
 <option value="Intermediate">进阶</option>
 <option value="Advanced">高级</option>
 <option value="Expert">专家</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">时长（分钟）</label>
 <div className="flex items-center gap-2">
 <input type="number" value={parseInt(form.duration) || ''} onChange={e => setForm({ ...form, duration: e.target.value ? `${e.target.value} 分钟` : '' })} className="flex-1 border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder="45" min="1" />
 <span className="text-sm text-[#666666]">分钟</span>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">类型</label>
 <select value={form.costType || 'free'} onChange={e => setForm({ ...form, costType: e.target.value as CostType, price: e.target.value === 'paid' ? 49.99 : 0 })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm">
 <option value="free">免费</option>
 <option value="paid">付费</option>
 </select>
 </div>
 </div>
 {form.costType === 'paid' && (
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">价格 (¥)</label>
 <input type="number" value={form.price || 0} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" />
 </div>
 )}
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">课程视频</label>
 <div className="flex gap-2">
 <input value={form.videoUrl || ''} onChange={e => setForm({ ...form, videoUrl: e.target.value })} className="flex-1 border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder="YouTube/B站链接 或 上传视频..." />
 <label className="px-3 py-2 bg-[#F5F4F0] hover:bg-[#F5F4F0] text-[#171717] text-sm rounded-lg cursor-pointer whitespace-nowrap">
 上传视频
 <input type="file" accept="video/*" className="hidden" onChange={e => {
 const file = e.target.files?.[0];
 if (file) {
 const objectUrl = URL.createObjectURL(file);
 setForm({ ...form, videoUrl: objectUrl });
 }
 }} />
 </label>
 </div>
 <p className="text-[10px] text-[#999999] mt-1">支持上传视频文件，或输入 YouTube、Bilibili 链接</p>
 {form.videoUrl && (form.videoUrl.startsWith('blob:') || isLocalVideo(form.videoUrl)) && (
 <video src={form.videoUrl} controls className="mt-2 w-full max-h-40 rounded-lg bg-[#171717]" />
 )}
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">封面图片</label>
 <div className="flex gap-2">
 <input value={form.thumbnail || ''} onChange={e => setForm({ ...form, thumbnail: e.target.value })} className="flex-1 border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder="图片URL或上传..." />
 <label className="px-3 py-2 bg-[#F5F4F0] hover:bg-[#EEEDE9] text-[#171717] text-sm rounded-lg cursor-pointer">
 上传
 <input type="file" accept="image/*" className="hidden" onChange={e => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onload = (event) => {
 setForm({ ...form, thumbnail: event.target?.result as string });
 };
 reader.readAsDataURL(file);
 }
 }} />
 </label>
 </div>
 {form.thumbnail && <img src={form.thumbnail} alt="预览" className="mt-2 h-20 rounded-lg object-cover" />}
 </div>
 </div>
 <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-[#EEEDE9] flex justify-end gap-3">
 <Button variant="secondary" onClick={() => { setShowCourseModal(false); setEditingCourse(null); }}>取消</Button>
 <Button onClick={handleSave}><Save size={14} className="mr-1.5" /> 保存</Button>
 </div>
 </div>
 </div>
 );
 };

 // 学位编辑表单
 const DegreeModal = () => {
 const isNew = !editingDegree;
 const [form, setForm] = useState<Partial<NanoDegree>>(editingDegree || {
 id: `nd${Date.now()}`,
 title: '',
 description: '',
 learningPoints: [''],
 courses: [],
 price: 399,
 icon: 'sparkles',
 costType: 'paid'
 });

 const handleSave = async () => {
 if (!form.title?.trim()) return alert('请输入学位标题');
 const degreeData = form as NanoDegree;
 if (isNew) {
 const saved = await db.createNanoDegree(degreeData);
 if (saved) {
 setDegrees([...degrees, saved]);
 } else {
 setDegrees([...degrees, degreeData]);
 }
 } else {
 const saved = await db.updateNanoDegree(degreeData);
 if (saved) {
 setDegrees(degrees.map(d => d.id === saved.id ? saved : d));
 } else {
 setDegrees(degrees.map(d => d.id === degreeData.id ? degreeData : d));
 }
 }
 setShowDegreeModal(false);
 setEditingDegree(null);
 };

 const toggleCourse = (courseId: string) => {
 const selected = form.courses || [];
 if (selected.includes(courseId)) {
 setForm({ ...form, courses: selected.filter(id => id !== courseId) });
 } else {
 setForm({ ...form, courses: [...selected, courseId] });
 }
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#171717]/60 p-4" onClick={() => { setShowDegreeModal(false); setEditingDegree(null); }}>
 <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl" onClick={e => e.stopPropagation()}>
 <div className="sticky top-0 bg-white px-6 py-4 border-b border-[#EEEDE9] flex items-center justify-between">
 <h2 className="text-lg font-bold text-[#171717]">{isNew ? '添加学位' : '编辑学位'}</h2>
 <button onClick={() => { setShowDegreeModal(false); setEditingDegree(null); }} className="text-[#999999] hover:text-[#171717]">
 <X size={20} />
 </button>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">学位名称 *</label>
 <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder="输入学位名称" />
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">学位描述</label>
 <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm h-20 resize-none" placeholder="学位简介..." />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">价格 (¥)</label>
 <input type="number" value={form.price || 0} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" />
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">图标</label>
 <select value={form.icon || 'sparkles'} onChange={e => setForm({ ...form, icon: e.target.value })} className="w-full border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm">
 <option value="shield">盾牌</option>
 <option value="sparkles">闪耀</option>
 <option value="layers">层叠</option>
 <option value="terminal">终端</option>
 <option value="cpu">芯片</option>
 <option value="code">代码</option>
 <option value="globe">地球</option>
 </select>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-1">封面图片</label>
 <div className="flex gap-2">
 <input value={form.thumbnail || ''} onChange={e => setForm({ ...form, thumbnail: e.target.value })} className="flex-1 border border-[#EEEDE9] rounded-lg px-3 py-2 text-sm" placeholder="图片URL或上传..." />
 <label className="px-3 py-2 bg-[#F5F4F0] hover:bg-[#EEEDE9] text-[#171717] text-sm rounded-lg cursor-pointer">
 上传
 <input type="file" accept="image/*" className="hidden" onChange={e => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onload = (event) => {
 setForm({ ...form, thumbnail: event.target?.result as string });
 };
 reader.readAsDataURL(file);
 }
 }} />
 </label>
 </div>
 {form.thumbnail && <img src={form.thumbnail} alt="预览" className="mt-2 h-20 rounded-lg object-cover" />}
 </div>
 <div>
 <label className="block text-xs font-medium text-[#666666] mb-2">包含课程（点击选择）</label>
 <div className="space-y-2 max-h-48 overflow-y-auto border border-[#EEEDE9] rounded-lg p-3">
 {courses.map(course => {
 const selected = form.courses?.includes(course.id);
 return (
 <div
 key={course.id}
 onClick={() => toggleCourse(course.id)}
 className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
 selected ? 'bg-[#F5F4F0] border border-[#EEEDE9]' : 'hover:bg-[#F5F4F0] border border-transparent'
 }`}
 >
 {selected ? <CheckSquare size={16} className="text-[#171717]" /> : <Square size={16} className="text-[#999999]" />}
 <span className={`text-sm ${selected ? 'text-[#171717] font-medium' : 'text-[#171717]'}`}>{course.title}</span>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-[#EEEDE9] flex justify-end gap-3">
 <Button variant="secondary" onClick={() => { setShowDegreeModal(false); setEditingDegree(null); }}>取消</Button>
 <Button onClick={handleSave}><Save size={14} className="mr-1.5" /> 保存</Button>
 </div>
 </div>
 </div>
 );
 };

 const deleteCourse = async (id: string) => {
 if (!confirm('确定删除此课程？')) return;
 await db.deleteCourse(id);
 setCourses(courses.filter(c => c.id !== id));
 // 同时从学位中移除该课程
 for (const degree of degrees) {
 if (degree.courses.includes(id)) {
 const updated = { ...degree, courses: degree.courses.filter(cid => cid !== id) };
 await db.updateNanoDegree(updated);
 }
 }
 setDegrees(degrees.map(d => ({ ...d, courses: d.courses.filter(cid => cid !== id) })));
 };

 const deleteDegree = async (id: string) => {
 if (!confirm('确定删除此学位？')) return;
 await db.deleteNanoDegree(id);
 setDegrees(degrees.filter(d => d.id !== id));
 };

 const deleteUser = (id: string) => {
 if (id === currentUser?.id) return alert('不能删除自己');
 if (!confirm('确定删除此用户？')) return;
 // 暂不支持从数据库删除用户
 setUsers(users.filter(u => u.id !== id));
 };

 return (
 <div className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in duration-300">
 {showCourseModal && <CourseModal />}
 {showDegreeModal && <DegreeModal />}

 {/* 页头 */}
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-2xl font-bold text-[#171717] mb-1">管理后台</h1>
 <p className="text-[#666666] text-sm">课程、学位与用户管理</p>
 </div>
 <div className="flex gap-2">
 <div className="bg-white border border-[#EEEDE9] rounded-lg px-3 py-1.5 text-xs text-[#666666]">
 课程: <span className="font-bold text-[#171717]">{courses.length}</span>
 </div>
 <div className="bg-white border border-[#EEEDE9] rounded-lg px-3 py-1.5 text-xs text-[#666666]">
 学位: <span className="font-bold text-[#171717]">{degrees.length}</span>
 </div>
 <div className="bg-white border border-[#EEEDE9] rounded-lg px-3 py-1.5 text-xs text-[#666666]">
 用户: <span className="font-bold text-[#171717]">{users.length}</span>
 </div>
 </div>
 </div>

 {/* Tab 切换 */}
 <div className="flex gap-1 bg-[#F5F4F0] p-1 rounded-xl mb-6 w-fit">
 <button onClick={() => setActiveTab('courses')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'courses' ? 'bg-white text-[#171717] ' : 'text-[#666666] hover:text-[#171717]'}`}>
 课程管理
 </button>
 <button onClick={() => setActiveTab('degrees')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'degrees' ? 'bg-white text-[#171717] ' : 'text-[#666666] hover:text-[#171717]'}`}>
 学位管理
 </button>
 <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'users' ? 'bg-white text-[#171717] ' : 'text-[#666666] hover:text-[#171717]'}`}>
 用户权限
 </button>
 </div>

 {/* 课程管理 */}
 {activeTab === 'courses' && (
 <div className="bg-white border border-[#EEEDE9] rounded-xl">
 <div className="px-5 py-4 border-b border-[#EEEDE9] flex items-center justify-between">
 <h2 className="font-bold text-[#171717]">课程列表</h2>
 <Button onClick={() => { setEditingCourse(null); setShowCourseModal(true); }} className="text-sm py-1.5">
 <Plus size={14} className="mr-1" /> 添加课程
 </Button>
 </div>
 <div className="divide-y divide-[#EEEDE9]">
 {courses.map(course => (
 <div key={course.id} className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-[#F5F4F0]">
 <img src={course.thumbnail} alt="" className="w-14 h-9 object-cover rounded" />
 <div className="flex-1 min-w-0">
 <div className="font-medium text-[#171717] truncate">{course.title}</div>
 <div className="text-xs text-[#999999]">{course.instructor} · {course.duration}</div>
 </div>
 <CostBadge type={course.costType} />
 <div className="w-16 text-right font-mono text-[#171717] text-xs">
 {course.costType === 'paid' ? `¥${course.price}` : '-'}
 </div>
 <div className="flex gap-1">
 <button onClick={() => { setEditingCourse(course); setShowCourseModal(true); }} className="p-1.5 text-[#999999] hover:text-[#171717] hover:bg-[#F5F4F0] rounded">
 <Edit2 size={14} />
 </button>
 <button onClick={() => deleteCourse(course.id)} className="p-1.5 text-[#999999] hover:text-red-600 hover:bg-red-50 rounded">
 <Trash2 size={14} />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 学位管理 */}
 {activeTab === 'degrees' && (
 <div className="bg-white border border-[#EEEDE9] rounded-xl">
 <div className="px-5 py-4 border-b border-[#EEEDE9] flex items-center justify-between">
 <h2 className="font-bold text-[#171717]">Nano Degree</h2>
 <Button onClick={() => { setEditingDegree(null); setShowDegreeModal(true); }} className="text-sm py-1.5">
 <Plus size={14} className="mr-1" /> 添加学位
 </Button>
 </div>
 <div className="divide-y divide-[#EEEDE9]">
 {degrees.map(degree => {
 const degreeCourses = degree.courses.map(id => courses.find(c => c.id === id)).filter(Boolean) as Course[];
 return (
 <div key={degree.id} className="px-5 py-4 hover:bg-[#F5F4F0]">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 bg-[#F5F4F0] rounded-lg flex items-center justify-center">
 {ICON_MAP[degree.icon] ? React.cloneElement(ICON_MAP[degree.icon] as React.ReactElement, { className: 'w-5 h-5 text-[#171717]' }) : <Sparkles className="w-5 h-5 text-[#171717]" />}
 </div>
 <div>
 <span className="font-medium text-[#171717]">{degree.title}</span>
 <span className="text-xs text-[#999999] ml-2">({degree.courses.length} 门课程)</span>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <span className="font-mono font-bold text-[#171717]">¥{degree.price}</span>
 <div className="flex gap-1">
 <button onClick={() => { setEditingDegree(degree); setShowDegreeModal(true); }} className="p-1.5 text-[#999999] hover:text-[#171717] hover:bg-[#F5F4F0] rounded">
 <Edit2 size={14} />
 </button>
 <button onClick={() => deleteDegree(degree.id)} className="p-1.5 text-[#999999] hover:text-red-600 hover:bg-red-50 rounded">
 <Trash2 size={14} />
 </button>
 </div>
 </div>
 </div>
 <div className="flex gap-2 flex-wrap ml-11">
 {degreeCourses.map((c, i) => (
 <span key={c.id} className="text-xs bg-[#F5F4F0] text-[#171717] px-2 py-1 rounded">{i + 1}. {c.title}</span>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* 用户权限管理 */}
 {activeTab === 'users' && (
 <div className="bg-white border border-[#EEEDE9] rounded-xl">
 <div className="px-5 py-4 border-b border-[#EEEDE9]">
 <h2 className="font-bold text-[#171717]">用户权限</h2>
 <p className="text-xs text-[#999999] mt-1">点击按钮切换访问权限（学位开通后自动包含所有课程）</p>
 </div>
 <div className="divide-y divide-[#EEEDE9]">
 {users.map(user => (
 <div key={user.id} className="px-5 py-4">
 <div className="flex items-center gap-4 mb-3">
 <div className="w-10 h-10 bg-[#F5F4F0] rounded-full flex items-center justify-center">
 <span className="text-sm font-bold text-[#666666]">{user.name.charAt(0).toUpperCase()}</span>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-[#171717]">{user.name}</span>
 <span className={`text-[10px] px-1.5 py-0.5 rounded ${user.role === 'admin' ? 'bg-[#F5F4F0] text-amber-600' : 'bg-[#F5F4F0] text-[#666666]'}`}>
 {user.role === 'admin' ? '管理员' : '学员'}
 </span>
 </div>
 <div className="text-xs text-[#999999]">{user.email}</div>
 </div>
 {user.role !== 'admin' && (
 <button onClick={() => deleteUser(user.id)} className="p-1.5 text-[#999999] hover:text-red-600 hover:bg-red-50 rounded">
 <Trash2 size={14} />
 </button>
 )}
 </div>
 {user.role === 'admin' ? (
 <div className="text-xs text-[#999999] ml-14">拥有全部权限</div>
 ) : (
 <div className="ml-14 space-y-2">
 {/* 学位权限 */}
 {paidDegrees.length > 0 && (
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs text-[#666666] font-medium w-12">学位:</span>
 {paidDegrees.map(d => {
 const has = (user.degreePermissions || []).includes(d.id);
 return (
 <button
 key={d.id}
 onClick={() => toggleDegreePermission(user.id, d.id)}
 className={`px-2.5 py-1 rounded text-xs ${has ? 'bg-emerald-600 text-white' : 'bg-[#F5F4F0] text-[#999999] hover:bg-[#EEEDE9]'}`}
 title={`${d.title}（包含 ${d.courses.length} 门课程）`}
 >
 <Award size={10} className="inline mr-1" />
 {d.title.slice(0, 6)}..
 </button>
 );
 })}
 </div>
 )}
 {/* 课程权限 */}
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs text-[#666666] font-medium w-12">课程:</span>
 {paidCourses.map(c => {
 const has = user.permissions.includes(c.id);
 // 检查是否通过学位获得权限
 const hasThroughDegree = (user.degreePermissions || []).some(degId => {
 const deg = degrees.find(d => d.id === degId);
 return deg && deg.courses.includes(c.id);
 });
 return (
 <button
 key={c.id}
 onClick={() => !hasThroughDegree && togglePermission(user.id, c.id)}
 className={`px-2.5 py-1 rounded text-xs ${
 hasThroughDegree
 ? 'bg-emerald-100 text-emerald-600 cursor-default'
 : has
 ? 'bg-[#171717] text-white'
 : 'bg-[#F5F4F0] text-[#999999] hover:bg-[#EEEDE9]'
 }`}
 title={hasThroughDegree ? `${c.title}（通过学位获得）` : c.title}
 >
 {c.title.slice(0, 6)}..
 {hasThroughDegree && <span className="ml-1 text-[10px]">✓</span>}
 </button>
 );
 })}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
 };
 
 // Helper Icons for inside components
 const TargetIcon = () => <svg className="w-5 h-5 text-[#171717]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
 const CalendarIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;

 // 加载状态
 if (isLoading) {
 return (
 <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
 <div className="text-center">
 <Loader2 className="w-10 h-10 text-[#171717] animate-spin mx-auto mb-4" />
 <p className="text-[#666666] font-medium">加载中...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen font-sans bg-[#F5F4F0] selection:bg-[#171717] selection:text-white text-[#171717]">
 {/* WelcomeBanner 已移除 */}
 <nav className="bg-[#F5F4F0] border-b border-[#EEEDE9] sticky top-0 z-40">
 <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
 <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navTo(ViewState.HOME)}>
 <div className="relative"><Cpu className="w-6 h-6 text-[#171717]" /></div>
 <span className="text-lg font-bold tracking-tight text-[#171717]">OpenCSG Academy</span>
 </div>
 <div className="hidden md:flex items-center gap-6 text-[15px] font-medium">
 <button onClick={() => navTo(ViewState.HOME)} className={` ${view === ViewState.HOME ? 'text-[#171717]' : 'text-[#666666] hover:text-[#171717]'}`}>首页</button>
 <button onClick={() => navTo(ViewState.ALL_DEGREES)} className={` ${view === ViewState.ALL_DEGREES || view === ViewState.NANO_DEGREE ? 'text-[#171717]' : 'text-[#666666] hover:text-[#171717]'}`}>Nano Degree</button>
 <button onClick={() => navTo(ViewState.ALL_COURSES)} className={` ${view === ViewState.ALL_COURSES || view === ViewState.COURSE_DETAIL ? 'text-[#171717]' : 'text-[#666666] hover:text-[#171717]'}`}>课程库</button>
 <button onClick={() => navTo(ViewState.HACKATHON)} className={` ${view === ViewState.HACKATHON ? 'text-[#171717]' : 'text-[#666666] hover:text-[#171717]'}`}>黑客松</button>
 {currentUser?.role === 'admin' && (<button onClick={() => navTo(ViewState.ADMIN)} className={` ml-2 ${view === ViewState.ADMIN ? 'text-[#171717]' : 'text-[#666666] hover:text-[#171717]'}`}>管理后台</button>)}
 </div>
 <div className="hidden md:flex items-center gap-4">
 {currentUser ? (
 <div className="flex items-center gap-3 pl-4 border-l border-[#EEEDE9]">
 <div
 onClick={() => navTo(ViewState.PROFILE)}
 className="text-right cursor-pointer hover:opacity-80 transition-opacity"
 title="个人中心"
 >
 <div className="text-[10px] text-[#666666] font-bold uppercase tracking-wider">
 {currentUser.role === 'admin' ? '管理员' : '学员'}
 </div>
 <div className="text-sm font-bold text-[#171717]">{currentUser.name}</div>
 </div>
 <div
 onClick={() => navTo(ViewState.PROFILE)}
 className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
 currentUser.role === 'admin' ? 'bg-[#EEEDE9]' : 'bg-[#171717]'
 }`}
 title="个人中心"
 >
 {currentUser.role === 'admin' ? (
 <Star className="w-4 h-4 text-[#171717]" />
 ) : (
 <UserIcon className="w-4 h-4 text-white" />
 )}
 </div>
 <Button variant="secondary" onClick={handleLogout} className="px-4 py-1.5 text-xs">注销</Button>
 </div>
 ) : (
 <div className="flex items-center gap-3">
 <button
 onClick={() => setIsLoginModalOpen(true)}
 className="text-sm font-medium text-[#666666] hover:text-[#171717]"
 >
 已有账号？登录
 </button>
 <Button onClick={() => setIsLoginModalOpen(true)}>
 免费注册
 </Button>
 </div>
 )}
 </div>
 <button className="md:hidden text-[#171717]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu className="w-6 h-6" /></button>
 </div>
 {isMobileMenuOpen && (
 <div className="md:hidden border-t border-[#EEEDE9] bg-white p-4 space-y-2">
 <button onClick={() => navTo(ViewState.HOME)} className={`block w-full text-left py-3 px-4 rounded-xl hover:bg-[#F5F4F0] font-medium ${view === ViewState.HOME ? 'text-[#171717] bg-[#F5F4F0]' : 'text-[#666666]'}`}>首页</button>
 <button onClick={() => navTo(ViewState.ALL_DEGREES)} className={`block w-full text-left py-3 px-4 rounded-xl hover:bg-[#F5F4F0] font-medium ${view === ViewState.ALL_DEGREES || view === ViewState.NANO_DEGREE ? 'text-[#171717] bg-[#F5F4F0]' : 'text-[#666666]'}`}>Nano Degree</button>
 <button onClick={() => navTo(ViewState.ALL_COURSES)} className={`block w-full text-left py-3 px-4 rounded-xl hover:bg-[#F5F4F0] font-medium ${view === ViewState.ALL_COURSES || view === ViewState.COURSE_DETAIL ? 'text-[#171717] bg-[#F5F4F0]' : 'text-[#666666]'}`}>课程库</button>
 <button onClick={() => navTo(ViewState.HACKATHON)} className={`block w-full text-left py-3 px-4 rounded-xl hover:bg-[#F5F4F0] font-medium ${view === ViewState.HACKATHON ? 'text-[#171717] bg-[#F5F4F0]' : 'text-[#666666]'}`}>黑客松</button>
 {currentUser?.role === 'admin' && <button onClick={() => navTo(ViewState.ADMIN)} className={`block w-full text-left py-3 px-4 rounded-xl hover:bg-[#F5F4F0] font-medium ${view === ViewState.ADMIN ? 'text-[#171717] bg-[#F5F4F0]' : 'text-[#666666]'}`}>管理后台</button>}
 <div className="pt-4 mt-4 border-t border-[#EEEDE9]">
 {currentUser ? (
 <div className="space-y-3">
 <div
 onClick={() => navTo(ViewState.PROFILE)}
 className="flex items-center gap-3 p-3 bg-[#F5F4F0] rounded-xl cursor-pointer hover:bg-[#EEEDE9]"
 >
 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentUser.role === 'admin' ? 'bg-[#EEEDE9]' : 'bg-[#171717]'}`}>
 {currentUser.role === 'admin' ? <Star className="w-5 h-5 text-[#171717]" /> : <UserIcon className="w-5 h-5 text-white" />}
 </div>
 <div className="flex-1">
 <div className="text-sm font-bold text-[#171717]">{currentUser.name}</div>
 <div className="text-xs text-[#666666] font-medium">{currentUser.role === 'admin' ? '管理员' : '学员'}</div>
 </div>
 <ChevronRight size={16} className="text-[#999999]" />
 </div>
 <Button onClick={handleLogout} className="w-full" variant="secondary">注销</Button>
 </div>
 ) : (
 <div className="space-y-3">
 <Button onClick={() => setIsLoginModalOpen(true)} className="w-full">免费注册</Button>
 <button onClick={() => setIsLoginModalOpen(true)} className="w-full text-center text-sm text-[#666666] hover:text-[#171717] font-medium">已有账号？点击登录</button>
 </div>
 )}
 </div>
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
 {view === ViewState.PROFILE && <ProfilePage />}
 </main>

 <LoginModal />
 <ContactModal />
 <AdminQuickTip />

 <footer className="bg-white border-t border-[#EEEDE9] text-[#666666] py-16 px-6 mt-20 relative z-10">
 <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12 mb-12">
 <div className="col-span-1 md:col-span-2">
 <div className="flex items-center gap-2 mb-4"><Cpu className="w-6 h-6 text-[#171717]" /><span className="font-bold text-[#171717] text-lg">OpenCSG Academy</span></div>
 <p className="text-[#666666] text-sm leading-relaxed max-w-sm font-medium">我们致力于让科技教育变得触手可及。通过 AI 辅助和项目驱动的教学模式，帮助每个人在这个快速变化的时代找到自己的位置。</p>
 </div>
 <div>
 <h4 className="text-[#171717] font-bold mb-4">探索</h4>
 <ul className="space-y-2 text-sm font-medium">
 <li className="hover:text-[#171717] cursor-pointer" onClick={() => navTo(ViewState.ALL_DEGREES)}>Nano Degree</li>
 <li className="hover:text-[#171717] cursor-pointer" onClick={() => navTo(ViewState.ALL_COURSES)}>最新课程</li>
 <li className="hover:text-[#171717] cursor-pointer" onClick={() => navTo(ViewState.HACKATHON)}>黑客松活动</li>
 </ul>
 </div>
 <div>
 <h4 className="text-[#171717] font-bold mb-4">关于</h4>
 <ul className="space-y-2 text-sm font-medium">
 <li className="hover:text-[#171717] cursor-pointer">关于我们</li>
 <li className="hover:text-[#171717] cursor-pointer">联系方式</li>
 <li><button onClick={() => { setLoginEmail('admin@opencsg.com'); setIsLoginModalOpen(true); }} className="flex items-center gap-2 hover:text-[#171717] mt-4 pt-4 border-t border-[#EEEDE9]"><Lock size={12} /> 管理员入口</button></li>
 </ul>
 </div>
 </div>
 <div className="max-w-7xl mx-auto border-t border-[#EEEDE9] pt-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-xs text-[#999999] font-medium">
 <span>© 2024 OpenCSG Academy. All rights reserved.</span>
 <div className="flex gap-6 mt-4 md:mt-0"><a href="#" className="hover:text-[#171717]">隐私政策</a><a href="#" className="hover:text-[#171717]">服务条款</a></div>
 </div>
 </footer>
 </div>
 );
}
