import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DegreesModule } from './modules/degrees/degrees.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';

import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    DegreesModule,
    EnrollmentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
