import { CourseSort } from './courses.dto';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

describe('CoursesService list metrics and sorting', () => {
  const prisma = {
    course: { findMany: jest.fn(), findFirst: jest.fn() },
    enrollment: { findFirst: jest.fn() },
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

  it('does not load chapter content for course listings', async () => {
    prisma.course.findMany.mockResolvedValue([]);
    await service.findAll({});
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.not.objectContaining({ chapters: expect.anything() }),
      }),
    );
  });

  it('redacts locked paid-course content without an active enrollment', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'paid-course',
      costType: 'paid',
      chapters: [{
        id: 'chapter-1',
        lessons: [
          { id: 'lesson-1', isPreview: false, videoUrl: 'https://cdn.example/paid.mp4', resources: [{ id: 'r1', isLocked: true, url: 'https://cdn.example/paid.pdf' }] },
          { id: 'lesson-2', isPreview: true, videoUrl: 'https://cdn.example/preview.mp4', resources: [] },
        ],
      }],
    });
    prisma.enrollment.findFirst.mockResolvedValue(null);

    const result = await service.findOne('paid-course', { userId: 'user-1' });

    expect(result.chapters[0].lessons[0].videoUrl).toBeNull();
    expect(result.chapters[0].lessons[0].resources[0].url).toBe('');
    expect(result.chapters[0].lessons[1].videoUrl).toBe('https://cdn.example/preview.mp4');
  });

  it('returns full paid-course content for an active enrollment', async () => {
    const course = {
      id: 'paid-course',
      costType: 'paid',
      chapters: [{ id: 'chapter-1', lessons: [{ id: 'lesson-1', isPreview: false, videoUrl: 'https://cdn.example/paid.mp4', resources: [] }] }],
    };
    prisma.course.findFirst.mockResolvedValue(course);
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });

    await expect(service.findOne('paid-course', { userId: 'user-1' })).resolves.toBe(course);
    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-1', courseId: 'paid-course', deletedAt: null }),
    }));
  });
});
