/**
 * 学位 mock 扩展 — P1-4
 *
 * 后端 NanoDegreeWithPath (packages/shared-types/src/index.ts) 只返
 *   { id, title, description, courses, stats }
 * P1-4 要的"路径图 / 阶段解锁 / 排名图 / 讲师 / 评价 / 证书" 都是
 * 学位域内独立维度,本文件把它们建模成"学位侧附加元数据 (meta)"。
 *
 * 用法:
 *   - Page 拉真 API 拿 NanoDegreeWithPath
 *   - 用 degree.id 去 DEGREE_PATH_META_BY_ID 查附加字段
 *   - 查不到 → fallback 到 MOCK_DEGREE_PATH_META(给"AI 工程师基础"用)
 *
 * 字段对齐 spec §7.2 P1-4:
 *   - 3 阶段:Foundation / Intermediate / Capstone(本次先落 3,spec 提到
 *     可选 4 阶段 Advanced,这里保留 Advance 字段供未来扩展)
 *   - 5 课程:3 必修 + 2 选修
 *
 * 颜色 / token:
 *   - 阶段颜色走 token(stage-* 是学位域自定色彩,但 hex 一律从 brand /
 *     xp / cert / success 这 4 个 brand 调色拿,跟 design system 对齐)
 *   - leaderboard 进度条用 brand-500
 *   - 排名 / 评价时间格式 走 ISO 前缀 + 相对时间
 */

import type { NanoDegreeWithPath } from '@opencsg/shared-types';

// =============================================================
// 阶段 + 课程 + 路径元数据
// =============================================================
export type StageName = 'Foundation' | 'Intermediate' | 'Advanced' | 'Capstone';

/** 单阶段(路径图上的一个节点) */
export interface DegreeStage {
  id: string;
  name: StageName;
  /** 中文短标题,UI 大字用 */
  title: string;
  /** 一句话描述,UI 副标题用 */
  description: string;
  /** 阶段内课程 id 列表(对应 NanoDegreeWithPath.courses[].id) */
  courseIds: string[];
  /** 此阶段"必修"课程数(在 courseIds 里前 N 个为必修) */
  requiredCount: number;
  /** 上一阶段是否需 100% 完成才能解锁 */
  requiresPrevComplete: boolean;
  /** 阶段预估总学时(纯展示) */
  estimatedHours: number;
  /** token-based 配色 hint,UI 用来挑品牌色 */
  colorHint: 'brand' | 'xp' | 'cert' | 'success';
}

export interface DegreePathMeta {
  /** 阶段顺序,UI 按数组顺序从左到右渲染路径图 */
  stages: DegreeStage[];
  /** 课程 ID → { isRequired } 的映射,UI 用来画"必修/选修"chip */
  courseMeta: Record<string, { isRequired: boolean; credits: number }>;
  /** 讲师墙(2-3 个) */
  instructors: Array<{
    id: string;
    name: string;
    title: string;
    initials: string;
    gradientFrom: string;
    gradientTo: string;
    bio: string;
  }>;
  /** 学员评价(3-5 条,P1-3 Review 还没建,这里 inline) */
  reviews: Array<{
    id: string;
    user: string;
    initials: string;
    rating: number;
    date: string;
    title: string;
    body: string;
  }>;
  /** 证书信息 */
  certificate: {
    signer: string;
    signerTitle: string;
    skills: string[];
  };
  /** 同伴进度对比 (rank 1-10) */
  leaderboard: Array<{
    rank: number;
    name: string;
    percent: number;
    stagesCompleted: number;
  }>;
  /** 学位等级 — UI filter 用:本科 / 研究生 / 博士 */
  level: 'bachelor' | 'master' | 'phd';
  /** 难度 UI chip 用(1-5 星) */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** 学位时长(纯展示) */
  durationLabel: string;
}

