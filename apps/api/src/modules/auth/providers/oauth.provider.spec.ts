import { UnauthorizedException } from '@nestjs/common';
import { OAuthProvider } from './oauth.provider';

describe('OAuthProvider identity normalization', () => {
  const provider = new OAuthProvider(
    'oauth.google',
    { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/callback', scopes: [] },
    {} as any,
  );

  it('rejects a Google profile whose email is not provider-verified', () => {
    expect(() => (provider as any).normalize('oauth.google', {
      sub: 'google-user', email: 'unverified@example.com', email_verified: false,
    })).toThrow(UnauthorizedException);
  });

  it('marks a verified Google email as verified for account-linking decisions', () => {
    const identity = (provider as any).normalize('oauth.google', {
      sub: 'google-user', email: 'verified@example.com', email_verified: true,
    });

    expect(identity.profile).toEqual(expect.objectContaining({
      email: 'verified@example.com', emailVerified: true,
    }));
  });
});
