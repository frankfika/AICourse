import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './auth.dto';
import { AuthProvider, AuthCredentials } from './providers/auth-provider.types';
export declare const AUTH_PROVIDERS = "AUTH_PROVIDERS";
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly logger;
    private readonly providers;
    constructor(prisma: PrismaService, jwtService: JwtService, providers: AuthProvider[]);
    authenticate(providerId: string, credentials: AuthCredentials): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    private upsertUser;
    refresh(token: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    register(dto: {
        email: string;
        password: string;
        name: string;
    }): Promise<{
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    listProviders(): {
        id: import("./providers/auth-provider.types").AuthProviderId;
        label: string;
        iconUrl?: string;
        type: import("./providers/auth-provider.types").AuthProviderType;
    }[];
    private generateTokens;
    private randomToken;
    private hashToken;
}
