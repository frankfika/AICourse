import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { OriginCheckMiddleware } from './common/middleware/origin-check.middleware';
import { AdminController } from './modules/admin/admin.controller';
import { CmsAdminController } from './modules/cms/cms-admin.controller';
import { AuditLogController } from './modules/audit/audit-log.controller';
import { AppController } from './app.controller';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DegreesModule } from './modules/degrees/degrees.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { PracticesModule } from './modules/practices/practices.module';
import { AuditModule } from './modules/audit/audit.module';
import { PointsModule } from './modules/points/points.module';
import { BadgesModule } from './modules/badges/badges.module';
import { ProgressModule } from './modules/progress/progress.module';
import { HackathonsModule } from './modules/hackathons/hackathons.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AiModule } from './modules/ai/ai.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UrlImportModule } from './modules/url-import/url-import.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { LearningEventsModule } from './modules/learning-events/learning-events.module';
import { SiteModule } from './modules/site/site.module';
import { CmsModule } from './modules/cms/cms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    // Security: global rate limiting (H-01). Defaults to 60 req/min per IP.
    // Security: global rate limiting (H-01). Defaults to 60 req/min per IP.
    // 走 env 覆盖, 默认安全值; screenshot / 测试场景可调大.
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: Number(process.env.THROTTLE_SHORT) || 5,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: Number(process.env.THROTTLE_MEDIUM) || 60,
      },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    DegreesModule,
    EnrollmentsModule,
    PracticesModule,
    PointsModule,
    BadgesModule,
    ProgressModule,
    HackathonsModule,
    OrdersModule,
    AiModule,
    EnterpriseModule,
    NotificationModule,
    UrlImportModule,
    CertificatesModule,
    AdminModule,
    ReviewsModule,
    LearningEventsModule,
    SiteModule,
    CmsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * P0 2026-07-23 CSRF 防御第二层: admin 写操作的 mutating 请求 (POST/PATCH/
   * PUT/DELETE) 强制 Origin / Referer 头检查, 跟 CORS_ORIGIN 白名单对比,
   * 跨站直接 403。配合 cookie sameSite=strict (生产) 双层防御。
   *
   * 范围: /api/v1/admin/* + /api/v1/admin/cms/* (cms-admin 用同一前缀) +
   *       /api/v1/audit-logs (admin 唯一访问)。其他公开端点不强加, 因为
   *       公开端点本来就不要鉴权, CSRF 没什么意义。
   */
  configure(consumer: MiddlewareConsumer) {
    // 用 controller class 而非 path 字符串 — path-to-regexp v8 + NestJS
    // globalPrefix + URI versioning 一起处理, string path 容易踩坑。
    // (P0 2026-07-23 修复: 之前用 'api/v1/admin/{*path}' 字符串 path 不生效)
    consumer
      .apply(OriginCheckMiddleware)
      .forRoutes(
        AdminController,
        CmsAdminController,
        AuditLogController,
      );
  }
}
