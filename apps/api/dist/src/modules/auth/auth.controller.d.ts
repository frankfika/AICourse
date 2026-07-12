import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    listProviders(): {
        providers: {
            id: import("./providers/auth-provider.types").AuthProviderId;
            label: string;
            iconUrl?: string;
            type: import("./providers/auth-provider.types").AuthProviderType;
        }[];
    };
    register(dto: RegisterDto): Promise<{
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    login(dto: LoginDto, res: Response): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    refresh(req: Request, res: Response): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    logout(res: Response): Promise<{
        message: string;
    }>;
    authenticate(providerId: string, body: Record<string, unknown>, res: Response): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: any;
            role: string;
        };
    }>;
    private setRefreshCookie;
}
