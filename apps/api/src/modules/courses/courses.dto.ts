import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  IsBoolean,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseLevel, CostType, CourseStatus, CourseType, ResourceType } from '@prisma/client';

class CreateResourceDto {
  @ApiProperty({ description: '资源标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '资源 URL' })
  @IsString()
  url: string;

  @ApiProperty({ enum: ResourceType, description: '资源类型' })
  @IsEnum(ResourceType)
  type: ResourceType;

  @ApiPropertyOptional({ description: '是否锁定（仅报名用户可看）', default: false })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

class CreateLessonDto {
  @ApiProperty({ description: '课时标题' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: '课时描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '视频 URL' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ description: '视频时长（秒）' })
  @IsOptional()
  @IsNumber()
  videoDuration?: number;

  @ApiProperty({ description: '排序索引' })
  @IsNumber()
  orderIndex: number;

  @ApiPropertyOptional({ description: '是否可试看', default: false })
  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @ApiPropertyOptional({ type: () => [CreateResourceDto], description: '关联资源' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateResourceDto)
  resources?: CreateResourceDto[];
}

class CreateChapterDto {
  @ApiProperty({ description: '章节标题' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: '章节描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '排序索引' })
  @IsNumber()
  orderIndex: number;

  @ApiPropertyOptional({ type: () => [CreateLessonDto], description: '章节下的课时' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateLessonDto)
  lessons?: CreateLessonDto[];
}

export class CreateCourseDto {
  @ApiProperty({ description: '课程标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '课程描述' })
  @IsString()
  description: string;

  @ApiProperty({ description: '学习要点' })
  @IsString()
  learningPoints: string;

  @ApiProperty({ description: '讲师名称' })
  @IsString()
  instructor: string;

  @ApiPropertyOptional({ description: '讲师用户 UUID' })
  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @ApiProperty({ enum: CourseLevel, description: '难度等级' })
  @IsEnum(CourseLevel)
  level: CourseLevel;

  @ApiProperty({ description: '学习时长（人类可读，例如 "8h"）' })
  @IsString()
  duration: string;

  @ApiProperty({ description: '课程缩略图 URL' })
  @IsString()
  thumbnail: string;

  @ApiProperty({ description: '标签（逗号分隔或 JSON 字符串）' })
  @IsString()
  tags: string;

  @ApiProperty({ enum: CostType, description: '计费类型' })
  @IsEnum(CostType)
  costType: CostType;

  @ApiProperty({ description: '价格（元，0 表示免费）' })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ enum: CourseStatus, description: '课程状态' })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({ enum: CourseType, description: '课程类型' })
  @IsOptional()
  @IsEnum(CourseType)
  courseType?: CourseType;

  @ApiPropertyOptional({ description: '外链课程 URL（外部跳转类型课程用）', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  externalUrl?: string;

  @ApiPropertyOptional({ description: '原始视频源 URL（导入用）', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceVideoUrl?: string;

  @ApiPropertyOptional({ description: '来源平台标识', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sourcePlatform?: string;

  // P1 修复(2026-07-24): 行业/分类 FK
  @ApiPropertyOptional({ description: '行业 UUID' })
  @IsOptional()
  @IsUUID()
  industryId?: string;

  @ApiPropertyOptional({ description: '课程分类 UUID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: () => [CreateChapterDto], description: '课程章节（含课时和资源）' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateChapterDto)
  chapters?: CreateChapterDto[];
}

export class UpdateCourseDto extends CreateCourseDto {}

/**
 * P0 修复(2026-07-24): 课程挂学位 — 接受学位 ID 列表(append 语义)。
 * 课程会按列表顺序追加到各学位的末尾(orderIndex = 现有 max + 1..N)。
 * 精确顺序编辑请走 POST /api/v1/degrees/:id/courses (linkCourses)。
 */
export class LinkDegreesDto {
  @ApiProperty({ type: [String], description: '要追加到的学位 UUID 列表' })
  @IsUUID('all', { each: true })
  degreeIds: string[];
}
