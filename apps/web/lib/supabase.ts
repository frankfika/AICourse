import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ocuiixrxzegbnatfmfay.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdWlpeHJ4emVnYm5hdGZtZmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODQzMjIsImV4cCI6MjA4MDI2MDMyMn0.qWldnUyzzEsIFFJEsKq9uJfuI6EwDk8Br4fJgOx23mo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'student';
  permissions: string[];
  degree_permissions: string[];
  created_at?: string;
  updated_at?: string;
}

export interface DbCourse {
  id: string;
  title: string;
  description: string;
  learning_points: string[];
  instructor: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  duration: string;
  video_duration?: number;
  thumbnail: string;
  tags: string[];
  cost_type: 'free' | 'paid' | 'charity';
  price: number;
  video_url?: string;
  resources?: { title: string; url: string; type: 'pdf' | 'code' | 'link' }[];
  created_at?: string;
  updated_at?: string;
}

export interface DbNanoDegree {
  id: string;
  title: string;
  description: string;
  learning_points: string[];
  courses: string[];
  price: number;
  icon: string;
  cost_type: 'free' | 'paid' | 'charity';
  thumbnail?: string;
  created_at?: string;
  updated_at?: string;
}
