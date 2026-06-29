from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.db.client import fetch_chat_session
from app.dependencies import verify_internal_secret

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


class DiagnosticStatusResponse(BaseModel):
    session_id: str
    is_complete: bool
    urgency: str | None
    suggested_specialty: str | None
    final_report: str | None  # JSON string, parsed by the caller (NestJS)


@router.get(
    "/status/{session_id}",
    response_model=DiagnosticStatusResponse,
    dependencies=[Depends(verify_internal_secret)],
)
async def get_diagnostic_status(session_id: str):
    """
    Called by NestJS to check whether a chat session has produced a completed
    pre-diagnostic report.  Returns the raw final_report JSON string so NestJS
    can parse it and store it in the pre_diagnostics table if needed.
    """
    session = await fetch_chat_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    agent_state: dict = session.get("agent_state") or {}

    return DiagnosticStatusResponse(
        session_id=session_id,
        is_complete=agent_state.get("is_complete", False),
        urgency=agent_state.get("urgency"),
        suggested_specialty=agent_state.get("suggested_specialty"),
        final_report=agent_state.get("final_report"),
    )
