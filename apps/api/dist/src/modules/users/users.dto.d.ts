import { UserRole } from '@prisma/client';
export declare class CreateUserDto {
    email: string;
    password: string;
    name: string;
    role: UserRole;
}
export declare class UpdateUserDto {
    name?: string;
    avatarUrl?: string;
}
export declare class GrantCourseAccessDto {
    courseIds: string[];
}
export declare class GrantDegreeAccessDto {
    degreeIds: string[];
}
