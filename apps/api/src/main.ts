import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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

  // CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000',
    credentials: true,
  });

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('OpenCSG Academy API')
    .setDescription('AI and LLM education platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('API_PORT') ?? 8080;
  const host = configService.get<string>('API_HOST') ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`🚀 API running on http://${host}:${port}/api`);
  console.log(`📚 API docs available on http://${host}:${port}/api/docs`);
}

bootstrap();
