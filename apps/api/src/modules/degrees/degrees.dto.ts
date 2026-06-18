import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CostType, CourseStatus } from '@prisma/client';

class DegreeCourseLinkDto {
  @IsUUID()
  courseId: string;

  @IsNumber()
  orderIndex: number;
}

export class CreateDegreeDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  learningPoints: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsEnum(CostType)
  costType: CostType;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}

export class UpdateDegreeDto extends CreateDegreeDto {}

export class LinkCoursesDto {
  @ValidateNested({ each: true })
  @Type(() => DegreeCourseLinkDto)
  courses: DegreeCourseLinkDto[];
}
