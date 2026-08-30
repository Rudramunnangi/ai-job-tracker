import pytest
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

# Global test state
test_user = {
    "email": "tester@nexjob.ai",
    "password": "SecurePassword123!"
}
auth_token = None
created_job_id = None


# --- 1. Static Asset & SEO Tests ---
def test_homepage_loads():
    response = client.get("/")
    assert response.status_code == 200
    assert "<title>" in response.text

def test_favicon_png_route():
    response = client.get("/favicon.png")
    assert response.status_code == 200
    assert response.headers["content-type"] in ["image/png", "application/octet-stream"]

def test_sitemap_xml_route():
    response = client.get("/sitemap.xml")
    assert response.status_code == 200
    assert "urlset" in response.text


# --- 2. Authentication Flow Tests ---
def test_user_registration():
    response = client.post("/api/auth/register", json=test_user)
    assert response.status_code in [200, 201, 400]  # 400 if user already exists

def test_user_login():
    global auth_token
    response = client.post("/api/auth/login", json=test_user)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data or "access_token" in data
    auth_token = data.get("token") or data.get("access_token")

def test_unauthorized_access():
    response = client.get("/api/jobs")
    assert response.status_code in [401, 403]


# --- 3. Job Pipeline CRUD Lifecycle Tests ---
def test_create_job_pipeline_entry():
    global created_job_id
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {
        "title": "Machine Learning Engineer",
        "company": "Anthropic",
        "status": "Bookmarked",
        "salary": "$180,000",
        "url": "https://example.com/job/123"
    }
    response = client.post("/api/jobs", json=payload, headers=headers)
    assert response.status_code in [200, 201]
    data = response.json()
    created_job_id = data.get("id") or data.get("_id")
    assert data["company"] == "Anthropic"
    assert data["status"] == "Bookmarked"

def test_update_job_pipeline_stage():
    headers = {"Authorization": f"Bearer {auth_token}"}
    update_payload = {"status": "Interviewing"}
    response = client.put(f"/api/jobs/{created_job_id}", json=update_payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "Interviewing"

def test_delete_job_pipeline_entry():
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = client.delete(f"/api/jobs/{created_job_id}", headers=headers)
    assert response.status_code in [200, 204]


# --- 4. AI Matching & Resume Parsing Tests ---
def test_ai_resume_analyzer_empty_payload():
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = client.post("/api/ai/match", json={}, headers=headers)
    assert response.status_code in [400, 422]

def test_ai_resume_analyzer_valid_payload():
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {
        "resume_text": "Experienced Python developer with PyTorch, FastAPI, and Docker skills.",
        "job_description": "Looking for a Python AI Engineer skilled in FastAPI, PyTorch, and cloud deployment."
    }
    response = client.post("/api/ai/match", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "score" in data or "match_percentage" in data
