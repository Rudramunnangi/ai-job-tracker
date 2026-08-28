import os
import sqlite3
import json
import io
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from google import genai
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
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

# Request Schemas
class AuthRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str

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
    role: str | None = "Target Role"
    company: str | None = "Target Company"
    jd: str
    resume: str
    linkedin: str | None = ""
    github: str | None = ""
    isGuest: bool = False

# Google Sign-In Verification
@app.post("/api/auth/google")
async def google_auth(payload: GoogleAuthRequest):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    try:
        # Verify token against Google Public Keys
        idinfo = id_token.verify_oauth2_token(
            payload.credential, 
            google_requests.Request(), 
            google_client_id if google_client_id else None
        )

        email = idinfo.get("email")
        name = idinfo.get("name", "")

        if not email:
            raise HTTPException(status_code=400, detail="Google authentication succeeded, but no email was provided.")

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT email, full_name, target_role, skills, resume, linkedin_url, github_url, portfolio_url FROM users WHERE email=?", (email,))
        user = cursor.fetchone()

        if not user:
            cursor.execute("""
                INSERT INTO users (email, password, full_name, auth_provider) 
                VALUES (?, 'google_oauth_verified', ?, 'google')
            """, (email, name))
            conn.commit()
            user_profile = {
                "fullName": name, "targetRole": "", "skills": "", "resume": "", 
                "linkedin": "", "github": "", "portfolio": ""
            }
        else:
            user_profile = {
                "fullName": user[1] or name, "targetRole": user[2], "skills": user[3], 
                "resume": user[4], "linkedin": user[5], "github": user[6], "portfolio": user[7]
            }
        conn.close()

        return {"status": "success", "email": email, "profile": user_profile}
    except Exception as e:
        print(f"[AUTH ERROR] Google Token Verification Failed: {str(e)}")
        raise HTTPException(
            status_code=400, 
            detail=f"Google Login Failed: {str(e)}. Please ensure your Google Client ID is configured in Render environment variables."
        )

# Standard Email/Password Auth
@app.post("/api/auth/signup")
async def signup(payload: AuthRequest):
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (email, password, auth_provider) VALUES (?, ?, 'local')", (payload.email, payload.password))
        conn.commit()
        return {"status": "success", "email": payload.email}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please log in.")
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
            "fullName": user[1], "targetRole": user[2], "skills": user[3],
            "resume": user[4], "linkedin": user[5], "github": user[6], "portfolio": user[7]
        }
    }

# Member PDF Resume Upload (Server-Side Gated)
@app.post("/api/resume/upload-pdf")
async def upload_pdf_resume(file: UploadFile = File(...), user_email: str = Header(None)):
    if not user_email or user_email == "null" or user_email == "guest":
        raise HTTPException(status_code=401, detail="PDF parsing is a Member-only feature. Please sign in.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only standard PDF files are supported.")
    try:
        content = await file.read()
        pdf_reader = PdfReader(io.BytesIO(content))
        extracted_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract readable text from this PDF file.")
        
        # Automatically update database record for user
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET resume=? WHERE email=?", (extracted_text.strip(), user_email))
        conn.commit()
        conn.close()

        return {"extracted_text": extracted_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing error: {str(e)}")

# Profile Management
@app.post("/api/profile/save")
async def save_profile(payload: ProfileRequest):
    if not payload.email or payload.email == "guest":
        raise HTTPException(status_code=401, detail="Unauthorized. Log in to persist profile records.")
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
    if not email or email == "guest":
        raise HTTPException(status_code=400, detail="Invalid account deletion request.")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE user_email=?", (email,))
    cursor.execute("DELETE FROM users WHERE email=?", (email,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Account and all associated records permanently purged."}

# Kanban Job Routes (Server-Side Gated)
@app.get("/api/jobs")
async def get_jobs(email: str):
    if not email or email == "guest":
        return {"jobs": []}
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, company, role, date, status, tags, jd FROM jobs WHERE user_email=?", (email,))
    rows = cursor.fetchall()
    conn.close()
    jobs = [{"id": r[0], "company": r[1], "role": r[2], "date": r[3], "status": r[4], "tags": json.loads(r[5]), "jd": r[6]} for r in rows]
    return {"jobs": jobs}

@app.post("/api/jobs/save")
async def save_job(payload: JobPayload):
    if not payload.user_email or payload.user_email == "guest":
        raise HTTPException(status_code=401, detail="Please log in to save applications to your cloud pipeline.")
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

# Unified ATS Decision Engine
@app.post("/api/gemini/smart-decision")
async def execute_smart_decision(payload: DecisionRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing on backend server.")

    client = genai.Client(api_key=api_key)

    if payload.isGuest:
        prompt = f"""
You are the ATS Evaluator for Guest Mode on NexJob AI.
Compare the Candidate Resume against the Target Job Description.

TARGET ROLE: {payload.role} at {payload.company}
JOB DESCRIPTION: {payload.jd}
CANDIDATE RESUME: {payload.resume}

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:
### Overall ATS Match Score: [Calculate precise score between 0% and 100%]%

**High-Level Verdict:** (1 concise sentence stating if the candidate qualifies or has major gaps).

---
> 🔒 **Detailed Career Roadmap, Cold Recruiter Outreach Generator & Instant Matching Jobs are Member-Only Features.**
> Sign in or create a free account to unlock your complete step-by-step skill-bridging action plan!
"""
    else:
        prompt = f"""
You are the Chief AI Career Strategist on NexJob AI.
Analyze the alignment between the Candidate Background and the Target Role.

TARGET APPLICATION:
Role: {payload.role} at {payload.company}
Job Description: {payload.jd}

CANDIDATE PROFILE:
Resume Content: {payload.resume}
LinkedIn: {payload.linkedin or 'Not Provided'}
GitHub: {payload.github or 'Not Provided'}

EVALUATION PROTOCOL:
1. Calculate a strict Match Percentage (0% to 100%).
2. Output format must follow this exact Markdown structure:

### Overall ATS Match Score: [Score]%

---

### DECISION VERDICT: [HIGH FIT (>= 83%) OR ACTIONABLE GAP (< 83%)]

IF Match Score >= 83%:
- **Candidate Fit Validation:** Highlight the top 3 matching core competencies.
- **Immediate Strategic Step:** Application is strongly aligned for immediate recruiter submission.
- **Ready-to-Send Cold Outreach Note:**
(Generate a personalized, high-converting recruiter message under 120 words ready to copy and send on LinkedIn/Email).

IF Match Score < 83%:
- **Critical Skill & Experience Gaps:** Detail exact missing keywords, tools, or domain experience.
- **Targeted Roadmap to Crack This Dream Job:**
  1. Priority technical project or system to build.
  2. Specific tools/frameworks to study.
  3. Estimated timeline to reach >=83% qualification.
- **High-Probability Alternative Roles You Can Crack Right Now:**
  List 3 specific realistic job titles where the candidate's existing background immediately scores >88%.
"""

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Admin Panel
@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(credentials: HTTPBasicCredentials = Depends(security)):
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
        <h1>NexJob AI — Central Admin User Dashboard</h1>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">Registered User Accounts: <b>{len(users)}</b></p>
        <table>
            <thead>
                <tr>
                    <th>Email</th>
                    <th>Candidate Name</th>
                    <th>Target Role</th>
                    <th>Date Joined</th>
                    <th>Jobs In Pipeline</th>
                </tr>
            </thead>
            <tbody>
                {table_rows if table_rows else '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No registered users found.</td></tr>'}
            </tbody>
        </table>
    </body>
    </html>
    """

@app.get("/")
async def serve_home():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
