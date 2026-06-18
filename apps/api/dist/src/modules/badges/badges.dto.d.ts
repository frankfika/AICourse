import { BadgeCriteriaType } from '@prisma/client';
export declare class CreateBadgeDto {
    code: string;
    name: string;
    description: string;
    icon?: string;
    category?: string;
    criteriaType: BadgeCriteriaType;
    criteriaValue?: number;
    points?: number;
    isActive?: boolean;
    orderIndex?: number;
}
export declare class UpdateBadgeDto {
    code?: string;
    name?: string;
    description?: string;
    icon?: string;
    category?: string;
    criteriaType?: BadgeCriteriaType;
    criteriaValue?: number;
    points?: number;
    isActive?: boolean;
    orderIndex?: number;
}
