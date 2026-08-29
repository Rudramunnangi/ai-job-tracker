import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

# 1. Test Static Landing Page
def test_root_route():
    response = client.get("/")
    assert response.status_code == 200

# 2. Test Guest ATS Evaluation with mocked AI response
@patch("server.genai.Client")
def test_guest_ats_execution(mock_genai_client):
    mock_instance = MagicMock()
    mock_model_response = MagicMock()
    mock_model_response.text = "### Overall ATS Match Score: 88%\n\n**High-Level Verdict:** Strong fit."
    mock_instance.models.generate_content.return_value = mock_model_response
    mock_genai_client.return_value = mock_instance

    payload = {
        "role": "AI Engineer",
        "company": "Test Corp",
        "jd": "Must have expertise in Python, FastAPI, Docker, and Gemini API.",
        "resume": "Skilled Python developer with experience building FastAPI backends.",
        "isGuest": True
    }
    response = client.post("/api/gemini/smart-decision", json=payload)
    assert response.status_code == 200
    assert "ATS Match Score" in response.json().get("result", "")

# 3. Test Member Feature Gating (PDF upload blocked without valid user header)
def test_guest_pdf_upload_blocked():
    response = client.post(
        "/api/resume/upload-pdf",
        headers={"user-email": "guest"},
        files={"file": ("test.pdf", b"%PDF-1.4 dummy content", "application/pdf")}
    )
    assert response.status_code == 401

# 4. Test Job Lifecycle (Create, Retrieve, and Update Stage)
def test_job_lifecycle_and_stage_update():
    test_user_email = "test_candidate@nexjob.ai"
    job_id = "test_job_123"

    # Step A: Save Job
    save_payload = {
        "id": job_id,
        "user_email": test_user_email,
        "company": "Google Cloud",
        "role": "AI Solutions Architect",
        "date": "2026-08-29",
        "status": "Applied",
        "tags": ["Python", "GCP"],
        "jd": "Design enterprise-scale AI architecture."
    }
    save_res = client.post("/api/jobs/save", json=save_payload)
    assert save_res.status_code == 200

    # Step B: Retrieve Jobs
    get_res = client.get(f"/api/jobs?email={test_user_email}")
    assert get_res.status_code == 200
    jobs = get_res.json().get("jobs", [])
    assert any(j["id"] == job_id for j in jobs)

    # Step C: Update Job Stage to Interviewing
    update_res = client.post("/api/jobs/update_status", json={"id": job_id, "status": "Interviewing"})
    assert update_res.status_code == 200

    # Verify Stage Change
    get_updated_res = client.get(f"/api/jobs?email={test_user_email}")
    updated_jobs = get_updated_res.json().get("jobs", [])
    matching_job = next((j for j in updated_jobs if j["id"] == job_id), None)
    assert matching_job is not None
    assert matching_job["status"] == "Interviewing"

# 5. Test User Account Deletion & Cascading Clean-up
def test_account_deletion_flow():
    user_email = "delete_me@nexjob.ai"
    
    # Save a temporary job under this user
    client.post("/api/jobs/save", json={
        "id": "job_to_purge",
        "user_email": user_email,
        "company": "Temp Corp",
        "role": "Intern",
        "date": "2026-08-29",
        "status": "Applied",
        "tags": ["General"],
        "jd": "Temporary role."
    })

    # Delete account
    del_res = client.delete(f"/api/account/delete?email={user_email}")
    assert del_res.status_code == 200

    # Confirm jobs are purged
    check_jobs = client.get(f"/api/jobs?email={user_email}")
    assert len(check_jobs.json().get("jobs", [])) == 0

# 6. Test Admin Basic Authentication Protection
def test_unauthorized_admin_access():
    response = client.get("/admin")
    assert response.status_code == 401

def test_authorized_admin_access():
    response = client.get("/admin", auth=("admin", "adminsecret"))
    assert response.status_code == 200
    assert "NexJob AI" in response.text
