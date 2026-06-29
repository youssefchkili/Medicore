from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from app.rag.scraper import DISEASE_TERMS, run_scrape
from app.dependencies import verify_internal_secret

router = APIRouter(prefix="/scraper", tags=["scraper"])


class RefreshRequest(BaseModel):
    terms: list[str] | None = None  # None = scrape all DISEASE_TERMS


class RefreshResponse(BaseModel):
    message: str
    terms_queued: int


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    dependencies=[Depends(verify_internal_secret)],
)
async def refresh_scraper(
    body: RefreshRequest,
    background_tasks: BackgroundTasks,
):
    """
    Trigger a full or partial re-scrape of MedlinePlus + PubMed.
    Runs in the background so the HTTP response returns immediately.
    Called by NestJS admin panel via POST /api/admin/scraper/refresh → proxy to here.
    """
    targets = body.terms or DISEASE_TERMS
    background_tasks.add_task(run_scrape, body.terms)

    return RefreshResponse(
        message="Scraper started in background",
        terms_queued=len(targets),
    )


@router.get("/status", dependencies=[Depends(verify_internal_secret)])
async def scraper_status():
    """
    Returns basic info about the knowledge base.
    Used by the admin panel to confirm the collection is populated.
    """
    from app.rag.qdrant_store import collection_count
    count = collection_count()
    return {"chunks_indexed": count}
