import asyncio
import logging
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from bs4 import BeautifulSoup

from .chunker import make_chunks
from .qdrant_store import add_chunks, ensure_collection

logger = logging.getLogger(__name__)

_RATE_DELAY = 1.0  # seconds between HTTP requests — MedlinePlus ToS asks ≤1 req/s

# Conditions to seed the knowledge base with.
# Covers the most common reasons patients visit a general clinic.
DISEASE_TERMS: list[str] = [
    "diabetes mellitus", "type 2 diabetes", "hypertension",
    "asthma", "anxiety disorder", "major depressive disorder",
    "coronary artery disease", "stroke", "lung cancer",
    "osteoarthritis", "rheumatoid arthritis", "obesity",
    "pneumonia", "urinary tract infection", "migraine",
    "hypothyroidism", "iron deficiency anemia", "appendicitis",
    "gastroesophageal reflux disease", "sleep apnea",
    "atrial fibrillation", "chronic kidney disease",
    "chronic obstructive pulmonary disease", "irritable bowel syndrome",
    "psoriasis", "eczema", "epilepsy", "multiple sclerosis",
    "Parkinson disease", "Alzheimer disease",
]

_MEDLINEPLUS_URL = "https://wsearch.nlm.nih.gov/ws/query"
_PUBMED_SEARCH   = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
_PUBMED_FETCH    = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


# ─── MedlinePlus ──────────────────────────────────────────────────────────────

async def _scrape_medlineplus(term: str, client: httpx.AsyncClient) -> list[dict]:
    try:
        resp = await client.get(
            _MEDLINEPLUS_URL,
            params={"db": "healthTopics", "term": term, "rettype": "brief"},
            timeout=15.0,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("MedlinePlus failed for '%s': %s", term, exc)
        return []

    articles: list[dict] = []
    try:
        root = ET.fromstring(resp.text)
        for doc in root.findall(".//document"):
            url = doc.get("url", "")
            title_el   = doc.find("content[@name='title']")
            summary_el = doc.find("content[@name='FullSummary']")
            if title_el is None or summary_el is None:
                continue

            raw_html = summary_el.text or ""
            clean    = BeautifulSoup(raw_html, "lxml").get_text(separator=" ").strip()
            if not clean:
                continue

            articles.append({
                "text":         clean,
                "source_url":   url,
                "source_title": f"{title_el.text or term.title()} — MedlinePlus",
                "section":      "Health Topic",
                "disease":      term.title(),
                "icd_code":     "",
            })
    except ET.ParseError as exc:
        logger.warning("XML parse error for '%s': %s", term, exc)

    return articles


# ─── PubMed ───────────────────────────────────────────────────────────────────

async def _pubmed_ids(
    term: str, client: httpx.AsyncClient, max_results: int = 5
) -> list[str]:
    try:
        resp = await client.get(
            _PUBMED_SEARCH,
            params={
                "db":     "pubmed",
                "term":   f"{term}[Title/Abstract] AND free full text[Filter]",
                "retmax": max_results,
                "retmode": "json",
                "sort":   "relevance",
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("esearchresult", {}).get("idlist", [])
    except Exception as exc:
        logger.warning("PubMed search failed for '%s': %s", term, exc)
        return []


async def _pubmed_abstracts(
    ids: list[str], term: str, client: httpx.AsyncClient
) -> list[dict]:
    if not ids:
        return []
    try:
        resp = await client.get(
            _PUBMED_FETCH,
            params={
                "db":      "pubmed",
                "id":      ",".join(ids),
                "rettype": "abstract",
                "retmode": "text",
            },
            timeout=20.0,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("PubMed fetch failed for '%s': %s", term, exc)
        return []

    # NCBI returns all abstracts concatenated, separated by blank lines
    sections = [s.strip() for s in resp.text.split("\n\n\n") if len(s.strip()) > 100]

    return [
        {
            "text":         section,
            "source_url":   f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "source_title": f"PubMed {pmid} — {term.title()}",
            "section":      "Abstract",
            "disease":      term.title(),
            "icd_code":     "",
        }
        for pmid, section in zip(ids, sections)
    ]


# ─── Full pipeline ────────────────────────────────────────────────────────────

async def run_scrape(terms: list[str] | None = None) -> dict:
    """
    Scrape MedlinePlus + PubMed for each term, chunk the text, embed it,
    and upsert into Qdrant. Returns a summary dict.
    Pass `terms` to scrape a subset; omit to scrape all DISEASE_TERMS.
    """
    ensure_collection()
    targets = terms or DISEASE_TERMS
    total_chunks = 0
    errors = 0

    async with httpx.AsyncClient(follow_redirects=True) as http:
        for term in targets:
            try:
                logger.info("Scraping: %s", term)

                ml_articles = await _scrape_medlineplus(term, http)
                await asyncio.sleep(_RATE_DELAY)

                pmids = await _pubmed_ids(term, http)
                await asyncio.sleep(_RATE_DELAY)

                pm_articles = await _pubmed_abstracts(pmids, term, http)
                await asyncio.sleep(_RATE_DELAY)

                chunks: list[dict] = []
                for article in ml_articles + pm_articles:
                    text = article.pop("text")
                    chunks.extend(make_chunks(text, metadata=article))

                if chunks:
                    await add_chunks(chunks)
                    total_chunks += len(chunks)
                    logger.info("  Indexed %d chunks for '%s'", len(chunks), term)
                else:
                    logger.info("  No content found for '%s'", term)

            except Exception as exc:
                logger.error("Error scraping '%s': %s", term, exc)
                errors += 1

    return {
        "terms_scraped":        len(targets),
        "total_chunks_indexed": total_chunks,
        "errors":               errors,
        "completed_at":         datetime.now(timezone.utc).isoformat(),
    }


# ─── APScheduler ─────────────────────────────────────────────────────────────

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def start_scheduled_scraper() -> None:
    """Register the nightly scraper job and start the scheduler. Call from lifespan."""
    sched = get_scheduler()
    sched.add_job(
        run_scrape,
        trigger="cron",
        hour=2,
        minute=0,
        id="nightly_scrape",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    sched.start()
    logger.info("Nightly scraper job scheduled at 02:00 UTC")


def stop_scheduled_scraper() -> None:
    sched = get_scheduler()
    if sched.running:
        sched.shutdown(wait=False)
