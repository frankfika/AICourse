import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './notes.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, lessonId: string) {
    await this.assertLesson(lessonId);
    return this.prisma.note.findMany({
      where: { userId, lessonId },
      orderBy: [{ positionSec: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    });
  }

  async create(userId: string, lessonId: string, dto: CreateNoteDto) {
    await this.assertLesson(lessonId);
    return this.prisma.note.create({
      data: {
        userId,
        lessonId,
        content: dto.content.trim(),
        positionSec: dto.positionSec,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    await this.assertOwned(userId, id);
    return this.prisma.note.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.positionSec !== undefined ? { positionSec: dto.positionSec } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.note.delete({ where: { id } });
    return { ok: true };
  }

  private async assertLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
  }

  private async assertOwned(userId: string, id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!note) throw new NotFoundException('Note not found');
  }
}
