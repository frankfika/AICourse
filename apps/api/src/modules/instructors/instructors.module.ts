import { Module } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import {
  InstructorsPublicController,
  InstructorsAdminController,
  CourseInstructorsAdminController,
} from './instructors.controller';
import {
  ExpertisesPublicController,
  ExpertisesAdminController,
} from './expertises.controller';

@Module({
  controllers: [
    // 前台
    InstructorsPublicController,
    ExpertisesPublicController,
    // Admin
    InstructorsAdminController,
    ExpertisesAdminController,
    CourseInstructorsAdminController,
  ],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
