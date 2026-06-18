import { CostType, CourseStatus } from '@prisma/client';
declare class DegreeCourseLinkDto {
    courseId: string;
    orderIndex: number;
}
export declare class CreateDegreeDto {
    title: string;
    description: string;
    learningPoints: string;
    price: number;
    icon?: string;
    costType: CostType;
    thumbnail?: string;
    status?: CourseStatus;
}
export declare class UpdateDegreeDto extends CreateDegreeDto {
}
export declare class LinkCoursesDto {
    courses: DegreeCourseLinkDto[];
}
export {};
