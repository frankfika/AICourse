"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = exports.AUTH_PROVIDERS = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
exports.AUTH_PROVIDERS = 'AUTH_PROVIDERS';
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwtService, providers) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger(AuthService_1.name);
        this.providers = new Map(providers.map((p) => [p.id, p]));
    }
    async authenticate(providerId, credentials) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new common_1.UnauthorizedException(`Unknown provider: ${providerId}`);
        }
        if (!provider.enabled) {
            throw new common_1.UnauthorizedException(`Provider ${providerId} is not enabled`);
        }
        const identity = await provider.verify(credentials);
        const { user, isNewUser } = await this.upsertUser(provider.id, identity);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        return this.generateTokens(user);
    }
    async upsertUser(providerId, identity) {
        const existingAccount = await this.prisma.userProviderAccount.findUnique({
            where: {
                provider_providerUserId: {
                    provider: providerId,
                    providerUserId: identity.providerUserId,
                },
            },
            include: { user: true },
        });
        if (existingAccount) {
            return { user: existingAccount.user, isNewUser: false };
        }
        const existingUser = await this.prisma.user.findUnique({
            where: { email: identity.profile.email },
        });
        if (existingUser) {
            await this.prisma.userProviderAccount.create({
                data: {
                    userId: existingUser.id,
                    provider: providerId,
                    providerUserId: identity.providerUserId,
                    profile: identity.profile.raw ?? undefined,
                },
            });
            this.logger.log(`Linked new provider "${providerId}" to existing user ${existingUser.id} (${existingUser.email})`);
            return { user: existingUser, isNewUser: false };
        }
        const newUser = await this.prisma.user.create({
            data: {
                email: identity.profile.email,
                name: identity.profile.name,
                avatarUrl: identity.profile.avatarUrl,
                passwordHash: '',
                passwordResetRequired: providerId !== 'email_password',
            },
        });
        await this.prisma.userProviderAccount.create({
            data: {
                userId: newUser.id,
                provider: providerId,
                providerUserId: identity.providerUserId,
                profile: identity.profile.raw ?? undefined,
            },
        });
        this.logger.log(`Created new user ${newUser.id} from provider "${providerId}"`);
        return { user: newUser, isNewUser: true };
    }
    async refresh(token) {
        if (!token) {
            throw new common_1.UnauthorizedException('No refresh token');
        }
        const stored = await this.prisma.refreshToken.findUnique({
            where: { token: this.hashToken(token) },
            include: { user: true },
        });
        if (!stored || stored.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        await this.prisma.refreshToken.delete({
            where: { token: this.hashToken(token) },
        });
        return this.generateTokens(stored.user);
    }
    async login(dto) {
        return this.authenticate('email_password', { ...dto, mode: 'login' });
    }
    async register(dto) {
        const result = await this.authenticate('email_password', { ...dto, mode: 'register' });
        return { user: result.user };
    }
    listProviders() {
        return Array.from(this.providers.values())
            .filter((p) => p.enabled && p.describe)
            .map((p) => p.describe());
    }
    generateTokens(user) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const refreshExpires = new Date();
        refreshExpires.setDate(refreshExpires.getDate() + 7);
        this.prisma.refreshToken.create({
            data: {
                token: this.hashToken(refreshToken),
                userId: user.id,
                expiresAt: refreshExpires,
            },
        });
        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }
    randomToken() {
        return (0, crypto_1.randomBytes)(32).toString('hex');
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(exports.AUTH_PROVIDERS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService, Array])
], AuthService);
//# sourceMappingURL=auth.service.js.map