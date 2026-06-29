import asyncio
from functools import lru_cache
from datetime import datetime, timezone
from typing import Any

from supabase import create_client, Client

from ..config import get_settings


# ─── Singleton client ──────────────────────────────────────────────────────────

@lru_cache
def _supabase() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def _run(fn, *args, **kwargs):
    """Run a synchronous Supabase call inside asyncio without blocking the event loop."""
    return asyncio.to_thread(fn, *args, **kwargs)


# ─── Chat sessions ─────────────────────────────────────────────────────────────

async def fetch_chat_session(session_id: str) -> dict:
    """
    Returns the chat_session row joined with its patient and that patient's profile.
    Called when a WebSocket connection opens so agents know who they are talking to.
    """
    def _query():
        return (
            _supabase()
            .table("chat_sessions")
            .select("*, patients(*, profiles(*))")
            .eq("id", session_id)
            .single()
            .execute()
        )

    result = await asyncio.to_thread(_query)
    return result.data


async def update_chat_session(
    session_id: str,
    status: str | None = None,
    agent_state: dict | None = None,
    token_count_delta: int = 0,
    end: bool = False,
) -> None:
    payload: dict[str, Any] = {}
    if status:
        payload["status"] = status
    if agent_state is not None:
        payload["agent_state"] = agent_state
    if token_count_delta:
        # Supabase doesn't support atomic increment via REST, so we read-then-write
        def _get():
            return (
                _supabase()
                .table("chat_sessions")
                .select("token_count")
                .eq("id", session_id)
                .single()
                .execute()
            )
        current = await asyncio.to_thread(_get)
        payload["token_count"] = (current.data.get("token_count") or 0) + token_count_delta
    if end:
        payload["ended_at"] = datetime.now(timezone.utc).isoformat()

    if not payload:
        return

    def _update():
        return (
            _supabase()
            .table("chat_sessions")
            .update(payload)
            .eq("id", session_id)
            .execute()
        )
    await asyncio.to_thread(_update)


# ─── Chat messages ─────────────────────────────────────────────────────────────

async def insert_message(
    session_id: str,
    role: str,           # "USER" | "ASSISTANT" | "SYSTEM"
    content: str,
    agent_name: str | None = None,
    metadata: dict | None = None,
) -> dict:
    def _insert():
        return (
            _supabase()
            .table("chat_messages")
            .insert({
                "session_id": session_id,
                "role": role,
                "content": content,
                "agent_name": agent_name,
                "metadata": metadata,
            })
            .execute()
        )
    result = await asyncio.to_thread(_insert)
    return result.data[0]


# ─── Pre-diagnostics ───────────────────────────────────────────────────────────

async def insert_pre_diagnostic(
    patient_id: str,
    chat_session_id: str,
    symptoms: dict,
    severity_level: int,
    urgency: str,
    suggested_specialty: str | None,
    possible_conditions: list,
    rag_sources: list,
    raw_report: str,
) -> dict:
    def _insert():
        return (
            _supabase()
            .table("pre_diagnostics")
            .insert({
                "patient_id": patient_id,
                "chat_session_id": chat_session_id,
                "symptoms": symptoms,
                "severity_level": severity_level,
                "urgency": urgency,
                "suggested_specialty": suggested_specialty,
                "possible_conditions": possible_conditions,
                "rag_sources": rag_sources,
                "raw_report": raw_report,
                "status": "PENDING_REVIEW",
            })
            .execute()
        )
    result = await asyncio.to_thread(_insert)
    return result.data[0]


# ─── Agent invocation logging ──────────────────────────────────────────────────

async def log_agent_invocation(
    chat_session_id: str,
    agent_name: str,
    input_data: dict,
    output_data: dict | None = None,
    tokens_used: int = 0,
    latency_ms: int | None = None,
    error: str | None = None,
) -> None:
    def _insert():
        return (
            _supabase()
            .table("agent_invocations")
            .insert({
                "chat_session_id": chat_session_id,
                "agent_name": agent_name,
                "input": input_data,
                "output": output_data,
                "tokens_used": tokens_used,
                "latency_ms": latency_ms,
                "error": error,
            })
            .execute()
        )
    await asyncio.to_thread(_insert)


# ─── Face embeddings ───────────────────────────────────────────────────────────

async def upsert_face_embedding(doctor_id: str, embedding: list[float], anti_spoof_score: float) -> None:
    def _upsert():
        return (
            _supabase()
            .table("face_embeddings")
            .upsert({
                "doctor_id": doctor_id,
                "embedding": embedding,
                "model_used": get_settings().deepface_model,
                "anti_spoof_score": anti_spoof_score,
            })
            .execute()
        )
    await asyncio.to_thread(_upsert)


async def fetch_face_embedding(doctor_id: str) -> dict | None:
    def _query():
        return (
            _supabase()
            .table("face_embeddings")
            .select("*")
            .eq("doctor_id", doctor_id)
            .maybe_single()
            .execute()
        )
    result = await asyncio.to_thread(_query)
    return result.data


async def insert_biometric_log(
    doctor_id: str,
    success: bool,
    similarity_score: float,
    anti_spoof_pass: bool,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    def _insert():
        return (
            _supabase()
            .table("biometric_login_logs")
            .insert({
                "doctor_id": doctor_id,
                "success": success,
                "similarity_score": similarity_score,
                "anti_spoof_pass": anti_spoof_pass,
                "ip_address": ip_address,
                "user_agent": user_agent,
            })
            .execute()
        )
    await asyncio.to_thread(_insert)


# ─── Emotion snapshots ─────────────────────────────────────────────────────────

async def insert_emotion_snapshot(
    session_id: str,
    timestamp: datetime,
    dominant_emotion: str,
    scores: dict[str, float],
    confidence: float,
) -> None:
    def _insert():
        return (
            _supabase()
            .table("emotion_snapshots")
            .insert({
                "session_id": session_id,
                "timestamp": timestamp.isoformat(),
                "dominant_emotion": dominant_emotion,
                "happy": scores.get("happy", 0.0),
                "sad": scores.get("sad", 0.0),
                "fearful": scores.get("fear", 0.0),
                "angry": scores.get("angry", 0.0),
                "surprised": scores.get("surprise", 0.0),
                "disgusted": scores.get("disgust", 0.0),
                "neutral": scores.get("neutral", 0.0),
                "confidence": confidence,
            })
            .execute()
        )
    await asyncio.to_thread(_insert)
