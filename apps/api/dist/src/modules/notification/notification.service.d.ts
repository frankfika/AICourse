import { ConfigService } from '@nestjs/config';
export declare class NotificationService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    private get provider();
    sendEnterpriseInquiryNotification(data: {
        name: string;
        email: string;
        company: string;
        teamSize: string;
        phone?: string;
        topic: string;
        description?: string;
    }): Promise<void>;
    private buildEnterpriseInquiryEmail;
    private send;
    private sendViaSendGrid;
    private sendViaSes;
}
