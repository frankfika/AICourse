import { HackathonsService } from './hackathons.service';
import { HackathonStatus } from '@prisma/client';
import { CreateHackathonDto, UpdateHackathonDto, CreateTeamDto, CreateSubmissionDto, UpdateSubmissionDto, CreateAnnouncementDto, JudgeSubmissionDto } from './hackathons.dto';
export declare class HackathonsController {
    private readonly hackathonsService;
    constructor(hackathonsService: HackathonsService);
    private getUserId;
    findAll(status?: HackathonStatus, search?: string, req?: any): Promise<{
        myRegistration: {
            id: string;
            status: import("@prisma/client").$Enums.RegistrationStatus;
            userId: string;
            hackathonId: string;
            registeredAt: Date;
            checkedInAt: Date | null;
        };
        registrations: undefined;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        _count: {
            registrations: number;
            teams: number;
        };
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.HackathonStatus;
        bannerUrl: string | null;
        startDate: Date;
        endDate: Date;
        registerDeadline: Date | null;
        maxTeamSize: number;
        minTeamSize: number;
        location: string | null;
        rules: string | null;
        prizes: string | null;
        organizerId: string | null;
        organizer: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
    }[]>;
    findOne(id: string, req: any): Promise<{
        myRegistration: {
            id: string;
            status: import("@prisma/client").$Enums.RegistrationStatus;
            userId: string;
            hackathonId: string;
            registeredAt: Date;
            checkedInAt: Date | null;
        } | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        _count: {
            submissions: number;
            registrations: number;
            teams: number;
        };
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.HackathonStatus;
        bannerUrl: string | null;
        startDate: Date;
        endDate: Date;
        registerDeadline: Date | null;
        maxTeamSize: number;
        minTeamSize: number;
        location: string | null;
        rules: string | null;
        prizes: string | null;
        organizerId: string | null;
        judges: {
            id: string;
            name: string;
            avatarUrl: string | null;
            title: string | null;
            userId: string | null;
            bio: string | null;
            hackathonId: string;
        }[];
        organizer: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
    }>;
    create(dto: CreateHackathonDto, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.HackathonStatus;
        bannerUrl: string | null;
        startDate: Date;
        endDate: Date;
        registerDeadline: Date | null;
        maxTeamSize: number;
        minTeamSize: number;
        location: string | null;
        rules: string | null;
        prizes: string | null;
        organizerId: string | null;
        organizer: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
    }>;
    update(id: string, dto: UpdateHackathonDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.HackathonStatus;
        bannerUrl: string | null;
        startDate: Date;
        endDate: Date;
        registerDeadline: Date | null;
        maxTeamSize: number;
        minTeamSize: number;
        location: string | null;
        rules: string | null;
        prizes: string | null;
        organizerId: string | null;
        organizer: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
    register(id: string, req: any): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.RegistrationStatus;
        userId: string;
        hackathonId: string;
        registeredAt: Date;
        checkedInAt: Date | null;
    }>;
    cancelRegistration(id: string, req: any): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.RegistrationStatus;
        userId: string;
        hackathonId: string;
        registeredAt: Date;
        checkedInAt: Date | null;
    }>;
    getMyRegistration(id: string, req: any): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.RegistrationStatus;
        userId: string;
        hackathonId: string;
        registeredAt: Date;
        checkedInAt: Date | null;
    } | null>;
    getAnnouncements(id: string): Promise<{
        id: string;
        createdAt: Date;
        title: string;
        content: string;
        isPinned: boolean;
        hackathonId: string;
    }[]>;
    createAnnouncement(id: string, dto: CreateAnnouncementDto, req: any): Promise<{
        id: string;
        createdAt: Date;
        title: string;
        content: string;
        isPinned: boolean;
        hackathonId: string;
    }>;
    getTeams(id: string): Promise<({
        _count: {
            submissions: number;
        };
        members: ({
            user: {
                id: string;
                name: string;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            role: import("@prisma/client").$Enums.TeamRole;
            userId: string;
            teamId: string;
        })[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        hackathonId: string;
        slogan: string | null;
        captainId: string;
    })[]>;
    createTeam(id: string, dto: CreateTeamDto, req: any): Promise<({
        members: ({
            user: {
                id: string;
                name: string;
                avatarUrl: string | null;
            };
        } & {
            id: string;
            role: import("@prisma/client").$Enums.TeamRole;
            userId: string;
            teamId: string;
        })[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        hackathonId: string;
        slogan: string | null;
        captainId: string;
    }) | null>;
    joinTeam(id: string, teamId: string, req: any): Promise<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        };
        team: {
            id: string;
            name: string;
            createdAt: Date;
            hackathonId: string;
            slogan: string | null;
            captainId: string;
        };
    } & {
        id: string;
        role: import("@prisma/client").$Enums.TeamRole;
        userId: string;
        teamId: string;
    }>;
    leaveTeam(id: string, teamId: string, req: any): Promise<{
        message: string;
    }>;
    getMySubmissions(id: string, req: any): Promise<({
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
        team: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.SubmissionStatus;
        videoUrl: string | null;
        userId: string | null;
        hackathonId: string;
        teamId: string | null;
        demoUrl: string | null;
        repoUrl: string | null;
        score: import("@prisma/client/runtime/library").Decimal | null;
        feedback: string | null;
        submittedAt: Date | null;
    })[]>;
    getAllSubmissions(id: string): Promise<({
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
        team: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.SubmissionStatus;
        videoUrl: string | null;
        userId: string | null;
        hackathonId: string;
        teamId: string | null;
        demoUrl: string | null;
        repoUrl: string | null;
        score: import("@prisma/client/runtime/library").Decimal | null;
        feedback: string | null;
        submittedAt: Date | null;
    })[]>;
    createSubmission(id: string, dto: CreateSubmissionDto, req: any): Promise<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
        team: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.SubmissionStatus;
        videoUrl: string | null;
        userId: string | null;
        hackathonId: string;
        teamId: string | null;
        demoUrl: string | null;
        repoUrl: string | null;
        score: import("@prisma/client/runtime/library").Decimal | null;
        feedback: string | null;
        submittedAt: Date | null;
    }>;
    updateSubmission(id: string, submissionId: string, dto: UpdateSubmissionDto, req: any): Promise<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
        team: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.SubmissionStatus;
        videoUrl: string | null;
        userId: string | null;
        hackathonId: string;
        teamId: string | null;
        demoUrl: string | null;
        repoUrl: string | null;
        score: import("@prisma/client/runtime/library").Decimal | null;
        feedback: string | null;
        submittedAt: Date | null;
    }>;
    judgeSubmission(id: string, submissionId: string, dto: JudgeSubmissionDto): Promise<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        } | null;
        team: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        title: string;
        status: import("@prisma/client").$Enums.SubmissionStatus;
        videoUrl: string | null;
        userId: string | null;
        hackathonId: string;
        teamId: string | null;
        demoUrl: string | null;
        repoUrl: string | null;
        score: import("@prisma/client/runtime/library").Decimal | null;
        feedback: string | null;
        submittedAt: Date | null;
    }>;
}
