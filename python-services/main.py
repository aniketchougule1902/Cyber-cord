from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from utils.rate_limit import limiter
from routers import email, domain, ip, username, phone, metadata, social

app = FastAPI(
    title="CyberCord OSINT Services",
    description="Python-based OSINT tool microservice for CyberCord platform",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:4000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(email.router)
app.include_router(domain.router)
app.include_router(ip.router)
app.include_router(username.router)
app.include_router(phone.router)
app.include_router(metadata.router)
app.include_router(social.router)


@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "service": "CyberCord OSINT Services",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
