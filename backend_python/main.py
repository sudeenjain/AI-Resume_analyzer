from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import httpx
import os
from dotenv import load_dotenv
from typing import List, Optional
import json

load_dotenv()

app = FastAPI()

class GitHubRequest(BaseModel):
    username: str

class JobSearchRequest(BaseModel):
    company: str
    role: str

@app.post("/api/github/analyze")
async def analyze_github(request: GitHubRequest):
    username = request.username
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Authorization": f"token {token}"} if token else {}
    
    async with httpx.AsyncClient() as client:
        try:
            user_res = await client.get(f"https://api.github.com/users/{username}", headers=headers)
            repos_res = await client.get(f"https://api.github.com/users/{username}/repos?per_page=100&sort=updated", headers=headers)
            
            user_res.raise_for_status()
            repos_res.raise_for_status()
            
            # AI logic would go here (e.g. calling Claude or Gemini)
            # For this reference, we return the raw data
            return {
                "username": username,
                "insights": {
                    "summary": "Expert developer with strong open source presence.",
                    "strengths": ["Python", "Cloud Architecture", "API Design"],
                    "evidence": "Consistent contributor with 50+ repos."
                }
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/jobs/search")
async def search_jobs(request: JobSearchRequest):
    # Adzuna API call logic
    return {"jobs": [], "keywords": ["React", "Node.js", "AWS"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
