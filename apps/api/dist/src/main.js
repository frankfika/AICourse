"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_1 = require("express");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const httpAdapter = app.getHttpAdapter().getInstance();
    httpAdapter.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
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
    }));
    app.use((0, express_1.json)({ limit: '100kb' }));
    app.use((0, express_1.urlencoded)({ limit: '100kb', extended: false }));
    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: '1',
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.use((0, cookie_parser_1.default)());
    const corsOrigin = configService.get('CORS_ORIGIN') ?? 'http://localhost:3000';
    const allowedOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error(`CORS: origin ${origin} not allowed`), false);
            }
        },
        credentials: true,
    });
    if (configService.get('NODE_ENV') !== 'production') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('OpenCSG Academy API')
            .setDescription('AI and LLM education platform API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    const port = configService.get('API_PORT') ?? 8080;
    const host = configService.get('API_HOST') ?? '0.0.0.0';
    await app.listen(port, host);
    console.log(`🚀 API running on http://${host}:${port}/api`);
    if (configService.get('NODE_ENV') !== 'production') {
        console.log(`📚 API docs available on http://${host}:${port}/api/docs`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map