import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { ChaptersController } from './chapters.controller';
import { LessonsController } from './lessons.controller';

@Module({
  controllers: [CoursesController, ChaptersController, LessonsController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
