/**
 * @SafeUrl — 限制 URL scheme 只能是 http(s) (防 javascript: / data: / file: XSS/SSRF)
 *
 * 2026-07-24: P0 安全修 (video upload + permissions)
 * 之前大量 url 字段用 @IsString, 可被存 javascript:data:text/html,<script>...
 *
 * 用法:  @SafeUrl() url: string
 *        @SafeUrl({ optional: true }) url?: string
 */
import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsUrl, IsString, MaxLength, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';

// 严格模式: 只允许 http(s), validator.js 默认允许 ftp — 改 protocols
const ALLOWED_PROTOCOLS = ['http', 'https'] as const;

@ValidatorConstraint({ name: 'isSafeUrl', async: false })
class IsSafeUrlConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (value === null || value === undefined || value === '') return true; // optional 字段
    if (typeof value !== 'string') return false;
    // 简单 scheme 校验 — 比 class-validator 的 IsUrl 更严
    return /^(https?):\/\/[^\s/$.?#].[^\s]*$/i.test(value);
  }
  defaultMessage(args: ValidationArguments) {
    return `${args.property} 必须是合法的 http(s) URL`;
  }
}

export function SafeUrl(options: { optional?: boolean; maxLength?: number; protocols?: readonly string[] } = {}) {
  const { optional = false, maxLength = 500 } = options;
  const decorators: any[] = [
    Validate(IsSafeUrlConstraint),
  ];
  if (optional) {
    decorators.push(IsOptional());
  } else {
    decorators.push(IsString());
  }
  if (maxLength) {
    decorators.push(MaxLength(maxLength));
  }
  return applyDecorators(...decorators);
}

// 显式 @IsUrl 带 protocols — 用于已有 class-validator 体系的地方
export function IsHttpUrl(options: { optional?: boolean; maxLength?: number } = {}) {
  const { optional = false, maxLength = 500 } = options;
  return applyDecorators(
    optional ? IsOptional() : IsString(),
    MaxLength(maxLength),
    IsUrl({ protocols: [...ALLOWED_PROTOCOLS], require_protocol: true, require_valid_protocol: true }),
  );
}
