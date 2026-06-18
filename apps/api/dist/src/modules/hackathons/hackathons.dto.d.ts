import { HackathonStatus, SubmissionStatus } from '@prisma/client';
export declare class CreateHackathonDto {
    title: string;
    description: string;
    bannerUrl?: string;
    status?: HackathonStatus;
    startDate: string;
    endDate: string;
    registerDeadline?: string;
    minTeamSize?: number;
    maxTeamSize?: number;
    location?: string;
    rules?: string;
    prizes?: string;
}
export declare class UpdateHackathonDto extends CreateHackathonDto {
}
export declare class CreateTeamDto {
    name: string;
    slogan?: string;
}
export declare class CreateSubmissionDto {
    title: string;
    description: string;
    demoUrl?: string;
    repoUrl?: string;
    videoUrl?: string;
    teamId?: string;
    status?: SubmissionStatus;
}
export declare class UpdateSubmissionDto {
    title?: string;
    description?: string;
    demoUrl?: string;
    repoUrl?: string;
    videoUrl?: string;
    status?: SubmissionStatus;
}
export declare class CreateAnnouncementDto {
    title: string;
    content: string;
    isPinned?: boolean;
}
export declare class JudgeSubmissionDto {
    score: number;
    feedback?: string;
    status?: SubmissionStatus;
}
