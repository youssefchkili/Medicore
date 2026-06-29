from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Groq (free LLM API — get key at console.groq.com)
    groq_api_key: str
    groq_chat_model: str = "llama-3.3-70b-versatile"

    # Embeddings — local HuggingFace model, no API key needed
    # Model is downloaded once (~420 MB) and cached in ~/.cache/huggingface/
    embedding_model: str = "sentence-transformers/all-mpnet-base-v2"
    embedding_dimensions: int = 768

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "medical_knowledge"

    # Supabase
    supabase_url: str
    supabase_service_role_key: str

    # LangSmith (optional tracing)
    langchain_tracing_v2: bool = False
    langchain_api_key: str = ""
    langchain_project: str = "medicore-ai"

    # Internal secret shared with NestJS
    ai_service_secret: str

    # NestJS base URL — used by FastAPI to call the webhook back and for CORS
    nestjs_url: str = "http://localhost:3001"

    # Next.js frontend URL — used for CORS
    frontend_url: str = "http://localhost:3000"

    # DeepFace
    deepface_model: str = "ArcFace"
    deepface_detector: str = "retinaface"
    face_similarity_threshold: float = 0.6

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
