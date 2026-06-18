export type CostType = 'free' | 'paid' | 'charity';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
export type UserRole = 'admin' | 'student' | 'instructor';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type ResourceType = 'pdf' | 'code' | 'link' | 'video' | 'audio';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type OrderType = 'course' | 'degree';
export type EnrollmentSource = 'direct' | 'degree' | 'hackathon' | 'promotion';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type HackathonStatus = 'upcoming' | 'active' | 'judging' | 'finished' | 'cancelled';
export type RegistrationStatus = 'registered' | 'cancelled' | 'checked_in';
export type TeamRole = 'captain' | 'member';
export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'shortlisted' | 'winner' | 'rejected';
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatarUrl?: string;
    passwordResetRequired: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
    lastLoginAt?: Date | string | null;
}
export interface Course {
    id: string;
    title: string;
    description: string;
    learningPoints: string;
    instructor: string;
    instructorId?: string | null;
    level: CourseLevel;
    duration: string;
    thumbnail: string;
    tags: string;
    costType: CostType;
    price: number;
    status: CourseStatus;
    createdAt: Date | string;
    updatedAt: Date | string;
}
export interface Chapter {
    id: string;
    courseId: string;
    title: string;
    description?: string | null;
    orderIndex: number;
    createdAt: Date | string;
}
export interface Lesson {
    id: string;
    chapterId: string;
    title: string;
    description?: string | null;
    videoUrl?: string | null;
    videoDuration?: number | null;
    orderIndex: number;
    isPreview: boolean;
    createdAt: Date | string;
}
export interface Resource {
    id: string;
    lessonId: string;
    title: string;
    url: string;
    type: ResourceType;
    isLocked: boolean;
    createdAt: Date | string;
}
export interface NanoDegree {
    id: string;
    title: string;
    description: string;
    learningPoints: string;
    price: number;
    icon: string;
    costType: CostType;
    thumbnail?: string | null;
    status: CourseStatus;
    createdAt: Date | string;
    updatedAt: Date | string;
}
export interface DegreeCourse {
    degreeId: string;
    courseId: string;
    orderIndex: number;
}
export interface Enrollment {
    id: string;
    userId: string;
    courseId?: string | null;
    degreeId?: string | null;
    enrolledAt: Date | string;
    expiresAt?: Date | string | null;
    source: EnrollmentSource;
}
export interface Order {
    id: string;
    userId: string;
    type: OrderType;
    courseId?: string | null;
    degreeId?: string | null;
    amount: number;
    currency: string;
    status: OrderStatus;
    paymentMethod?: string | null;
    transactionId?: string | null;
    paidAt?: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}
export interface ProgressRecord {
    id: string;
    userId: string;
    courseId: string;
    lessonId: string;
    status: ProgressStatus;
    completedAt?: Date | string | null;
    lastPosition?: number | null;
    updatedAt: Date | string;
}
export interface Hackathon {
    id: string;
    title: string;
    description: string;
    bannerUrl?: string | null;
    status: HackathonStatus;
    startDate: Date | string;
    endDate: Date | string;
    registerDeadline?: Date | string | null;
    maxTeamSize: number;
    minTeamSize: number;
    location?: string | null;
    rules?: string | null;
    prizes?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}
export interface HackathonRegistration {
    id: string;
    hackathonId: string;
    userId: string;
    status: RegistrationStatus;
    registeredAt: Date | string;
    checkedInAt?: Date | string | null;
}
export interface Team {
    id: string;
    hackathonId: string;
    name: string;
    slogan?: string | null;
    captainId: string;
    createdAt: Date | string;
}
export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    role: TeamRole;
}
export interface Judge {
    id: string;
    hackathonId: string;
    userId?: string | null;
    name: string;
    title?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
}
export interface Submission {
    id: string;
    hackathonId: string;
    teamId?: string | null;
    userId?: string | null;
    title: string;
    description: string;
    demoUrl?: string | null;
    repoUrl?: string | null;
    videoUrl?: string | null;
    status: SubmissionStatus;
    score?: number | null;
    feedback?: string | null;
    submittedAt?: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}
export interface Announcement {
    id: string;
    hackathonId: string;
    title: string;
    content: string;
    isPinned: boolean;
    createdAt: Date | string;
}
export interface AuditLog {
    id: string;
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    details?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: Date | string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    user: User;
    accessToken: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
}
export interface RefreshTokenRequest {
    refreshToken: string;
}
export interface CreateCourseRequest {
    title: string;
    description: string;
    learningPoints: string;
    instructor: string;
    level: CourseLevel;
    duration: string;
    thumbnail: string;
    tags: string;
    costType: CostType;
    price: number;
    status?: CourseStatus;
}
export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
}
export interface CreateDegreeRequest {
    title: string;
    description: string;
    learningPoints: string;
    price: number;
    icon: string;
    costType: CostType;
    thumbnail?: string;
    status?: CourseStatus;
}
export interface UpdateDegreeRequest extends Partial<CreateDegreeRequest> {
}
export interface ApiResponse<T = any> {
    data?: T;
    message?: string;
    error?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
//# sourceMappingURL=index.d.ts.map