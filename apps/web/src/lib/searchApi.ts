/**
 * searchApi — P1-2 全站搜索 API 包装
 *
 * 职责:
 *   1. searchAll(q) — 并行查 4 个端点(/courses /degrees /hackathons /instructors)
 *   2. 合并成统一 SearchResult[] 列表(每项含 type + title + href + subtitle)
 *   3. 单个端点失败时不影响其他端点(用 Promise.allSettled)
 *   4. 全部失败 / 网络挂时 → 4+3+3+4 = 14 条 mock fallback
 *      mock 数据跟 P0-5 home 用的完全一致(共享数据源,避免飘)
 *
 * 排序规则(P1-2 spec):
 *   - courses:     enrollmentCount DESC
 *   - degrees:     学员数 DESC(用 stats.totalLearners)
 *   - hackathons:  startDate ASC(进行中优先)
 *   - instructors: 课程数 DESC
 *
 * 注意:后端目前没有 /api/v1/instructors 端点 — Promise.allSettled 拿到 reject
 * 后会触发 fallback,所以 instructor 数据永远走 mock(暂)。
 */

import api from './api';
import { hackathonsApi } from './hackathonsApi';

// =============================================================
// 统一 SearchResult 类型
// =============================================================
export type SearchResultType = 'course' | 'degree' | 'hackathon' | 'instructor';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;       // 描述 / 副标题
  href: string;            // 跳转 URL
  meta?: string;           // 顶部小字(分类/讲师/学员数)
  badge?: string;          // 状态徽章(进行中/免费/...)
}

// =============================================================
// 4 个端点的原始返回类型(只取我们需要的字段)
// =============================================================
interface CourseSearchRaw {
  id: string;
  title: string;
  description?: string;
  instructor?: string;
  level?: string;
  costType?: 'free' | 'paid' | 'charity';
  price?: number;
  tags?: string;
  enrollmentCount?: number;
  duration?: string;
}

interface DegreeSearchRaw {
  id: string;
  title: string;
  description?: string;
  price?: number;
  costType?: 'free' | 'paid' | 'charity';
  stats?: { totalLearners?: number; courseCount?: number; estimatedHours?: number };
  courses?: Array<{ id: string; title: string }>;
}

interface InstructorSearchRaw {
  id: string;
  name: string;
  title?: string;
  courseCount?: number;
}

// =============================================================
// Mock fallback 数据(全部失败时使用)
// 数量:4 courses + 3 degrees + 3 hackathons + 4 instructors
// =============================================================
const MOCK_COURSES: CourseSearchRaw[] = [
  {
    id: 'm1',
    title: '用 LangChain 搭建第一个 Agent',
    description: '从零开始,5 个章节学会 prompt、tool、memory、chain 的核心抽象。',
    instructor: '杨一帆',
    level: 'Beginner',
    costType: 'free',
    price: 0,
    tags: 'LangChain,Agent,Python',
    enrollmentCount: 4280,
    duration: '6.5h',
  },
  {
    id: 'm2',
    title: 'RAG 检索增强生成实战',
    description: '从 embedding、向量库到 reranking,做出企业可用的知识库问答系统。',
    instructor: '李珩',
    level: 'Intermediate',
    costType: 'paid',
    price: 299,
    tags: 'RAG,Embedding,向量库',
    enrollmentCount: 3120,
    duration: '8.0h',
  },
  {
    id: 'm3',
    title: '模型评估与生产部署',
    description: '从离线评测、A/B 实验到 vLLM 部署,构建可监控的 LLM 服务。',
    instructor: '周阳',
    level: 'Advanced',
    costType: 'paid',
    price: 599,
    tags: 'vLLM,A/B Test,MLOps',
    enrollmentCount: 1840,
    duration: '12.0h',
  },
  {
    id: 'm4',
    title: '开源模型微调实战',
    description: '用 LoRA / QLoRA 微调 7B 模型,从数据准备到评测。',
    instructor: '陈昕',
    level: 'Intermediate',
    costType: 'paid',
    price: 499,
    tags: 'Fine-tuning,LoRA,QLoRA',
    enrollmentCount: 2210,
    duration: '10.0h',
  },
];

const MOCK_DEGREES: DegreeSearchRaw[] = [
  {
    id: 'd1',
    title: 'AI 工程师基础',
    description: '3 门核心课 + 2 个实践项目',
    costType: 'free',
    price: 0,
    stats: { totalLearners: 1240, courseCount: 3, estimatedHours: 80 },
  },
  {
    id: 'd2',
    title: 'LLM 应用工程师',
    description: '5 门核心课 + 3 个项目 + 1 个黑客松',
    costType: 'paid',
    price: 2999,
    stats: { totalLearners: 820, courseCount: 5, estimatedHours: 160 },
  },
  {
    id: 'd3',
    title: 'AI 创业者学位',
    description: '技术 + 商业 + 投资人路演',
    costType: 'paid',
    price: 9999,
    stats: { totalLearners: 156, courseCount: 3, estimatedHours: 120 },
  },
];

