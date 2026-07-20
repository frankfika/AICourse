import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
