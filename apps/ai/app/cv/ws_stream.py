import asyncio
import logging
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

from .emotion import analyze_frame
from ..db.client import insert_emotion_snapshot

logger = logging.getLogger(__name__)


async def run_emotion_stream(websocket: WebSocket, session_id: str) -> None:
    """
    Handle a WebSocket session for real-time emotion detection during a doctor session.

    Wire protocol (JSON):
      Client → Server:  {"frame": "<base64-encoded JPEG>"}
      Server → Client:  {"type": "emotion", "data": {...}, "timestamp": "ISO-8601"}
                        {"type": "error",   "message": "..."}
                        {"type": "ping"}   (keepalive every 30 s of silence)

    Emotion data is stored to emotion_snapshots in Supabase and is visible only
    to the doctor — it is never shown to the patient.
    """
    await websocket.accept()
    logger.info("Emotion stream started for session %s", session_id)

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
            except asyncio.TimeoutError:
                # Keepalive — the doctor's browser may have paused sending frames
                await websocket.send_json({"type": "ping"})
                continue

            frame_b64: str | None = data.get("frame")
            if not frame_b64:
                continue

            try:
                result = analyze_frame(frame_b64)
                timestamp = datetime.now(timezone.utc)

                # Persist snapshot — fire-and-forget style; don't block the stream
                await insert_emotion_snapshot(
                    session_id=session_id,
                    timestamp=timestamp,
                    dominant_emotion=result["dominant_emotion"],
                    scores=result["scores"],
                    confidence=result["confidence"],
                )

                await websocket.send_json({
                    "type": "emotion",
                    "data": result,
                    "timestamp": timestamp.isoformat(),
                })

            except ValueError as exc:
                # Frame unreadable or no face detected — inform client, keep stream alive
                await websocket.send_json({"type": "error", "message": str(exc)})

    except WebSocketDisconnect:
        logger.info("Emotion stream ended for session %s", session_id)
    except Exception:
        logger.exception("Unexpected error in emotion stream for session %s", session_id)