const MOCK_HACKATHONS = [
  {
    id: 'h1',
    title: 'Spring 2026 Agent Builders Hackathon',
    description: '用 OpenCSG AgentHub 搭建一个能完成真实任务的 Agent。',
    status: 'active' as const,
    startDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
    location: '线上 + 北京',
  },
  {
    id: 'h2',
    title: 'RAG 检索评测挑战赛',
    description: '构建可量化的检索系统,挑战 5 个企业级评测集。',
    status: 'upcoming' as const,
    startDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    location: '线上',
  },
  {
    id: 'h3',
    title: '开源模型微调黑客松',
    description: '在 OpenCSG Hub 公开数据集上微调开源模型。',
    status: 'upcoming' as const,
    startDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    location: '线上',
  },
];

const MOCK_INSTRUCTORS: InstructorSearchRaw[] = [
  { id: 'i1', name: '杨一帆', title: '前 Anthropic · Agent', courseCount: 4 },
  { id: 'i2', name: '李珩', title: 'OpenCSG CTO · RAG', courseCount: 3 },
  { id: 'i3', name: '周阳', title: '前 Databricks · MLOps', courseCount: 2 },
  { id: 'i4', name: '陈昕', title: '连续创业者 · AI 产品', courseCount: 3 },
];

// =============================================================
// 内部:把原始数据转换成 SearchResult + 排序
// =============================================================

function mapCourse(c: CourseSearchRaw): SearchResult {
  const badge =
    c.costType === 'free' ? '免费' :
    c.costType === 'charity' ? '公益' :
    c.price ? `¥ ${c.price}` : undefined;
  return {
    type: 'course',
    id: c.id,
    title: c.title,
    subtitle: c.description,
    href: `/courses/${c.id}`,
    meta: c.tags ? c.tags.split(/[,，]/)[0] : undefined,
    badge,
  };
}

function mapDegree(d: DegreeSearchRaw): SearchResult {
  const learners = d.stats?.totalLearners;
  return {
    type: 'degree',
    id: d.id,
    title: d.title,
    subtitle: d.description,
    href: `/degrees/${d.id}`,
    meta: learners ? `${learners} 学员` : undefined,
    badge:
      d.costType === 'free' ? '免费' :
      d.costType === 'charity' ? '公益' :
      d.price ? `¥ ${d.price}` : undefined,
  };
}

function mapHackathon(h: { id: string; title: string; description?: string; status?: string; startDate?: string | Date; location?: string | null }): SearchResult {
  let badge = '即将开始';
  if (h.status === 'active') badge = '进行中';
  else if (h.status === 'judging') badge = '评审中';
  else if (h.status === 'finished') badge = '已结束';
  return {
    type: 'hackathon',
    id: h.id,
    title: h.title,
    subtitle: h.description,
    href: `/hackathons/${h.id}`,
    meta: h.location ?? undefined,
    badge,
  };
}

function mapInstructor(i: InstructorSearchRaw): SearchResult {
  return {
    type: 'instructor',
    id: i.id,
    title: i.name,
    subtitle: i.title,
    href: `/instructors/${i.id}`,
    meta: i.courseCount ? `${i.courseCount} 门课程` : undefined,
  };
}

// 排序辅助
function sortCourses(list: CourseSearchRaw[]): CourseSearchRaw[] {
  return [...list].sort((a, b) => (b.enrollmentCount ?? 0) - (a.enrollmentCount ?? 0));
}
function sortDegrees(list: DegreeSearchRaw[]): DegreeSearchRaw[] {
  return [...list].sort(
    (a, b) => (b.stats?.totalLearners ?? 0) - (a.stats?.totalLearners ?? 0),
  );
}
function sortHackathons<T extends { id: string; startDate?: string | Date }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ta = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const tb = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return ta - tb;  // 升序,进行中 / 最近的在前
  });
}
function sortInstructors(list: InstructorSearchRaw[]): InstructorSearchRaw[] {
  return [...list].sort((a, b) => (b.courseCount ?? 0) - (a.courseCount ?? 0));
}

// =============================================================
// 主入口:searchAll(q)
// =============================================================

export interface SearchAllResult {
  results: SearchResult[];
  /** 每个 type 单独的结果数,给 UI 分组 / 分 tab 用 */
  counts: Record<SearchResultType, number>;
  /** 是否走了 mock fallback(后端全挂) */
  usingMock: boolean;
}

