import os
import sqlite3
import json
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="NexJob AI API")
security = HTTPBasic()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- SQLite Database Setup -----------------
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
            FOREIGN KEY (user_email) REFERENCES users(email)
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ----------------- Models -----------------
class AuthRequest(BaseModel):
    email: str
    password: str

class ProfileRequest(BaseModel):
    email: str
    full_name: str
    target_role: str
    skills: str
    resume: str

class JobPayload(BaseModel):
    id: str
    user_email: str
    company: str
    role: str
    date: str
    status: str
    tags: list[str]
    jd: str

class GeminiRequest(BaseModel):
    action: str
    role: str
    company: str
    jd: str
    resume: str
    apiKey: str | None = None

# ----------------- Auth & User Endpoints -----------------
@app.post("/api/auth/signup")
async def signup(payload: AuthRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", (payload.email, payload.password))
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
    cursor.execute("SELECT email, full_name, target_role, skills, resume FROM users WHERE email=? AND password=?", (payload.email, payload.password))
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
            "resume": user[4]
        }
    }

@app.post("/api/profile/save")
async def save_profile(payload: ProfileRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users 
        SET full_name=?, target_role=?, skills=?, resume=? 
        WHERE email=?
    """, (payload.full_name, payload.target_role, payload.skills, payload.resume, payload.email))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ----------------- Job Data Endpoints -----------------
@app.get("/api/jobs")
async def get_jobs(email: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, company, role, date, status, tags, jd FROM jobs WHERE user_email=?", (email,))
    rows = cursor.fetchall()
    conn.close()
    jobs = []
    for r in rows:
        jobs.append({
            "id": r[0],
            "company": r[1],
            "role": r[2],
            "date": r[3],
            "status": r[4],
            "tags": json.loads(r[5]),
            "jd": r[6]
        })
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

# ----------------- AI Copilot Endpoint -----------------
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
            model="gemini-3.6-flash",
            contents=prompt,
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Central Admin Dashboard -----------------
@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(credentials: HTTPBasicCredentials = Depends(security)):
    # Default admin credentials: username=admin, password=adminsecret (change as needed)
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASS", "adminsecret")
    
    if credentials.username != admin_user or credentials.password != admin_pass:
        raise HTTPException(status_code=401, detail="Unauthorized Admin Access")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.email, u.full_name, u.target_role, u.created_at, COUNT(j.id) as job_count
        FROM users u
        LEFT JOIN jobs j ON u.email = j.user_email
        GROUP BY u.email
        ORDER BY u.created_at DESC
    """)
    users = cursor.fetchall()
    conn.close()

    table_rows = "".join([
        f"<tr><td>{u[0]}</td><td>{u[1] or 'Not Set'}</td><td>{u[2] or 'Not Set'}</td><td>{u[3]}</td><td><b>{u[4]}</b></td></tr>"
        for u in users
    ])

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>NexJob AI - Central Admin Panel</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }}
            h1 {{ font-size: 1.5rem; margin-bottom: 1rem; color: #38bdf8; }}
            table {{ width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }}
            th, td {{ padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; font-size: 0.9rem; }}
            th {{ background: #0b1329; color: #94a3b8; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }}
            tr:hover {{ background: #243248; }}
        </style>
    </head>
    <body>
        <h1>NexJob AI — Registered Users Dashboard</h1>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">Total Registered Accounts: <b>{len(users)}</b></p>
        <table>
            <thead>
                <tr>
                    <th>Email Address</th>
                    <th>Candidate Name</th>
                    <th>Target Role</th>
                    <th>Registered Date</th>
                    <th>Active Jobs Tracked</th>
                </tr>
            </thead>
            <tbody>
                {table_rows if table_rows else '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No users registered yet.</td></tr>'}
            </tbody>
        </table>
    </body>
    </html>
    """

# ----------------- Static Frontend Hosting -----------------
@app.get("/")
async def serve_home():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
