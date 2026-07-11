import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './auth.dto';
import { User, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: UserRole.student,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return { user };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  async refresh(token: string) {
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }

    // Security: only the SHA-256 hash of the refresh token is stored in DB.
    // Compare by hashing the incoming token before lookup.
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: this.hashToken(token) },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: invalidate the old token and issue a new one atomically.
    await this.prisma.$transaction([
      this.prisma.refreshToken.delete({ where: { token: this.hashToken(token) } }),
    ]);
    return this.generateTokens(stored.user);
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.randomToken();

    const refreshExpires = new Date();
    refreshExpires.setDate(refreshExpires.getDate() + 7);

    // Security: store only the hash, never the raw token.
    this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: refreshExpires,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // Security: refresh tokens must come from a CSPRNG, never Math.random().
  private randomToken(): string {
    return randomBytes(32).toString('hex');
  }

  // Security: only the SHA-256 hash of the refresh token is persisted.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
