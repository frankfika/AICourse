import { Injectable, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './auth.dto';
import { AuthProvider, AuthCredentials } from './providers/auth-provider.types';

/**
 * AuthService - 重构后
 *
 * 之前（126 行）: register / login / refresh 全部 hardcode email+password
 * 现在：调度层 + 业务层分离
 *   - verify 逻辑委托给 AuthProvider（email_password / oauth.google / sso.saml ...）
 *   - 这里只负责：
 *     1. 拿 provider identity 后 upsert User + UserProviderAccount
 *     2. 签发 / 轮换 access + refresh token
 *     3. 验证 refresh token
 *
 * 保留的安全逻辑（不重写，来自 commit b05bad7）：
 *   - SHA-256 哈希 refresh token（不存原文）
 *   - CSPRNG randomBytes(32) 生成 refresh token
 *   - refresh token rotation（删旧发新）
 */
export const AUTH_PROVIDERS = 'AUTH_PROVIDERS';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly providers: Map<string, AuthProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(AUTH_PROVIDERS) providers: AuthProvider[],
  ) {
    this.providers = new Map(providers.map((p) => [p.id, p]));
  }

  /**
   * 通用登录入口：根据 provider id 调度
   * 之前的 register/login 端点会传 providerId="email_password" + mode
   * 新的 oauth 端点会传 providerId="oauth.google" + code
   */
  async authenticate(providerId: string, credentials: AuthCredentials) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new UnauthorizedException(`Unknown provider: ${providerId}`);
    }
    if (!provider.enabled) {
      throw new UnauthorizedException(`Provider ${providerId} is not enabled`);
    }

    // 1. 让 provider 验证凭据 → 标准化 identity
    const identity = await provider.verify(credentials);

    // 2. upsert user + provider account
    const { user, isNewUser } = await this.upsertUser(provider.id, identity);

    // 3. 记录 last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 4. 签发 tokens
    return this.generateTokens(user);
  }

  /**
   * 把 provider identity 映射到 user
   * 规则：
   *   - 先查 UserProviderAccount（provider + providerUserId 唯一索引）
   *   - 命中 → 返回 user
   *   - 不命中 → 用 identity.profile.email 查 user,合并 provider account
   *   - 还不命中 → 创建 user + provider account
   */
  private async upsertUser(providerId: string, identity: Awaited<ReturnType<AuthProvider['verify']>>) {
    // 先看 provider account 是不是已经绑过
    const existingAccount = await this.prisma.userProviderAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: providerId,
          providerUserId: identity.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return { user: existingAccount.user, isNewUser: false };
    }

    // 找一下有没有同 email 的 user（可能先用 email/password 注册过,现在用 google 登录）
    const existingUser = await this.prisma.user.findUnique({
      where: { email: identity.profile.email },
    });

    if (existingUser) {
      await this.prisma.userProviderAccount.create({
        data: {
          userId: existingUser.id,
          provider: providerId,
          providerUserId: identity.providerUserId,
          profile: (identity.profile.raw as any) ?? undefined,
        },
      });
      this.logger.log(
        `Linked new provider "${providerId}" to existing user ${existingUser.id} (${existingUser.email})`,
      );
      return { user: existingUser, isNewUser: false };
    }

    // 完全新用户
    const newUser = await this.prisma.user.create({
      data: {
        email: identity.profile.email,
        name: identity.profile.name,
        avatarUrl: identity.profile.avatarUrl,
        // OAuth/SSO 用户没密码,空字符串占位;passwordResetRequired 提示后续补密码
        // email_password provider 自己会覆盖 passwordHash
        passwordHash: '',
        passwordResetRequired: providerId !== 'email_password',
      },
    });
    await this.prisma.userProviderAccount.create({
      data: {
        userId: newUser.id,
        provider: providerId,
        providerUserId: identity.providerUserId,
        profile: (identity.profile.raw as any) ?? undefined,
      },
    });
    this.logger.log(`Created new user ${newUser.id} from provider "${providerId}"`);
    return { user: newUser, isNewUser: true };
  }

  async refresh(token: string) {
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }

    // Security: 只存 hash,验证时先 hash 再查
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: this.hashToken(token) },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation: 删旧发新
    await this.prisma.refreshToken.delete({
      where: { token: this.hashToken(token) },
    });
    return this.generateTokens(stored.user);
  }

  /** 旧 login 端点兼容：直接走 email_password provider */
  async login(dto: LoginDto) {
    return this.authenticate('email_password', { ...dto, mode: 'login' });
  }

  /** 旧 register 端点兼容 */
  async register(dto: { email: string; password: string; name: string }) {
    const result = await this.authenticate('email_password', { ...dto, mode: 'register' });
    // 注册端点只返回 user,不返回 token（用户需要再走 login 拿 token）
    return { user: result.user };
  }

  /** 列出可用的登录 provider（前端 LoginPage 渲染按钮用） */
  listProviders() {
    return Array.from(this.providers.values())
      .filter((p) => p.enabled && p.describe)
      .map((p) => p.describe!());
  }

  private generateTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(32).toString('hex');

    const refreshExpires = new Date();
    refreshExpires.setDate(refreshExpires.getDate() + 7);

    // Security: 只存 hash
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
        name: (user as any).name,
        role: user.role,
      },
    };
  }

  // Security: CSPRNG,never Math.random()
  private randomToken(): string {
    return randomBytes(32).toString('hex');
  }

  // Security: 只存 hash
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
