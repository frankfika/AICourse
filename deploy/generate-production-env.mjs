import { randomBytes } from 'node:crypto';
import { openSync, writeFileSync, closeSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function randomHex() {
  return randomBytes(32).toString('hex');
}

function initialPassword() {
  return `Aa1!${randomBytes(18).toString('base64url')}`;
}

export function generateProductionEnv({ domain, adminEmail, studentEmail, imageSha }) {
  if (!/^[a-z0-9.-]+$/i.test(domain) || domain.startsWith('.') || domain.endsWith('.')) {
    throw new Error('domain must be a valid DNS hostname');
  }
  for (const [name, email] of Object.entries({ adminEmail, studentEmail })) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`${name} must be a valid email`);
  }
  if (adminEmail.toLowerCase() === studentEmail.toLowerCase()) {
    throw new Error('adminEmail and studentEmail must be different');
  }
  if (!/^[0-9a-f]{40}$/i.test(imageSha)) throw new Error('imageSha must be a full 40-character Git commit SHA');

  const mysqlPassword = randomHex();
  const values = {
    PUBLIC_URL: `https://${domain}`,
    WEB_BIND_ADDRESS: '127.0.0.1',
    WEB_PORT: '8088',
    API_IMAGE: `ghcr.io/frankfika/aicourse-api:${imageSha}`,
    WEB_IMAGE: `ghcr.io/frankfika/aicourse-web:${imageSha}`,
    MYSQL_ROOT_PASSWORD: randomHex(),
    MYSQL_DATABASE: 'ai_academy',
    MYSQL_USER: 'ai_academy',
    MYSQL_PASSWORD: mysqlPassword,
    DATABASE_URL: `mysql://ai_academy:${mysqlPassword}@mysql:3306/ai_academy`,
    REDIS_PASSWORD: randomHex(),
    MINIO_ROOT_USER: 'aiacademy',
    MINIO_ROOT_PASSWORD: randomHex(),
    MINIO_BUCKET: 'ai-academy',
    STORAGE_PUBLIC_HOST: domain,
    STORAGE_PUBLIC_PORT: '443',
    STORAGE_PUBLIC_SSL: 'true',
    JWT_SECRET: randomHex(),
    AI_KEY_ENCRYPTION_KEY: randomHex(),
    BOOTSTRAP_DATA: 'true',
    ADMIN_EMAIL: adminEmail,
    ADMIN_INITIAL_PASSWORD: initialPassword(),
    SEED_STUDENT_EMAIL: studentEmail,
    SEED_STUDENT_PASSWORD: initialPassword(),
    GEMINI_API_KEY: '',
    GEMINI_MODEL: 'gemini-2.0-flash',
    ENTERPRISE_NOTIFY_EMAIL: '',
    RESEND_API_KEY: '',
    MAIL_FROM: '',
    AUTH_PROVIDERS: 'email_password',
    AUTH_OAUTH_GOOGLE_CLIENT_ID: '',
    AUTH_OAUTH_GOOGLE_CLIENT_SECRET: '',
    AUTH_OAUTH_GOOGLE_REDIRECT_URI: '',
    AUTH_OAUTH_GITHUB_CLIENT_ID: '',
    AUTH_OAUTH_GITHUB_CLIENT_SECRET: '',
    AUTH_OAUTH_GITHUB_REDIRECT_URI: '',
  };
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const output = argument('output');
  const domain = argument('domain');
  const adminEmail = argument('admin-email');
  const studentEmail = argument('student-email');
  const imageSha = argument('image-sha');
  if (!output || !domain || !adminEmail || !studentEmail || !imageSha) {
    throw new Error('required: --output --domain --admin-email --student-email --image-sha');
  }

  const content = generateProductionEnv({ domain, adminEmail, studentEmail, imageSha });
  const descriptor = openSync(output, 'wx', 0o600);
  try {
    writeFileSync(descriptor, content, 'utf8');
  } finally {
    closeSync(descriptor);
  }
  console.info(`Production environment created with mode 0600: ${output}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
