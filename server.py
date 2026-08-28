import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="NexJob AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AIRequest(BaseModel):
    action: str
    role: str
    company: str
    jd: str
    resume: str
    apiKey: str = ""

@app.post("/api/gemini")
async def generate_ai(req: AIRequest):
    use_key = req.apiKey.strip() if req.apiKey.strip() else api_key
    if not use_key:
        raise HTTPException(status_code=400, detail="Gemini API Key missing. Add it in the UI or .env file.")
    
    client = genai.Client(api_key=use_key)
    
    if req.action == "match":
        prompt = f"""
        Perform an objective technical match analysis.
        Job Role: {req.role} at {req.company}
        Job Description: {req.jd}
        Candidate Resume: {req.resume}

        Return clean markdown:
        ### 🎯 Match Score: [Score]%
        **Executive Fit Summary:** [1-2 sentences]
        
        #### 🌟 Top Matching Competencies
        - [Skill 1]
        - [Skill 2]
        - [Skill 3]
        
        #### ⚠️ Critical Skill Gaps & Keywords
        - [Gap 1]
        - [Gap 2]
        
        #### 💡 High-Yield Interview Prep Tip
        [Specific technical focus area]
        """
    elif req.action == "outreach":
        prompt = f"""
        Write a high-converting, professional cold outreach message to the hiring manager for {req.role} at {req.company}.
        Candidate Experience: {req.resume}
        Job Description: {req.jd}

        Structure:
        - **Subject Line:** [Punchy, high-open rate]
        - **Body:** 3 brief, compelling paragraphs connecting skills to company needs.
        - **Call to Action:** Confident and low friction.
        """
    elif req.action == "nudge":
        prompt = f"""
        Write a polite, 100-word follow-up check-in email to the recruiter for {req.role} at {req.company}.
        The application was submitted 6 days ago. Be enthusiastic, concise, and professional.
        """
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
        
    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt
        )
        return {"result": response.text}
    except Exception as e:
        # Fallback to preview model if required
        try:
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt
            )
            return {"result": response.text}
        except Exception as err:
            raise HTTPException(status_code=500, detail=str(err))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
