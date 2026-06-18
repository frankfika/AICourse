import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  IsUUID,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class GrantCourseAccessDto {
  @IsArray()
  @IsUUID('4', { each: true })
  courseIds: string[];
}

export class GrantDegreeAccessDto {
  @IsArray()
  @IsUUID('4', { each: true })
  degreeIds: string[];
}
