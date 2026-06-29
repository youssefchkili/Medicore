import json
import time
import logging
from typing import List, Optional

import httpx
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from app.agents.state import MedicalAgentState
from app.db.client import insert_pre_diagnostic, log_agent_invocation
from app.config import get_settings

logger = logging.getLogger(__name__)


class FinalReport(BaseModel):
    symptoms_summary: str
    severity_level: int
    urgency: str
    suggested_specialty: Optional[str]
    possible_conditions: List[dict]
    rag_sources: List[dict]
    recommendations: str
    disclaimer: str = "This is an AI-assisted pre-screening, not a medical diagnosis."


_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
_structured_llm = _llm.with_structured_output(FinalReport, include_raw=True)

_prompt = ChatPromptTemplate.from_messages([
    ("system", """Generate a comprehensive pre-diagnostic report for a doctor to review.
Be thorough and objective. Always include the disclaimer that this is not a medical diagnosis."""),
    ("human", """Symptoms: {symptoms}
Severity: {severity}/10
Urgency: {urgency}
Suggested specialty: {specialty}
Possible conditions: {conditions}
Sources: {sources}"""),
])

_chain = _prompt | _structured_llm


async def report_agent(state: MedicalAgentState) -> dict:
    symptoms = state.get("symptoms", {})
    severity = state.get("severity_level", 1)
    urgency = state.get("urgency", "LOW")
    specialty = state.get("suggested_specialty")
    conditions = state.get("possible_conditions", [])
    sources = state.get("rag_sources", [])
    patient_id = state.get("patient_id")
    chat_session_id = state.get("chat_session_id")

    start = time.monotonic()
    raw_result = await _chain.ainvoke({
        "symptoms": json.dumps(symptoms),
        "severity": severity,
        "urgency": urgency,
        "specialty": specialty or "General Practice",
        "conditions": json.dumps(conditions),
        "sources": json.dumps(sources),
    })
    latency_ms = int((time.monotonic() - start) * 1000)

    result = raw_result["parsed"]
    tokens = 0
    if raw_result.get("raw"):
        usage = getattr(raw_result["raw"], "usage_metadata", None)
        if usage:
            tokens = usage.get("total_tokens", 0)

    report_json = json.dumps(result.model_dump())

    # Persist to Supabase and retrieve the new row's UUID
    pre_diag_id: Optional[str] = None
    if patient_id and chat_session_id:
        try:
            pre_diag = await insert_pre_diagnostic(
                patient_id=patient_id,
                chat_session_id=chat_session_id,
                symptoms=symptoms,
                severity_level=severity,
                urgency=urgency,
                suggested_specialty=specialty,
                possible_conditions=conditions,
                rag_sources=sources,
                raw_report=report_json,
            )
            pre_diag_id = pre_diag.get("id")
        except Exception:
            logger.exception("Could not save pre-diagnostic to Supabase")

    # Notify NestJS so it can send the patient notification and mark the session complete
    if pre_diag_id and patient_id:
        settings = get_settings()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{settings.nestjs_url}/ai-proxy/webhook/diagnostic-complete",
                    json={
                        "preDiagnosticId": pre_diag_id,
                        "patientId": patient_id,
                        "urgency": urgency,
                    },
                    headers={"x-internal-secret": settings.ai_service_secret},
                )
        except Exception:
            logger.warning("Could not call NestJS diagnostic-complete webhook", exc_info=True)

    if chat_session_id:
        try:
            await log_agent_invocation(
                chat_session_id=chat_session_id,
                agent_name="report_agent",
                input_data={"symptoms": symptoms, "urgency": urgency, "conditions_count": len(conditions)},
                output_data=result.model_dump(),
                tokens_used=tokens,
                latency_ms=latency_ms,
            )
        except Exception:
            pass

    return {
        "final_report": report_json,
        "is_complete": True,
        "current_agent": "report_agent",
        "token_count": tokens,
        "messages": [
            {"role": "assistant", "content": "Your pre-diagnostic assessment is complete. A doctor will review it shortly."}
        ],
    }
