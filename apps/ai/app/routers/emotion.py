from fastapi import APIRouter, WebSocket
from app.cv.ws_stream import run_emotion_stream

router = APIRouter(prefix="/emotion", tags=["emotion"])


@router.websocket("/stream/{session_id}")
async def emotion_stream(websocket: WebSocket, session_id: str):
    """
    Real-time emotion detection WebSocket for doctor sessions.
    The client (doctor's browser) sends base64-encoded video frames;
    the server responds with emotion scores after each frame.

    Emotion data is stored in emotion_snapshots and shown only on the
    doctor dashboard — it is never exposed to the patient.
    """
    await run_emotion_stream(websocket, session_id)
