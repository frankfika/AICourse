import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: '密码必须包含大小写字母、数字和符号',
  })
  password: string;

  @IsString()
  name: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class OAuthCallbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  code: string;

  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  state: string;
}

export class PasswordResetRequestDto {
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: '新密码必须包含大小写字母、数字和符号',
  })
  newPassword: string;
}
