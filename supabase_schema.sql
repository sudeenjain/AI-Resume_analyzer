-- Supabase Schema for AI Resume Architect

-- Users table (handled by Supabase Auth, but we can have a profile table)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Profiles
CREATE TABLE IF NOT EXISTS github_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  username TEXT NOT NULL,
  raw_data JSONB,
  insights JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, username)
);

-- LinkedIn Profiles
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  raw_data JSONB,
  parsed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resumes
CREATE TABLE IF NOT EXISTS resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  target_company TEXT,
  target_role TEXT,
  content JSONB, -- The structured resume content
  latex_code TEXT,
  ats_score INTEGER,
  ats_breakdown JSONB,
  pdf_url TEXT,
  docx_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Descriptions
CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resume_id UUID REFERENCES resumes ON DELETE CASCADE,
  adzuna_data JSONB,
  keywords JSONB,
  raw_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for demo)
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view their own github profiles" ON github_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own linkedin profiles" ON linkedin_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own resumes" ON resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own job descriptions" ON job_descriptions FOR SELECT USING (auth.uid() = (SELECT user_id FROM resumes WHERE id = resume_id));
