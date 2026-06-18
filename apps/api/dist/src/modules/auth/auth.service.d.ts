import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './auth.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(dto: RegisterDto): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
            createdAt: Date;
        };
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
        };
    }>;
    refresh(token: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: import("@prisma/client").$Enums.UserRole;
        };
    }>;
    private generateTokens;
    private randomToken;
}
