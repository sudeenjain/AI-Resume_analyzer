import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from './lib/supabase';
import {
  Github,
  Linkedin,
  FileText,
  Target,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronRight,
  Search,
  Briefcase,
  Trophy,
  Code,
  User,
  Layout,
  Upload,
  FileUp,
  Sun,
  Moon,
  Plus,
  Trash2,
  Edit3,
  Save,
  X
} from 'lucide-react';

// --- Types ---

interface GitHubInsights {
  summary: string;
  strengths: string[];
  projectHighlights: string[];
  evidence: string;
}

interface LinkedInData {
  fullName: string;
  headline: string;
  experience: any[];
  education: any[];
  skills: string[];
}

interface ResumeContent {
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
  };
  summary: string;
  experience: any[];
  projects: any[];
  skills: {
    technical: string[];
    soft: string[];
  };
  education: any[];
  certifications?: string[];
  achievements?: string[];
}

interface ATSScore {
  score: number;
  breakdown: Record<string, number>;
  suggestions: string[];
  missingKeywords: string[];
  gapAnalysis?: {
    missing: string[];
    weak: string[];
  };
}

// --- Constants ---

const ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Mobile Developer",
  "DevOps Engineer",
  "Data Scientist",
  "Product Manager",
  "UI/UX Designer",
  "QA Engineer",
  "Security Engineer"
];

// --- AI Service ---

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not found. Please set it in the Secrets panel.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Components ---

