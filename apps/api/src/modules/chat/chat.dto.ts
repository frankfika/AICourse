import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  content: string;
}
