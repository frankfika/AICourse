export declare const TEAM_SIZES: readonly ["1-10", "11-50", "51-200", "201-1000", "1000+"];
export declare class CreateEnterpriseInquiryDto {
    name: string;
    email: string;
    company: string;
    teamSize: string;
    phone?: string;
    topic: string;
    description?: string;
}
export declare class UpdateInquiryStatusDto {
    status: 'pending' | 'contacted' | 'qualified' | 'closed' | 'archived';
}
