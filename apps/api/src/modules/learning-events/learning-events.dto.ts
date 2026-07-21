import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum LearningEventType {
  play = 'play',
  pause = 'pause',
  seek = 'seek',
  complete = 'complete',
  replay = 'replay',
  skip = 'skip',
  note = 'note',
}

export class CreateLearningEventDto {
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsEnum(LearningEventType)
  eventType: LearningEventType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400) // 上限 24h 防止恶意值
  positionSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600_000) // 上限 10 分钟
  durationMs?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BatchCreateLearningEventDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50) // 50 条/批,避免单请求过大
  @ValidateNested({ each: true })
  @Type(() => CreateLearningEventDto)
  events: CreateLearningEventDto[];
}
