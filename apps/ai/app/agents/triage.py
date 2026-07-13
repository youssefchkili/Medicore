import time
from typing import Optional, Union
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field, field_validator
from app.agents.state import MedicalAgentState
from app.db.client import log_agent_invocation


class TriageOutput(BaseModel):
    urgency: str = Field(description="LOW, MEDIUM, HIGH, or EMERGENCY")
    # Groq's tool-call schema validation rejects the whole request if the model emits
    # severity_level as a numeric string against a strict "integer" schema (observed with
    # llama-3.3-70b-versatile). Accepting both here widens the generated schema so Groq
    # doesn't 400, and the validator below normalizes back to int for downstream consumers.
    severity_level: Union[int, str] = Field(description="1-10 scale")
    suggested_specialty: Optional[str] = Field(default=None, description="e.g., 'cardiology'")
    reasoning: str = Field(description="Why this urgency level was chosen")

    @field_validator("severity_level", mode="after")
    @classmethod
    def coerce_severity_level(cls, v: Union[int, str]) -> int:
        return int(v)


_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
_structured_llm = _llm.with_structured_output(TriageOutput, include_raw=True)

_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a medical triage assistant. Analyze the patient's message and determine urgency.
If the patient mentions chest pain, difficulty breathing, severe bleeding, loss of consciousness, or suicidal thoughts, mark as EMERGENCY.
Respond with structured data."""),
    ("human", "{patient_message}")
])

_chain = _prompt | _structured_llm


async def triage_agent(state: MedicalAgentState) -> dict:
    last_user_msg = ""
    for msg in reversed(state.get("messages", [])):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content", "")
            break

    if not last_user_msg:
        return {
            "triage_complete": False,
            "awaiting_user_input": True,
            "token_count": 0,
            "messages": [{"role": "assistant", "content": "Please describe your symptoms."}],
        }

    start = time.monotonic()
    raw_result = await _chain.ainvoke({"patient_message": last_user_msg})
    latency_ms = int((time.monotonic() - start) * 1000)

    result = raw_result["parsed"]
    tokens = 0
    if raw_result.get("raw"):
        usage = getattr(raw_result["raw"], "usage_metadata", None)
        if usage:
            tokens = usage.get("total_tokens", 0)

    session_id = state.get("chat_session_id")
    if session_id:
        try:
            await log_agent_invocation(
                chat_session_id=session_id,
                agent_name="triage",
                input_data={"patient_message": last_user_msg},
                output_data=result.model_dump(),
                tokens_used=tokens,
                latency_ms=latency_ms,
            )
        except Exception:
            pass

    return {
        "urgency": result.urgency,
        "severity_level": result.severity_level,
        "suggested_specialty": result.suggested_specialty,
        "triage_complete": True,
        "awaiting_user_input": False,
        "current_agent": "triage",
        "token_count": tokens,
        # No user-facing message — triage is an internal routing agent
    }
