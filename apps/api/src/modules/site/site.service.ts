/**
 * SiteService — 站点公开统计数据(首页 hero / AuthShell 用)
 *
 * 4 个核心 KPI + 1 个推荐课程 + 1 个 term 标签:
 *   - activeLearners: 非 admin 用户数(student + instructor)
 *   - totalCourses:    已发布课程数
 *   - totalProjects:   已完成实践项目数(practice completions)
 *   - totalDegrees:    nano degrees 总数
 *   - currentTermLabel: 当前季度术语(基于最新 active/upcoming hackathon 推算)
 *   - featuredCourse:  推荐课程(已发布课程中报名数最多的一条)
 *   - activeHackathonCount: 进行中 + 即将开始的黑客松数量
 *
 * 纯公开 API,不走 AuthGuard。Prisma 只读,无副作用。
 *
 * 数据来源(避免和 admin/stats 重复太多 — 这里只暴露给前端首页用的"对外数字"):
 *   - admin/stats 走 JwtAuthGuard + RolesGuard(admin only), 包含 KPI delta / 图表 / 待办
 *   - site/stats 公开, 只 4 个对外展示数字 + 1 个推荐课程
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      activeLearners,
      totalCourses,
      totalProjects,
      totalDegrees,
      activeHackathonCount,
      featuredCourseRow,
      latestActiveHackathon,
    ] = await Promise.all([
      // 1) 在读学员(非 admin)
      this.prisma.user.count({
        where: { role: { in: ['student', 'instructor'] } },
      }),
      // 2) 已发布课程
      this.prisma.course.count({
        where: { status: 'published' },
      }),
      // 3) 已完成实践项目
      this.prisma.practiceCompletion.count(),
      // 4) 学位总数
      this.prisma.nanoDegree.count(),
      // 5) 进行中 + 即将开始的黑客松
      this.prisma.hackathon.count({
        where: { status: { in: ['active', 'upcoming'] } },
      }),
      // 6) 推荐课程:已发布 + 报名数最多,fallback 到最新发布
      this.prisma.course
        .findFirst({
          where: { status: 'published' },
          orderBy: [{ enrollments: { _count: 'desc' } }, { createdAt: 'desc' }],
          select: {
            id: true,
            title: true,
            description: true,
            level: true,
            duration: true,
            instructor: true,
            tags: true,
            thumbnail: true,
            _count: { select: { enrollments: true, chapters: true } },
          },
        })
        .then((c) => {
          if (!c) return null;
          return {
            id: c.id,
            title: c.title,
            description: c.description,
            level: c.level,
            duration: c.duration,
            instructor: c.instructor,
            tags: c.tags,
            thumbnail: c.thumbnail,
            enrollmentCount: c._count.enrollments,
            chapterCount: c._count.chapters,
          };
        }),
      // 7) 最新 active/upcoming hackathon(用于推导 term 标签)
      this.prisma.hackathon.findFirst({
        where: { status: { in: ['active', 'upcoming'] } },
        orderBy: { startDate: 'asc' },
        select: { id: true, title: true, startDate: true },
      }),
    ]);

    return {
      activeLearners,
      totalCourses,
      totalProjects,
      totalDegrees,
      activeHackathonCount,
      currentTermLabel: this.deriveTermLabel(latestActiveHackathon?.startDate),
      featuredCourse: featuredCourseRow,
    };
  }

  /**
   * 推导当前 term 标签:
   *   - 3-5 月 → 春季
   *   - 6-8 月 → 夏季
   *   - 9-11 月 → 秋季
   *   - 12-2 月 → 冬季
   * 默认基于当前月份。后续可以接活动/课程时间表。
   */
  private deriveTermLabel(date?: Date | null): string {
    const d = date ?? new Date();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const term = month <= 5 ? '春季' : month <= 8 ? '夏季' : month <= 11 ? '秋季' : '冬季';
    return `${year} ${term}`;
  }
}
