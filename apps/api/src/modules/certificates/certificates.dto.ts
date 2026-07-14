import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';

export const CERTIFICATE_TYPES = ['course', 'degree', 'hackathon'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

/**
 * IssueCertificateDto — 由 order mockPay / course complete / hackathon judge 调用,
 * 不直接对前端暴露。前端用 0 endpoint 走 trigger (service 内部生成)。
 */
export class IssueCertificateDto {
  @IsString()
  userId: string;

  @IsString()
  type: CertificateType | string;

  @IsString()
  refId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ListCertificatesQuery {
  @IsOptional()
  @IsString()
  type?: string; // 'course' | 'degree' | 'hackathon' | 'all'
}
