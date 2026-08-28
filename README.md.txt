# NexJob AI — Autonomous Career Engine

NexJob AI is an intelligent job application management platform and candidate career cockpit built with Python, FastAPI, vanilla JavaScript, and Google Cloud's Gemini 3.6 Flash engine.

---

## Architecture Overview

```text
[ Modern Dark UI / Frontend (HTML/CSS/JS) ]
                  │
                  ▼ (REST JSON Payloads)
[ FastAPI Async Backend Server (server.py) ]
                  │
                  ├── Session Pipeline State & Time-Decay Engine
                  │
                  ▼ (google-genai SDK)
[ Google Cloud / Gemini 3.6 Flash ]
        ├── Objective Match Scoring & Resume Gap Analysis
        ├── High-Conversion Recruiter Cold Outreach Drafter
        └── Smart Time-Decay Follow-up Generator