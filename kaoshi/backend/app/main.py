from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os

from .models import Base
from .database import engine
from .routers import questions, papers, rules, ai, tags, logs
from .limiter import limiter

# Load environment variables
load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Exam System API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(questions.router)
app.include_router(papers.router)
app.include_router(rules.router)
app.include_router(ai.router)
app.include_router(tags.router)
app.include_router(logs.router)

@app.get("/")
@limiter.limit("5/minute")
def read_root(request: Request):
    return {"message": "Smart Exam System API is running"}
