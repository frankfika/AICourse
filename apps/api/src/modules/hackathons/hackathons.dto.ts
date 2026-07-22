import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HackathonStatus,
  SubmissionStatus,
} from '@prisma/client';

export class CreateHackathonDto {
  @ApiProperty({ description: '黑客松标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '黑客松描述' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Banner 图片 URL' })
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;

  @ApiPropertyOptional({ enum: HackathonStatus, description: '状态' })
  @IsOptional()
  @IsEnum(HackathonStatus)
  status?: HackathonStatus;

  @ApiProperty({ description: '开始时间 ISO 字符串' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: '结束时间 ISO 字符串' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: '报名截止时间 ISO 字符串' })
  @IsOptional()
  @IsDateString()
  registerDeadline?: string;

  @ApiPropertyOptional({ description: '最小团队人数', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minTeamSize?: number;

  @ApiPropertyOptional({ description: '最大团队人数', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxTeamSize?: number;

  @ApiPropertyOptional({ description: '地点' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: '比赛规则' })
  @IsOptional()
  @IsString()
  rules?: string;

  @ApiPropertyOptional({ description: '奖项设置' })
  @IsOptional()
  @IsString()
  prizes?: string;

  @ApiPropertyOptional({ description: '外链 CTA URL (报名 / 了解更多 / 官网 等任意一个)' })
  @IsOptional()
  @IsUrl()
  registrationUrl?: string;

  @ApiPropertyOptional({ description: '外链 CTA 文案, 留空默认 "前往报名"' })
  @IsOptional()
  @IsString()
  registrationLabel?: string;
}

export class UpdateHackathonDto extends CreateHackathonDto {}

export class CreateTeamDto {
  @ApiProperty({ description: '队伍名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '队伍口号' })
  @IsOptional()
  @IsString()
  slogan?: string;
}

export class CreateSubmissionDto {
  @ApiProperty({ description: '作品标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '作品描述' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Demo 链接' })
  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @ApiPropertyOptional({ description: '代码仓库链接' })
  @IsOptional()
  @IsUrl()
  repoUrl?: string;

  @ApiPropertyOptional({ description: '视频链接' })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({ description: '所属队伍 ID，为空则个人参赛' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ enum: SubmissionStatus, description: '作品状态' })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}

export class UpdateSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  repoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({ enum: SubmissionStatus })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}

export class CreateAnnouncementDto {
  @ApiProperty({ description: '公告标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '公告内容' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '是否置顶', default: false })
  @IsOptional()
  isPinned?: boolean;
}

export class JudgeSubmissionDto {
  @ApiProperty({ description: '评分 0-100' })
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @ApiPropertyOptional({ description: '评语' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({ enum: SubmissionStatus, description: '评审后状态' })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}
