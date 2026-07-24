/**
 * uploads.dto.ts — sign / complete 的请求 DTO
 */
import { IsString, IsEnum, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UploadScope } from './uploads.config';

export class SignUploadDto {
  @ApiProperty({ enum: ['lesson-video', 'resource', 'course-thumbnail', 'degree-thumbnail', 'hackathon-banner', 'hackathon-judge-avatar', 'hackathon-sponsor-logo', 'submission-video', 'user-avatar'] })
  @IsString()
  scope: UploadScope;

  @ApiProperty({ description: '原始文件名, 用于扩展名推断' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'MIME type' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: '文件字节数' })
  @IsNumber()
  @Min(1)
  size: number;

  @ApiPropertyOptional({ description: '目标 entity id (lesson / hackathon / user). 留空用于 "create 时上传" (resource / submission-video), 由业务侧 setField' })
  @IsOptional()
  @IsUUID()
  refId?: string;
}

export class CompleteUploadDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty({ enum: ['lesson-video', 'resource', 'course-thumbnail', 'degree-thumbnail', 'hackathon-banner', 'hackathon-judge-avatar', 'hackathon-sponsor-logo', 'submission-video', 'user-avatar'] })
  @IsString()
  scope: UploadScope;

  @ApiPropertyOptional({ description: '目标 entity id (e.g. lessonId / userId). 留空 = 只 confirm object 存在, 不写库 (前端用 publicUrl 走原 create/update flow)' })
  @IsOptional()
  @IsUUID()
  refId?: string;
}
