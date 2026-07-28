import api from './api';

export interface InstructorExpertise {
  id: string;
  key: string;
  label: string;
}

export interface InstructorSummary {
  id: string;
  slug: string;
  name: string;
  nameEn?: string | null;
  title?: string | null;
  headline?: string | null;
  avatarUrl?: string | null;
  company?: string | null;
  yearsOfExperience?: number | null;
  expertiseLinks: Array<{ expertise: InstructorExpertise }>;
  _count: { courseLinks: number };
}

export interface InstructorDetail extends InstructorSummary {
  titleEn?: string | null;
  headlineEn?: string | null;
  bio?: string | null;
  bioEn?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  twitterUrl?: string | null;
  websiteUrl?: string | null;
  courseLinks: Array<{
    id: string;
    role: 'instructor' | 'mentor';
    isPrimary: boolean;
    course: {
      id: string;
      title: string;
      thumbnail?: string | null;
      level: string;
      duration: string;
      costType: 'free' | 'paid' | 'charity';
      status: 'draft' | 'published' | 'archived';
      instructor: string;
    };
  }>;
}

export interface InstructorStats {
  instructorId: string;
  name: string;
  courseCount: number;
  studentCount: number;
  completionRate: number;
  averageRating: number;
  reviewCount: number;
}

export interface InstructorListResponse {
  items: InstructorSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const instructorsApi = {
  async list(params: { search?: string; page?: number; limit?: number; sort?: 'orderIndex' | 'name' | 'recent' } = {}) {
    const { data } = await api.get<InstructorListResponse>('/api/v1/instructors', { params });
    return data;
  },

  async getBySlug(slug: string) {
    const { data } = await api.get<InstructorDetail>(`/api/v1/instructors/${encodeURIComponent(slug)}`);
    return data;
  },

  async getStats(id: string) {
    const { data } = await api.get<InstructorStats>(`/api/v1/instructors/${id}/stats`);
    return data;
  },
};
