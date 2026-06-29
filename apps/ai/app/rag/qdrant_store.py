from functools import lru_cache

from langchain_core.vectorstores import VectorStoreRetriever
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from ..config import get_settings
from .embedder import get_embeddings


@lru_cache
def get_qdrant_client() -> QdrantClient:
    s = get_settings()
    return QdrantClient(host=s.qdrant_host, port=s.qdrant_port)


def ensure_collection() -> None:
    """Create the Qdrant collection if it does not already exist."""
    s = get_settings()
    client = get_qdrant_client()
    existing = {c.name for c in client.get_collections().collections}
    if s.qdrant_collection not in existing:
        client.create_collection(
            collection_name=s.qdrant_collection,
            vectors_config=VectorParams(size=s.embedding_dimensions, distance=Distance.COSINE),
        )


def get_vector_store() -> QdrantVectorStore:
    s = get_settings()
    return QdrantVectorStore.from_existing_collection(
        url=f"http://{s.qdrant_host}:{s.qdrant_port}",
        collection_name=s.qdrant_collection,
        embedding=get_embeddings(),
        retrieval_mode=RetrievalMode.DENSE,
    )


def get_retriever(k: int = 5) -> VectorStoreRetriever:
    """Return a LangChain retriever ready to be used inside agent nodes."""
    return get_vector_store().as_retriever(search_kwargs={"k": k})


async def add_chunks(chunks: list[dict]) -> None:
    """
    Embed and upsert a batch of chunks into Qdrant.
    Each chunk must have a 'content' key; all other keys become the point payload.
    Uses LangChain's aadd_texts so the embedding call is async.
    """
    if not chunks:
        return
    store = get_vector_store()
    texts = [c["content"] for c in chunks]
    metadatas = [{k: v for k, v in c.items() if k != "content"} for c in chunks]
    await store.aadd_texts(texts, metadatas=metadatas)


def collection_count() -> int:
    """Return how many points (chunks) are currently stored."""
    s = get_settings()
    info = get_qdrant_client().get_collection(s.qdrant_collection)
    return info.points_count or 0
