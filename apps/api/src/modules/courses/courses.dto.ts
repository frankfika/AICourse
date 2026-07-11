import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CourseLevel, CostType, CourseStatus } from '@prisma/client';

import { ResourceType } from '@prisma/client';

class CreateResourceDto {
  @IsString()
  title: string;

  @IsString()
  url: string;

  @IsEnum(ResourceType)
  type: ResourceType;

  @IsOptional()
  isLocked?: boolean;
}

class CreateLessonDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsNumber()
  videoDuration?: number;

  @IsNumber()
  orderIndex: number;

  @IsOptional()
  isPreview?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateResourceDto)
  resources?: CreateResourceDto[];
}

class CreateChapterDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  orderIndex: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateLessonDto)
  lessons?: CreateLessonDto[];
}

export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  learningPoints: string;

  @IsString()
  instructor: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsEnum(CourseLevel)
  level: CourseLevel;

  @IsString()
  duration: string;

  @IsString()
  thumbnail: string;

  @IsString()
  tags: string;

  @IsEnum(CostType)
  costType: CostType;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceVideoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sourcePlatform?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateChapterDto)
  chapters?: CreateChapterDto[];
}

export class UpdateCourseDto extends CreateCourseDto {}
