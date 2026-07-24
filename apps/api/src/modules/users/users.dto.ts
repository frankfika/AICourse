import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SafeUrl } from '../../common/validators/safe-url.decorator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: '邮箱', example: '[email protected]' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '密码（最少 6 位）', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: '显示名' })
  @IsString()
  name: string;

  @ApiProperty({ enum: UserRole, description: '用户角色' })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '显示名' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '头像 URL (http/https)' })
  @IsOptional()
  // 2026-07-24 P0: 限制 scheme 防 javascript: / data: / file:
  @SafeUrl({ optional: true, maxLength: 500 })
  avatarUrl?: string;
}

export class GrantCourseAccessDto {
  @ApiProperty({ type: [String], description: '要授权的课程 UUID 列表', format: 'uuid' })
  @IsArray()
  @IsUUID('4', { each: true })
  courseIds: string[];
}

export class GrantDegreeAccessDto {
  @ApiProperty({ type: [String], description: '要授权的学位 UUID 列表', format: 'uuid' })
  @IsArray()
  @IsUUID('4', { each: true })
  degreeIds: string[];
}
