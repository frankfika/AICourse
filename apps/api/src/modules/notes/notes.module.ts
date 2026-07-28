import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LessonNotesController, NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [PrismaModule],
  controllers: [LessonNotesController, NotesController],
  providers: [NotesService],
})
export class NotesModule {}
