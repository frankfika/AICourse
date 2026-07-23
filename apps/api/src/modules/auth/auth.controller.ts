import { Controller, Post, Body, Req, Res, Get, HttpCode, HttpStatus, UnauthorizedException, Param, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

/**
 * AuthController - 重构后
 *
 * 端点分层：
 * - 旧端点（保留兼容）: /auth/register /auth/login /auth/refresh /auth/logout
 * - 新端点（抽象层）:    /auth/providers /auth/:providerId /auth/:providerId/callback
 *
 * 旧端点内部走 email_password provider（保留 Frank 安全加固 commit 的逻辑）
 * 新端点通用：传 providerId + credentials
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ============ 新端点：列出可用 provider ============

  /** 前端 LoginPage 用：列出可用的 provider 渲染按钮（OAuth / SSO 入口） */
  @Get('providers')
  listProviders() {
    return { providers: this.authService.listProviders() };
  }

  // ============ 旧端点：email/password 兼容 ============

  // P1-7: 显式 'short' + 'medium' 覆盖全局 5/sec 60/min, 对注册收紧到 5/min 挡批量账号
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // P1-7: 5/sec 30/min 挡密码爆破, 仍允许合法用户失败重试
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  // Security: refresh 走 httpOnly cookie,不在 body 取（防 log 泄露 + 防恶意扩展）
  //
  // P1 fix: 全局 throttler (5/sec, 60/min per IP) 对 refresh 太紧 — 每次 page
  // load 都会调一次 (AuthProvider boot + 401 fallback),hard reload 几下就
  // 429。refresh 是合法高频操作,放宽到 30/sec, 300/min — 仍能挡 brute force
  // (7-char token 暴力破解需要 1000+ QPS),不会拦正常用户。
  @Throttle({ short: { limit: 30, ttl: 1000 }, medium: { limit: 300, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.['refresh_token'];
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }
    const result = await this.authService.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  // P1-7: 5/sec 30/min 防止 token 暴力清除 race
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { message: 'Logged out' };
  }

  // ============ 新端点：通用 provider 入口 ============

  /**
   * 通用 provider authenticate 入口
   * - email_password: body = { email, password, mode: 'login' | 'register' }
   * - oauth.google / oauth.github: body = { code }
   * - sso.saml: body = { samlResponse }
   *
   * 返回结构跟 /auth/login 一致（access + refresh + user）
   */
  // P1-7: 通用 provider 入口 — 5/sec 30/min 跟 login 对齐 (OAuth callback 也是登录动作)
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 30, ttl: 60000 } })
  @Post(':providerId')
  @HttpCode(HttpStatus.OK)
  async authenticate(
    @Param('providerId') providerId: string,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('Missing credentials');
    }
    const result = await this.authService.authenticate(providerId, body);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    // Security: 
    //  - httpOnly: 防止 JS 读
    //  - secure: 生产强制 https
    //  - sameSite=lax: 防 CSRF (顶层导航才带 cookie), 同时支持 cross-port dev
    //  - path=/api/v1/auth: 限定 cookie 路径
    //    注: 原 spec 是 'strict',但 dev 跨端口 (5502→8080) 时 strict 会被
    //    一些浏览器当作跨站, 实际不送 cookie. 改 'lax' 在安全和 dev 体验间取平衡.
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