const LoadingOverlay = ({ message, isVisible }: { message: string, isVisible: boolean }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors"
      >
        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute w-24 h-24 bg-indigo-500/20 dark:bg-indigo-400/20 rounded-full animate-ping" />
          <div className="relative w-16 h-16 bg-indigo-600 dark:bg-indigo-500 rounded-2xl shadow-xl flex items-center justify-center">
            <RefreshCw className="text-white animate-spin" size={32} />
          </div>
        </div>
        <div
          aria-live="polite"
          className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight text-center px-6"
        >
          {message}
        </div>
        <div className="mt-4 flex space-x-1">
          <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = ['Extract', 'Analyze', 'Target', 'Generate'];
  return (
    <div className="flex items-center justify-center space-x-4 mb-12">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div className={`flex items-center space-x-2 ${i <= currentStep ? 'text-indigo-600' : 'text-gray-400 dark:text-slate-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${i <= currentStep ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-slate-700'}`}>
              {i < currentStep ? <CheckCircle2 size={16} /> : <span>{i + 1}</span>}
            </div>
            <span className="font-medium hidden sm:block">{step}</span>
          </div>
          {i < steps.length - 1 && <ChevronRight className="text-gray-300 dark:text-slate-700" size={16} />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Data State
  const [githubUsername, setGithubUsername] = useState('');
  const [githubData, setGithubData] = useState<any>(null);
  const [linkedinData, setLinkedinData] = useState<LinkedInData | null>(null);
  const [linkedinPdfBase64, setLinkedinPdfBase64] = useState<string | null>(null);
  const [targetJob, setTargetJob] = useState({ company: '', role: '' });
  const [jobKeywords, setJobKeywords] = useState<string[]>([]);
  const [resume, setResume] = useState<ResumeContent | null>(null);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const [experienceStatus, setExperienceStatus] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [manualExperience, setManualExperience] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showManualExpForm, setShowManualExpForm] = useState(false);
  const [showSkillExpForm, setShowSkillExpForm] = useState(false);
  const [showGapAnalysis, setShowGapAnalysis] = useState(false);
  const [gapResponse, setGapResponse] = useState<'yes' | 'no' | null>(null);
  const [manualSkillExperience, setManualSkillExperience] = useState<any[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const resumeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // --- Handlers ---

  const handleAnalyzeProfile = async () => {
    if (!githubUsername && !linkedinPdfBase64 && !linkedinData) {
      alert("Please provide at least a GitHub username or a LinkedIn PDF.");
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    try {
      const ai = getAI();
      let githubInsights = null;
      let extractedLinkedinData = linkedinData;

      // 1. Analyze GitHub if username provided
      if (githubUsername) {
        setLoadingMessage("Fetching GitHub repositories...");
        const githubRes = await fetch('/api/github/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: githubUsername })
        });

        const githubData = await githubRes.json();

        if (!githubRes.ok) {
          throw new Error(githubData.error || `GitHub Error: ${githubRes.status}`);
        }

        setLoadingMessage("Analyzing technical profile...");
        const rawData = githubData;
        const githubPrompt = `Analyze this GitHub profile for a resume:
          User: ${rawData.username}
          Bio: ${rawData.user.bio}
          Public Repos: ${rawData.user.public_repos}
          Top Languages: ${rawData.topLanguages.join(", ")}
          Total Stars: ${rawData.totalStars}
          Recent Repos: ${rawData.repos.slice(0, 5).map((r: any) => `${r.name}: ${r.description}`).join("; ")}
          
          Return a JSON object with:
          - summary: A professional 1-sentence summary of their technical profile.
          - strengths: Array of 3 key technical strengths based on their repos.
          - projectHighlights: Array of 2 projects that seem most impressive.
          - evidence: A string like "Strong in Python — 8 repos over 2 years"`;

        const githubModel = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: githubPrompt,
          config: { responseMimeType: "application/json" }
        });

        githubInsights = { ...rawData, insights: JSON.parse(githubModel.text || "{}") };
        setGithubData(githubInsights);
      }

      // 2. Analyze LinkedIn PDF if provided
      if (linkedinPdfBase64) {
        setLoadingMessage("Parsing LinkedIn PDF...");
        const linkedinPrompt = `Extract professional information from this LinkedIn Resume PDF. 
        Return a JSON object with:
        - fullName: string
        - headline: string
        - experience: array of { title, company, duration, description }
        - education: array of { school, degree, date }
        - skills: array of strings`;

        const linkedinResult = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: linkedinPdfBase64
              }
            },
            { text: linkedinPrompt }
          ],
          config: { responseMimeType: "application/json" }
        });

        extractedLinkedinData = JSON.parse(linkedinResult.text || "{}");
        setLinkedinData(extractedLinkedinData);
      }

      if (!githubInsights && !extractedLinkedinData) {
        throw new Error("Failed to extract data from provided sources.");
      }

      // Check for experience
      const hasExp = (extractedLinkedinData?.experience && extractedLinkedinData.experience.length > 0);
      setExperienceStatus(hasExp ? 'yes' : 'unknown');

      // Ensure minimum display time
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

      setStep(1);
    } catch (err: any) {
      console.error(err);
      alert(`Analysis Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const searchJobs = async () => {
    setLoading(true);
    setLoadingMessage("Matching job requirements...");
    const startTime = Date.now();
    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetJob)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Job Search Error: ${res.status}`);
      }

      const jobs = data.jobs;

      if (jobs.length > 0) {
        const ai = getAI();
        const jd = jobs[0].description;
        const prompt = `Extract the top 10 technical and soft skill keywords from this job description: "${jd}". Return a JSON array of strings.`;
        const model = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const keywords = JSON.parse(model.text || "[]");
        setJobKeywords(keywords);
      } else {
        setJobKeywords(["React", "TypeScript", "Node.js", "API Design", "Cloud Computing"]);
      }

      // Ensure minimum display time
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

      setStep(3);
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const generateResume = async () => {
    setLoading(true);
    setLoadingMessage("Structuring resume data...");
    const startTime = Date.now();
    try {
      const ai = getAI();
      const prompt = `You are a professional ATS-compliant resume generation engine.
      
      INPUT DATA:
      - GITHUB: ${JSON.stringify(githubData?.insights || {})}
      - LINKEDIN: ${JSON.stringify(linkedinData || {})}
      - MANUAL EXPERIENCE: ${JSON.stringify(manualExperience)}
      - MANUAL SKILL EXPERIENCE: ${JSON.stringify(manualSkillExperience)}
      - TARGET: ${targetJob.role} at ${targetJob.company}
      - JOB KEYWORDS: ${jobKeywords.join(", ")}
      
      TASK:
      1. DATA NORMALIZATION: Extract and structure all relevant information. Remove duplicates. Clean formatting. Do NOT fabricate information.
      2. CONDITIONAL EXPERIENCE: 
         - If experience exists (LinkedIn or Manual), include EXPERIENCE section. Sort reverse-chronological.
         - If NO experience exists, do NOT create EXPERIENCE section. Move PROJECTS above EDUCATION.
      3. PROJECT RANKING: Rank GitHub projects by pinned, recent updates, stars, and complexity. Sort reverse-chronological.
         - Each bullet: Action + Technology + Impact. Do NOT invent metrics.
      4. STRICT SECTION ORDER:
         - HEADER
         - SUMMARY
         - SKILLS
         - EXPERIENCE (if exists)
         - PROJECTS
         - EDUCATION
         - CERTIFICATIONS (if exists)
         - ACHIEVEMENTS (if exists)
      5. ATS OPTIMIZATION:
         - Use bullet points and strong action verbs.
         - No generic phrases.
         - Plain text focus, no tables, no icons, no special characters.
         - Max 1 page for students.
      
      Return a JSON object:
      {
        "contact": { "name": "...", "email": "...", "phone": "...", "location": "...", "linkedin": "...", "github": "..." },
        "summary": "...",
        "skills": { "technical": ["..."], "soft": ["..."] },
        "experience": [ { "title": "...", "company": "...", "duration": "...", "bullets": ["..."] } ],
        "projects": [ { "name": "...", "description": "...", "techStack": ["..."], "link": "...", "bullets": ["..."] } ],
        "education": [ { "school": "...", "degree": "...", "year": "..." } ],
        "certifications": ["..."],
        "achievements": ["..."]
      }`;

      const model = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const resumeData = JSON.parse(model.text || "{}");
      setResume(resumeData);

      // Score it immediately
      setLoadingMessage("Optimizing ATS keywords...");
      const scorePrompt = `Score this resume against these job keywords: ${jobKeywords.join(", ")}.
      Resume Content: ${JSON.stringify(resumeData)}
      
      Scoring Criteria (Total 100):
      - Keyword match (40)
      - Section completeness (20)
      - Formatting friendliness (20)
      - Quantified achievements (10)
      - Action verbs (10)
      
      GAP ANALYSIS TASK:
      1. Compare the resume against the job requirements.
      2. Identify missing or weak skills, tools, and responsibilities.
      3. Categorize them as "missing" or "weak".
      
      Return a JSON object:
      {
        "score": number,
        "breakdown": { "keywords": number, "completeness": number, "formatting": number, "achievements": number, "verbs": number },
        "suggestions": string[],
        "missingKeywords": string[],
        "gapAnalysis": {
          "missing": ["..."],
          "weak": ["..."]
        }
      }`;

      const scoreModel = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: scorePrompt,
        config: { responseMimeType: "application/json" }
      });

      const scoreData = JSON.parse(scoreModel.text || "{}");
      setAtsScore(scoreData);

      // Ensure minimum display time
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const optimizeResume = async () => {
    if (!resume) return;
    setIsOptimizing(true);
    setLoadingMessage("Optimizing ATS keywords...");
    const startTime = Date.now();
    try {
      const ai = getAI();
      const prompt = `You are an ATS resume optimization engine.
      
      CURRENT RESUME: ${JSON.stringify(resume)}
      TARGET JOB: ${targetJob.role} at ${targetJob.company}
      JOB KEYWORDS: ${jobKeywords.join(", ")}
      MISSING KEYWORDS: ${JSON.stringify(atsScore?.missingKeywords || [])}
      MANUAL SKILL EXPERIENCE: ${JSON.stringify(manualSkillExperience)}
      
      TASK:
      1. Analyze the job requirements and missing keywords.
      2. Rewrite the resume to naturally include missing keywords.
      3. Strengthen bullet points using measurable impact (Action + Tech + Result).
      4. Improve professional tone and maintain reverse-chronological order.
      5. Ensure ATS-friendly formatting (plain text focus).
      6. Do NOT fabricate fake experience or invent metrics.
      
      Return a JSON object in the same structure as the input resume.`;

      const model = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const optimizedData = JSON.parse(model.text || "{}");
      setResume(optimizedData);

      // Re-score
      setLoadingMessage("Finalizing resume...");
      const scorePrompt = `Score this resume against these job keywords: ${jobKeywords.join(", ")}.
      Resume Content: ${JSON.stringify(optimizedData)}
      
      GAP ANALYSIS TASK:
      1. Compare the resume against the job requirements.
      2. Identify missing or weak skills, tools, and responsibilities.
      3. Categorize them as "missing" or "weak".
      
      Return a JSON object:
      {
        "score": number,
        "breakdown": { "keywords": number, "completeness": number, "formatting": number, "achievements": number, "verbs": number },
        "suggestions": string[],
        "missingKeywords": string[],
        "gapAnalysis": {
          "missing": ["..."],
          "weak": ["..."]
        }
      }`;

      const scoreModel = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: scorePrompt,
        config: { responseMimeType: "application/json" }
      });

      const scoreData = JSON.parse(scoreModel.text || "{}");
      setAtsScore(scoreData);

      // Ensure minimum display time
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));
    } catch (err: any) {
      console.error(err);
      alert(`Optimization Error: ${err.message}`);
    } finally {
      setIsOptimizing(false);
      setLoadingMessage('');
    }
  };
  const downloadPDF = async () => {
    if (!resumeRef.current) return;
    setIsDownloadingPdf(true);
    try {
      const canvas = await html2canvas(resumeRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Force hex colors for common classes to avoid oklch issues in html2canvas
          const elements = clonedDoc.querySelectorAll('.pdf-compatible, .pdf-compatible *');
          elements.forEach((el: any) => {
            // Force standard colors to avoid oklch parsing errors
            if (el.classList.contains('text-slate-900')) el.style.color = '#0f172a';
            if (el.classList.contains('text-slate-800')) el.style.color = '#1e293b';
            if (el.classList.contains('text-slate-600')) el.style.color = '#475569';
            if (el.classList.contains('text-indigo-600')) el.style.color = '#4f46e5';
            if (el.classList.contains('border-slate-200')) el.style.borderColor = '#e2e8f0';
            if (el.classList.contains('bg-white')) el.style.backgroundColor = '#ffffff';

            // Remove any potential oklch from inline styles if they exist
            const inlineStyle = el.getAttribute('style') || '';
            if (inlineStyle.includes('oklch')) {
              el.setAttribute('style', inlineStyle.replace(/oklch\([^)]+\)/g, '#000000'));
            }
          });

          // Also try to strip oklch from any style tags in the cloned doc
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach(tag => {
            if (tag.innerHTML.includes('oklch')) {
              tag.innerHTML = tag.innerHTML.replace(/oklch\([^)]+\)/g, '#000000');
            }
          });
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${targetJob.company || 'My'}_Resume.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const copyToClipboard = () => {
    if (!resume) return;

    let text = `${resume.contact.name.toUpperCase()}\n`;
    text += `${resume.contact.email} | ${resume.contact.location}\n`;
    if (resume.contact.linkedin) text += `LinkedIn: ${resume.contact.linkedin}\n`;
    if (resume.contact.github) text += `GitHub: ${resume.contact.github}\n\n`;

    text += `SUMMARY\n${resume.summary}\n\n`;

    text += `SKILLS\nTechnical: ${resume.skills.technical.join(', ')}\n`;
    text += `Soft: ${resume.skills.soft.join(', ')}\n\n`;

    if (resume.experience && resume.experience.length > 0) {
      text += `EXPERIENCE\n`;
      resume.experience.forEach(exp => {
        text += `${exp.title} | ${exp.company} | ${exp.duration}\n`;
        exp.bullets.forEach((b: string) => text += `• ${b}\n`);
        text += `\n`;
      });
    }

    text += `PROJECTS\n`;
    resume.projects.forEach(proj => {
      text += `${proj.name} | ${proj.techStack?.join(', ')}\n`;
      text += `${proj.description}\n`;
      proj.bullets?.forEach((b: string) => text += `• ${b}\n`);
      text += `\n`;
    });

    text += `EDUCATION\n`;
    resume.education.forEach(edu => {
      text += `${edu.degree} | ${edu.school} | ${edu.year}\n`;
    });

    if (resume.certifications && resume.certifications.length > 0) {
      text += `\nCERTIFICATIONS\n${resume.certifications.join('\n')}\n`;
    }

    if (resume.achievements && resume.achievements.length > 0) {
      text += `\nACHIEVEMENTS\n${resume.achievements.join('\n')}\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const downloadWord = async () => {
    if (!resume) return;
    setIsDownloadingWord(true);
    try {
      const res = await fetch('/api/resume/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${targetJob.company || 'My'}_Resume.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate Word document");
      }
    } catch (err: any) {
      console.error("Word generation failed:", err);
      alert(err.message);
    } finally {
      setIsDownloadingWord(false);
    }
  };

  // Mock LinkedIn data for demo if extension not used
  const useMockLinkedin = () => {
    setLinkedinData({
      fullName: "Alex Rivera",
      headline: "Senior Full Stack Engineer | React & Node.js Expert",
      experience: [
        { title: "Senior Software Engineer", company: "TechCorp", duration: "2021 - Present", description: "Leading the frontend team in building scalable web applications." },
        { title: "Software Engineer", company: "StartUp Inc", duration: "2018 - 2021", description: "Developed core features for a high-traffic e-commerce platform." }
      ],
      education: [{ school: "University of Technology", degree: "B.S. Computer Science", date: "2014 - 2018" }],
      skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS", "Docker"]
    });
  };

  const handlePdfSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setLinkedinPdfBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors ${darkMode ? 'dark' : ''}`}>
      <LoadingOverlay message={loadingMessage} isVisible={loading || isOptimizing} />
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-6 sticky top-0 z-10 transition-colors">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Layout className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight dark:text-white">Resume Architect</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <StepIndicator currentStep={step} />

        <AnimatePresence mode="wait">
          {/* Step 0: Data Extraction */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold dark:text-white">Let's build your profile</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">We'll analyze your GitHub and LinkedIn to gather the evidence needed for a high-impact resume.</p>
              </div>

              <div className="max-w-2xl mx-auto w-full">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-8 transition-colors">
                  <div className="space-y-6">
                    {/* GitHub Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-900 dark:bg-slate-800 p-2 rounded-lg">
                          <Github className="text-white" size={20} />
                        </div>
                        <h3 className="text-lg font-semibold dark:text-white">GitHub Profile</h3>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          placeholder="GitHub Username (e.g. janesmith)"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                          value={githubUsername}
                          onChange={(e) => setGithubUsername(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-slate-900 px-4 text-slate-400 dark:text-slate-500 font-bold">And</span>
                      </div>
                    </div>

                    {/* LinkedIn Section */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-[#0a66c2] p-2 rounded-lg">
                          <Linkedin className="text-white" size={20} />
                        </div>
                        <h3 className="text-lg font-semibold dark:text-white">LinkedIn Resume</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="relative">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            id="pdf-upload"
                            onChange={handlePdfSelection}
                          />
                          <label
                            htmlFor="pdf-upload"
                            className={`flex items-center justify-center space-x-2 w-full py-3 px-4 rounded-xl font-medium cursor-pointer transition-all border ${linkedinPdfBase64 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                          >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : (linkedinPdfBase64 ? <CheckCircle2 size={18} /> : <FileUp size={18} />)}
                            <span>{loading ? 'Processing...' : (linkedinPdfBase64 ? 'PDF Selected' : 'Upload PDF')}</span>
                          </label>
                        </div>

                        <button
                          onClick={useMockLinkedin}
                          className={`flex items-center justify-center space-x-2 w-full py-3 px-4 rounded-xl font-medium transition-all border ${linkedinData ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                          {linkedinData ? <CheckCircle2 size={18} /> : null}
                          <span>{linkedinData ? 'Demo Data Active' : 'Use Demo Data'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAnalyzeProfile}
                    disabled={loading || (!githubUsername && !linkedinPdfBase64 && !linkedinData)}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-50 transition-all flex items-center justify-center space-x-3 text-lg"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={24} /> : <><Search size={24} /><span>Analyze My Profile</span></>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 1: Evidence Page */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold dark:text-white">Technical Evidence</h2>
                  <p className="text-slate-500 dark:text-slate-400">Comprehensive analysis of your professional footprint.</p>
                </div>
                <button
                  onClick={() => {
                    if (experienceStatus === 'unknown') {
                      // Do nothing, wait for user choice
                    } else {
                      setStep(2);
                    }
                  }}
                  disabled={experienceStatus === 'unknown'}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
                >
                  Looks Good, Continue
                </button>
              </div>

              {experienceStatus === 'unknown' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400">
                    <AlertCircle size={24} />
                    <h3 className="text-lg font-bold">Work Experience Check</h3>
                  </div>
                  <p className="text-amber-800 dark:text-amber-300">We couldn't find any professional experience in your profile. Do you have any work experience in any company?</p>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setExperienceStatus('yes')}
                      className="bg-amber-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-amber-700 transition-all"
                    >
                      Yes, I have experience
                    </button>
                    <button
                      onClick={() => setExperienceStatus('no')}
                      className="bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-6 py-2 rounded-lg font-medium hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
                    >
                      No, I'm a student/fresher
                    </button>
                  </div>
                </div>
              )}

              {experienceStatus === 'yes' && (linkedinData?.experience?.length === 0 || !linkedinData?.experience) && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6 transition-colors">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold dark:text-white">Add Professional Experience</h3>
                    <button
                      onClick={() => setShowManualExpForm(true)}
                      className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center space-x-1"
                    >
                      <Plus size={18} />
                      <span>Add Entry</span>
                    </button>
                  </div>

                  {manualExperience.length > 0 ? (
                    <div className="space-y-4">
                      {manualExperience.map((exp, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                          <div>
                            <p className="font-bold dark:text-white">{exp.title}</p>
                            <p className="text-sm text-slate-500">{exp.company} • {exp.duration}</p>
                          </div>
                          <button
                            onClick={() => setManualExperience(manualExperience.filter((_, idx) => idx !== i))}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-8 italic">No experience added yet. Click "Add Entry" to begin.</p>
                  )}
                </div>
              )}

              {showSkillExpForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6"
                  >
                    <h3 className="text-2xl font-bold dark:text-white">Skill Experience Details</h3>
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Skill / Tool (e.g. AWS, Docker)"
                        id="skill-name"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Where was this used? (Company/Project)"
                        id="skill-company"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Duration (e.g. 6 months)"
                        id="skill-duration"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                      <textarea
                        placeholder="How did you use this? (Description)"
                        id="skill-desc"
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                    </div>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => {
                          const skill = (document.getElementById('skill-name') as HTMLInputElement).value;
                          const company = (document.getElementById('skill-company') as HTMLInputElement).value;
                          const duration = (document.getElementById('skill-duration') as HTMLInputElement).value;
                          const desc = (document.getElementById('skill-desc') as HTMLTextAreaElement).value;

                          if (skill && company) {
                            setManualSkillExperience([...manualSkillExperience, { skill, company, duration, desc }]);
                            setShowSkillExpForm(false);
                          }
                        }}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700"
                      >
                        Add Skill
                      </button>
                      <button
                        onClick={() => setShowSkillExpForm(false)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {showManualExpForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6"
                  >
                    <h3 className="text-2xl font-bold dark:text-white">Experience Details</h3>
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Company Name"
                        id="exp-company"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Role / Title"
                        id="exp-title"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Duration (e.g. 2021 - Present)"
                          id="exp-duration"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                      </div>
                      <textarea
                        placeholder="Responsibilities (Bullet points)"
                        id="exp-bullets"
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                    </div>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => {
                          const company = (document.getElementById('exp-company') as HTMLInputElement).value;
                          const title = (document.getElementById('exp-title') as HTMLInputElement).value;
                          const duration = (document.getElementById('exp-duration') as HTMLInputElement).value;
                          const bullets = (document.getElementById('exp-bullets') as HTMLTextAreaElement).value.split('\n').filter(b => b.trim());

                          if (company && title) {
                            setManualExperience([...manualExperience, { company, title, duration, bullets }]);
                            setShowManualExpForm(false);
                          }
                        }}
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700"
                      >
                        Add Experience
                      </button>
                      <button
                        onClick={() => setShowManualExpForm(false)}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Summary Card */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                    <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">AI Profile Summary</h3>
                    <p className="text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed italic">
                      "{githubData?.insights?.summary || linkedinData?.headline || 'Analyzing your professional background...'}"
                    </p>
                  </div>

                  {/* Skills & Strengths */}
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
                      <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                        <Trophy size={20} />
                        <h4 className="font-bold">Key Strengths</h4>
                      </div>
                      <ul className="space-y-3">
                        {(githubData?.insights?.strengths || linkedinData?.skills?.slice(0, 5) || []).map((s: string, i: number) => (
                          <li key={i} className="flex items-start space-x-2 text-slate-600 dark:text-slate-400 text-sm">
                            <CheckCircle2 className="text-green-500 mt-0.5 shrink-0" size={16} />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
                      <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                        <Code size={20} />
                        <h4 className="font-bold">Project Highlights</h4>
                      </div>
                      <ul className="space-y-3">
                        {(githubData?.insights?.projectHighlights || []).map((p: string, i: number) => (
                          <li key={i} className="flex items-start space-x-2 text-slate-600 dark:text-slate-400 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            <span>{p}</span>
                          </li>
                        ))}
                        {(!githubData?.insights?.projectHighlights && linkedinData?.experience) && linkedinData.experience.slice(0, 2).map((exp: any, i: number) => (
                          <li key={i} className="flex items-start space-x-2 text-slate-600 dark:text-slate-400 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            <span>{exp.title} at {exp.company}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Detailed Repositories / Experience */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                    <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                      {githubData ? 'Top Repositories' : 'Professional Experience'}
                    </h3>
                    <div className="space-y-4">
                      {githubData ? (
                        githubData.repos.slice(0, 5).map((repo: any) => (
                          <div key={repo.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">{repo.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{repo.description || 'No description provided.'}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded">
                                {repo.language || 'Plain Text'}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : linkedinData?.experience?.map((exp: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{exp.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{exp.company} • {exp.duration}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                  <div className="bg-slate-900 dark:bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">The Evidence</h4>
                    <div className="space-y-6">
                      {githubData && (
                        <>
                          <div>
                            <p className="text-3xl font-bold">{githubData?.raw?.user?.public_repos || githubData?.user?.public_repos}</p>
                            <p className="text-xs text-slate-400 mt-1">Public Repositories</p>
                          </div>
                          <div className="h-px bg-slate-800" />
                          <div>
                            <p className="text-sm font-medium text-slate-300">{githubData?.insights?.evidence}</p>
                            <p className="text-xs text-slate-400 mt-1">Contribution Pattern</p>
                          </div>
                        </>
                      )}
                      {linkedinData && (
                        <>
                          <div>
                            <p className="text-3xl font-bold">{linkedinData.experience.length}</p>
                            <p className="text-xs text-slate-400 mt-1">Roles Analyzed</p>
                          </div>
                          <div className="h-px bg-slate-800" />
                          <div>
                            <p className="text-sm font-medium text-slate-300">{linkedinData.skills.length}+ Skills Found</p>
                            <p className="text-xs text-slate-400 mt-1">Professional Network</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Job Targeting */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold dark:text-white">Where are we applying?</h2>
                <p className="text-slate-500 dark:text-slate-400">We'll tailor your resume to match the specific company and role requirements.</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-6 transition-colors">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Target Company <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Google"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                      value={targetJob.company}
                      onChange={(e) => setTargetJob({ ...targetJob, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Target Role</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white appearance-none cursor-pointer"
                      value={targetJob.role}
                      onChange={(e) => setTargetJob({ ...targetJob, role: e.target.value })}
                    >
                      <option value="" disabled>Select a role</option>
                      {ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={searchJobs}
                  disabled={!targetJob.role || loading}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <><Target size={20} /><span>Match Job Requirements</span></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Keyword Matching */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold dark:text-white">Keyword Analysis</h2>
                  <p className="text-slate-500 dark:text-slate-400">We've extracted these key skills from {targetJob.company}'s requirements.</p>
                </div>
                <button
                  onClick={generateResume}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center space-x-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <><FileText size={20} /><span>Generate My Resume</span></>}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                <div className="flex flex-wrap gap-3">
                  {(jobKeywords || []).map((kw, i) => (
                    <div key={i} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-semibold border border-indigo-100 dark:border-indigo-800 flex items-center space-x-2 group">
                      <CheckCircle2 size={14} />
                      <span>{kw}</span>
                      <button
                        onClick={() => setJobKeywords(jobKeywords.filter((_, idx) => idx !== i))}
                        className="text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Result: Resume & Score */}
          {resume && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid lg:grid-cols-3 gap-8 mt-12"
            >
              {/* Score Sidebar */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-6 transition-colors">
                  <h3 className="text-lg font-bold dark:text-white">ATS Score</h3>
                  <div className="relative w-32 h-32 mx-auto">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100 dark:text-slate-800"
                        strokeDasharray="100, 100"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-indigo-600 dark:text-indigo-400"
                        strokeDasharray={`${atsScore?.score}, 100`}
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{atsScore?.score}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Your resume is highly optimized for {targetJob.company}.</p>

                  {atsScore && atsScore.score < 90 && (
                    <div className="space-y-3">
                      <button
                        onClick={optimizeResume}
                        disabled={isOptimizing}
                        className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center space-x-2"
                      >
                        {isOptimizing ? <RefreshCw className="animate-spin" size={18} /> : <Target size={18} />}
                        <span>Optimize for ATS</span>
                      </button>

                      {!showGapAnalysis && (
                        <button
                          onClick={() => setShowGapAnalysis(true)}
                          className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center space-x-2"
                        >
                          <Search size={18} />
                          <span>Gap Analysis</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {showGapAnalysis && atsScore?.gapAnalysis && (
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6 transition-colors">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold flex items-center space-x-2 dark:text-white text-lg">
                        <Search className="text-indigo-600" size={20} />
                        <span>Gap Analysis</span>
                      </h4>
                      <button onClick={() => setShowGapAnalysis(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {atsScore.gapAnalysis.missing.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-red-500">Completely Missing</p>
                          <div className="flex flex-wrap gap-2">
                            {atsScore.gapAnalysis.missing.map((s, i) => (
                              <span key={i} className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-[10px] font-medium border border-red-100 dark:border-red-800">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {atsScore.gapAnalysis.weak.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-amber-500">Weakly Represented</p>
                          <div className="flex flex-wrap gap-2">
                            {atsScore.gapAnalysis.weak.map((s, i) => (
                              <span key={i} className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-[10px] font-medium border border-amber-100 dark:border-amber-800">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {gapResponse === null ? (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <p className="text-sm font-medium dark:text-white">Do you have experience in any of these skills?</p>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setGapResponse('yes')}
                            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all"
                          >
                            Yes, I do
                          </button>
                          <button
                            onClick={() => setGapResponse('no')}
                            className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                          >
                            No, not yet
                          </button>
                        </div>
                      </div>
                    ) : gapResponse === 'yes' ? (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-bold dark:text-white">Add Skill Experience</p>
                          <button
                            onClick={() => setShowSkillExpForm(true)}
                            className="text-xs text-indigo-600 font-bold flex items-center space-x-1"
                          >
                            <Plus size={14} />
                            <span>Add Details</span>
                          </button>
                        </div>

                        {manualSkillExperience.length > 0 && (
                          <div className="space-y-3">
                            {manualSkillExperience.map((item, i) => (
                              <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 relative group">
                                <p className="text-xs font-bold dark:text-white">{item.skill}</p>
                                <p className="text-[10px] text-slate-500">{item.company} • {item.duration}</p>
                                <button
                                  onClick={() => setManualSkillExperience(manualSkillExperience.filter((_, idx) => idx !== i))}
                                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={generateResume}
                              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                            >
                              Regenerate Optimized Resume
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">No problem! We've optimized your resume with your existing information. Consider learning these areas to improve your future score.</p>
                        <ul className="space-y-2">
                          {atsScore.gapAnalysis.missing.slice(0, 3).map((s, i) => (
                            <li key={i} className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400">
                              <div className="w-1 h-1 rounded-full bg-indigo-400" />
                              <span>Learn {s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {atsScore?.missingKeywords && atsScore.missingKeywords.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
                    <h4 className="font-bold flex items-center space-x-2 dark:text-white">
                      <AlertCircle className="text-amber-500" size={18} />
                      <span>Missing Keywords</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {atsScore.missingKeywords.map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 transition-colors">
                  <h4 className="font-bold flex items-center space-x-2 dark:text-white">
                    <Trophy className="text-amber-500" size={18} />
                    <span>Suggestions</span>
                  </h4>
                  <ul className="space-y-3">
                    {(atsScore?.suggestions || []).map((s, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start space-x-2">
                        <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mt-1.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Resume Preview */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold dark:text-white">Resume Preview</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${copySuccess ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}
                    >
                      {copySuccess ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                      <span>{copySuccess ? 'Copied!' : 'Copy Text'}</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${isEditing ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'}`}
                    >
                      {isEditing ? <Save size={16} /> : <Edit3 size={16} />}
                      <span>{isEditing ? 'Save Changes' : 'Edit Details'}</span>
                    </button>
                    <button
                      onClick={downloadPDF}
                      disabled={isDownloadingPdf || isDownloadingWord || isEditing}
                      className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 dark:text-white"
                    >
                      {isDownloadingPdf ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={downloadWord}
                      disabled={isDownloadingPdf || isDownloadingWord || isEditing}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {isDownloadingWord ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                      <span>Word</span>
                    </button>
                  </div>
                </div>

                <div
                  ref={resumeRef}
                  className="bg-white p-12 rounded-lg shadow-2xl border border-slate-200 min-h-[1000px] font-serif text-slate-800 space-y-8 pdf-compatible"
                >
                  {isEditing ? (
                    <div className="space-y-8 font-sans">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Full Name</label>
                          <input
                            className="w-full p-2 border rounded"
                            value={resume.contact.name}
                            onChange={(e) => setResume({ ...resume, contact: { ...resume.contact, name: e.target.value } })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Email</label>
                          <input
                            className="w-full p-2 border rounded"
                            value={resume.contact.email}
                            onChange={(e) => setResume({ ...resume, contact: { ...resume.contact, email: e.target.value } })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Summary</label>
                        <textarea
                          className="w-full p-2 border rounded"
                          rows={4}
                          value={resume.summary}
                          onChange={(e) => setResume({ ...resume, summary: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Skills (Technical - comma separated)</label>
                        <input
                          className="w-full p-2 border rounded"
                          value={resume.skills.technical.join(', ')}
                          onChange={(e) => setResume({ ...resume, skills: { ...resume.skills, technical: e.target.value.split(',').map(s => s.trim()) } })}
                        />
                      </div>
                      <p className="text-xs text-slate-400 italic">More advanced editing coming soon. For now, you can modify the core details above.</p>
                    </div>
                  ) : (
                    <>
                      {/* Contact */}
                      <div className="text-center space-y-2 border-b pb-6">
                        <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">{resume.contact.name}</h1>
                        <div className="text-sm text-slate-600 flex justify-center space-x-4">
                          <span>{resume.contact.email}</span>
                          <span>•</span>
                          <span>{resume.contact.location}</span>
                          {resume.contact.linkedin && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600">LinkedIn</span>
                            </>
                          )}
                          {resume.contact.github && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600">GitHub</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-widest">Summary</h4>
                        <p className="text-sm leading-relaxed">{resume.summary}</p>
                      </div>

                      {/* Skills */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-widest">Skills</h4>
                        <div className="text-xs space-y-1">
                          <p><span className="font-bold">Technical:</span> {(resume.skills?.technical || []).join(", ")}</p>
                          <p><span className="font-bold">Soft:</span> {(resume.skills?.soft || []).join(", ")}</p>
                        </div>
                      </div>

                      {/* Experience */}
                      {resume.experience && resume.experience.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-widest">Experience</h4>
                          {(resume.experience || []).map((exp, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between font-bold text-sm">
                                <span>{exp.title} | {exp.company}</span>
                                <span>{exp.duration}</span>
                              </div>
                              <ul className="list-disc list-inside text-xs space-y-1 pl-2">
                                {(exp.bullets || []).map((b: string, j: number) => (
                                  <li key={j} className="leading-relaxed">{b}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Projects */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-widest">Projects</h4>
                        {(resume.projects || []).map((proj, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between font-bold text-sm">
                              <span>{proj.name}</span>
                              {proj.techStack && <span className="text-[10px] font-normal text-slate-500">{proj.techStack.join(", ")}</span>}
                            </div>
                            <p className="text-xs italic text-slate-600">{proj.description}</p>
                            <ul className="list-disc list-inside text-xs space-y-1 pl-2">
                              {(proj.bullets || []).map((b: string, j: number) => (
                                <li key={j} className="leading-relaxed">{b}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* Education */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-widest">Education</h4>
                        {(resume.education || []).map((edu, i) => (
                          <div key={i} className="flex justify-between font-bold text-sm">
                            <span>{edu.degree} | {edu.school}</span>
                            <span>{edu.year}</span>
                          </div>
                        ))}
                      </div>

                      {/* Certifications */}
                      {resume.certifications && resume.certifications.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-widest">Certifications</h4>
                          <ul className="list-disc list-inside text-xs space-y-1 pl-2">
                            {resume.certifications.map((cert, i) => (
                              <li key={i}>{cert}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Achievements */}
                      {resume.achievements && resume.achievements.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1 uppercase tracking-widest">Achievements</h4>
                          <ul className="list-disc list-inside text-xs space-y-1 pl-2">
                            {resume.achievements.map((ach, i) => (
                              <li key={i}>{ach}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 mt-24 transition-colors">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-4">

          <div className="flex justify-center space-x-6">

            {/* GitHub */}
            <a
              href="https://github.com/sudeenjain"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                size={20}
              />
            </a>

            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/in/sudeenjain"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin
                className="text-slate-400 hover:text-[#0a66c2] cursor-pointer transition-colors"
                size={20}
              />
            </a>

          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            © 2026 AI Resume Architect. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
