# AI Resume Architect

A production-ready AI-powered resume generator that analyzes your professional presence across GitHub and LinkedIn to craft the perfect resume for your target role.

## Features

- **LinkedIn Extraction**: Chrome extension to pull your latest professional data directly from your profile.
- **GitHub Analysis**: Deep dive into your repositories, languages, and contribution patterns.
- **Job Targeting**: Integration with Adzuna API to find real job descriptions and match keywords.
- **AI Generation**: Powered by Gemini 3.1 Pro to write high-impact, quantified bullet points.
- **ATS Optimization**: Real-time scoring and suggestions to beat the bots.
- **Multi-Format Export**: Download as professional PDF (LaTeX-based) or editable Word document.

## Setup Instructions

### Prerequisites
- Node.js 18+
- Supabase Account
- Gemini API Key (handled by AI Studio)
- Adzuna API Credentials
- GitHub Personal Access Token

### Environment Variables
Create a `.env` file based on `.env.example`:
- `GITHUB_TOKEN`: Your GitHub PAT
- `ADZUNA_APP_ID`: From Adzuna dashboard
- `ADZUNA_API_KEY`: From Adzuna dashboard
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Installation
1. `npm install`
2. `npm run dev`

### Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome-extension` folder in this project.
