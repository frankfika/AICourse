import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

// Security: refuse to boot with a weak or placeholder JWT secret.
function assertStrongJwtSecret(secret: string | undefined): string {
  const value = secret?.trim();
  if (!value) {
    throw new Error('JWT_SECRET is required');
  }
  if (value.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  const PLACEHOLDERS = [
    'change-this',
    'changeme',
    'placeholder',
    'your-secret',
    'example',
    'test-secret',
  ];
  const lower = value.toLowerCase();
  if (PLACEHOLDERS.some((p) => lower.includes(p))) {
    throw new Error('JWT_SECRET looks like a placeholder. Generate one with `openssl rand -hex 32`.');
  }
  return value;
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = assertStrongJwtSecret(configService.get<string>('JWT_SECRET'));
        new Logger('AuthModule').log('JWT secret validated');
        return {
          secret,
          signOptions: {
            expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m') as `${number}m`,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
