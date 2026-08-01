import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthProvider, AuthIdentity, AuthCredentials } from './auth-provider.types';
import { SAML } from '@node-saml/node-saml';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SSO Provider (SAML 2.0)
 *
 * Frank 的硬要求："后续要跟外部 IdP 整合"
 * - 企业客户通常用 SAML 接 Okta / Azure AD / 自建 IdP
 * - 接口已就位,SAML 实现留给下一刀（接 @node-saml/passport-saml 或类似 lib）
 * - 这一刀把 verify/link/describe 接口写好,实现里抛 NotImplementedException
 *
 * 接入步骤（下一刀）：
 *   1. pnpm add @node-saml/passport-saml
 *   2. 替换 verify() 的 throw 为真实 SAML response 解析
 *   3. 用 config.cert 做签名验证
 */
@Injectable()
export class SsoProvider extends AuthProvider {
  readonly id = 'sso.saml' as const;
  readonly type = 'sso' as const;
  readonly enabled: boolean;
  private readonly saml: SAML;

  constructor(
    private readonly config: {
      entryPoint: string;
      issuer: string;
      callbackUrl: string;
      cert: string;
    },
    private readonly prisma: PrismaService,
  ) {
    super();
    this.enabled = true;
    this.saml = new SAML({
      entryPoint: config.entryPoint,
      issuer: config.issuer,
      callbackUrl: config.callbackUrl,
      idpCert: config.cert,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
    });
  }

  async verify(credentials: AuthCredentials): Promise<AuthIdentity> {
    // SAML 实现待下一刀,这一层先 fail-fast,避免静默"接通了"假象
    const { samlResponse } = credentials as { samlResponse?: string };
    if (!samlResponse) {
      throw new UnauthorizedException('Missing SAML response');
    }

    try {
      const result = await this.saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
      const profile = result.profile as Record<string, unknown>;
      const email = String(profile.email ?? profile.mail ?? profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? '');
      const providerUserId = String(profile.nameID ?? profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? '');
      if (!email || !providerUserId) throw new Error('required claims missing');
      const name = String(profile.displayName ?? profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? email);
      return { providerUserId, profile: { email, name, raw: profile } };
    } catch {
      throw new UnauthorizedException('Invalid SAML response');
    }
  }

  async link(userId: string, credentials: AuthCredentials): Promise<void> {
    const identity = await this.verify(credentials);
    const existing = await this.prisma.userProviderAccount.findUnique({ where: { provider_providerUserId: { provider: this.id, providerUserId: identity.providerUserId } } });
    if (existing && existing.userId !== userId) throw new UnauthorizedException('This SSO account is already linked');
    if (!existing) await this.prisma.userProviderAccount.create({ data: { userId, provider: this.id, providerUserId: identity.providerUserId, email: identity.profile.email, displayName: identity.profile.name, profile: identity.profile.raw as any } });
  }

  describe() {
    return { id: this.id, label: 'Enterprise SSO (SAML)', type: this.type };
  }
}
