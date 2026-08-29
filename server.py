import os
import sqlite3
import json
import io
import urllib.parse
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
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

try:
    init_db()
except Exception as e:
    print(f"[DB INIT ERROR]: {e}")

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

@app.post("/api/auth/google")
async def google_auth(payload: GoogleAuthRequest):
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential, 
            google_requests.Request(), 
            google_client_id if google_client_id else None
        )
        email = idinfo.get("email")
        name = idinfo.get("name", "")

        if not email:
            raise HTTPException(status_code=400, detail="Google authentication succeeded, but no email was provided.")

        email_clean = email.strip().lower()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT email, full_name, target_role, skills, resume, linkedin_url, github_url, portfolio_url FROM users WHERE email=?", (email_clean,))
        user = cursor.fetchone()

        if not user:
            cursor.execute("""
                INSERT INTO users (email, password, full_name, auth_provider) 
                VALUES (?, 'google_oauth_verified', ?, 'google')
            """, (email_clean, name))
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
        return {"status": "success", "email": email_clean, "profile": user_profile}
    except Exception as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Google Login Error: {str(e)}. Check authorized origins in Google Cloud Console."
        )

@app.post("/api/auth/signup")
async def signup(payload: AuthRequest):
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    
    email_clean = payload.email.strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (email, password, auth_provider) VALUES (?, ?, 'local')", (email_clean, payload.password))
        conn.commit()
        return {"status": "success", "email": email_clean}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please log in.")
    finally:
        conn.close()

@app.post("/api/auth/login")
async def login(payload: AuthRequest):
    email_clean = payload.email.strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email, full_name, target_role, skills, resume, linkedin_url, github_url, portfolio_url FROM users WHERE email=? AND password=?", (email_clean, payload.password))
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

