import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.rag.scraper import start_scheduled_scraper, stop_scheduled_scraper
from app.routers import chat, diagnostics, emotion, face, scraper

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the nightly scraper (runs at 02:00 UTC via APScheduler)
    start_scheduled_scraper()
    yield
    stop_scheduled_scraper()


settings = get_settings()

app = FastAPI(
    title="MediCore AI Service",
    description="LangGraph multi-agent pre-diagnostic system with CV capabilities",
    version="1.0.0",
    lifespan=lifespan,
    # Disable the default /docs in production by setting docs_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.nestjs_url,   # http://localhost:3001 in dev
        settings.frontend_url, # http://localhost:3000 in dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(chat.router)
app.include_router(diagnostics.router)
app.include_router(face.router)
app.include_router(emotion.router)
app.include_router(scraper.router)


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    """Used by NGINX, Docker health checks, and NestJS ai-proxy to verify the service is up."""
    return {"status": "ok", "service": "medicore-ai"}
