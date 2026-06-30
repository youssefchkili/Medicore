from typing import TypedDict, Annotated, Optional, List
import operator

class MedicalAgentState(TypedDict):
    patient_id: str
    chat_session_id: Optional[str]
    messages: Annotated[List[dict], operator.add]
    symptoms: dict
    severity_level: int
    urgency: str
    suggested_specialty: Optional[str]
    possible_conditions: List[dict]
    rag_sources: List[dict]
    final_report: Optional[str]
    current_agent: str
    is_complete: bool
    needs_clarification: bool
    clarification_question: Optional[str]
    triage_complete: bool
    emergency_notified: bool  # True after the one-time emergency warning is shown
    symptom_collection_complete: bool
    rag_complete: bool
    awaiting_user_input: bool
    token_count: Annotated[int, operator.add]  # accumulates across agents per turn, reset after each turn
