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
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
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
    app.enableCors({
        origin: configService.get('CORS_ORIGIN') ?? 'http://localhost:3000',
        credentials: true,
    });
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('OpenCSG Academy API')
        .setDescription('AI and LLM education platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = configService.get('API_PORT') ?? 8080;
    const host = configService.get('API_HOST') ?? '0.0.0.0';
    await app.listen(port, host);
    console.log(`🚀 API running on http://${host}:${port}/api`);
    console.log(`📚 API docs available on http://${host}:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map