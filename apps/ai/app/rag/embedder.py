from functools import lru_cache
from langchain_huggingface import HuggingFaceEmbeddings
from ..config import get_settings


@lru_cache
def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Returns a local HuggingFace embedding model.
    The model is downloaded once on first call and cached in ~/.cache/huggingface/.
    No API key required.
    """
    s = get_settings()
    return HuggingFaceEmbeddings(
        model_name=s.embedding_model,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


async def embed_query(text: str) -> list[float]:
    return await get_embeddings().aembed_query(text)


async def embed_documents(texts: list[str]) -> list[list[float]]:
    return await get_embeddings().aembed_documents(texts)
