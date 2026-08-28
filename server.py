import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="NexJob AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GeminiRequest(BaseModel):
    action: str
    role: str
    company: str
    jd: str
    resume: str
    apiKey: str | None = None

@app.post("/api/gemini")
async def generate_career_intelligence(payload: GeminiRequest):
    api_key = payload.apiKey or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing.")

    client = genai.Client(api_key=api_key)

    if payload.action == "match":
        prompt = f"""
Analyze the alignment between the Candidate Profile and the Target Job Description.
Target Role: {payload.role} at {payload.company}
Job Description: {payload.jd}
Candidate Profile: {payload.resume}

Provide structured output formatted in clean Markdown:
### Match Score: [Score between 0% and 100%]
**Executive Summary:** 2-sentence summary of overall fit.

#### Top Matching Competencies
- Strengths aligned with requirements.

#### Critical Skill Gaps
- Missing keywords or technologies.

#### High-Yield Interview Prep Tip
- 1 concise technical tip to prepare.
"""
    elif payload.action == "outreach":
        prompt = f"""
Write a high-converting cold LinkedIn/email outreach note (under 150 words) from the candidate to the hiring manager for the {payload.role} position at {payload.company}.
Job Description: {payload.jd}
Candidate Background: {payload.resume}
"""
    elif payload.action == "nudge":
        prompt = f"""
Draft a polite, concise follow-up note (under 100 words) checking in on an application submitted 5 days ago for the {payload.role} role at {payload.company}.
"""
    else:
        raise HTTPException(status_code=400, detail="Invalid action.")

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve frontend static assets
@app.get("/")
async def serve_home():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
