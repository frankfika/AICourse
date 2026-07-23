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

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString()
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
