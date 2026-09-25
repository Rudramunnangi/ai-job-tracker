import os
import sqlite3
import json
import io
import time
import datetime
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
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Fetch complete user records with joined applications count
    cursor.execute("""
        SELECT 
            u.email, 
            u.username,
            u.full_name, 
            u.target_role, 
            u.skills,
            u.resume,
            u.linkedin_url,
            u.github_url,
            u.portfolio_url,
            u.auth_provider,
            u.created_at,
            datetime(u.created_at, '+5 hours', '+30 minutes') as ist_created_at, 
            date(u.created_at, '+5 hours', '+30 minutes') as ist_created_date,
            u.token, 
            u.last_active, 
            datetime(u.last_active, 'unixepoch', '+5 hours', '+30 minutes') as ist_last_active,
            COUNT(j.id) as job_count
        FROM users u
        LEFT JOIN jobs j ON u.email = j.user_email
        GROUP BY u.email
        ORDER BY u.created_at DESC
    """)
    user_rows = cursor.fetchall()

    # 2. Fetch all tracked job applications
    cursor.execute("""
        SELECT id, user_email, company, role, date, status, tags
        FROM jobs
        ORDER BY date DESC
    """)
    job_rows = cursor.fetchall()

    # 3. Daily customer registration breakdown (Past 14 Days)
    cursor.execute("""
        SELECT 
            date(created_at, '+5 hours', '+30 minutes') as signup_date,
            COUNT(*) as new_signups
        FROM users
        GROUP BY signup_date
        ORDER BY signup_date DESC
        LIMIT 14
    """)
    daily_rows = cursor.fetchall()

    cursor.execute("SELECT COUNT(*) FROM jobs")
    total_jobs_count = cursor.fetchone()[0] or 0
    conn.close()

    total_users_count = len(user_rows)
    now = time.time()

    # Map jobs by user email
    user_jobs_map = {}
    for j in job_rows:
        ue = j["user_email"]
        if ue not in user_jobs_map:
            user_jobs_map[ue] = []
        user_jobs_map[ue].append({
            "id": j["id"],
            "company": j["company"],
            "role": j["role"],
            "date": j["date"],
            "status": j["status"],
            "tags": j["tags"]
        })

    active_now_count = 0
    new_today_count = 0
    regular_users_count = 0
    google_auth_count = 0

    now_ist = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
    today_ist_str = now_ist.strftime("%Y-%m-%d")

    customers_list = []

    for u in user_rows:
        email = u["email"]
        created_date = u["ist_created_date"] or ""
        last_act = u["last_active"] or 0
        job_cnt = u["job_count"] or 0
        auth_prov = u["auth_provider"] or "local"

        is_online = bool(u["token"] and u["token"].strip() and (now - last_act < 7200))
        if is_online:
            active_now_count += 1

        is_new_today = (created_date == today_ist_str)
        if is_new_today:
            new_today_count += 1

        is_regular = (job_cnt > 0) or (last_act > 0 and created_date != today_ist_str)
        if is_regular:
            regular_users_count += 1

        if auth_prov == "google":
            google_auth_count += 1

        customers_list.append({
            "email": email,
            "username": u["username"] or "",
            "full_name": u["full_name"] or "",
            "target_role": u["target_role"] or "",
            "skills": u["skills"] or "",
            "resume": u["resume"] or "",
            "linkedin_url": u["linkedin_url"] or "",
            "github_url": u["github_url"] or "",
            "portfolio_url": u["portfolio_url"] or "",
            "auth_provider": auth_prov,
            "ist_created_at": u["ist_created_at"] or "N/A",
            "ist_last_active": u["ist_last_active"] if last_act > 0 else "Never",
            "is_online": is_online,
            "job_count": job_cnt,
            "is_new_today": is_new_today,
            "is_regular": is_regular,
            "jobs": user_jobs_map.get(email, [])
        })

    avg_jobs_per_user = round(total_jobs_count / max(1, total_users_count), 1)

    daily_signups_data = [{"date": r["signup_date"] or "N/A", "count": r["new_signups"]} for r in daily_rows]
    customers_json = json.dumps(customers_list).replace("</script>", "<\\/script>")
    daily_json = json.dumps(daily_signups_data).replace("</script>", "<\\/script>")

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NexJob AI - Executive Admin Cockpit</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700;800&family=Google+Sans+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
        <style>
            :root {{
                --bg: #07090F;
                --surface: #0E1424;
                --elevated: #151D33;
                --border: rgba(255, 255, 255, 0.08);
                --border-hover: rgba(255, 255, 255, 0.18);
                --indigo: #5B5FEF;
                --teal: #22D3C8;
                --coral: #FF7A59;
                --amber: #F5A623;
                --text: #F8FAFC;
                --muted: #94A3B8;
                --dim: #4B5565;
            }}
            * {{ margin:0; padding:0; box-sizing:border-box; }}
            body {{
                font-family: 'Google Sans', 'Google Sans Text', sans-serif;
                background-color: var(--bg);
                color: var(--text);
                padding: 2rem;
                min-height: 100vh;
                line-height: 1.5;
            }}
            .header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 1.5rem;
                margin-bottom: 2rem;
                padding-bottom: 1.5rem;
                border-bottom: 1px solid var(--border);
            }}
            .header h1 {{ font-size: 1.65rem; font-weight: 800; letter-spacing: -0.02em; color: #FFF; }}
            .header p {{ color: var(--muted); font-size: 0.88rem; margin-top: 4px; }}
            .btn-group {{ display: flex; gap: 10px; flex-wrap: wrap; }}
            .btn {{
                background: var(--elevated);
                border: 1px solid var(--border);
                color: #FFF;
                padding: 8px 16px;
                border-radius: 8px;
                font-family: inherit;
                font-size: 0.84rem;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.15s ease;
            }}
            .btn:hover {{ background: #1E294B; border-color: var(--border-hover); }}
            .btn-primary {{ background: var(--indigo); border-color: transparent; }}
            .btn-primary:hover {{ background: #4B4FD8; }}

            /* KPI Stats Grid */
            .stats-grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 1.25rem;
                margin-bottom: 2rem;
            }}
            .stat-card {{
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 1.25rem 1.4rem;
                display: flex;
                flex-direction: column;
                gap: 6px;
                position: relative;
                overflow: hidden;
            }}
            .stat-title {{
                font-size: 0.76rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: var(--muted);
            }}
            .stat-value {{
                font-family: 'JetBrains Mono', monospace;
                font-size: 1.9rem;
                font-weight: 800;
                color: #FFF;
            }}
            .stat-sub {{ font-size: 0.75rem; color: var(--muted); }}

            /* Daily Breakdown & Grid Layout */
            .main-grid {{
                display: grid;
                grid-template-columns: 1fr 340px;
                gap: 1.5rem;
                margin-bottom: 2rem;
            }}
            @media (max-width: 1080px) {{
                .main-grid {{ grid-template-columns: 1fr; }}
            }}
            .panel {{
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 1.5rem;
            }}
            .panel-header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.25rem;
                flex-wrap: wrap;
                gap: 10px;
            }}
            .panel-title {{ font-size: 1.1rem; font-weight: 700; color: #FFF; }}

            /* Search & Filter Bar */
            .filter-bar {{
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 1.25rem;
            }}
            .search-input {{
                background: var(--bg);
                border: 1px solid var(--border);
                color: #FFF;
                padding: 8px 14px;
                border-radius: 8px;
                font-family: inherit;
                font-size: 0.85rem;
                min-width: 280px;
                flex: 1;
            }}
            .search-input:focus {{ outline: none; border-color: var(--indigo); }}
            .filter-chip {{
                background: var(--elevated);
                border: 1px solid var(--border);
                color: var(--muted);
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.78rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
            }}
            .filter-chip.active, .filter-chip:hover {{
                background: rgba(91, 95, 239, 0.2);
                border-color: var(--indigo);
                color: #FFF;
            }}

            /* Table Styles */
            table {{ width: 100%; border-collapse: collapse; text-align: left; font-size: 0.86rem; }}
            th, td {{ padding: 12px 14px; border-bottom: 1px solid var(--border); }}
            th {{
                background: #0A0E1A;
                color: var(--muted);
                text-transform: uppercase;
                font-size: 0.72rem;
                letter-spacing: 0.05em;
                position: sticky;
                top: 0;
            }}
            tr:hover td {{ background: rgba(255, 255, 255, 0.02); }}

            /* Clickable Customer Name Button */
            .customer-btn {{
                background: transparent;
                border: none;
                padding: 0;
                text-align: left;
                cursor: pointer;
                font-family: inherit;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }}
            .customer-btn:hover .c-name {{
                color: var(--teal);
                text-decoration: underline;
            }}
            .c-name {{ font-weight: 700; color: #FFF; font-size: 0.88rem; transition: color 0.15s ease; }}
            .c-email {{ font-size: 0.74rem; color: var(--muted); }}

            .dot-online {{
                display: inline-flex;
                align-items: center;
                gap: 6px;
                color: var(--teal);
                font-size: 0.75rem;
                font-weight: 600;
            }}
            .dot-online::before {{
                content: '';
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: var(--teal);
                box-shadow: 0 0 8px var(--teal);
            }}
            .dot-offline {{
                display: inline-flex;
                align-items: center;
                gap: 6px;
                color: var(--muted);
                font-size: 0.75rem;
            }}
            .dot-offline::before {{
                content: '';
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: var(--dim);
            }}
            .badge {{
                background: rgba(91, 95, 239, 0.15);
                color: #A5B4FC;
                padding: 3px 8px;
                border-radius: 4px;
                font-weight: 700;
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.75rem;
            }}
            .badge-teal {{
                background: rgba(34, 211, 200, 0.15);
                color: var(--teal);
            }}
            .badge-amber {{
                background: rgba(245, 166, 35, 0.15);
                color: var(--amber);
            }}
            .btn-sm-del {{
                background: rgba(220, 38, 38, 0.15);
                border: 1px solid rgba(220, 38, 38, 0.35);
                color: #FECDD3;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 0.74rem;
                font-weight: 600;
                cursor: pointer;
            }}
            .btn-sm-del:hover {{ background: rgba(220, 38, 38, 0.3); }}

            /* Daily Signups Bars */
            .daily-row {{
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid var(--border);
                font-size: 0.82rem;
            }}
            .daily-bar-wrap {{
                flex: 1;
                height: 6px;
                background: var(--elevated);
                border-radius: 3px;
                overflow: hidden;
            }}
            .daily-bar {{
                height: 100%;
                background: linear-gradient(90deg, var(--indigo), var(--teal));
                border-radius: 3px;
            }}

            /* Detail Modal (Opens when clicking name) */
            .modal-backdrop {{
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(6px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 1.5rem;
            }}
            .modal-box {{
                background: var(--surface);
                border: 1px solid var(--border-hover);
                border-radius: 14px;
                width: 100%;
                max-width: 680px;
                max-height: 90vh;
                overflow-y: auto;
                padding: 2rem;
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }}
            .modal-header {{
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 1px solid var(--border);
                padding-bottom: 1rem;
            }}
            .detail-section {{
                display: flex;
                flex-direction: column;
                gap: 8px;
            }}
            .detail-label {{
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--muted);
            }}
            .detail-value {{
                font-size: 0.9rem;
                color: #FFF;
            }}
            .resume-box {{
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 1rem;
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.76rem;
                color: #CBD5E1;
                max-height: 180px;
                overflow-y: auto;
                white-space: pre-wrap;
                line-height: 1.5;
            }}
            .skill-chip {{
                background: var(--elevated);
                border: 1px solid var(--border);
                color: var(--teal);
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.74rem;
                display: inline-block;
                margin: 2px 4px 2px 0;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <h1>NexJob AI Owner Central Cockpit</h1>
                <p>Real-time customer analytics, candidate profiles, daily signups & system activity (IST Timezone).</p>
            </div>
            <div class="btn-group">
                <button class="btn" onclick="exportToCSV()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Customers CSV
                </button>
                <a href="/" target="_blank" class="btn btn-primary">← View Public Web App</a>
            </div>
        </div>

        <!-- 6 Key Performance Indicators -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-title">Total Customers</div>
                <div class="stat-value" style="color:var(--indigo);">{total_users_count}</div>
                <div class="stat-sub">{google_auth_count} Google • {total_users_count - google_auth_count} Email</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">New Today (Last 24h)</div>
                <div class="stat-value" style="color:var(--teal);">{new_today_count}</div>
                <div class="stat-sub">Joined on {today_ist_str}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Regular Customers</div>
                <div class="stat-value" style="color:#A855F7;">{regular_users_count}</div>
                <div class="stat-sub">Active / Tracking Apps</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Live Right Now</div>
                <div class="stat-value" style="color:var(--teal);">{active_now_count}</div>
                <div class="stat-sub">Active in past 2 hours</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Tracked Applications</div>
                <div class="stat-value" style="color:var(--amber);">{total_jobs_count}</div>
                <div class="stat-sub">Candidate job pipelines</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Avg Apps / User</div>
                <div class="stat-value" style="color:var(--coral);">{avg_jobs_per_user}</div>
                <div class="stat-sub">Average application volume</div>
            </div>
        </div>

        <!-- Main Workspace Grid: Customer Directory + Daily Growth Breakdown -->
        <div class="main-grid">
            <!-- Left: Customer Directory Table -->
            <div class="panel">
                <div class="panel-header">
                    <div>
                        <div class="panel-title">Customer Directory</div>
                        <div style="font-size:0.78rem; color:var(--muted); margin-top:2px;">Click any candidate's name to view their complete profile, resume, and tracked jobs.</div>
                    </div>
                </div>

                <div class="filter-bar">
                    <input type="text" id="searchInput" class="search-input" placeholder="Search by name, email, target role..." oninput="filterCustomers()">
                    <button class="filter-chip active" id="chipAll" onclick="setFilter('all')">All ({total_users_count})</button>
                    <button class="filter-chip" id="chipOnline" onclick="setFilter('online')">Online ({active_now_count})</button>
                    <button class="filter-chip" id="chipNew" onclick="setFilter('new')">New Today ({new_today_count})</button>
                    <button class="filter-chip" id="chipRegular" onclick="setFilter('regular')">Regular ({regular_users_count})</button>
                    <button class="filter-chip" id="chipGoogle" onclick="setFilter('google')">Google ({google_auth_count})</button>
                </div>

                <div style="overflow-x:auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Candidate (Click Name)</th>
                                <th>Status</th>
                                <th>Target Role</th>
                                <th>Applications</th>
                                <th>Joined (IST)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="customersTableBody">
                            <!-- Populated dynamically via JS -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Right: Daily Customer Signups Trend -->
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">Daily Signups</div>
                    <span class="badge badge-teal">Past 14 Days</span>
                </div>
                <div id="dailySignupsList">
                    <!-- Populated via JS -->
                </div>
            </div>
        </div>

        <!-- Customer Detail Modal (Opens when clicking Candidate Name) -->
        <div class="modal-backdrop" id="customerModal" onclick="if(event.target===this) closeCustomerModal()">
            <div class="modal-box">
                <div class="modal-header">
                    <div>
                        <h2 id="mName" style="font-size:1.35rem; font-weight:800; color:#FFF;">Candidate Name</h2>
                        <div id="mEmail" style="color:var(--muted); font-size:0.85rem; margin-top:2px;">email@example.com</div>
                    </div>
                    <button class="btn" style="padding:4px 10px;" onclick="closeCustomerModal()">&times; Close</button>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
                    <div class="detail-section">
                        <div class="detail-label">Status & Account Type</div>
                        <div id="mStatusBadge" class="detail-value">Online</div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-label">Joined Date (IST)</div>
                        <div id="mJoined" class="detail-value" style="font-family:'JetBrains Mono', monospace;">2026-09-25</div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-label">Target Role</div>
                        <div id="mRole" class="detail-value">Software Engineer</div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-label">Last Active (IST)</div>
                        <div id="mLastActive" class="detail-value" style="font-family:'JetBrains Mono', monospace;">Just now</div>
                    </div>
                </div>

                <div class="detail-section" id="mSocialWrap">
                    <div class="detail-label">Links & Profiles</div>
                    <div id="mSocialLinks" style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.82rem;"></div>
                </div>

                <div class="detail-section">
                    <div class="detail-label">Stored Skills</div>
                    <div id="mSkills" style="display:flex; flex-wrap:wrap; gap:4px;">None specified</div>
                </div>

                <div class="detail-section">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="detail-label">Stored Resume Text</div>
                        <button class="btn" style="padding:2px 8px; font-size:0.72rem;" onclick="copyModalResume()">Copy Resume</button>
                    </div>
                    <div class="resume-box" id="mResume">No resume on file.</div>
                </div>

                <div class="detail-section">
                    <div class="detail-label">Tracked Job Applications (<span id="mJobCount">0</span>)</div>
                    <div id="mJobsTable" style="max-height:160px; overflow-y:auto;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:1rem; margin-top:0.5rem;">
                    <a id="mMailToBtn" href="#" class="btn btn-primary" style="font-size:0.82rem;">Email Candidate</a>
                    <button id="mDeleteBtn" class="btn-sm-del" style="padding:8px 14px; font-size:0.82rem;" onclick="deleteFromModal()">Delete Customer Account</button>
                </div>
            </div>
        </div>

        <script>
            const CUSTOMERS = {customers_json};
            const DAILY_DATA = {daily_json};
            let currentFilter = 'all';
            let currentCustomerEmail = null;

            // Render Table
            function renderTable(data) {{
                const tbody = document.getElementById('customersTableBody');
                if (!data || data.length === 0) {{
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--muted);">No candidates match your search.</td></tr>';
                    return;
                }}

                tbody.innerHTML = data.map((c, idx) => {{
                    const dot = c.is_online ? '<span class="dot-online">Online</span>' : '<span class="dot-offline">Offline</span>';
                    const nameDisplay = c.full_name || 'Candidate (No name set)';
                    return `
                    <tr id="row-${{idx}}">
                        <td>
                            <button class="customer-btn" onclick="openCustomerModal('${{encodeURIComponent(c.email)}}')">
                                <span class="c-name">${{nameDisplay}}</span>
                                <span class="c-email">${{c.email}}</span>
                            </button>
                        </td>
                        <td>${{dot}}</td>
                        <td style="color:#CBD5E1;">${{c.target_role || '<span style="color:var(--dim);">Not specified</span>'}}</td>
                        <td><span class="badge badge-teal">${{c.job_count}} apps</span></td>
                        <td style="font-family:'JetBrains Mono', monospace; font-size:0.78rem; color:var(--muted);">${{c.ist_created_at}}</td>
                        <td>
                            <div style="display:flex; gap:6px;">
                                <button class="btn" style="padding:3px 8px; font-size:0.72rem;" onclick="openCustomerModal('${{encodeURIComponent(c.email)}}')">Details</button>
                                <button class="btn-sm-del" onclick="deleteUserRow('${{c.email}}', 'row-${{idx}}')">Delete</button>
                            </div>
                        </td>
                    </tr>
                    `;
                }}).join('');
            }}

            // Render Daily Signups
            function renderDaily() {{
                const container = document.getElementById('dailySignupsList');
                if (!DAILY_DATA || DAILY_DATA.length === 0) {{
                    container.innerHTML = '<div style="color:var(--muted); font-size:0.85rem; padding:1rem 0;">No signups recorded yet.</div>';
                    return;
                }}
                const maxCount = Math.max(...DAILY_DATA.map(d => d.count), 1);
                container.innerHTML = DAILY_DATA.map(d => {{
                    const pct = Math.min(100, Math.round((d.count / maxCount) * 100));
                    return `
                    <div class="daily-row">
                        <span style="font-family:'JetBrains Mono', monospace; color:#CBD5E1;">${{d.date}}</span>
                        <div class="daily-bar-wrap">
                            <div class="daily-bar" style="width:${{pct}}%;"></div>
                        </div>
                        <span class="badge badge-teal">+${{d.count}}</span>
                    </div>
                    `;
                }}).join('');
            }}

            // Open Customer Detail Modal
            function openCustomerModal(encodedEmail) {{
                const email = decodeURIComponent(encodedEmail);
                const c = CUSTOMERS.find(item => item.email === email);
                if (!c) return;

                currentCustomerEmail = email;
                document.getElementById('mName').textContent = c.full_name || 'Candidate Account';
                document.getElementById('mEmail').textContent = c.email + (c.username ? ' (@' + c.username + ')' : '');
                
                const dotHtml = c.is_online ? '<span class="dot-online">Online Session Active</span>' : '<span class="dot-offline">Offline</span>';
                const authBadge = c.auth_provider === 'google' ? '<span class="badge badge-amber" style="margin-left:6px;">Google OAuth</span>' : '<span class="badge" style="margin-left:6px;">Email & Password</span>';
                document.getElementById('mStatusBadge').innerHTML = dotHtml + authBadge;

                document.getElementById('mJoined').textContent = c.ist_created_at;
                document.getElementById('mLastActive').textContent = c.ist_last_active;
                document.getElementById('mRole').textContent = c.target_role || 'Not specified';

                // Social Links
                const socialDiv = document.getElementById('mSocialLinks');
                const links = [];
                if (c.linkedin_url) links.push(`<a href="${{c.linkedin_url}}" target="_blank" style="color:var(--teal); text-decoration:none;">LinkedIn ↗</a>`);
                if (c.github_url) links.push(`<a href="${{c.github_url}}" target="_blank" style="color:#FFF; text-decoration:none;">GitHub ↗</a>`);
                if (c.portfolio_url) links.push(`<a href="${{c.portfolio_url}}" target="_blank" style="color:var(--indigo); text-decoration:none;">Portfolio ↗</a>`);
                socialDiv.innerHTML = links.length ? links.join(' • ') : '<span style="color:var(--dim);">No external profile links added</span>';

                // Skills
                const skillsDiv = document.getElementById('mSkills');
                if (c.skills && c.skills.trim()) {{
                    const tags = c.skills.split(',').map(s => s.trim()).filter(Boolean);
                    skillsDiv.innerHTML = tags.map(t => `<span class="skill-chip">${{t}}</span>`).join('');
                }} else {{
                    skillsDiv.innerHTML = '<span style="color:var(--dim); font-size:0.82rem;">No skills saved in profile.</span>';
                }}

                // Resume
                document.getElementById('mResume').textContent = c.resume || 'No resume stored by candidate.';

                // Tracked Jobs
                const jobsDiv = document.getElementById('mJobsTable');
                document.getElementById('mJobCount').textContent = c.jobs.length;
                if (c.jobs && c.jobs.length > 0) {{
                    jobsDiv.innerHTML = `
                        <table style="font-size:0.78rem;">
                            <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Date</th></tr></thead>
                            <tbody>
                                ${{c.jobs.map(j => `
                                    <tr>
                                        <td><strong>${{j.company}}</strong></td>
                                        <td>${{j.role}}</td>
                                        <td><span class="badge">${{j.status}}</span></td>
                                        <td style="color:var(--muted);">${{j.date}}</td>
                                    </tr>
                                `).join('')}}
                            </tbody>
                        </table>
                    `;
                }} else {{
                    jobsDiv.innerHTML = '<div style="color:var(--dim); font-size:0.82rem; padding:6px 0;">No job applications tracked yet.</div>';
                }}

                document.getElementById('mMailToBtn').href = `mailto:${{c.email}}?subject=NexJob%20AI%20Candidate%20Update`;
                document.getElementById('customerModal').style.display = 'flex';
            }}

            function closeCustomerModal() {{
                document.getElementById('customerModal').style.display = 'none';
            }}

            function copyModalResume() {{
                const txt = document.getElementById('mResume').textContent;
                navigator.clipboard.writeText(txt);
                alert('Candidate resume copied to clipboard.');
            }}

            async function deleteFromModal() {{
                if (!currentCustomerEmail) return;
                if (!confirm(`Permanently delete account and all data for ${{currentCustomerEmail}}?`)) return;
                const res = await fetch('/admin/delete-user', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ email: currentCustomerEmail }})
                }});
                if (res.ok) {{
                    alert(`User ${{currentCustomerEmail}} successfully deleted.`);
                    location.reload();
                }}
            }}

            async function deleteUserRow(email, rowId) {{
                if (!confirm(`Delete user ${{email}}?`)) return;
                const res = await fetch('/admin/delete-user', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ email }})
                }});
                if (res.ok) {{
                    const el = document.getElementById(rowId);
                    if (el) el.remove();
                }}
            }}

            // Filter & Search Logic
            function setFilter(type) {{
                currentFilter = type;
                document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                const chip = document.getElementById('chip' + type.charAt(0).toUpperCase() + type.slice(1));
                if (chip) chip.classList.add('active');
                filterCustomers();
            }}

            function filterCustomers() {{
                const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
                let filtered = CUSTOMERS;

                if (currentFilter === 'online') filtered = filtered.filter(c => c.is_online);
                else if (currentFilter === 'new') filtered = filtered.filter(c => c.is_new_today);
                else if (currentFilter === 'regular') filtered = filtered.filter(c => c.is_regular);
                else if (currentFilter === 'google') filtered = filtered.filter(c => c.auth_provider === 'google');

                if (q) {{
                    filtered = filtered.filter(c => 
                        c.email.toLowerCase().includes(q) ||
                        c.full_name.toLowerCase().includes(q) ||
                        c.target_role.toLowerCase().includes(q) ||
                        c.jobs.some(j => j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q))
                    );
                }}

                renderTable(filtered);
            }}

            // Export to CSV
            function exportToCSV() {{
                const headers = ['Email', 'Full Name', 'Target Role', 'Joined (IST)', 'Last Active (IST)', 'Applications Count', 'Auth Provider'];
                const rows = CUSTOMERS.map(c => [
                    `"${{c.email}}"`,
                    `"${{(c.full_name || '').replace(/"/g, '""')}}"`,
                    `"${{(c.target_role || '').replace(/"/g, '""')}}"`,
                    `"${{c.ist_created_at}}"`,
                    `"${{c.ist_last_active}}"`,
                    c.job_count,
                    `"${{c.auth_provider}}"`
                ]);
                const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `nexjob_candidates_${{new Date().toISOString().slice(0, 10)}}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }}

            // Init
            renderTable(CUSTOMERS);
            renderDaily();
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
