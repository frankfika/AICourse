import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
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
