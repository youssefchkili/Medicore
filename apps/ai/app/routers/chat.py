import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.agents.graph import graph
from app.db.client import (
    fetch_chat_session,
    insert_message,
    update_chat_session,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# In-process state cache keyed by langgraph_thread_id.
# Survives within the same server process; lost on restart.
# For production: replace with a Redis-backed store.
_session_cache: dict[str, dict] = {}


def _initial_state(patient_id: str, session_id: str) -> dict:
    return {
        "patient_id": patient_id,
        "chat_session_id": session_id,
        "messages": [],
        "symptoms": {},
        "severity_level": 0,
        "urgency": "LOW",
        "suggested_specialty": None,
        "possible_conditions": [],
        "rag_sources": [],
        "final_report": None,
        "current_agent": "",
        "is_complete": False,
        "needs_clarification": False,
        "clarification_question": None,
        "triage_complete": False,
        "emergency_notified": False,
        "symptom_collection_complete": False,
        "rag_complete": False,
        "awaiting_user_input": False,
        "token_count": 0,
    }


@router.websocket("/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: str):
    """
    Main LangGraph chat WebSocket.

    Wire protocol (JSON):
      Client → Server:  {"message": "I have a headache"}
      Server → Client:  {"type": "message",  "agent": "triage",   "content": "..."}
                        {"type": "complete"}   — sent when the pre-diagnostic is ready
                        {"type": "error",     "message": "..."}
    """
    await websocket.accept()

    try:
        session_row = await fetch_chat_session(session_id)
        if not session_row:
            await websocket.send_json({"type": "error", "message": "Session not found"})
            await websocket.close(code=1008)
            return

        patient_id: str = session_row["patient_id"]
        thread_id: str = session_row["langgraph_thread_id"]

        # Restore state: in-memory cache → Supabase agent_state → fresh
        state: dict = (
            _session_cache.get(thread_id)
            or session_row.get("agent_state")
            or _initial_state(patient_id, session_id)
        )

        while True:
            data = await websocket.receive_json()
            user_message: str = data.get("message", "").strip()
            if not user_message:
                continue

            await insert_message(session_id, "USER", user_message)

            # Add user message and reset the pause flag before invoking the graph
            state = {
                **state,
                "messages": state.get("messages", []) + [{"role": "user", "content": user_message}],
                "awaiting_user_input": False,
            }

            # Stream through the graph — each chunk is {node_name: state_delta}
            async for chunk in graph.astream(state):
                for node_name, node_output in chunk.items():
                    if node_name.startswith("__") or node_output is None:
                        continue

                    # Forward any new assistant messages to the client immediately
                    for msg in node_output.get("messages", []):
                        if msg.get("role") == "assistant":
                            await websocket.send_json({
                                "type": "message",
                                "agent": node_name,
                                "content": msg["content"],
                            })
                            await insert_message(
                                session_id,
                                "ASSISTANT",
                                msg["content"],
                                agent_name=node_name,
                            )

                    # Accumulate state:
                    # - "messages" and "token_count" use operator.add → accumulate
                    # - everything else → replace
                    for key, value in node_output.items():
                        if key == "messages":
                            state["messages"] = state.get("messages", []) + value
                        elif key == "token_count":
                            state["token_count"] = (state.get("token_count") or 0) + value
                        else:
                            state[key] = value

            # Capture and reset per-turn token count before persisting
            turn_tokens = state.get("token_count", 0)
            state["token_count"] = 0

            _session_cache[thread_id] = state
            await update_chat_session(session_id, agent_state=state, token_count_delta=turn_tokens)

            if state.get("is_complete"):
                await websocket.send_json({"type": "complete"})
                await update_chat_session(session_id, status="COMPLETED", end=True)
                break

    except WebSocketDisconnect:
        logger.info("Client disconnected from session %s", session_id)
    except Exception:
        logger.exception("Unhandled error in chat session %s", session_id)
        try:
            await websocket.send_json({"type": "error", "message": "An internal error occurred."})
        except Exception:
            pass