// =============================================================
// Mock:AI 工程师基础(d1)
// spec 明确要"3 阶段 + 5 课程(3 必修 + 2 选修)"
// =============================================================
const MOCK_DEGREE_PATH_META: DegreePathMeta = {
  level: 'bachelor',
  difficulty: 2,
  durationLabel: '12 周',
  stages: [
    {
      id: 'stage-1',
      name: 'Foundation',
      title: '基础阶段',
      description: '掌握 Python、数学、机器学习的最小必要集',
      courseIds: ['c1', 'c2', 'c3', 'c4'],
      requiredCount: 3, // c1, c2, c3 必修;c4 选修
      requiresPrevComplete: false,
      estimatedHours: 80,
      colorHint: 'brand',
    },
    {
      id: 'stage-2',
      name: 'Intermediate',
      title: '进阶阶段',
      description: '深度学习 + LLM 入门,开始写生产级代码',
      courseIds: ['c5'],
      requiredCount: 1,
      requiresPrevComplete: true,
      estimatedHours: 60,
      colorHint: 'xp',
    },
    {
      id: 'stage-3',
      name: 'Capstone',
      title: '毕业项目',
      description: '端到端做一个可演示的 AI 应用,通过评审即获学位证书',
      courseIds: [],
      requiredCount: 0,
      requiresPrevComplete: true,
      estimatedHours: 40,
      colorHint: 'cert',
    },
  ],
  courseMeta: {
    c1: { isRequired: true, credits: 3 }, // Python 数据处理
    c2: { isRequired: true, credits: 4 }, // 机器学习基础
    c3: { isRequired: true, credits: 4 }, // 深度学习入门
    c4: { isRequired: false, credits: 2 }, // 选修:数学基础
    c5: { isRequired: true, credits: 3 }, // 深度学习进阶
  },
  instructors: [
    {
      id: 'i-yang',
      name: '杨一帆',
      title: '前 Anthropic · Agent 研究员',
      initials: '杨',
      gradientFrom: 'from-brand-500',
      gradientTo: 'to-xp-500',
      bio: '专注 Agent 推理与工具使用,在 NeurIPS / ICML 发表 6 篇论文。',
    },
    {
      id: 'i-li',
      name: '李珩',
      title: 'OpenCSG CTO · RAG 架构师',
      initials: '李',
      gradientFrom: 'from-xp-500',
      gradientTo: 'to-cert-500',
      bio: '主导 OpenCSG RAG 平台从 0 到 1,服务 30+ 企业客户日均 100w 次调用。',
    },
    {
      id: 'i-zhou',
      name: '周阳',
      title: '前 Databricks · MLOps Lead',
      initials: '周',
      gradientFrom: 'from-info-500',
      gradientTo: 'to-brand-500',
      bio: '把 5 个 ML 团队从 notebook 搬上生产,熟悉 Kubernetes / MLflow / Ray 全栈。',
    },
  ],
  reviews: [
    {
      id: 'r1',
      user: '张同学 · 字节跳动 算法工程师',
      initials: '张',
      rating: 5,
      date: '2026-04-12',
      title: '从 0 到 1 跑通 Agent,比看书快 10 倍',
      body: '之前看了一堆博客,一上手还是懵。跟着路径图把 Foundation 走完,Intermediate 阶段写了一个内部 Agent,老板直接给升了级。',
    },
    {
      id: 'r2',
      user: '陈同学 · 复旦在读硕士',
      initials: '陈',
      rating: 5,
      date: '2026-03-28',
      title: '毕业项目是真刀真枪,不是写写文档',
      body: 'Capstone 阶段要求 1v1 评审 + 公开路演,这个含金量比很多网课都高。最后我的项目被导师直接拿去给实验室同学参考。',
    },
    {
      id: 'r3',
      user: '林同学 · 转型 AI 的后端',
      initials: '林',
      rating: 4,
      date: '2026-02-15',
      title: '选修课设计合理,但 Foundation 略慢',
      body: '选修的"数学基础"很贴心,给非 CS 背景的同学补了底层。基础阶段对有经验的同学偏慢,可以跳。',
    },
  ],
  certificate: {
    signer: '陈昕',
    signerTitle: 'OpenCSG Academy 院长',
    skills: ['Python 工程', '机器学习', '深度学习', 'LLM 应用', '端到端 AI 产品'],
  },
  // 排名 = 同伴进度对比
  leaderboard: [
    { rank: 1, name: '学友 A', percent: 92, stagesCompleted: 3 },
    { rank: 2, name: '学友 B', percent: 88, stagesCompleted: 3 },
    { rank: 3, name: '学友 C', percent: 76, stagesCompleted: 2 },
    { rank: 4, name: '学友 D', percent: 70, stagesCompleted: 2 },
    { rank: 5, name: '学友 E', percent: 64, stagesCompleted: 2 },
    { rank: 6, name: '学友 F', percent: 56, stagesCompleted: 2 },
    { rank: 7, name: '学友 G', percent: 48, stagesCompleted: 1 },
    { rank: 8, name: '学友 H', percent: 40, stagesCompleted: 1 },
    { rank: 9, name: '学友 I', percent: 32, stagesCompleted: 1 },
    { rank: 10, name: '学友 J', percent: 20, stagesCompleted: 1 },
  ],
};

