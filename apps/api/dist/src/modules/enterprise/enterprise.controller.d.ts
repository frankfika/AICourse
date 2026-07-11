import { EnterpriseService } from './enterprise.service';
import { CreateEnterpriseInquiryDto, UpdateInquiryStatusDto } from './enterprise.dto';
export declare class EnterpriseController {
    private readonly enterpriseService;
    constructor(enterpriseService: EnterpriseService);
    create(dto: CreateEnterpriseInquiryDto): Promise<{
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import("@prisma/client").$Enums.InquiryStatus;
        topic: string;
        company: string;
        teamSize: string;
        phone: string | null;
    }>;
    findAll(): Promise<{
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import("@prisma/client").$Enums.InquiryStatus;
        topic: string;
        company: string;
        teamSize: string;
        phone: string | null;
    }[]>;
    updateStatus(id: string, dto: UpdateInquiryStatusDto): Promise<{
        id: string;
        email: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import("@prisma/client").$Enums.InquiryStatus;
        topic: string;
        company: string;
        teamSize: string;
        phone: string | null;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
}
