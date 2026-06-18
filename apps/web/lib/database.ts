import { supabase, DbUser, DbCourse, DbNanoDegree } from './supabase';
import { User, Course, NanoDegree, CostType, Resource } from '../types';

// ============ 转换函数 ============

// 数据库格式 → 前端格式
const dbUserToUser = (dbUser: DbUser): User => ({
  id: dbUser.id,
  email: dbUser.email,
  password: dbUser.password_hash,
  name: dbUser.name,
  role: dbUser.role,
  permissions: dbUser.permissions || [],
  degreePermissions: dbUser.degree_permissions || [],
});

const dbCourseToConourse = (dbCourse: DbCourse): Course => ({
  id: dbCourse.id,
  title: dbCourse.title,
  description: dbCourse.description,
  learningPoints: dbCourse.learning_points || [],
  instructor: dbCourse.instructor,
  level: dbCourse.level,
  duration: dbCourse.duration,
  videoDuration: dbCourse.video_duration,
  thumbnail: dbCourse.thumbnail,
  tags: dbCourse.tags || [],
  costType: dbCourse.cost_type as CostType,
  price: Number(dbCourse.price) || 0,
  videoUrl: dbCourse.video_url,
  resources: dbCourse.resources as Resource[],
});

const dbDegreeToNanoDegree = (dbDegree: DbNanoDegree): NanoDegree => ({
  id: dbDegree.id,
  title: dbDegree.title,
  description: dbDegree.description,
  learningPoints: dbDegree.learning_points || [],
  courses: dbDegree.courses || [],
  price: Number(dbDegree.price) || 0,
  icon: dbDegree.icon,
  costType: dbDegree.cost_type as CostType,
  thumbnail: dbDegree.thumbnail,
});

// 前端格式 → 数据库格式
const userToDbUser = (user: User, includeId = true): Partial<DbUser> => {
  const result: Partial<DbUser> = {
    email: user.email,
    password_hash: user.password,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    degree_permissions: user.degreePermissions || [],
  };
  if (includeId && user.id) {
    result.id = user.id;
  }
  return result;
};

const courseToDbCourse = (course: Course, includeId = true): Partial<DbCourse> => {
  const result: Partial<DbCourse> = {
    title: course.title,
    description: course.description,
    learning_points: course.learningPoints,
    instructor: course.instructor,
    level: course.level,
    duration: course.duration,
    video_duration: course.videoDuration,
    thumbnail: course.thumbnail,
    tags: course.tags,
    cost_type: course.costType,
    price: course.price,
    video_url: course.videoUrl,
    resources: course.resources as any,
  };
  if (includeId && course.id) {
    result.id = course.id;
  }
  return result;
};

const degreeToDbDegree = (degree: NanoDegree, includeId = true): Partial<DbNanoDegree> => {
  const result: Partial<DbNanoDegree> = {
    title: degree.title,
    description: degree.description,
    learning_points: degree.learningPoints,
    courses: degree.courses,
    price: degree.price,
    icon: degree.icon,
    cost_type: degree.costType,
    thumbnail: degree.thumbnail,
  };
  if (includeId && degree.id) {
    result.id = degree.id;
  }
  return result;
};

// ============ 用户操作 ============

export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return (data || []).map(dbUserToUser);
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !data) return null;
  return dbUserToUser(data);
};

export const createUser = async (user: User): Promise<User | null> => {
  const dbUser = userToDbUser(user, false); // 不传id，让数据库自动生成
  const { data, error } = await supabase
    .from('users')
    .insert(dbUser)
    .select()
    .single();
  if (error) {
    console.error('Error creating user:', error);
    return null;
  }
  return dbUserToUser(data);
};

export const updateUser = async (user: User): Promise<User | null> => {
  const dbUser = userToDbUser(user);
  const { data, error } = await supabase
    .from('users')
    .update(dbUser)
    .eq('id', user.id)
    .select()
    .single();
  if (error) {
    console.error('Error updating user:', error);
    return null;
  }
  return dbUserToUser(data);
};

// ============ 课程操作 ============

export const getCourses = async (): Promise<Course[]> => {
  const { data, error } = await supabase.from('courses').select('*');
  if (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
  return (data || []).map(dbCourseToConourse);
};

export const getCourseById = async (id: string): Promise<Course | null> => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return dbCourseToConourse(data);
};

export const createCourse = async (course: Course): Promise<Course | null> => {
  const dbCourse = courseToDbCourse(course, false); // 不传id，让数据库自动生成
  const { data, error } = await supabase
    .from('courses')
    .insert(dbCourse)
    .select()
    .single();
  if (error) {
    console.error('Error creating course:', error);
    return null;
  }
  return dbCourseToConourse(data);
};

export const updateCourse = async (course: Course): Promise<Course | null> => {
  const dbCourse = courseToDbCourse(course);
  const { data, error } = await supabase
    .from('courses')
    .update(dbCourse)
    .eq('id', course.id)
    .select()
    .single();
  if (error) {
    console.error('Error updating course:', error);
    return null;
  }
  return dbCourseToConourse(data);
};

export const deleteCourse = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) {
    console.error('Error deleting course:', error);
    return false;
  }
  return true;
};

// ============ 学位操作 ============

export const getNanoDegrees = async (): Promise<NanoDegree[]> => {
  const { data, error } = await supabase.from('nano_degrees').select('*');
  if (error) {
    console.error('Error fetching nano degrees:', error);
    return [];
  }
  return (data || []).map(dbDegreeToNanoDegree);
};

export const getNanoDegreeById = async (id: string): Promise<NanoDegree | null> => {
  const { data, error } = await supabase
    .from('nano_degrees')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return dbDegreeToNanoDegree(data);
};

export const createNanoDegree = async (degree: NanoDegree): Promise<NanoDegree | null> => {
  const dbDegree = degreeToDbDegree(degree, false); // 不传id，让数据库自动生成
  const { data, error } = await supabase
    .from('nano_degrees')
    .insert(dbDegree)
    .select()
    .single();
  if (error) {
    console.error('Error creating nano degree:', error);
    return null;
  }
  return dbDegreeToNanoDegree(data);
};

export const updateNanoDegree = async (degree: NanoDegree): Promise<NanoDegree | null> => {
  const dbDegree = degreeToDbDegree(degree);
  const { data, error } = await supabase
    .from('nano_degrees')
    .update(dbDegree)
    .eq('id', degree.id)
    .select()
    .single();
  if (error) {
    console.error('Error updating nano degree:', error);
    return null;
  }
  return dbDegreeToNanoDegree(data);
};

export const deleteNanoDegree = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('nano_degrees').delete().eq('id', id);
  if (error) {
    console.error('Error deleting nano degree:', error);
    return false;
  }
  return true;
};