export async function searchAll(q: string): Promise<SearchAllResult> {
  const query = q.trim();

  // 4 端点并行查(用 allSettled 避免一个挂掉全部挂)
  const [courseRes, degreeRes, hackathonRes, instructorRes] = await Promise.allSettled([
    api
      .get<CourseSearchRaw[]>('/api/v1/courses', { params: { search: query } })
      .then((r) => r.data),
    api
      .get<DegreeSearchRaw[]>('/api/v1/degrees', { params: { search: query } })
      .then((r) => r.data),
    hackathonsApi.getAll(query ? { search: query } : undefined),
    api
      .get<InstructorSearchRaw[]>('/api/v1/instructors', { params: { search: query } })
      .then((r) => r.data)
      .catch(() => null),  // 端点不存在不抛,直接 null
  ]);

  // 全部 reject → 走全 mock
  const allFailed =
    courseRes.status === 'rejected' &&
    degreeRes.status === 'rejected' &&
    (hackathonRes.status === 'rejected' || !hackathonRes.value) &&
    (instructorRes.status === 'rejected' || !instructorRes.value);

  if (allFailed) {
    return {
      results: [
        ...sortCourses(MOCK_COURSES.filter((c) => matchQuery(c.title, query))).map(mapCourse),
        ...sortDegrees(MOCK_DEGREES.filter((d) => matchQuery(d.title, query))).map(mapDegree),
        ...sortHackathons(MOCK_HACKATHONS.filter((h) => matchQuery(h.title, query))).map(mapHackathon),
        ...sortInstructors(MOCK_INSTRUCTORS.filter((i) => matchQuery(i.name, query))).map(mapInstructor),
      ],
      counts: {
        course: MOCK_COURSES.length,
        degree: MOCK_DEGREES.length,
        hackathon: MOCK_HACKATHONS.length,
        instructor: MOCK_INSTRUCTORS.length,
      },
      usingMock: true,
    };
  }

  // 部分成功:成功的用真数据,失败的用 mock
  const courses: CourseSearchRaw[] =
    courseRes.status === 'fulfilled' ? courseRes.value : MOCK_COURSES;
  const degrees: DegreeSearchRaw[] =
    degreeRes.status === 'fulfilled' ? degreeRes.value : MOCK_DEGREES;
  const hackathons =
    hackathonRes.status === 'fulfilled' && hackathonRes.value
      ? hackathonRes.value
      : MOCK_HACKATHONS;
  const instructors: InstructorSearchRaw[] =
    instructorRes.status === 'fulfilled' && instructorRes.value
      ? instructorRes.value
      : MOCK_INSTRUCTORS;

  // 客户端再过一遍搜索关键字(后端 search 已经过了一次,这里只是保险)
  const filteredCourses = query
    ? courses.filter((c) => matchQuery(c.title, query) || matchQuery(c.description ?? '', query))
    : courses;
  const filteredDegrees = query
    ? degrees.filter((d) => matchQuery(d.title, query) || matchQuery(d.description ?? '', query))
    : degrees;
  const filteredHackathons = query
    ? hackathons.filter((h) => matchQuery(h.title, query) || matchQuery(h.description ?? '', query))
    : hackathons;
  const filteredInstructors = query
    ? instructors.filter((i) => matchQuery(i.name, query) || matchQuery(i.title ?? '', query))
    : instructors;

  return {
    results: [
      ...sortCourses(filteredCourses).map(mapCourse),
      ...sortDegrees(filteredDegrees).map(mapDegree),
      ...sortHackathons(filteredHackathons).map(mapHackathon),
      ...sortInstructors(filteredInstructors).map(mapInstructor),
    ],
    counts: {
      course: filteredCourses.length,
      degree: filteredDegrees.length,
      hackathon: filteredHackathons.length,
      instructor: filteredInstructors.length,
    },
    usingMock:
      courseRes.status === 'rejected' &&
      degreeRes.status === 'rejected' &&
      (hackathonRes.status === 'rejected' || !hackathonRes.value) &&
      (instructorRes.status === 'rejected' || !instructorRes.value),
  };
}

function matchQuery(text: string, q: string): boolean {
  if (!q) return true;
  return text.toLowerCase().includes(q.toLowerCase());
}

// =============================================================
// 热门搜索(P1-2 spec:空查询时显示 4 chips)
// =============================================================
export const HOT_SEARCHES = ['LangChain', 'RAG', 'Agent', 'vLLM'];

// =============================================================
// 分组工具(给 CommandPalette + SearchPage 用)
// =============================================================

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  items: SearchResult[];
}

export function groupResults(results: SearchResult[]): SearchGroup[] {
  const order: SearchResultType[] = ['course', 'degree', 'hackathon', 'instructor'];
  const labels: Record<SearchResultType, string> = {
    course: '课程',
    degree: '学位',
    hackathon: '黑客松',
    instructor: '讲师',
  };
  return order.map((t) => ({
    type: t,
    label: labels[t],
    items: results.filter((r) => r.type === t),
  }));
}
