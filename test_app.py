import sqlite3
import pytest
from fastapi.testclient import TestClient
from server import app, DB_PATH, hash_password

client = TestClient(app)

TEST_EMAIL = "ci_tester@nexjob.ai"
TEST_USERNAME = "citester"
TEST_PASSWORD = "Password123!"

# Dynamic token holder
auth_headers = {}


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Seed test user and clean up after tests complete."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO users (email, username, password, token, full_name, auth_provider)
        VALUES (?, ?, ?, '', 'CI Tester', 'local')
    """, (TEST_EMAIL, TEST_USERNAME, hash_password(TEST_PASSWORD)))
    conn.commit()
    conn.close()

    yield

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE user_email=?", (TEST_EMAIL,))
    cursor.execute("DELETE FROM users WHERE email=?", (TEST_EMAIL,))
    conn.commit()
    conn.close()


# --- 1. Static Assets & SEO Routes ---

def test_homepage():
    response = client.get("/")
    assert response.status_code == 200

def test_sitemap():
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    assert "urlset" in response.text

def test_robots():
    response = client.get("/robots.txt")
    assert response.status_code == 200
    assert "User-agent" in response.text


# --- 2. Authentication Endpoints ---

def test_login_invalid_credentials():
    payload = {
        "identifier": TEST_EMAIL,
        "password": "WrongPassword!"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401

def test_send_otp_invalid_email():
    payload = {
        "email": "invalid-email",
        "purpose": "signup"
    }
    response = client.post("/api/auth/send-otp", json=payload)
    assert response.status_code == 400

def test_login_success():
    global auth_headers
    payload = {
        "identifier": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["email"] == TEST_EMAIL
    
    # Store dynamic token for subsequent tests
    active_token = data["token"]
    auth_headers["Authorization"] = f"Bearer {active_token}"


# --- 3. Job Pipeline CRUD Endpoints ---

def test_get_jobs_unauthorized():
    response = client.get("/api/jobs")
    assert response.status_code == 401

def test_save_job():
    job_payload = {
        "id": "job-test-101",
        "company": "Google",
        "role": "AI Engineer",
        "date": "2026-08-30",
        "status": "Applied",
        "tags": ["AI", "FastAPI", "Python"],
        "jd": "Design enterprise-grade ML pipelines."
    }
    response = client.post("/api/jobs/save", json=job_payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_jobs_authorized():
    response = client.get("/api/jobs", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data
    assert len(data["jobs"]) >= 1
    assert data["jobs"][0]["company"] == "Google"

def test_update_job_status():
    payload = {
        "id": "job-test-101",
        "status": "Interviewing"
    }
    response = client.post("/api/jobs/update_status", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"


# --- 4. Profile Management Endpoints ---

def test_save_profile():
    payload = {
        "full_name": "CI Tester Updated",
        "target_role": "Senior AI Architect",
        "skills": "Python, PyTorch, FastAPI",
        "resume": "Experienced engineer with AI systems background.",
        "linkedin_url": "https://linkedin.com/in/test",
        "github_url": "https://github.com/test",
        "portfolio_url": "https://test.dev"
    }
    response = client.post("/api/profile/save", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"


# --- 5. AI Decision Engine Validation ---

def test_smart_decision_invalid_payload():
    response = client.post("/api/gemini/smart-decision", json={"isGuest": True})
    assert response.status_code == 422


# --- 6. Boost & Performance Verification Tests ---

def test_batch_save_jobs():
    batch_payload = {
        "jobs": [
            {
                "id": "job-batch-1",
                "company": "Amazon AWS",
                "role": "Cloud Architect",
                "date": "2026-09-01",
                "status": "Applied",
                "tags": ["Cloud", "AWS"],
                "jd": "Design multi-region scalable cloud services."
            },
            {
                "id": "job-batch-2",
                "company": "Microsoft",
                "role": "Principal Systems Engineer",
                "date": "2026-09-02",
                "status": "Interviewing",
                "tags": ["Systems", "Azure"],
                "jd": "Distributed operating systems and kernel virtualization."
            }
        ]
    }
    response = client.post("/api/jobs/batch-save", json=batch_payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["count"] == 2

    # Verify both jobs were inserted
    get_res = client.get("/api/jobs", headers=auth_headers)
    assert get_res.status_code == 200
    all_jobs = get_res.json()["jobs"]
    job_ids = [j["id"] for j in all_jobs]
    assert "job-batch-1" in job_ids
    assert "job-batch-2" in job_ids

def test_gzip_compression_on_json():
    # Fetch jobs with Accept-Encoding: gzip
    headers = dict(auth_headers)
    headers["Accept-Encoding"] = "gzip"
    response = client.get("/api/jobs", headers=headers)
    assert response.status_code == 200
    # Since jobs payload is larger than 500 bytes, GZipMiddleware must compress it
    assert response.headers.get("Content-Encoding") == "gzip"

def test_static_cache_headers():
    home_res = client.get("/")
    assert home_res.status_code == 200
    assert "Cache-Control" in home_res.headers
    assert "public" in home_res.headers["Cache-Control"]

    sitemap_res = client.get("/sitemap.xml")
    assert sitemap_res.status_code == 200
    assert "Cache-Control" in sitemap_res.headers

    robots_res = client.get("/robots.txt")
    assert robots_res.status_code == 200
    assert "Cache-Control" in robots_res.headers

def test_decision_alias_endpoint():
    response = client.post("/api/decision/ats-score", json={"isGuest": True})
    assert response.status_code == 422

def test_google_site_verification():
    response = client.get("/googlea771eba2957995c8.html")
    assert response.status_code == 200
    assert "google-site-verification: googlea771eba2957995c8.html" in response.text

# --- 7. Security & Counter-Attack Features Tests ---

def test_enterprise_security_headers():
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in response.headers

def test_resume_authenticity_endpoint():
    # Test with robotic AI cliches
    robotic_resume = "Spearheaded cross-functional synergies to optimize pipeline throughput. Leveraged cutting-edge machine learning paradigms."
    res = client.post("/api/gemini/resume-authenticity", json={
        "resume": robotic_resume,
        "role": "Backend Engineer",
        "company": "Stripe"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "authenticity_score" in data["data"]
    assert "flagged_phrases" in data["data"]
    assert "humanized_bullets" in data["data"]

def test_mock_interview_start_and_respond():
    # Start mock interview
    start_res = client.post("/api/gemini/mock-interview/start", json={
        "role": "Distributed Systems Engineer",
        "company": "Cloudflare",
        "jd": "Design low-latency distributed edge proxies with Go and Redis.",
        "resume": "Software engineer with experience building Go microservices."
    })
    assert start_res.status_code == 200
    start_data = start_res.json()
    assert start_data["status"] == "success"
    assert "question" in start_data["data"]
    assert start_data["round"] == 1

    # Respond to question
    respond_res = client.post("/api/gemini/mock-interview/respond", json={
        "session_id": start_data["session_id"],
        "round": 1,
        "question": start_data["data"]["question"],
        "answer": "In my last role, I designed a Redis connection pool in Go which decreased latency by 45% under 10k concurrent requests.",
        "role": "Distributed Systems Engineer",
        "company": "Cloudflare"
    })
    assert respond_res.status_code == 200
    respond_data = respond_res.json()
    assert respond_data["status"] == "success"
    assert "score" in respond_data["data"]
    assert "feedback" in respond_data["data"]
    assert "strengths" in respond_data["data"]

def test_parse_job_url_ssrf_protection():
    # Attempting to fetch loopback or private URLs must be rejected with 400
    for bad_url in ["http://localhost:8000", "http://127.0.0.1:5000", "http://169.254.169.254/latest/meta-data"]:
        res = client.post("/api/jobs/parse-url", json={"url": bad_url})
        assert res.status_code == 400
        assert "Invalid, malformed, or private URL" in res.json()["detail"]

def test_ghost_detector_endpoint():
    res = client.post("/api/jobs/ghost-detector", json={
        "jd": "We are looking for a Senior Python Developer to join our backend team reporting to the VP of Engineering with immediate start and annual bonus.",
        "company": "ScaleAI",
        "role": "Senior Python Developer",
        "posted_days_ago": 5
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "reality_score" in data["data"]
    assert "verdict" in data["data"]
    assert "tactical_action" in data["data"]

def test_counter_offer_endpoint():
    res = client.post("/api/offers/counter-offer", json={
        "role": "Staff Backend Architect",
        "company": "Airbnb",
        "base_offer": 160000,
        "currency": "USD",
        "candidate_name": "Jordan Doe"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "market_benchmark" in data["data"]
    assert data["data"]["market_benchmark"]["recommended_target"] > 160000
    assert "templates" in data["data"]
    assert len(data["data"]["templates"]) >= 3



