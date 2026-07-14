/**
 * reviews.dto.ts — P1-3 评价入参 DTO
 *
 * CreateReviewDto:
 *   - rating: 1-5 整数(必填)
 *   - content: 10-1000 字符(必填)
 *
 * ListReviewsQueryDto:
 *   - page / limit 分页(默认 1 / 10)
 */
import { IsInt, IsString, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @IsInt({ message: 'rating 必须是 1-5 整数' })
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(10, { message: '评价内容至少 10 字符' })
  @MaxLength(1000, { message: '评价内容最多 1000 字符' })
  content: string;
}

export class ListReviewsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
