import os
import sqlite3
import json
import io
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from google import genai
from pypdf import PdfReader
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="NexJob AI - Enterprise Career Engine")
security = HTTPBasic()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "nexjob.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            full_name TEXT DEFAULT '',
            target_role TEXT DEFAULT '',
            skills TEXT DEFAULT '',
            resume TEXT DEFAULT '',
            linkedin_url TEXT DEFAULT '',
            github_url TEXT DEFAULT '',
            portfolio_url TEXT DEFAULT '',
            auth_provider TEXT DEFAULT 'local',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            company TEXT NOT NULL,
            role TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            tags TEXT NOT NULL,
            jd TEXT NOT NULL,
            FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Models
class AuthRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str
    email: str
    name: str | None = None

class ProfileRequest(BaseModel):
    email: str
    full_name: str
    target_role: str
    skills: str
    resume: str
    linkedin_url: str = ""
    github_url: str = ""
    portfolio_url: str = ""

class JobPayload(BaseModel):
    id: str
    user_email: str
    company: str
    role: str
    date: str
    status: str
    tags: list[str]
    jd: str

class DecisionRequest(BaseModel):
    role: str
    company: str
    jd: str
    resume: str
    linkedin: str | None = ""
    github: str | None = ""
    apiKey: str | None = None

# PDF Parsing Endpoint
@app.post("/api/resume/upload-pdf")
async def upload_pdf_resume(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF format files are supported.")
    try:
        content = await file.read()
        pdf_reader = PdfReader(io.BytesIO(content))
        extracted_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract readable text from this PDF.")
        return {"extracted_text": extracted_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing error: {str(e)}")

# Authentication Endpoints
@app.post("/api/auth/signup")
async def signup(payload: AuthRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (email, password, auth_provider) VALUES (?, ?, 'local')", (payload.email, payload.password))
        conn.commit()
        return {"status": "success", "email": payload.email}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Account already exists. Please log in.")
    finally:
        conn.close()

@app.post("/api/auth/login")
async def login(payload: AuthRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email, full_name, target_role, skills, resume, linkedin_url, github_url, portfolio_url FROM users WHERE email=? AND password=?", (payload.email, payload.password))
    user = cursor.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {
        "email": user[0],
        "profile": {
            "fullName": user[1],
            "targetRole": user[2],
            "skills": user[3],
            "resume": user[4],
            "linkedin": user[5],
            "github": user[6],
            "portfolio": user[7]
        }
    }

@app.post("/api/auth/google")
async def google_auth(payload: GoogleAuthRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email, full_name, target_role, skills, resume, linkedin_url, github_url, portfolio_url FROM users WHERE email=?", (payload.email,))
    user = cursor.fetchone()
    if not user:
        cursor.execute("INSERT INTO users (email, password, full_name, auth_provider) VALUES (?, 'google_oauth_user', ?, 'google')", (payload.email, payload.name or ''))
        conn.commit()
        user_profile = {"fullName": payload.name or "", "targetRole": "", "skills": "", "resume": "", "linkedin": "", "github": "", "portfolio": ""}
    else:
        user_profile = {"fullName": user[1], "targetRole": user[2], "skills": user[3], "resume": user[4], "linkedin": user[5], "github": user[6], "portfolio": user[7]}
    conn.close()
    return {"email": payload.email, "profile": user_profile}

@app.post("/api/profile/save")
async def save_profile(payload: ProfileRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users 
        SET full_name=?, target_role=?, skills=?, resume=?, linkedin_url=?, github_url=?, portfolio_url=?
        WHERE email=?
    """, (payload.full_name, payload.target_role, payload.skills, payload.resume, payload.linkedin_url, payload.github_url, payload.portfolio_url, payload.email))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/account/delete")
async def delete_account(email: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE user_email=?", (email,))
    cursor.execute("DELETE FROM users WHERE email=?", (email,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Account and all associated records permanently purged."}

# Job Pipeline Endpoints
@app.get("/api/jobs")
async def get_jobs(email: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, company, role, date, status, tags, jd FROM jobs WHERE user_email=?", (email,))
    rows = cursor.fetchall()
    conn.close()
    jobs = [{"id": r[0], "company": r[1], "role": r[2], "date": r[3], "status": r[4], "tags": json.loads(r[5]), "jd": r[6]} for r in rows]
    return {"jobs": jobs}

@app.post("/api/jobs/save")
async def save_job(payload: JobPayload):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO jobs (id, user_email, company, role, date, status, tags, jd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (payload.id, payload.user_email, payload.company, payload.role, payload.date, payload.status, json.dumps(payload.tags), payload.jd))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/jobs/update_status")
async def update_job_status(data: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE jobs SET status=? WHERE id=?", (data.get("status"), data.get("id")))
    conn.commit()
    conn.close()
    return {"status": "success"}

# Smart Decision Engine (85% Match Logic)
@app.post("/api/gemini/smart-decision")
async def execute_smart_decision(payload: DecisionRequest):
    api_key = payload.apiKey or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing.")

    client = genai.Client(api_key=api_key)

    prompt = f"""
You are the Chief AI Career Strategist on NexJob AI.
Analyze the alignment between the Candidate Background and the Target Role.

TARGET APPLICATION:
Role: {payload.role} at {payload.company}
Job Description: {payload.jd}

CANDIDATE PROFILE:
Resume Content: {payload.resume}
LinkedIn: {payload.linkedin}
GitHub: {payload.github}

EVALUATION PROTOCOL:
1. First, calculate an exact Match Score between 0% and 100%.
2. IF Match Score is >= 85%:
   - Label: 'HIGH FIT (MATCH >= 85%)'
   - Confirm candidate is strongly positioned for this target role.
   - Output 3 key competitive advantages.
   - Provide a high-converting Cold Recruiter Outreach Note (under 120 words).

3. IF Match Score is < 85%:
   - Label: 'GAP DETECTED (MATCH < 85%)'
   - Explicitly highlight what is missing (tech stack, experience depth, systems design).
   - ACTION PLAN TO BRIDGE GAP: Exactly what steps/projects/certifications the candidate needs to qualify for this target role.
   - ALTERNATIVE SUITABLE ROLES: Recommend 3 specific job titles that currently fit the candidate's existing resume profile with >90% suitability.

Format the response cleanly in structured Markdown with clear bold headers and bullet points.
"""

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def serve_home():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)

