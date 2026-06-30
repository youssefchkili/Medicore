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
    ("system", """You are a medical symptom collector. Be concise and decisive.

Current symptoms collected so far: {symptoms}
Questions asked so far: {turn_count}

Your job:
1. Update the symptoms dict from the conversation.
2. Set is_complete=true if you have AT MINIMUM: what symptoms, how long, and whether getting better or worse.
   Do NOT keep asking once you have these basics — a doctor will ask for more detail in person.
3. If you must ask ONE more follow-up, make it count. Never ask about something already answered.
4. If the patient says they have nothing more to add, set is_complete=true immediately.
5. If turn_count >= 5, ALWAYS set is_complete=true regardless of how much info you have.

Respond with structured data only."""),
    ("human", "Recent conversation: {conversation}"),
])

_chain = _prompt | _structured_llm


async def symptom_collector_agent(state: MedicalAgentState) -> dict:
    current_symptoms = state.get("symptoms", {})
    messages = state.get("messages", [])

    # Count how many times the symptom collector has already asked a question
    # (proxy: number of user messages after the first one)
    user_msgs = [m for m in messages if m.get("role") == "user"]
    turn_count = max(0, len(user_msgs) - 1)  # first user msg is the initial symptom report

    # Hard limit: if the patient has answered 6+ follow-up questions, stop asking
    if turn_count >= 6:
        return {
            "symptoms": current_symptoms,
            "symptom_collection_complete": True,
            "needs_clarification": False,
            "awaiting_user_input": False,
            "current_agent": "symptom_collector",
            "token_count": 0,
            "messages": [{"role": "assistant", "content": "Thank you, I have enough information to prepare your pre-diagnostic report."}],
        }

    recent_messages = messages[-10:] if len(messages) > 10 else messages

    start = time.monotonic()
    raw_result = await _chain.ainvoke({
        "symptoms": json.dumps(current_symptoms),
        "conversation": json.dumps(recent_messages),
        "turn_count": turn_count,
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
