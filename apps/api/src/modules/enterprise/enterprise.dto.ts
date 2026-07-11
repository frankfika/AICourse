import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const TEAM_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;

export class CreateEnterpriseInquiryDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsString()
  @MaxLength(100)
  company: string;

  @IsIn(TEAM_SIZES as unknown as string[])
  teamSize: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MaxLength(200)
  topic: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateInquiryStatusDto {
  @IsIn(['pending', 'contacted', 'qualified', 'closed', 'archived'])
  status: 'pending' | 'contacted' | 'qualified' | 'closed' | 'archived';
}
