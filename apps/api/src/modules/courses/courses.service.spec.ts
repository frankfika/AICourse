import { CourseSort } from './courses.dto';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

describe('CoursesService list metrics and sorting', () => {
  const prisma = {
    course: { findMany: jest.fn() },
  };
  const service = new CoursesService(
    prisma as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditLogService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns real review/enrollment metrics and sorts by rating', async () => {
    prisma.course.findMany.mockResolvedValue([
      {
        id: 'c1',
        createdAt: new Date('2026-01-01'),
        reviews: [{ rating: 3 }],
        _count: { enrollments: 10 },
      },
      {
        id: 'c2',
        createdAt: new Date('2026-01-02'),
        reviews: [{ rating: 5 }, { rating: 4 }],
        _count: { enrollments: 2 },
      },
    ]);

    const result = await service.findAll({ sort: CourseSort.rating });

    expect(result.map((course) => course.id)).toEqual(['c2', 'c1']);
    expect(result[0]).toEqual(
      expect.objectContaining({
        rating: 4.5,
        reviewCount: 2,
        enrollmentCount: 2,
      }),
    );
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' } }),
    );
  });

  it('sorts popularity by active enrollment count', async () => {
    prisma.course.findMany.mockResolvedValue([
      {
        id: 'c1',
        createdAt: new Date('2026-01-02'),
        reviews: [],
        _count: { enrollments: 1 },
      },
      {
        id: 'c2',
        createdAt: new Date('2026-01-01'),
        reviews: [],
        _count: { enrollments: 9 },
      },
    ]);

    const result = await service.findAll({ sort: CourseSort.popular });
    expect(result.map((course) => course.id)).toEqual(['c2', 'c1']);
  });
});