// =============================================================
// Mock:LLM 应用工程师(d2) — 4 阶段 + 8 课程
// =============================================================
const MOCK_DEGREE_LLM_META: DegreePathMeta = {
  level: 'master',
  difficulty: 4,
  durationLabel: '20 周',
  stages: [
    {
      id: 'stage-1',
      name: 'Foundation',
      title: 'Prompt 基础',
      description: 'Prompt 工程范式与 OpenAI / Claude API 深度使用',
      courseIds: ['c4'],
      requiredCount: 1,
      requiresPrevComplete: false,
      estimatedHours: 30,
      colorHint: 'brand',
    },
    {
      id: 'stage-2',
      name: 'Intermediate',
      title: '框架与编排',
      description: 'LangChain / LlamaIndex / LCEL,链式调用与并行',
      courseIds: ['c5'],
      requiredCount: 1,
      requiresPrevComplete: true,
      estimatedHours: 50,
      colorHint: 'xp',
    },
    {
      id: 'stage-3',
      name: 'Advanced',
      title: 'RAG 与 Agent 实战',
      description: '生产级 RAG 检索增强 + Agent 工具调用',
      courseIds: ['c6'],
      requiredCount: 1,
      requiresPrevComplete: true,
      estimatedHours: 60,
      colorHint: 'success',
    },
    {
      id: 'stage-4',
      name: 'Capstone',
      title: '评估与生产部署',
      description: '评测体系 + 监控告警 + 成本控制',
      courseIds: [],
      requiredCount: 0,
      requiresPrevComplete: true,
      estimatedHours: 40,
      colorHint: 'cert',
    },
  ],
  courseMeta: {
    c4: { isRequired: true, credits: 3 },
    c5: { isRequired: true, credits: 4 },
    c6: { isRequired: true, credits: 5 },
  },
  // LLM 学位讲师/评价/证书复用上面那批,只调整 1-2 个字段
  instructors: MOCK_DEGREE_PATH_META.instructors,
  reviews: MOCK_DEGREE_PATH_META.reviews,
  certificate: MOCK_DEGREE_PATH_META.certificate,
  leaderboard: MOCK_DEGREE_PATH_META.leaderboard,
};

// =============================================================
// Mock:AI 创业者学位(d3) — 3 阶段
// =============================================================
const MOCK_DEGREE_FOUNDER_META: DegreePathMeta = {
  level: 'phd',
  difficulty: 5,
  durationLabel: '24 周',
  stages: [
    {
      id: 'stage-1',
      name: 'Foundation',
      title: 'AI 产品方法论',
      description: '从 0 到 1 找 PMF,产品/技术/商业三角验证',
      courseIds: ['c8'],
      requiredCount: 1,
      requiresPrevComplete: false,
      estimatedHours: 40,
      colorHint: 'brand',
    },
    {
      id: 'stage-2',
      name: 'Intermediate',
      title: '技术选型与成本',
      description: '开源 vs 闭源 API vs 自建,真实 TCO 模型',
      courseIds: ['c9'],
      requiredCount: 1,
      requiresPrevComplete: true,
      estimatedHours: 40,
      colorHint: 'xp',
    },
    {
      id: 'stage-3',
      name: 'Capstone',
      title: 'GTM 与路演',
      description: '向 5 位真实投资人路演,通过即获学位 + 投资意向',
      courseIds: [],
      requiredCount: 0,
      requiresPrevComplete: true,
      estimatedHours: 40,
      colorHint: 'cert',
    },
  ],
  courseMeta: {
    c8: { isRequired: true, credits: 4 },
    c9: { isRequired: true, credits: 4 },
  },
  instructors: MOCK_DEGREE_PATH_META.instructors,
  reviews: MOCK_DEGREE_PATH_META.reviews,
  certificate: MOCK_DEGREE_PATH_META.certificate,
  leaderboard: MOCK_DEGREE_PATH_META.leaderboard,
};

// =============================================================
// 通用 fallback(真后端学位还没建元数据时,给个 bachelor 占位)
// =============================================================
const FALLBACK_META: DegreePathMeta = {
  ...MOCK_DEGREE_PATH_META,
  // 复制 stages 避免引用共享
  stages: MOCK_DEGREE_PATH_META.stages.map((s) => ({ ...s, courseIds: [...s.courseIds] })),
  courseMeta: { ...MOCK_DEGREE_PATH_META.courseMeta },
  instructors: [...MOCK_DEGREE_PATH_META.instructors],
  reviews: [...MOCK_DEGREE_PATH_META.reviews],
  certificate: { ...MOCK_DEGREE_PATH_META.certificate },
  leaderboard: MOCK_DEGREE_PATH_META.leaderboard.map((l) => ({ ...l })),
};

/** ID → meta 索引 */
const META_BY_ID: Record<string, DegreePathMeta> = {
  d1: MOCK_DEGREE_PATH_META,
  d2: MOCK_DEGREE_LLM_META,
  d3: MOCK_DEGREE_FOUNDER_META,
};

