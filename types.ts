import React from 'react';

export type CostType = 'free' | 'paid' | 'charity';

export interface Resource {
  title: string;
  url: string;
  type: 'pdf' | 'code' | 'link';
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'student';
  permissions: string[]; // List of Course IDs that the user has access to
  degreePermissions?: string[]; // List of Degree IDs that the user has purchased
}

export interface Course {
  id: string;
  title: string;
  description: string;
  learningPoints: string[];
  instructor: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  duration: string;
  videoDuration?: number;
  thumbnail: string;
  tags: string[];
  // New fields
  costType: CostType;
  price: number; // 0 if free/charity
  videoUrl?: string; // Embed URL
  resources?: Resource[];
}

export interface NanoDegree {
  id: string;
  title: string;
  description: string;
  learningPoints: string[];
  courses: string[]; // List of Course IDs
  price: number;
  icon: string; // Identifier for icon map (e.g. 'shield', 'sparkles')
  costType: CostType;
}

export enum ViewState {
  HOME = 'HOME',
  ALL_DEGREES = 'ALL_DEGREES',
  ALL_COURSES = 'ALL_COURSES',
  COURSE_DETAIL = 'COURSE_DETAIL',
  NANO_DEGREE = 'NANO_DEGREE',
  HACKATHON = 'HACKATHON',
  ADMIN = 'ADMIN',
  PROFILE = 'PROFILE'
}