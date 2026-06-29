from datetime import datetime, timezone
from langchain_text_splitters import RecursiveCharacterTextSplitter


def make_chunks(
    text: str,
    metadata: dict,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[dict]:
    """
    Split a full article into smaller chunks.
    Each chunk inherits the article metadata so Qdrant payloads are self-contained.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    parts = splitter.split_text(text)
    now = datetime.now(timezone.utc).isoformat()

    return [
        {
            "content": part.strip(),
            "chunk_index": i,
            "scraped_at": now,
            **metadata,
        }
        for i, part in enumerate(parts)
        if part.strip()
    ]
