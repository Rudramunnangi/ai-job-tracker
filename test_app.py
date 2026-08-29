import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_root_route():
    response = client.get("/")
    assert response.status_code == 200

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

def test_unauthenticated_api_blocked():
    # Calling member route without token must return 401
    response = client.get("/api/jobs")
    assert response.status_code == 401

def test_otp_signup_and_multi_identifier_login():
    email = "candidate_test@nexjob.ai"
    phone = "+919876543210"
    username = "candidatetest"
    pwd = "securepassword123"

    # Step 1: Send OTP
    otp_res = client.post("/api/auth/send-otp", json={"identifier": email, "purpose": "signup"})
    assert otp_res.status_code == 200
    dev_otp = otp_res.json().get("dev_otp")
    assert dev_otp is not None

    # Step 2: Verify OTP and Register
    signup_res = client.post("/api/auth/signup-verify", json={
        "identifier": email,
        "otp": dev_otp,
        "username": username,
        "password": pwd,
        "full_name": "Test Candidate"
    })
    assert signup_res.status_code == 200
    token = signup_res.json().get("token")
    assert token is not None

    # Step 3: Login using Username identifier
    login_user_res = client.post("/api/auth/login", json={"identifier": username, "password": pwd})
    assert login_user_res.status_code == 200

    # Step 4: Login using Email identifier
    login_email_res = client.post("/api/auth/login", json={"identifier": email, "password": pwd})
    assert login_email_res.status_code == 200
    user_token = login_email_res.json().get("token")

    # Step 5: Save Job on Board with Token
    headers = {"Authorization": f"Bearer {user_token}"}
    save_job_res = client.post("/api/jobs/save", json={
        "id": "apex_job_1",
        "company": "DeepMind",
        "role": "Research Scientist",
        "date": "2026-08-29",
        "status": "Applied",
        "tags": ["AI", "PyTorch"],
        "jd": "Develop frontier models."
    }, headers=headers)
    assert save_job_res.status_code == 200

    # Step 6: Purge Account
    del_res = client.delete("/api/account/delete", headers=headers)
    assert del_res.status_code == 200
