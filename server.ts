import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import axios from "axios";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
app.use(express.json());

app.use("/api", (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  next();
});

// Check for required env variables
const checkEnv = () => {
  const required = ['GITHUB_TOKEN', 'ADZUNA_APP_ID', 'ADZUNA_API_KEY', 'VITE_GEMINI_API_KEY'];
  required.forEach(key => {
    if (!process.env[key]) {
      console.warn(`[WARNING] Missing environment variable: ${key}`);
    } else {
      console.log(`[INFO] Loaded environment variable: ${key}`);
    }
  });
};
checkEnv();

// --- API Routes ---

// GitHub Analysis
app.post("/api/github/fetch", async (req, res) => {
  const { username } = req.body;
  let token = process.env.GITHUB_TOKEN;
  // Ignore placeholder token
  if (token === "your_github_personal_access_token") {
    token = "";
  }

  try {
    const headers = token ? { Authorization: `token ${token}` } : {};

    // Fetch basic user info
    const userRes = await axios.get(`https://api.github.com/users/${username}`, { headers });
    const reposRes = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers });

    const repos = reposRes.data;
    const languagesMap: Record<string, number> = {};

    repos.forEach((repo: any) => {
      if (repo.language) {
        languagesMap[repo.language] = (languagesMap[repo.language] || 0) + 1;
      }
    });

    const topLanguages = Object.entries(languagesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);

    const totalStars = repos.reduce((acc: number, repo: any) => acc + repo.stargazers_count, 0);

    res.json({
      username,
      user: userRes.data,
      repos: repos.slice(0, 10),
      topLanguages,
      totalStars
    });
  } catch (error: any) {
    console.error("GitHub Fetch Error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    let message = "Failed to fetch GitHub profile";

    if (status === 404) {
      message = `GitHub user "${username}" not found. Please check the spelling.`;
    } else if (status === 401) {
      message = "GitHub API authentication failed ('Bad credentials'). Please update GITHUB_TOKEN in your .env file with a valid Personal Access Token.";
    } else if (status === 403) {
      message = "GitHub API rate limit exceeded. Please provide a GITHUB_TOKEN in .env for higher limits.";
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    }

    res.status(status).json({ error: message });
  }
});

// Adzuna Job Search
app.post("/api/jobs/search", async (req, res) => {
  const { company, role } = req.body;
  const appId = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;

  if (appId === "your_adzuna_app_id" || apiKey === "your_adzuna_api_key") {
    console.warn("[WARNING] Adzuna API placeholders found. Returning fallback keywords.");
    return res.json({ jobs: [] }); // Returning empty allows frontend to use fallback keywords
  }

  try {
    const response = await axios.get(`https://api.adzuna.com/v1/api/jobs/us/search/1`, {
      params: {
        app_id: appId,
        app_key: apiKey,
        what: `${role} ${company}`,
        results_per_page: 5
      }
    });

    res.json({ jobs: response.data.results });
  } catch (error: any) {
    console.error("Job Search Error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    let message = "Failed to search jobs on Adzuna";

    if (status === 401 || status === 403) {
      message = "Adzuna API authentication failed. Please check your API credentials.";
    } else if (status === 429) {
      message = "Adzuna API rate limit exceeded. Please try again later.";
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    }

    res.status(status).json({
      error: message,
      details: error.response?.data || error.message,
      status: status
    });
  }
});

// Word Document Generation
app.post("/api/resume/docx", async (req, res) => {
  const { resume } = req.body;

  try {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: resume.contact.name,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun(`${resume.contact.email} | ${resume.contact.location} | ${resume.contact.phone}`),
            ],
          }),
          new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: resume.summary }),

          new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }),
          ...resume.experience.flatMap((exp: any) => [
            new Paragraph({
              children: [
                new TextRun({ text: `${exp.title} | ${exp.company}`, bold: true }),
                new TextRun({ text: `\t${exp.duration}`, break: 0 }),
              ],
            }),
            ...exp.bullets.map((bullet: string) => new Paragraph({ text: bullet, bullet: { level: 0 } }))
          ]),

          new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [
              new TextRun({ text: "Technical: ", bold: true }),
              new TextRun(resume.skills.technical.join(", ")),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Soft: ", bold: true }),
              new TextRun(resume.skills.soft.join(", ")),
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader("Content-Disposition", "attachment; filename=resume.docx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);
  } catch (error) {
    console.error("Docx Generation Error:", error);
    res.status(500).json({ error: "Failed to generate Word document" });
  }
});

app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// --- Vite Integration ---

async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: {
            port: 24679, // prevents clash if 24678 stuck
          },
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      // Serve static files from the dist directory
      const path = await import("path");
      const express = await import("express");
      const distPath = path.resolve(process.cwd(), "dist");
      app.use(express.static(distPath));

      // Handle SPA routing: serve index.html for all non-API routes
      app.get("*", (req, res) => {
        if (!req.url.startsWith("/api")) {
          res.sendFile(path.join(distPath, "index.html"));
        }
      });
    }

    app.listen(PORT, "0.0.0.0")
      .on("listening", () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
      })
      .on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.error(`❌ Port ${PORT} is already in use.`);
          console.error(`👉 Try running on a different port:`);
          console.error(`   $env:PORT=5001; npm run dev`);
        } else {
          console.error("Server error:", err);
        }
        process.exit(1);
      });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
