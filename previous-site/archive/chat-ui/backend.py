
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
import pathlib

app = FastAPI()

# Serve static files from the chat-ui directory
static_dir = pathlib.Path(__file__).parent.resolve()
app.mount("/static", StaticFiles(directory=static_dir, html=True), name="static")

# Allow frontend to access backend (not strictly needed now, but safe)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

# Change this to your LM Studio API endpoint
LM_STUDIO_API_URL = os.getenv("LM_STUDIO_API_URL", "http://localhost:1234/v1/chat/completions")

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    # Format request for LM Studio
    payload = {
        "messages": [
            {"role": "user", "content": req.message}
        ],
        "max_tokens": 512
    }
    try:
        response = requests.post(LM_STUDIO_API_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        # Extract model response
        model_reply = data["choices"][0]["message"]["content"]
        return {"response": model_reply}
    except Exception as e:
        return {"response": f"Error: {str(e)}"}
