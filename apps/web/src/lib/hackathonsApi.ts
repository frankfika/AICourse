import api from '../lib/api';
import type {
  Hackathon,
  HackathonListItem,
  HackathonWithDetails,
  HackathonRegistration,
  Team,
  Submission,
  Announcement,
  CreateHackathonRequest,
  UpdateHackathonRequest,
  CreateTeamRequest,
  CreateSubmissionRequest,
  UpdateSubmissionRequest,
  CreateAnnouncementRequest,
  JudgeSubmissionRequest,
} from '@opencsg/shared-types';

const PREFIX = '/api/v1/hackathons';

export const hackathonsApi = {
  getAll: async (params?: { status?: string; search?: string }): Promise<HackathonListItem[]> => {
    const { data } = await api.get(PREFIX, { params });
    return data;
  },

  getById: async (id: string): Promise<HackathonWithDetails> => {
    const { data } = await api.get(`${PREFIX}/${id}`);
    return data;
  },

  create: async (payload: CreateHackathonRequest): Promise<Hackathon> => {
    const { data } = await api.post(PREFIX, payload);
    return data;
  },

  update: async (id: string, payload: UpdateHackathonRequest): Promise<Hackathon> => {
    const { data } = await api.patch(`${PREFIX}/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`${PREFIX}/${id}`);
    return data;
  },

  register: async (id: string): Promise<HackathonRegistration> => {
    const { data } = await api.post(`${PREFIX}/${id}/register`);
    return data;
  },

  cancelRegistration: async (id: string): Promise<HackathonRegistration> => {
    const { data } = await api.post(`${PREFIX}/${id}/cancel`);
    return data;
  },

  getMyRegistration: async (id: string): Promise<HackathonRegistration | null> => {
    const { data } = await api.get(`${PREFIX}/${id}/my-registration`);
    return data;
  },

  getAnnouncements: async (id: string): Promise<Announcement[]> => {
    const { data } = await api.get(`${PREFIX}/${id}/announcements`);
    return data;
  },

  createAnnouncement: async (id: string, payload: CreateAnnouncementRequest): Promise<Announcement> => {
    const { data } = await api.post(`${PREFIX}/${id}/announcements`, payload);
    return data;
  },

  getTeams: async (id: string): Promise<Team[]> => {
    const { data } = await api.get(`${PREFIX}/${id}/teams`);
    return data;
  },

  createTeam: async (id: string, payload: CreateTeamRequest): Promise<Team> => {
    const { data } = await api.post(`${PREFIX}/${id}/teams`, payload);
    return data;
  },

  joinTeam: async (id: string, teamId: string): Promise<{ message: string }> => {
    const { data } = await api.post(`${PREFIX}/${id}/teams/${teamId}/join`);
    return data;
  },

  leaveTeam: async (id: string, teamId: string): Promise<{ message: string }> => {
    const { data } = await api.post(`${PREFIX}/${id}/teams/${teamId}/leave`);
    return data;
  },

  getMySubmissions: async (id: string): Promise<Submission[]> => {
    const { data } = await api.get(`${PREFIX}/${id}/submissions`);
    return data;
  },

  getAllSubmissions: async (id: string): Promise<Submission[]> => {
    const { data } = await api.get(`${PREFIX}/${id}/submissions/all`);
    return data;
  },

  createSubmission: async (id: string, payload: CreateSubmissionRequest): Promise<Submission> => {
    const { data } = await api.post(`${PREFIX}/${id}/submissions`, payload);
    return data;
  },

  updateSubmission: async (
    id: string,
    submissionId: string,
    payload: UpdateSubmissionRequest,
  ): Promise<Submission> => {
    const { data } = await api.patch(`${PREFIX}/${id}/submissions/${submissionId}`, payload);
    return data;
  },

  judgeSubmission: async (
    id: string,
    submissionId: string,
    payload: JudgeSubmissionRequest,
  ): Promise<Submission> => {
    const { data } = await api.post(`${PREFIX}/${id}/submissions/${submissionId}/judge`, payload);
    return data;
  },
};
