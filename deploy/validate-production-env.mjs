import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function validateProductionEnv(env) {
  const errors = [];
  const required = [
    'PUBLIC_URL', 'MYSQL_ROOT_PASSWORD', 'MYSQL_PASSWORD', 'DATABASE_URL',
    'REDIS_PASSWORD', 'MINIO_ROOT_PASSWORD', 'STORAGE_PUBLIC_HOST',
    'STORAGE_PUBLIC_PORT', 'STORAGE_PUBLIC_SSL', 'JWT_SECRET',
    'AI_KEY_ENCRYPTION_KEY', 'ADMIN_EMAIL', 'ADMIN_INITIAL_PASSWORD',
    'SEED_STUDENT_EMAIL', 'SEED_STUDENT_PASSWORD', 'AUTH_PROVIDERS',
  ];
  for (const key of required) {
    if (!env[key]) errors.push(`${key} is required`);
  }

  const placeholderPattern = /replace-with|example\.com|your-domain|changeme|password123/i;
  for (const [key, value] of Object.entries(env)) {
    if (value && placeholderPattern.test(value)) errors.push(`${key} still contains a placeholder value`);
  }

  let publicUrl;
  try {
    publicUrl = new URL(env.PUBLIC_URL);
    if (publicUrl.protocol !== 'https:') errors.push('PUBLIC_URL must use HTTPS');
    if (publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/') {
      errors.push('PUBLIC_URL must be an origin without credentials, path, query, or fragment');
    }
  } catch {
    errors.push('PUBLIC_URL must be a valid absolute URL');
  }

  if (publicUrl) {
    if (env.STORAGE_PUBLIC_HOST !== publicUrl.hostname) errors.push('STORAGE_PUBLIC_HOST must match the PUBLIC_URL hostname');
    const expectedPort = publicUrl.port || '443';
    if (env.STORAGE_PUBLIC_PORT !== expectedPort) errors.push(`STORAGE_PUBLIC_PORT must be ${expectedPort} for PUBLIC_URL`);
    if (env.STORAGE_PUBLIC_SSL !== 'true') errors.push('STORAGE_PUBLIC_SSL must be true in production');
  }

  try {
    const databaseUrl = new URL(env.DATABASE_URL);
    if (decodeURIComponent(databaseUrl.password) !== env.MYSQL_PASSWORD) errors.push('DATABASE_URL password must match MYSQL_PASSWORD');
    if (databaseUrl.hostname !== 'mysql') errors.push('DATABASE_URL hostname must be mysql for the production Compose stack');
  } catch {
    errors.push('DATABASE_URL must be a valid MySQL URL');
  }

  for (const key of ['MYSQL_ROOT_PASSWORD', 'REDIS_PASSWORD', 'MINIO_ROOT_PASSWORD', 'JWT_SECRET', 'AI_KEY_ENCRYPTION_KEY']) {
    if (env[key] && env[key].length < 32) errors.push(`${key} must contain at least 32 characters`);
  }
  for (const key of ['ADMIN_INITIAL_PASSWORD', 'SEED_STUDENT_PASSWORD']) {
    if (env[key] && env[key].length < 16) errors.push(`${key} must contain at least 16 characters`);
  }
  if (env.ADMIN_INITIAL_PASSWORD && env.ADMIN_INITIAL_PASSWORD === env.SEED_STUDENT_PASSWORD) {
    errors.push('ADMIN_INITIAL_PASSWORD and SEED_STUDENT_PASSWORD must be different');
  }
  for (const key of ['ADMIN_EMAIL', 'SEED_STUDENT_EMAIL']) {
    if (env[key] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env[key])) errors.push(`${key} must be a valid email address`);
  }
  if (env.ADMIN_EMAIL && env.ADMIN_EMAIL === env.SEED_STUDENT_EMAIL) errors.push('ADMIN_EMAIL and SEED_STUDENT_EMAIL must be different');
  if (Boolean(env.RESEND_API_KEY) !== Boolean(env.MAIL_FROM)) {
    errors.push('RESEND_API_KEY and MAIL_FROM must be configured together');
  }
  if (env.RESEND_API_KEY && !env.RESEND_API_KEY.startsWith('re_')) {
    errors.push('RESEND_API_KEY must start with re_');
  }
  if (env.MAIL_FROM && !/@[^\s>]+/.test(env.MAIL_FROM)) {
    errors.push('MAIL_FROM must contain a valid sender email address');
  }
  if (env.WEB_BIND_ADDRESS && env.WEB_BIND_ADDRESS !== '127.0.0.1') {
    errors.push('WEB_BIND_ADDRESS must remain 127.0.0.1 behind the host reverse proxy');
  }

  const providers = (env.AUTH_PROVIDERS || '').split(',').map((item) => item.trim()).filter(Boolean);
  const allowedProviders = new Set(['email_password', 'oauth.google', 'oauth.github']);
  for (const provider of providers) if (!allowedProviders.has(provider)) errors.push(`AUTH_PROVIDERS contains unsupported provider: ${provider}`);
  if (!providers.includes('email_password')) errors.push('AUTH_PROVIDERS must include email_password');
  const callback = publicUrl ? `${publicUrl.origin}/auth/oauth/callback` : '';
  for (const [provider, prefix] of [['oauth.google', 'AUTH_OAUTH_GOOGLE'], ['oauth.github', 'AUTH_OAUTH_GITHUB']]) {
    if (!providers.includes(provider)) continue;
    for (const field of [`${prefix}_CLIENT_ID`, `${prefix}_CLIENT_SECRET`, `${prefix}_REDIRECT_URI`]) {
      if (!env[field]) errors.push(`${field} is required when ${provider} is enabled`);
    }
    if (env[`${prefix}_REDIRECT_URI`] && env[`${prefix}_REDIRECT_URI`] !== callback) {
      errors.push(`${prefix}_REDIRECT_URI must equal ${callback}`);
    }
  }
  return [...new Set(errors)];
}

function main() {
  const envPath = resolve(process.argv[2] || '.env.production');
  let source;
  try {
    source = readFileSync(envPath, 'utf8');
  } catch (error) {
    console.error(`Production environment validation failed: cannot read ${envPath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const errors = validateProductionEnv(parseEnv(source));
  if (errors.length) {
    console.error(`Production environment validation failed (${errors.length}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.info(`Production environment is valid: ${envPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
