import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthProvider, AuthIdentity, AuthCredentials } from './auth-provider.types';

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
  private readonly logger = new Logger(SsoProvider.name);

  constructor(
    private readonly config: {
      entryPoint: string;
      issuer: string;
      callbackUrl: string;
      cert: string;
    },
  ) {
    super();
    this.enabled = true;
  }

  async verify(credentials: AuthCredentials): Promise<AuthIdentity> {
    // SAML 实现待下一刀,这一层先 fail-fast,避免静默"接通了"假象
    const { samlResponse } = credentials as { samlResponse?: string };
    if (!samlResponse) {
      throw new UnauthorizedException('Missing SAML response');
    }

    // TODO(next-iteration): 用 @node-saml/passport-saml 解析 + 验签 samlResponse
    // 这里只做框架占位,确保接口完整 + fail-fast
    this.logger.error(
      'SAML verify() not implemented. Add @node-saml/passport-saml and parse samlResponse.',
    );
    throw new UnauthorizedException('SSO/SAML not yet implemented. Coming next iteration.');
  }

  async link(_userId: string, _credentials: AuthCredentials): Promise<void> {
    throw new UnauthorizedException('SSO link not yet implemented. Coming next iteration.');
  }

  describe() {
    return { id: this.id, label: 'Enterprise SSO (SAML)', type: this.type };
  }
}