@app.post("/api/resume/upload-pdf")
async def upload_pdf_resume(file: UploadFile = File(...), user_email: str = Header(None)):
    if not user_email or user_email in ("null", "guest", ""):
        raise HTTPException(status_code=401, detail="PDF parsing is a member-only feature. Please sign in.")
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
            raise HTTPException(status_code=400, detail="Could not extract readable text from this PDF.")
        
        email_clean = user_email.strip().lower()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET resume=? WHERE email=?", (extracted_text.strip(), email_clean))
        conn.commit()
        conn.close()
        return {"extracted_text": extracted_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing error: {str(e)}")

@app.post("/api/profile/save")
async def save_profile(payload: ProfileRequest):
    if not payload.email or payload.email == "guest":
        raise HTTPException(status_code=401, detail="Unauthorized. Log in to persist profile records.")
    
    email_clean = payload.email.strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users 
        SET full_name=?, target_role=?, skills=?, resume=?, linkedin_url=?, github_url=?, portfolio_url=?
        WHERE email=?
    """, (payload.full_name, payload.target_role, payload.skills, payload.resume, payload.linkedin_url, payload.github_url, payload.portfolio_url, email_clean))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/account/delete")
async def delete_account(email: str):
    if not email or email == "guest":
        raise HTTPException(status_code=400, detail="Invalid account deletion request.")
    
    email_clean = email.strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE user_email=?", (email_clean,))
    cursor.execute("DELETE FROM users WHERE email=?", (email_clean,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Account permanently deleted."}

@app.get("/api/jobs")
async def get_jobs(email: str):
    if not email or email == "guest":
        return {"jobs": []}
    
    email_clean = email.strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, company, role, date, status, tags, jd FROM jobs WHERE user_email=?", (email_clean,))
    rows = cursor.fetchall()
    conn.close()
    jobs = [{"id": r[0], "company": r[1], "role": r[2], "date": r[3], "status": r[4], "tags": json.loads(r[5]), "jd": r[6]} for r in rows]
    return {"jobs": jobs}

@app.post("/api/jobs/save")
async def save_job(payload: JobPayload):
    if not payload.user_email or payload.user_email == "guest":
        raise HTTPException(status_code=401, detail="Please log in to save applications.")
    
    email_clean = payload.user_email.strip().lower()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO jobs (id, user_email, company, role, date, status, tags, jd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (payload.id, email_clean, payload.company, payload.role, payload.date, payload.status, json.dumps(payload.tags), payload.jd))
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

@app.post("/api/gemini/smart-decision")
async def execute_smart_decision(payload: DecisionRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing on backend server.")

    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize Gemini Client: {str(e)}")

    if payload.isGuest:
        prompt = f"""
You are the ATS Evaluator for Guest Mode on NexJob AI.
Analyze candidate alignment against the target role.

TARGET ROLE: {payload.role} at {payload.company}
JOB DESCRIPTION: {payload.jd}
CANDIDATE RESUME: {payload.resume}

FORMAT EXACTLY AS FOLLOWS (Never mention internal threshold numbers):
<div class="result-score-card">
  <div class="score-badge">ATS Match Score: [Score between 0% and 100%]%</div>
  <p><strong>Overview:</strong> 1-sentence verdict on qualification level.</p>
</div>

---
> 🔒 **Detailed Career Roadmap, Cold Outreach Generators & Direct Job Search Links are Member-Only Features.**
> Sign in or create an account to view your step-by-step roadmap and matching live opportunities!
"""
    else:
        prompt = f"""
You are the Chief AI Career Strategist on NexJob AI.
Analyze the candidate's actual capabilities and technical background against the target role.

TARGET APPLICATION:
Role: {payload.role} at {payload.company}
Job Description: {payload.jd}

CANDIDATE PROFILE:
Resume Content: {payload.resume}
LinkedIn: {payload.linkedin or 'Not Provided'}
GitHub: {payload.github or 'Not Provided'}

EVALUATION PROTOCOL:
1. Calculate a strict Match Percentage (0% to 100%).
2. Extract the candidate's strongest 3 high-probability alternative job roles based solely on their proven abilities.
3. Generate direct 1-click verified search links with URL encoded keywords for immediate submission.
4. Output your response formatted in clean distinct sections:

<div class="result-score-card">
  <div class="score-badge">ATS Match Score: [Score]%</div>
  <p><strong>Alignment Status:</strong> [Strong Alignment OR Actionable Gaps Detected]</p>
</div>

---

<div class="highlight-section roadmap-section">
  <h3>🗺️ Targeted Roadmap to Close the Gap</h3>
  <ul>
    <li><strong>Missing Competencies & Tools:</strong> Specific missing technical skills/keywords.</li>
    <li><strong>Priority Project to Build:</strong> Architecture/system project to demonstrate competency.</li>
    <li><strong>Estimated Timeline:</strong> Timeline and concepts to study.</li>
  </ul>
</div>

<div class="highlight-section jobs-section">
  <h3>🎯 Alternative High-Probability Roles You Can Target Right Now</h3>
  <p>Based on your current resume profile, these positions match your immediate strengths with 1-click direct apply links:</p>
  <ul>
    <li>
      <strong>[Role 1 Title]</strong> — Match Probability: <b>High</b>
      <br>
      🚀 <b>1-Click Apply:</b> 
      <a href="https://www.linkedin.com/jobs/search/?keywords=[URL_ENCODED_ROLE_1]&f_TPR=r86400" target="_blank" class="verified-job-link">LinkedIn Jobs (Live)</a> | 
      <a href="https://www.indeed.com/jobs?q=[URL_ENCODED_ROLE_1]&sort=date" target="_blank" class="verified-job-link">Indeed (Latest)</a> |
      <a href="https://www.google.com/search?q=[URL_ENCODED_ROLE_1]+jobs&ibp=htl;jobs" target="_blank" class="verified-job-link">Google Careers</a>
    </li>
    <li>
      <strong>[Role 2 Title]</strong> — Match Probability: <b>High</b>
      <br>
      🚀 <b>1-Click Apply:</b> 
      <a href="https://www.linkedin.com/jobs/search/?keywords=[URL_ENCODED_ROLE_2]&f_TPR=r86400" target="_blank" class="verified-job-link">LinkedIn Jobs (Live)</a> | 
      <a href="https://www.indeed.com/jobs?q=[URL_ENCODED_ROLE_2]&sort=date" target="_blank" class="verified-job-link">Indeed (Latest)</a> |
      <a href="https://www.google.com/search?q=[URL_ENCODED_ROLE_2]+jobs&ibp=htl;jobs" target="_blank" class="verified-job-link">Google Careers</a>
    </li>
    <li>
      <strong>[Role 3 Title]</strong> — Match Probability: <b>High</b>
      <br>
      🚀 <b>1-Click Apply:</b> 
      <a href="https://www.linkedin.com/jobs/search/?keywords=[URL_ENCODED_ROLE_3]&f_TPR=r86400" target="_blank" class="verified-job-link">LinkedIn Jobs (Live)</a> | 
      <a href="https://www.indeed.com/jobs?q=[URL_ENCODED_ROLE_3]&sort=date" target="_blank" class="verified-job-link">Indeed (Latest)</a> |
      <a href="https://www.google.com/search?q=[URL_ENCODED_ROLE_3]+jobs&ibp=htl;jobs" target="_blank" class="verified-job-link">Google Careers</a>
    </li>
  </ul>
</div>

<div class="highlight-section outreach-section">
  <h3>✉️ Ready-to-Send Cold Outreach Note</h3>
  <p>Send this to hiring managers or recruiters for {payload.role} at {payload.company}:</p>
  <blockquote>[High converting message under 120 words tailored to candidate's strengths]</blockquote>
</div>

Replace [URL_ENCODED_ROLE_X] with the URL-encoded string of each role (e.g. AI%20Engineer).
"""

    models_to_try = [
        "gemini-2.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.1-pro-preview"
    ]

    try:
        remote_models = [
            m.name.replace("models/", "")
            for m in client.models.list()
            if hasattr(m, 'supported_generation_methods') and "generateContent" in (m.supported_generation_methods or [])
        ]
        if remote_models:
            models_to_try = list(dict.fromkeys(remote_models + models_to_try))
    except Exception as list_err:
        print(f"[MODEL DISCOVERY] Using default fallback: {list_err}")

    last_error = None
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                return {"result": response.text}
        except Exception as e:
            last_error = e
            print(f"[MODEL RETRY] {model_name} failed: {str(e)}")
            continue

    raise HTTPException(
        status_code=429, 
        detail=f"AI model generation temporarily rate-limited. Please wait 15 seconds and retry. ({str(last_error)})"
    )

# Admin User Removal Endpoint
@app.post("/admin/delete-user")
async def admin_delete_user(data: dict, credentials: HTTPBasicCredentials = Depends(security)):
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASS", "adminsecret")
    if credentials.username != admin_user or credentials.password != admin_pass:
        raise HTTPException(status_code=401, detail="Unauthorized Admin Access")
    
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Invalid email provided.")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE user_email=?", (email,))
    cursor.execute("DELETE FROM users WHERE email=?", (email,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"User {email} successfully deleted."}

# Complete Admin Analytics & User Management Dashboard
@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(credentials: HTTPBasicCredentials = Depends(security)):
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASS", "adminsecret")
    
    if credentials.username != admin_user or credentials.password != admin_pass:
        raise HTTPException(status_code=401, detail="Unauthorized Admin Access")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. User & Job Data
    cursor.execute("""
        SELECT u.email, u.full_name, u.target_role, u.created_at, COUNT(j.id) as job_count
        FROM users u
        LEFT JOIN jobs j ON u.email = j.user_email
        GROUP BY u.email
        ORDER BY u.created_at DESC
    """)
    users = cursor.fetchall()
    
    # 2. Total Application Count
    cursor.execute("SELECT COUNT(*) FROM jobs")
    total_jobs_count = cursor.fetchone()[0] or 0

    # 3. Pipeline Breakdown by Status
    cursor.execute("SELECT status, COUNT(*) FROM jobs GROUP BY status")
    status_counts = dict(cursor.fetchall())
    status_applied = status_counts.get("Applied", 0)
    status_interviewing = status_counts.get("Interviewing", 0)
    status_offered = status_counts.get("Offered", 0)
    status_rejected = status_counts.get("Rejected", 0)

    # 4. Signups Per Day (Last 30 Days) for Graphs
    cursor.execute("""
        SELECT strftime('%Y-%m-%d', created_at) as day, COUNT(*)
        FROM users
        GROUP BY day
        ORDER BY day ASC
        LIMIT 30
    """)
    daily_signups = cursor.fetchall()
    
    # 5. Signups Per Month
    cursor.execute("""
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*)
        FROM users
        GROUP BY month
        ORDER BY month ASC
    """)
    monthly_signups = cursor.fetchall()

    conn.close()

    total_users_count = len(users)
    
    # Calculations for Averages
    avg_per_week = round(total_users_count / 4.3, 1) if total_users_count > 0 else 0
    avg_per_month = round(total_users_count / max(len(monthly_signups), 1), 1) if total_users_count > 0 else 0

    daily_labels = json.dumps([d[0] for d in daily_signups] or ["Today"])
    daily_values = json.dumps([d[1] for d in daily_signups] or [total_users_count])
    
    status_labels = json.dumps(["Applied", "Interviewing", "Offered", "Rejected"])
    status_values = json.dumps([status_applied, status_interviewing, status_offered, status_rejected])

    table_rows = "".join([
        f"""<tr id="row-{idx}">
            <td><strong style="color:#FFF;">{u[0]}</strong></td>
            <td>{u[1] or '<span style="color:#64748B;">Not Set</span>'}</td>
            <td>{u[2] or '<span style="color:#64748B;">Not Set</span>'}</td>
            <td>{u[3]}</td>
            <td><span class="badge">{u[4]} jobs</span></td>
            <td>
                <button class="btn-del" onclick="deleteUserRow('{u[0]}', 'row-{idx}')">Delete</button>
            </td>
        </tr>"""
        for idx, u in enumerate(users)
    ])

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NexJob AI - Executive Admin Cockpit</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@600;800&display=swap" rel="stylesheet">
        <style>
            :root {{
                --bg: #07090F;
                --surface: #0E1424;
                --elevated: #151D33;
                --border: rgba(255,255,255,0.08);
                --indigo: #6366F1;
                --teal: #14B8A6;
                --coral: #F43F5E;
                --amber: #F59E0B;
                --text: #F8FAFC;
                --muted: #94A3B8;
            }}
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); color: var(--text); padding: 2rem; min-height: 100vh; }}
            .header-bar {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }}
            .title {{ font-size: 1.6rem; font-weight: 800; }}
            .gradient-txt {{ background: linear-gradient(135deg, var(--indigo), var(--teal)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
            
            /* Metric Stat Cards */
            .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }}
            .stat-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }}
            .stat-label {{ font-size: 0.75rem; text-transform: uppercase; color: var(--muted); font-weight: 700; letter-spacing: 0.05em; }}
            .stat-val {{ font-family: 'JetBrains Mono', monospace; font-size: 1.8rem; font-weight: 800; margin-top: 6px; }}
            
            /* Chart Layout */
            .charts-grid {{ display: grid; grid-template-columns: 2fr 1.2fr; gap: 1.5rem; margin-bottom: 2.5rem; }}
            .chart-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; }}
            .chart-title {{ font-size: 0.95rem; font-weight: 700; margin-bottom: 1rem; color: #FFF; }}

            /* User Table & Controls */
            .table-container {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; overflow-x: auto; }}
            .table-top {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px; }}
            .search-box {{ background: var(--elevated); border: 1px solid var(--border); color: #FFF; padding: 8px 14px; border-radius: 8px; font-size: 0.88rem; min-width: 260px; outline: none; }}
            .search-box:focus {{ border-color: var(--indigo); }}
            table {{ width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem; }}
            th, td {{ padding: 12px 16px; border-bottom: 1px solid var(--border); }}
            th {{ background: #0A0E1A; color: var(--muted); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em; }}
            tr:hover {{ background: rgba(255,255,255,0.02); }}
            .badge {{ font-family: 'JetBrains Mono', monospace; background: rgba(99, 102, 241, 0.15); color: #818CF8; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }}
            
            .btn-del {{ background: rgba(244, 63, 94, 0.15); border: 1px solid var(--coral); color: #FECDD3; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }}
            .btn-del:hover {{ background: var(--coral); color: #FFF; }}
            .btn-home {{ background: var(--elevated); border: 1px solid var(--border); color: #FFF; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 0.85rem; font-weight: 600; }}
            .btn-home:hover {{ border-color: var(--indigo); }}

            @media (max-width: 900px) {{
                .charts-grid {{ grid-template-columns: 1fr; }}
            }}
        </style>
    </head>
    <body>
        <div class="header-bar">
            <div>
                <h1 class="title">NexJob AI <span class="gradient-txt">Central Cockpit</span></h1>
                <p style="color: var(--muted); font-size: 0.85rem; margin-top: 4px;">System metrics, user directory, and recruitment pipeline analytics.</p>
            </div>
            <a href="/" class="btn-home">← Open App</a>
        </div>

        <!-- 4 Metric Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Accounts</div>
                <div class="stat-val" style="color: var(--indigo);">{total_users_count}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Users / Week</div>
                <div class="stat-val" style="color: var(--teal);">{avg_per_week}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Users / Month</div>
                <div class="stat-val" style="color: var(--amber);">{avg_per_month}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Tracked Applications</div>
                <div class="stat-val" style="color: #A855F7;">{total_jobs_count}</div>
            </div>
        </div>

        <!-- Interactive Visual Analytics -->
        <div class="charts-grid">
            <div class="chart-card">
                <div class="chart-title">📈 User Registration Growth (Daily / Trend)</div>
                <canvas id="growthChart" height="120"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-title">📊 Global Application Pipeline Status</div>
                <canvas id="pipelineChart" height="120"></canvas>
            </div>
        </div>

        <!-- User Directory & Actions -->
        <div class="table-container">
            <div class="table-top">
                <h3 style="font-size: 1.1rem; font-weight: 700;">Registered Candidate Directory ({total_users_count})</h3>
                <input type="text" id="userSearch" class="search-box" placeholder="Search by email or name..." onkeyup="filterUserTable()">
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Candidate Email</th>
                        <th>Full Name</th>
                        <th>Target Role</th>
                        <th>Joined Date</th>
                        <th>Applications</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="userTableBody">
                    {table_rows if table_rows else '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:2rem;">No registered candidate records found.</td></tr>'}
                </tbody>
            </table>
        </div>

        <script>
            // Chart 1: User Growth Line Chart
            const ctxGrowth = document.getElementById('growthChart').getContext('2d');
            new Chart(ctxGrowth, {{
                type: 'line',
                data: {{
                    labels: {daily_labels},
                    datasets: [{{
                        label: 'Candidate Signups',
                        data: {daily_values},
                        borderColor: '#6366F1',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2,
                        pointBackgroundColor: '#14B8A6'
                    }}]
                }},
                options: {{
                    responsive: true,
                    plugins: {{ legend: {{ display: false }} }},
                    scales: {{
                        y: {{ beginAtZero: true, grid: {{ color: 'rgba(255,255,255,0.05)' }}, ticks: {{ color: '#94A3B8' }} }},
                        x: {{ grid: {{ display: false }}, ticks: {{ color: '#94A3B8' }} }}
                    }}
                }}
            }});

            // Chart 2: Pipeline Donut Chart
            const ctxPipe = document.getElementById('pipelineChart').getContext('2d');
            new Chart(ctxPipe, {{
                type: 'doughnut',
                data: {{
                    labels: {status_labels},
                    datasets: [{{
                        data: {status_values},
                        backgroundColor: ['#6366F1', '#F59E0B', '#14B8A6', '#64748B'],
                        borderWidth: 0
                    }}]
                }},
                options: {{
                    responsive: true,
                    plugins: {{ legend: {{ position: 'bottom', labels: {{ color: '#94A3B8' }} }} }}
                }}
            }});

            // Quick Client-side Table Filter
            function filterUserTable() {{
                const input = document.getElementById('userSearch').value.toLowerCase();
                const rows = document.querySelectorAll('#userTableBody tr');
                rows.forEach(row => {{
                    const text = row.innerText.toLowerCase();
                    row.style.display = text.includes(input) ? '' : 'none';
                }});
            }}

            // 1-Click User Removal with Instant UI Sync
            async function deleteUserRow(email, rowId) {{
                if (!confirm(`Are you sure you want to permanently delete user ${{email}} and all their tracked applications?`)) return;
                try {{
                    const res = await fetch('/admin/delete-user', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ email: email }})
                    }});
                    const data = await res.json();
                    if (res.ok) {{
                        const row = document.getElementById(rowId);
                        if (row) row.remove();
                        alert(`User ${{email}} successfully deleted.`);
                    }} else {{
                        alert(data.detail || "Deletion failed.");
                    }}
                }} catch (e) {{
                    alert("Error deleting user.");
                }}
            }}
        </script>
    </body>
    </html>
    """

@app.get("/")
async def serve_home():
    return FileResponse("index.html")

# Serve assets (style.css, app.js)
app.mount("/static", StaticFiles(directory="."), name="static")
app.mount("/", StaticFiles(directory=".", html=True), name="root_static")
