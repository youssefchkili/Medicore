import json
import time
from typing import Optional
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from app.agents.state import MedicalAgentState
from app.db.client import log_agent_invocation


class SymptomCollectorOutput(BaseModel):
    symptoms: dict = Field(default_factory=dict, description="Structured symptom data collected so far")
    question_to_ask: Optional[str] = Field(default=None, description="Next focused question if more info is needed")
    is_complete: bool = Field(default=False, description="True if enough symptoms have been collected")
    needs_clarification: bool = Field(
        default=False,
        description="True if the patient's input is too ambiguous to process — triggers the clarification agent"
    )


_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
_structured_llm = _llm.with_structured_output(SymptomCollectorOutput, include_raw=True)

_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a medical symptom collector.

Current symptoms collected so far: {symptoms}

Your job:
1. Review the conversation and update the structured symptoms dict.
2. If the patient's message is too vague or contradictory to extract anything useful,
   set needs_clarification=true (the clarification agent will ask them to rephrase).
3. If you have a clear follow-up question, set question_to_ask to ONE focused question.
4. If you have enough information (location, duration, severity, character of symptoms),
   set is_complete=true.

Respond with structured data only."""),
    ("human", "Recent conversation: {conversation}"),
])

_chain = _prompt | _structured_llm


async def symptom_collector_agent(state: MedicalAgentState) -> dict:
    current_symptoms = state.get("symptoms", {})
    messages = state.get("messages", [])
    recent_messages = messages[-6:] if len(messages) > 6 else messages

    start = time.monotonic()
    raw_result = await _chain.ainvoke({
        "symptoms": json.dumps(current_symptoms),
        "conversation": json.dumps(recent_messages),
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
                agent_name="symptom_collector",
                input_data={"symptoms": current_symptoms, "message_count": len(recent_messages)},
                output_data=result.model_dump(),
                tokens_used=tokens,
                latency_ms=latency_ms,
            )
        except Exception:
            pass

    response: dict = {
        "symptoms": result.symptoms,
        "symptom_collection_complete": result.is_complete,
        "needs_clarification": result.needs_clarification,
        "current_agent": "symptom_collector",
        "token_count": tokens,
    }

    if result.needs_clarification:
        response["awaiting_user_input"] = False

    elif not result.is_complete and result.question_to_ask:
        response["messages"] = [{"role": "assistant", "content": result.question_to_ask}]
        response["awaiting_user_input"] = True

    elif not result.is_complete and not result.question_to_ask:
        response["needs_clarification"] = True
        response["awaiting_user_input"] = False

    else:
        response["messages"] = [{"role": "assistant", "content": "Thank you. I have collected your symptoms."}]
        response["awaiting_user_input"] = False

    return response
