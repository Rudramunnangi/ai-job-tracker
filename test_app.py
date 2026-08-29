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
    # Mock the Gemini client response
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

# 3. Test Member Feature Gating (PDF upload rejected without valid user header)
def test_guest_pdf_upload_blocked():
    response = client.post(
        "/api/resume/upload-pdf",
        headers={"user-email": "guest"},
        files={"file": ("test.pdf", b"%PDF-1.4 dummy content", "application/pdf")}
    )
    assert response.status_code == 401

# 4. Test Admin Basic Authentication Protection
def test_unauthorized_admin_access():
    response = client.get("/admin")
    assert response.status_code == 401

def test_authorized_admin_access():
    response = client.get("/admin", auth=("admin", "adminsecret"))
    assert response.status_code == 200
    assert "NexJob AI" in response.text
