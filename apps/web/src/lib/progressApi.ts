import { api } from './api';
import type { CourseProgress, LearningStats } from '@opencsg/shared-types';

export interface CompleteLessonResponse {
  record: any;
  courseProgress: CourseProgress;
  pointsAwarded: number;
  newlyUnlockedBadges: { badgeId: string; name: string; pointsAwarded: number }[];
}

export const progressApi = {
  getMyProgress: async () => {
    const response = await api.get('/api/v1/progress/me');
    return response.data;
  },

  getMyStats: async (): Promise<LearningStats> => {
    const response = await api.get('/api/v1/progress/me/stats');
    return response.data;
  },

  getCourseProgress: async (courseId: string): Promise<CourseProgress> => {
    const response = await api.get(`/api/v1/progress/courses/${courseId}`);
    return response.data;
  },

  completeLesson: async (lessonId: string): Promise<CompleteLessonResponse> => {
    const response = await api.post(`/api/v1/progress/lessons/${lessonId}/complete`);
    return response.data;
  },
};
