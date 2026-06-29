import json
import time
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from app.agents.state import MedicalAgentState
from app.db.client import log_agent_invocation


class ClarificationOutput(BaseModel):
    clarification_question: str = Field(description="Clear, simple question to resolve ambiguity")
    is_resolved: bool = Field(description="True if the ambiguity is now resolved and we can continue")


_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
_structured_llm = _llm.with_structured_output(ClarificationOutput, include_raw=True)

_prompt = ChatPromptTemplate.from_messages([
    ("system", "The patient's input is unclear or too vague to process. Ask one simple, direct question to resolve the ambiguity."),
    ("human", "Patient's last message: '{message}'\nSymptoms collected so far: {symptoms}"),
])

_chain = _prompt | _structured_llm


async def clarification_agent(state: MedicalAgentState) -> dict:
    messages = state.get("messages", [])
    symptoms = state.get("symptoms", {})

    last_user_msg = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content", "")
            break

    start = time.monotonic()
    raw_result = await _chain.ainvoke({
        "message": last_user_msg,
        "symptoms": json.dumps(symptoms),
    })
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
                agent_name="clarification",
                input_data={"last_user_message": last_user_msg},
                output_data=result.model_dump(),
                tokens_used=tokens,
                latency_ms=latency_ms,
            )
        except Exception:
            pass

    if not result.is_resolved:
        return {
            "needs_clarification": True,
            "clarification_question": result.clarification_question,
            "current_agent": "clarification",
            "awaiting_user_input": True,
            "token_count": tokens,
            "messages": [{"role": "assistant", "content": result.clarification_question}],
        }

    return {
        "needs_clarification": False,
        "clarification_question": None,
        "current_agent": "clarification",
        "awaiting_user_input": False,
        "token_count": tokens,
        "messages": [{"role": "assistant", "content": "Thank you for the clarification."}],
    }
