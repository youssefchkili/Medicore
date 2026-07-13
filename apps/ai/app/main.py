import asyncio
import logging
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()  # must run before any module-level LLM/client init

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.rag.qdrant_store import collection_count, ensure_collection
from app.rag.scraper import run_scrape, start_scheduled_scraper, stop_scheduled_scraper
from app.routers import chat, diagnostics, emotion, face, scraper

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


async def _wait_for_qdrant(max_wait: float = 90.0) -> bool:
    """
    Qdrant often boots slower than this service, so the first connection attempt
    can be refused. Poll (with backoff) until it accepts connections, otherwise
    the initial seed would give up and RAG would have no context until 02:00 UTC.
    """
    deadline = time.monotonic() + max_wait
    delay = 1.0
    while time.monotonic() < deadline:
        try:
            ensure_collection()
            return True
        except Exception as exc:
            logger.info("Waiting for Qdrant to become ready: %s", exc)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 5.0)
    return False


async def _seed_if_empty() -> None:
    """
    On a fresh deploy, Qdrant has no chunks until the nightly 02:00 UTC job runs.
    The RAG agent degrades gracefully when the collection is empty, but that means
    a full day of chat sessions would get zero medical context. Seed immediately
    instead if the collection is empty (or missing) so RAG works right after boot.
    """
    if not await _wait_for_qdrant():
        logger.warning("Qdrant not reachable after startup wait — relying on nightly job")
        return
    try:
        if collection_count() == 0:
            logger.info("Qdrant collection is empty — running initial scrape now")
            await run_scrape()
    except Exception as exc:
        logger.warning("Initial Qdrant seed check failed, will rely on nightly job: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_seed_if_empty())
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