/** 根据 degree id 拿路径元数据,没找到走 fallback(避免 UI 崩) */
export function getDegreePathMeta(degreeId: string): DegreePathMeta {
  return META_BY_ID[degreeId] ?? FALLBACK_META;
}

// =============================================================
// 阶段颜色 token 映射 — 让路径图每个 node 颜色有差异化
// (每个 colorHint 映射到 Tailwind 调色)
// =============================================================
export const STAGE_COLOR_TOKENS: Record<
  DegreeStage['colorHint'],
  { solid: string; soft: string; border: string; text: string; ring: string; dot: string }
> = {
  brand: {
    solid: 'bg-brand-500 text-neutral-0',
    soft: 'bg-brand-100 dark:bg-brand-900/30',
    border: 'border-brand-500',
    text: 'text-brand-500',
    ring: 'ring-brand-500/30',
    dot: 'bg-brand-500',
  },
  xp: {
    solid: 'bg-xp-500 text-neutral-0',
    // dark: 用 500/15 透明度替代 light pastel,避免暗色模式出现亮色块
    soft: 'bg-xp-100 dark:bg-xp-500/15',
    border: 'border-xp-500',
    text: 'text-xp-500',
    ring: 'ring-xp-500/30',
    dot: 'bg-xp-500',
  },
  cert: {
    solid: 'bg-cert-500 text-neutral-900',
    soft: 'bg-cert-100 dark:bg-cert-500/15',
    border: 'border-cert-500',
    text: 'text-cert-500',
    ring: 'ring-cert-500/30',
    dot: 'bg-cert-500',
  },
  success: {
    solid: 'bg-success-500 text-neutral-0',
    soft: 'bg-success-100 dark:bg-success-500/15',
    border: 'border-success-500',
    text: 'text-success-500',
    ring: 'ring-success-500/30',
    dot: 'bg-success-500',
  },
};

// =============================================================
// 进度计算 helpers(在 Detail / Dashboard 都用)
// =============================================================
export interface StageProgress {
  stage: DegreeStage;
  status: 'completed' | 'in_progress' | 'locked' | 'available';
  /** 此阶段已完成课程数(基于 courseId set) */
  completed: number;
  /** 此阶段总课程数(非空时才 > 0) */
  total: number;
}

/** 给一组阶段 + 一组已完成 courseId,算每个阶段的状态(解锁 + 完成) */
export function computeStageProgress(
  stages: DegreeStage[],
  completedCourseIds: Set<string>,
): StageProgress[] {
  const out: StageProgress[] = [];
  let prevComplete = true; // 第一个阶段永远不锁
  for (const s of stages) {
    const total = s.courseIds.length;
    const completed = s.courseIds.filter((id) => completedCourseIds.has(id)).length;
    let status: StageProgress['status'];
    if (total === 0) {
      // Capstone(无课程) — 上一阶段完成就视为"可进行",还没过就是 in_progress
      status = prevComplete ? 'in_progress' : 'locked';
    } else if (completed >= total) {
      status = 'completed';
    } else if (prevComplete) {
      status = 'in_progress';
    } else {
      status = 'locked';
    }
    out.push({ stage: s, status, completed, total });
    // 解锁下一阶段的条件:本阶段所有 required 课程都完成,或者本阶段无课
    if (s.requiresPrevComplete) {
      const required = s.courseIds.slice(0, s.requiredCount);
      prevComplete = required.every((id) => completedCourseIds.has(id));
    } else {
      prevComplete = true;
    }
  }
  return out;
}

/** 给定 stageProgress 列表,算总进度 0-100 */
export function computeOverallPercent(sp: StageProgress[]): number {
  const total = sp.reduce((sum, s) => sum + Math.max(s.total, 0), 0);
  const completed = sp.reduce((sum, s) => sum + s.completed, 0);
  // Capstone(无课)按"0 课程"算 0 分母,符合预期
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/** 在 stageProgress 找下一门"未完成必修课" — 用于 DashboardDegreePage 推荐课程 */
export function findNextRequiredCourse(
  sp: StageProgress[],
  allCourses: NanoDegreeWithPath['courses'],
): { courseId: string; stageName: string } | null {
  for (const { stage, status, completed, total } of sp) {
    if (status === 'in_progress' && total > 0 && completed < total) {
      // 找 stage 里第一个未完成的必修课
      for (const id of stage.courseIds) {
        const c = allCourses.find((x) => x.id === id);
        if (c) {
          return { courseId: id, stageName: stage.name };
        }
      }
    }
  }
  return null;
}
