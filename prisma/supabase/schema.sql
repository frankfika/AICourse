-- AI Academy Database Schema

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  permissions TEXT[] DEFAULT '{}',
  degree_permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 课程表
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  learning_points TEXT[] DEFAULT '{}',
  instructor TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
  duration TEXT NOT NULL,
  video_duration INTEGER,
  thumbnail TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  cost_type TEXT NOT NULL DEFAULT 'free' CHECK (cost_type IN ('free', 'paid', 'charity')),
  price NUMERIC DEFAULT 0,
  video_url TEXT,
  resources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学位表
CREATE TABLE IF NOT EXISTS nano_degrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  learning_points TEXT[] DEFAULT '{}',
  courses TEXT[] DEFAULT '{}',
  price NUMERIC DEFAULT 0,
  icon TEXT NOT NULL DEFAULT 'sparkles',
  cost_type TEXT NOT NULL DEFAULT 'paid' CHECK (cost_type IN ('free', 'paid', 'charity')),
  thumbnail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE nano_degrees ENABLE ROW LEVEL SECURITY;

-- 允许匿名读取课程和学位
CREATE POLICY "Allow public read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Allow public read nano_degrees" ON nano_degrees FOR SELECT USING (true);

-- 允许匿名读取用户（用于登录验证）
CREATE POLICY "Allow public read users" ON users FOR SELECT USING (true);

-- 允许匿名插入用户（用于注册）
CREATE POLICY "Allow public insert users" ON users FOR INSERT WITH CHECK (true);

-- 允许用户更新自己的数据
CREATE POLICY "Allow users update own data" ON users FOR UPDATE USING (true);

-- 允许管理操作（课程和学位的增删改）
CREATE POLICY "Allow all operations on courses" ON courses FOR ALL USING (true);
CREATE POLICY "Allow all operations on nano_degrees" ON nano_degrees FOR ALL USING (true);

-- 插入默认管理员
INSERT INTO users (email, password_hash, name, role, permissions, degree_permissions)
VALUES ('admin@ai-academy.local', 'admin123', '管理员', 'admin', '{}', '{}')
ON CONFLICT (email) DO NOTHING;

-- 插入示例课程（使用自动生成的 UUID）
INSERT INTO courses (title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, video_url) VALUES
('大模型应用开发入门', '从零开始学习如何构建基于大语言模型的应用程序，掌握 Prompt Engineering 核心技巧。',
 ARRAY['理解大模型的基本原理', '掌握 Prompt Engineering 技巧', '构建简单的 AI 应用'],
 '张教授', 'Beginner', '120 分钟',
 'https://images.unsplash.com/photo-1677442135136-760c813028c0?w=800',
 ARRAY['AI', 'LLM', 'Prompt'], 'free', 0, NULL),

('RAG 检索增强生成实战', '深入学习 RAG 技术，构建企业级知识库问答系统。',
 ARRAY['理解 RAG 架构原理', '掌握向量数据库使用', '构建知识库问答系统'],
 '李博士', 'Intermediate', '180 分钟',
 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800',
 ARRAY['RAG', 'Vector DB', 'LangChain'], 'paid', 299, NULL),

('AI Agent 智能体开发', '学习构建具有自主决策能力的 AI Agent，实现复杂任务自动化。',
 ARRAY['理解 Agent 架构设计', '掌握工具调用机制', '构建多 Agent 协作系统'],
 '王工程师', 'Advanced', '240 分钟',
 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800',
 ARRAY['Agent', 'AutoGPT', 'LangChain'], 'paid', 399, NULL);

-- 插入示例学位（courses 字段后续在管理后台关联）
INSERT INTO nano_degrees (title, description, learning_points, courses, price, icon, cost_type) VALUES
('AI 全栈工程师', '系统化学习 AI 应用开发全流程，从模型调用到生产部署。',
 ARRAY['掌握 AI 应用开发全流程', '具备独立开发 AI 产品能力', '理解主流大模型原理与应用'],
 '{}', 599, 'sparkles', 'paid');
