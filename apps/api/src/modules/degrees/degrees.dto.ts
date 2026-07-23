import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CostType, CourseStatus } from '@prisma/client';

class DegreeCourseLinkDto {
  @ApiProperty({ description: '课程 UUID' })
  @IsUUID()
  courseId: string;

  @ApiProperty({ description: '在学位内的排序索引' })
  @IsNumber()
  orderIndex: number;
}

export class CreateDegreeDto {
  @ApiProperty({ description: '学位标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '学位描述' })
  @IsString()
  description: string;

  @ApiProperty({ description: '学习要点' })
  @IsString()
  learningPoints: string;

  @ApiProperty({ description: '价格（元，0 表示免费）' })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ description: '图标 URL 或 emoji' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ enum: CostType, description: '计费类型' })
  @IsEnum(CostType)
  costType: CostType;

  @ApiPropertyOptional({ description: '缩略图 URL' })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({ enum: CourseStatus, description: '学位状态' })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}

export class UpdateDegreeDto extends CreateDegreeDto {}

export class LinkCoursesDto {
  @ApiProperty({ type: [DegreeCourseLinkDto], description: '要绑定的课程列表（含排序）' })
  @ValidateNested({ each: true })
  @Type(() => DegreeCourseLinkDto)
  courses: DegreeCourseLinkDto[];
}
