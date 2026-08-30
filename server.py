import os
import sqlite3
import json
import io
import time
import random
import hashlib
import secrets
import urllib.request
import urllib.error
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, Response
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

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT NOT NULL,
            token TEXT DEFAULT '',
            full_name TEXT DEFAULT '',
            target_role TEXT DEFAULT '',
            skills TEXT DEFAULT '',
            resume TEXT DEFAULT '',
            linkedin_url TEXT DEFAULT '',
            github_url TEXT DEFAULT '',
            portfolio_url TEXT DEFAULT '',
            auth_provider TEXT DEFAULT 'local',
            last_active REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS otps (
            email TEXT PRIMARY KEY,
            otp_hash TEXT NOT NULL,
            purpose TEXT NOT NULL,
            expires_at REAL NOT NULL,
            attempts INTEGER DEFAULT 0
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

# --- Brevo HTTPS Email Dispatcher ---
def send_otp_email(recipient_email: str, otp_code: str, purpose: str):
    brevo_api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("SENDER_EMAIL", "nexjobai.official@gmail.com")

    if not brevo_api_key:
        print(f"\n[DEV FALLBACK - NO BREVO KEY] OTP for {recipient_email}: {otp_code}\n")
        return

    action_text = "complete your registration" if purpose == "signup" else "reset your password"
    subject = "Your NexJob AI Verification Code" if purpose == "signup" else "NexJob AI Password Reset Code"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, sans-serif; background-color: #07090F; color: #F8FAFC; padding: 24px; }}
        .card {{ max-width: 460px; margin: 0 auto; background: #0E1424; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); padding: 32px; }}
        .otp-box {{ background: #151D33; border: 2px dashed #6366F1; border-radius: 8px; text-align: center; padding: 16px; margin: 20px 0; }}
        .otp-code {{ font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2DD4BF; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h2 style="color: #FFFFFF; margin-top:0;">NexJob AI Verification</h2>
        <p style="color: #94A3B8;">Use this 6-digit verification code to {action_text}. Valid for 10 minutes.</p>
        <div class="otp-box"><div class="otp-code">{otp_code}</div></div>
        <p style="font-size: 12px; color: #64748B;">If you didn't request this code, ignore this email.</p>
      </div>
    </body>
    </html>
    """
    payload = json.dumps({
        "sender": {"name": "NexJob AI", "email": sender_email},
        "to": [{"email": recipient_email}],
        "subject": subject,
        "htmlContent": html_content
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        headers={"api-key": brevo_api_key, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"[BREVO DISPATCH ERROR]: {e}")

def get_current_user_email(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid token.")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users WHERE token=?", (token,))
    row = cursor.fetchone()
    if row:
        cursor.execute("UPDATE users SET last_active=? WHERE email=?", (time.time(), row[0]))
        conn.commit()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return row[0]

# --- Pydantic Data Models ---
class SendOTPRequest(BaseModel):
    email: str | None = None
    identifier: str | None = None
    purpose: str

class SignupVerifyRequest(BaseModel):
    email: str | None = None
    identifier: str | None = None
    otp: str
    username: str
    password: str
    full_name: str = ""
    terms_accepted: bool = True

class ResetPasswordRequest(BaseModel):
    email: str | None = None
    identifier: str | None = None
    otp: str
    new_password: str

class LoginRequest(BaseModel):
    identifier: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str

class ProfileRequest(BaseModel):
    full_name: str
    target_role: str
    skills: str
    resume: str
    linkedin_url: str = ""
    github_url: str = ""
    portfolio_url: str = ""

class JobPayload(BaseModel):
    id: str
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

# --- Auth Endpoints ---
@app.post("/api/auth/send-otp")
async def send_otp(payload: SendOTPRequest):
    raw_email = payload.email or payload.identifier or ""
    email_clean = raw_email.strip().lower()
    
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users WHERE LOWER(email)=?", (email_clean,))
    user_exists = cursor.fetchone()

    if payload.purpose == "signup" and user_exists:
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    
    if payload.purpose == "forgot_password" and not user_exists:
        conn.close()
        raise HTTPException(status_code=404, detail="No registered account found with this email.")

    otp_code = f"{random.randint(100000, 999999)}"
    otp_hash = hash_otp(otp_code)
    expires_at = time.time() + 600

    cursor.execute("""
        INSERT OR REPLACE INTO otps (email, otp_hash, purpose, expires_at, attempts)
        VALUES (?, ?, ?, ?, 0)
    """, (email_clean, otp_hash, payload.purpose, expires_at))
    conn.commit()
    conn.close()

    send_otp_email(email_clean, otp_code, payload.purpose)
    return {"status": "success", "message": f"Verification code sent to {email_clean}."}

@app.post("/api/auth/signup-verify")
async def signup_verify(payload: SignupVerifyRequest):
    if not payload.terms_accepted:
        raise HTTPException(status_code=400, detail="You must agree to the Terms of Service and Privacy Policy.")
        
    raw_email = payload.email or payload.identifier or ""
    email_clean = raw_email.strip().lower()
    username_clean = payload.username.strip().lower()
    otp = payload.otp.strip()
    
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT otp_hash, expires_at, attempts, purpose FROM otps WHERE email=?", (email_clean,))
    otp_record = cursor.fetchone()

    if not otp_record:
        conn.close()
        raise HTTPException(status_code=400, detail="OTP expired or request not found.")

    otp_hash, expires_at, attempts, purpose = otp_record

    if time.time() > expires_at or attempts >= 5 or hash_otp(otp) != otp_hash or purpose != "signup":
        cursor.execute("UPDATE otps SET attempts = attempts + 1 WHERE email=?", (email_clean,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code.")

    hashed_pwd = hash_password(payload.password)
    new_token = secrets.token_hex(24)
    now = time.time()

    try:
        cursor.execute("""
            INSERT INTO users (email, username, password, token, full_name, auth_provider, last_active)
            VALUES (?, ?, ?, ?, ?, 'local', ?)
        """, (email_clean, username_clean, hashed_pwd, new_token, payload.full_name or username_clean, now))
        cursor.execute("DELETE FROM otps WHERE email=?", (email_clean,))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email is already registered.")
    
    conn.close()
    return {
        "status": "success",
        "token": new_token,
        "email": email_clean,
        "profile": {"fullName": payload.full_name or username_clean, "targetRole": "", "skills": "", "resume": "", "linkedin": "", "github": ""}
    }

@app.post("/api/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    raw_email = payload.email or payload.identifier or ""
    email_clean = raw_email.strip().lower()
    otp = payload.otp.strip()

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT otp_hash, expires_at, attempts, purpose FROM otps WHERE email=?", (email_clean,))
    otp_record = cursor.fetchone()

    if not otp_record or time.time() > otp_record[1] or otp_record[2] >= 5 or hash_otp(otp) != otp_record[0] or otp_record[3] != "forgot_password":
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code.")

    new_hashed_pwd = hash_password(payload.new_password)
    new_token = secrets.token_hex(24)

    cursor.execute("UPDATE users SET password=?, token=?, last_active=? WHERE LOWER(email)=?", (new_hashed_pwd, new_token, time.time(), email_clean))
    cursor.execute("DELETE FROM otps WHERE email=?", (email_clean,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Password updated successfully."}

@app.post("/api/auth/login")
async def login(payload: LoginRequest):
    identifier = payload.identifier.strip().lower()
    hashed_pwd = hash_password(payload.password)
    new_token = secrets.token_hex(24)
    now = time.time()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT email, full_name, target_role, skills, resume, linkedin_url, github_url, portfolio_url 
        FROM users 
        WHERE (LOWER(email)=? OR LOWER(username)=?) AND password=?
    """, (identifier, identifier, hashed_pwd))
    user = cursor.fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials. Check your email/username and password.")

    user_email = user[0]
    cursor.execute("UPDATE users SET token=?, last_active=? WHERE email=?", (new_token, now, user_email))
    conn.commit()
    conn.close()

    return {
        "token": new_token,
        "email": user_email,
        "profile": {
            "fullName": user[1], "targetRole": user[2], "skills": user[3],
            "resume": user[4], "linkedin": user[5], "github": user[6], "portfolio": user[7]
        }
    }

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
            raise HTTPException(status_code=400, detail="No email provided by Google.")

        email_clean = email.strip().lower()
        new_token = secrets.token_hex(24)
        now = time.time()

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT email, full_name, target_role, skills, resume, linkedin_url, github_url, portfolio_url FROM users WHERE email=?", (email_clean,))
        user = cursor.fetchone()

        if not user:
            cursor.execute("""
                INSERT INTO users (email, username, password, token, full_name, auth_provider, last_active) 
                VALUES (?, ?, 'google_oauth_verified', ?, ?, 'google', ?)
            """, (email_clean, email_clean.split('@')[0], new_token, name, now))
            user_profile = {
                "fullName": name, "targetRole": "", "skills": "", "resume": "", 
                "linkedin": "", "github": "", "portfolio": ""
            }
        else:
            cursor.execute("UPDATE users SET token=?, last_active=? WHERE email=?", (new_token, now, email_clean))
            user_profile = {
                "fullName": user[1] or name, "targetRole": user[2], "skills": user[3], 
                "resume": user[4], "linkedin": user[5], "github": user[6], "portfolio": user[7]
            }
        conn.commit()
        conn.close()
        return {"status": "success", "token": new_token, "email": email_clean, "profile": user_profile}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Login Error: {str(e)}")

@app.post("/api/auth/logout")
async def logout(user_email: str = Depends(get_current_user_email)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET token='' WHERE email=?", (user_email,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# --- Member Features ---
@app.post("/api/resume/upload-pdf")
async def upload_pdf_resume(file: UploadFile = File(...), user_email: str = Depends(get_current_user_email)):
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
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET resume=?, last_active=? WHERE email=?", (extracted_text.strip(), time.time(), user_email))
        conn.commit()
        conn.close()
        return {"extracted_text": extracted_text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing error: {str(e)}")

@app.get("/api/jobs")
async def get_jobs(user_email: str = Depends(get_current_user_email)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, company, role, date, status, tags, jd FROM jobs WHERE user_email=?", (user_email,))
    rows = cursor.fetchall()
    conn.close()
    jobs = [{"id": r[0], "company": r[1], "role": r[2], "date": r[3], "status": r[4], "tags": json.loads(r[5]), "jd": r[6]} for r in rows]
    return {"jobs": jobs}

@app.post("/api/jobs/save")
async def save_job(payload: JobPayload, user_email: str = Depends(get_current_user_email)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO jobs (id, user_email, company, role, date, status, tags, jd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (payload.id, user_email, payload.company, payload.role, payload.date, payload.status, json.dumps(payload.tags), payload.jd))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/jobs/update_status")
async def update_job_status(data: dict, user_email: str = Depends(get_current_user_email)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE jobs SET status=? WHERE id=? AND user_email=?", (data.get("status"), data.get("id"), user_email))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/profile/save")
async def save_profile(payload: ProfileRequest, user_email: str = Depends(get_current_user_email)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users 
        SET full_name=?, target_role=?, skills=?, resume=?, linkedin_url=?, github_url=?, portfolio_url=?, last_active=?
        WHERE email=?
    """, (payload.full_name, payload.target_role, payload.skills, payload.resume, payload.linkedin_url, payload.github_url, payload.portfolio_url, time.time(), user_email))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/account/delete")
async def delete_account(user_email: str = Depends(get_current_user_email)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE user_email=?", (user_email,))
    cursor.execute("DELETE FROM users WHERE email=?", (user_email,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Account permanently deleted."}

# --- AI Decision Engine ---
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

FORMAT EXACTLY AS FOLLOWS:
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
            continue

    raise HTTPException(
        status_code=429, 
        detail=f"AI model generation temporarily rate-limited. Please retry shortly. ({str(last_error)})"
    )

# --- Admin Cockpit with IST Timestamps & Active Dots ---
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

@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(credentials: HTTPBasicCredentials = Depends(security)):
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASS", "adminsecret")
    if credentials.username != admin_user or credentials.password != admin_pass:
        raise HTTPException(status_code=401, detail="Unauthorized Admin Access")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Converts SQLite default UTC to IST (UTC +5:30)
    cursor.execute("""
        SELECT 
            u.email, 
            u.full_name, 
            u.target_role, 
            datetime(u.created_at, '+5 hours', '+30 minutes') as ist_created_at, 
            u.token, 
            u.last_active, 
            COUNT(j.id) as job_count
        FROM users u
        LEFT JOIN jobs j ON u.email = j.user_email
        GROUP BY u.email
        ORDER BY u.created_at DESC
    """)
    users = cursor.fetchall()
    
    cursor.execute("SELECT COUNT(*) FROM jobs")
    total_jobs_count = cursor.fetchone()[0] or 0
    conn.close()

    total_users_count = len(users)
    now = time.time()

    table_rows = []
    active_now_count = 0

    for idx, u in enumerate(users):
        email, full_name, target_role, created_at, token, last_active, job_count = u
        is_active = bool(token and token.strip() and (now - (last_active or 0) < 7200))
        if is_active:
            active_now_count += 1
            dot_html = '<span style="display:inline-flex; align-items:center; gap:6px; color:#2DD4BF;"><span style="height:8px; width:8px; background:#2DD4BF; border-radius:50%; box-shadow:0 0 8px #2DD4BF;"></span> Online</span>'
        else:
            dot_html = '<span style="display:inline-flex; align-items:center; gap:6px; color:#64748B;"><span style="height:8px; width:8px; background:#64748B; border-radius:50%;"></span> Offline</span>'

        table_rows.append(f"""
        <tr id="row-{idx}">
            <td><strong style="color:#FFF;">{email}</strong></td>
            <td>{dot_html}</td>
            <td>{full_name or '<span style="color:#64748B;">Not Set</span>'}</td>
            <td>{target_role or '<span style="color:#64748B;">Not Set</span>'}</td>
            <td>{created_at} IST</td>
            <td><span class="badge">{job_count} jobs</span></td>
            <td><button class="btn-del" onclick="deleteUserRow('{email}', 'row-{idx}')">Delete</button></td>
        </tr>
        """)

    rendered_table = "".join(table_rows) if table_rows else '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#64748B;">No users registered yet.</td></tr>'

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8"><title>NexJob AI - Admin Cockpit</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@600;800&display=swap" rel="stylesheet">
        <style>
            :root {{ --bg:#07090F; --surface:#0E1424; --elevated:#151D33; --border:rgba(255,255,255,0.08); --indigo:#6366F1; --teal:#14B8A6; --coral:#F43F5E; --text:#F8FAFC; --muted:#94A3B8; }}
            * {{ margin:0; padding:0; box-sizing:border-box; }}
            body {{ font-family:'Plus Jakarta Sans', sans-serif; background:var(--bg); color:var(--text); padding:2rem; }}
            .header {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem; }}
            .stats {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:1rem; margin-bottom:2rem; }}
            .card {{ background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.25rem; }}
            .val {{ font-family:'JetBrains Mono', monospace; font-size:1.8rem; font-weight:800; margin-top:4px; }}
            table {{ width:100%; border-collapse:collapse; text-align:left; font-size:0.88rem; }}
            th, td {{ padding:12px 16px; border-bottom:1px solid var(--border); }}
            th {{ background:#0A0E1A; color:var(--muted); text-transform:uppercase; font-size:0.72rem; }}
            .badge {{ background:rgba(99,102,241,0.15); color:#818CF8; padding:3px 8px; border-radius:4px; font-weight:700; font-family:'JetBrains Mono', monospace; }}
            .btn-del {{ background:rgba(244,63,94,0.15); border:1px solid var(--coral); color:#FECDD3; padding:4px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div><h1 style="font-size:1.6rem; font-weight:800;">NexJob AI Central Cockpit</h1><p style="color:var(--muted); font-size:0.85rem;">Global accounts, live session tracking, and user directories.</p></div>
            <a href="/" style="background:var(--elevated); border:1px solid var(--border); color:#FFF; padding:8px 16px; border-radius:8px; text-decoration:none; font-size:0.85rem;">← View Main App</a>
        </div>
        <div class="stats">
            <div class="card"><div style="font-size:0.75rem; text-transform:uppercase; color:var(--muted); font-weight:700;">Total Registrations</div><div class="val" style="color:var(--indigo);">{total_users_count}</div></div>
            <div class="card"><div style="font-size:0.75rem; text-transform:uppercase; color:var(--muted); font-weight:700;">Live / Active Users</div><div class="val" style="color:var(--teal);">{active_now_count}</div></div>
            <div class="card"><div style="font-size:0.75rem; text-transform:uppercase; color:var(--muted); font-weight:700;">Tracked Applications</div><div class="val" style="color:#A855F7;">{total_jobs_count}</div></div>
        </div>
        <div class="card" style="overflow-x:auto;">
            <h3 style="margin-bottom:1rem; font-size:1.05rem;">Registered Candidate History & Status</h3>
            <table>
                <thead>
                    <tr><th>Candidate Email</th><th>Status</th><th>Full Name</th><th>Target Role</th><th>Joined Date (IST)</th><th>Applications</th><th>Actions</th></tr>
                </thead>
                <tbody>{rendered_table}</tbody>
            </table>
        </div>
        <script>
            async function deleteUserRow(email, rowId) {{
                if (!confirm(`Delete ${{email}}?`)) return;
                const res = await fetch('/admin/delete-user', {{ method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify({{ email }}) }});
                if (res.ok) document.getElementById(rowId).remove();
            }}
        </script>
    </body>
    </html>
    """

# --- Sitemap, Robots, Static Mounts ---
@app.get("/sitemap.xml")
async def get_sitemap():
    content = """<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://ai-job-tracker-9a3m.onrender.com/</loc><lastmod>2026-08-30</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>"""
    return Response(content=content, media_type="application/xml")

@app.get("/robots.txt")
async def get_robots():
    return Response(content="User-agent: *\nAllow: /\nSitemap: https://ai-job-tracker-9a3m.onrender.com/sitemap.xml", media_type="text/plain")

@app.get("/")
async def serve_home():
    return FileResponse("index.html")

app.mount("/static", StaticFiles(directory="."), name="static")
app.mount("/", StaticFiles(directory=".", html=True), name="root_static")
