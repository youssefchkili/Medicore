from typing import Literal
from langgraph.graph import END
from app.agents.state import MedicalAgentState

def should_route_to(state: MedicalAgentState) -> Literal[
    "triage", "symptom_collector", "clarification", "rag_agent",
    "report_agent", "emergency_response", "__end__"
]:
    # Pause the graph — the WebSocket router will resume it with the next user message
    if state.get("awaiting_user_input", False):
        return END

    # Check completion early so emergency_response and report_agent don't loop
    if state.get("is_complete", False):
        return END

    if not state.get("triage_complete", False):
        return "triage"

    if state.get("urgency") == "EMERGENCY":
        return "emergency_response"

    if state.get("needs_clarification", False):
        return "clarification"

    if not state.get("symptom_collection_complete", False):
        return "symptom_collector"

    if not state.get("rag_complete", False):
        return "rag_agent"

    return "report_agent"
