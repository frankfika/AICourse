import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnv, validateProductionEnv } from './validate-production-env.mjs';

function validEnv() {
  return {
    PUBLIC_URL: 'https://academy.example.test',
    WEB_BIND_ADDRESS: '127.0.0.1',
    WEB_PORT: '8088',
    MYSQL_ROOT_PASSWORD: 'root-7A4b9C2d5E8f1G6h3J0k4L7m2N9p6Q',
    MYSQL_DATABASE: 'ai_academy',
    MYSQL_USER: 'ai_academy',
    MYSQL_PASSWORD: 'db-8B5c2D9e6F3a0G7h4J1k8L5m2N9p6Q3',
    DATABASE_URL: 'mysql://ai_academy:db-8B5c2D9e6F3a0G7h4J1k8L5m2N9p6Q3@mysql:3306/ai_academy',
    REDIS_PASSWORD: 'redis-9C6d3E0f7G4h1J8k5L2m9N6p3Q0r7S4',
    MINIO_ROOT_USER: 'aiacademy',
    MINIO_ROOT_PASSWORD: 'minio-1D8e5F2g9H6j3K0m7N4p1Q8r5S2t9U6',
    STORAGE_PUBLIC_HOST: 'academy.example.test',
    STORAGE_PUBLIC_PORT: '443',
    STORAGE_PUBLIC_SSL: 'true',
    JWT_SECRET: 'jwt-2E9f6A3b0C7d4E1f8A5b2C9d6E3f0A7b',
    AI_KEY_ENCRYPTION_KEY: '0123456789abcdef'.repeat(4),
    ADMIN_EMAIL: 'admin@example.test',
    ADMIN_INITIAL_PASSWORD: 'AdminInitial-4X7y2Z9w!',
    SEED_STUDENT_EMAIL: 'student@example.test',
    SEED_STUDENT_PASSWORD: 'StudentInitial-6Q3r8T1u!',
    AUTH_PROVIDERS: 'email_password',
  };
}

test('parseEnv supports comments and quoted values', () => {
  assert.deepEqual(parseEnv('# comment\nA=one\nB="two words"\nC=\'three\'\n'), {
    A: 'one',
    B: 'two words',
    C: 'three',
  });
});

test('accepts a complete production environment', () => {
  assert.deepEqual(validateProductionEnv(validEnv()), []);
});

test('rejects an encryption key that would disable AI key management at runtime', () => {
  const env = validEnv();
  env.AI_KEY_ENCRYPTION_KEY = 'not-hex-but-long-enough-to-pass-the-old-check';
  assert.ok(validateProductionEnv(env).includes(
    'AI_KEY_ENCRYPTION_KEY must be exactly 64 hexadecimal characters',
  ));
});

test('rejects database identity mismatches', () => {
  const env = validEnv();
  env.DATABASE_URL = 'postgresql://other:wrong@db:5432/not_ai_academy';
  const errors = validateProductionEnv(env);
  assert.ok(errors.includes('DATABASE_URL must use the mysql protocol'));
  assert.ok(errors.includes('DATABASE_URL username must match MYSQL_USER'));
  assert.ok(errors.includes('DATABASE_URL hostname must be mysql for the production Compose stack'));
  assert.ok(errors.includes('DATABASE_URL database name must match MYSQL_DATABASE'));
});

test('rejects weak bootstrap passwords and reused infrastructure secrets', () => {
  const env = validEnv();
  env.ADMIN_INITIAL_PASSWORD = 'all-lowercase-password';
  env.REDIS_PASSWORD = env.MYSQL_ROOT_PASSWORD;
  const errors = validateProductionEnv(env);
  assert.ok(errors.includes(
    'ADMIN_INITIAL_PASSWORD must contain uppercase, lowercase, number, and symbol characters',
  ));
  assert.ok(errors.includes('MYSQL_ROOT_PASSWORD and REDIS_PASSWORD must not reuse the same secret'));
});
