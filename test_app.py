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

