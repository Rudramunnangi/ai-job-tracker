import os
import sqlite3
import json
import io
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
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

class AuthRequest(BaseModel):
    email: str
    password: str

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

# PDF Parsing
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

# Authentication
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
    return {"status": "success", "message": "Account permanently deleted."}

# Job Pipeline
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

# 83% Smart Decision Engine
@app.post("/api/gemini/smart-decision")
async def execute_smart_decision(payload: DecisionRequest):
    api_key = payload.apiKey or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing.")

    client = genai.Client(api_key=api_key)

    prompt = f"""
You are the Chief AI Career Strategist on NexJob AI.
Analyze alignment between Candidate Background and Target Role.

TARGET APPLICATION:
Role: {payload.role or 'Target Role'} at {payload.company or 'Target Company'}
Job Description: {payload.jd}

CANDIDATE BACKGROUND:
Resume: {payload.resume}
LinkedIn: {payload.linkedin}
GitHub: {payload.github}

EVALUATION PROTOCOL:
1. Calculate a strict Match Percentage (0% to 100%).
2. Output format must follow this exact markdown structure:

### Overall Match Score: [Score]%

---

### DECISION VERDICT: [HIGH FIT (>= 83%) OR ACTIONABLE GAP (< 83%)]

IF Score >= 83%:
- **Candidate Fit Validation:** Explain top 3 aligned core competencies.
- **Immediate Next Step:** Ready for direct recruiter engagement.
- **Personalized Cold Outreach Note:**
  (Provide a high-converting message under 120 words ready to send to the hiring manager)

IF Score < 83%:
- **Critical Skill & Experience Gaps:** Detail exact missing keywords, frameworks, or depth.
- **Roadmap to Achieve This Dream Job:**
  1. Priority project or system to build.
  2. Specific technical certifications or concepts to master.
  3. Estimated timeline to reach 83%+ fit.
- **Alternative High-Probability Jobs You Can Crack Right Now:**
  List 3 specific job titles matching the candidate's existing strengths with >88% immediate fit.
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

@app.get("/")
async def serve_home():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
