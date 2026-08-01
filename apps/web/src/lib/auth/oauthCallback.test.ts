import { describe, expect, it } from 'vitest';
import { providerFromOAuthState } from './oauthCallback';

function stateFor(payload: object) {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${encoded}.signature`;
}

describe('providerFromOAuthState', () => {
  it('extracts an OAuth provider from the signed-state payload', () => {
    expect(providerFromOAuthState(stateFor({ providerId: 'oauth.github' }))).toBe('oauth.github');
  });

  it('rejects malformed and non-OAuth provider ids', () => {
    expect(providerFromOAuthState('invalid')).toBeNull();
    expect(providerFromOAuthState(stateFor({ providerId: 'email_password' }))).toBeNull();
  });
});
