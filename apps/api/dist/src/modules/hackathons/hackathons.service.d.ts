import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateHackathonDto, UpdateHackathonDto, CreateTeamDto, CreateSubmissionDto, UpdateSubmissionDto, CreateAnnouncementDto, JudgeSubmissionDto } from './hackathons.dto';
import { HackathonStatus } from '@prisma/client';
export declare class HackathonsService {
    private readonly prisma;
    private readonly auditLog;
    constructor(prisma: PrismaService, auditLog: AuditLogService);
    private baseSelect;
    private organizerSelect;
    private userSelect;
    findAll(params: {
        status?: HackathonStatus;
        search?: string;
        userId?: string;
    }): Promise<{
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
    findOne(id: string, userId?: string): Promise<{
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
    create(dto: CreateHackathonDto, organizerId: string): Promise<{
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
    register(userId: string, hackathonId: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.RegistrationStatus;
        userId: string;
        hackathonId: string;
        registeredAt: Date;
        checkedInAt: Date | null;
    }>;
    cancelRegistration(userId: string, hackathonId: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.RegistrationStatus;
        userId: string;
        hackathonId: string;
        registeredAt: Date;
        checkedInAt: Date | null;
    }>;
    getMyRegistration(userId: string, hackathonId: string): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.RegistrationStatus;
        userId: string;
        hackathonId: string;
        registeredAt: Date;
        checkedInAt: Date | null;
    } | null>;
    getAnnouncements(hackathonId: string): Promise<{
        id: string;
        createdAt: Date;
        title: string;
        content: string;
        isPinned: boolean;
        hackathonId: string;
    }[]>;
    createAnnouncement(hackathonId: string, dto: CreateAnnouncementDto, userId: string): Promise<{
        id: string;
        createdAt: Date;
        title: string;
        content: string;
        isPinned: boolean;
        hackathonId: string;
    }>;
    getTeams(hackathonId: string): Promise<({
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
    createTeam(userId: string, hackathonId: string, dto: CreateTeamDto): Promise<({
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
    joinTeam(userId: string, hackathonId: string, teamId: string): Promise<{
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
    leaveTeam(userId: string, hackathonId: string, teamId: string): Promise<{
        message: string;
    }>;
    getMySubmissions(userId: string, hackathonId: string): Promise<({
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
    createSubmission(userId: string, hackathonId: string, dto: CreateSubmissionDto): Promise<{
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
    updateSubmission(userId: string, hackathonId: string, submissionId: string, dto: UpdateSubmissionDto): Promise<{
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
    getAllSubmissions(hackathonId: string): Promise<({
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
    judgeSubmission(hackathonId: string, submissionId: string, dto: JudgeSubmissionDto): Promise<{
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
    private ensureExists;
    private ensureRegistered;
}
