export function providerFromOAuthState(state: string): string | null {
  try {
    const payload = state.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as { providerId?: unknown };
    return typeof decoded.providerId === 'string' && /^oauth\.[a-z0-9_-]+$/i.test(decoded.providerId)
      ? decoded.providerId
      : null;
  } catch {
    return null;
  }
}
