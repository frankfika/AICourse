import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security: never leak stack traces / framework internals on 5xx.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Security: only one trusted proxy in front (Nginx / Cloudflare LB).
  // Access the underlying Express instance so we can set the trust-proxy knob.
  const httpAdapter = app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void };
  httpAdapter.set('trust proxy', 1);

  // Security: helmet adds X-Content-Type-Options, X-Frame-Options,
  // Strict-Transport-Security, Referrer-Policy and a strict CSP.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          imgSrc: [`'self'`, 'data:', 'https://coresg-normal.trae.ai'],
          scriptSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          connectSrc: [`'self'`, 'https://generativelanguage.googleapis.com'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Security: hard cap on request body size to prevent memory DoS (H-03).
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ limit: '100kb', extended: false }));

  // Global configuration
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(cookieParser());

  // CORS — support comma-separated origin list (e.g. "http://localhost:3000,http://localhost:5500")
  const corsOrigin = configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
  });

  // Swagger documentation — disabled in production to avoid leaking API surface.
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI Academy API')
      .setDescription('AI and LLM education platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('API_PORT') ?? 8080;
  const host = configService.get<string>('API_HOST') ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`🚀 API running on http://${host}:${port}/api`);
  if (configService.get<string>('NODE_ENV') !== 'production') {
    console.log(`📚 API docs available on http://${host}:${port}/api/docs`);
  }
}

bootstrap();
