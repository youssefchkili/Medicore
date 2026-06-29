from langgraph.graph import StateGraph, END

from app.agents.state import MedicalAgentState
from app.agents.supervisor import should_route_to
from app.agents.triage import triage_agent
from app.agents.symptom_collector import symptom_collector_agent
from app.agents.clarification import clarification_agent
from app.agents.rag_agent import rag_agent
from app.agents.report_agent import report_agent


def emergency_response(state: MedicalAgentState) -> dict:
    return {
        "is_complete": True,
        "awaiting_user_input": False,
        "current_agent": "emergency_response",
        "messages": [
            {
                "role": "assistant",
                "content": (
                    "EMERGENCY: Please seek immediate medical attention or call your local "
                    "emergency services now. Do not wait. This platform is not a substitute "
                    "for emergency care."
                ),
            }
        ],
    }


builder = StateGraph(MedicalAgentState)

# _router is a no-op entry point.  Its only job is to immediately call the
# supervisor so the supervisor decides which real agent to run first.
# Without it, set_entry_point("triage") would force triage to execute on
# every single turn — including follow-up answers like "3 days" — which is wrong.
builder.add_node("_router", lambda state: {})
builder.add_node("triage", triage_agent)
builder.add_node("symptom_collector", symptom_collector_agent)
builder.add_node("clarification", clarification_agent)
builder.add_node("rag_agent", rag_agent)
builder.add_node("report_agent", report_agent)
builder.add_node("emergency_response", emergency_response)

builder.set_entry_point("_router")

# Every node (including the router) routes through the supervisor after it finishes
destinations = {
    "triage": "triage",
    "symptom_collector": "symptom_collector",
    "clarification": "clarification",
    "rag_agent": "rag_agent",
    "report_agent": "report_agent",
    "emergency_response": "emergency_response",
    END: END,
}

for node in ["_router", "triage", "symptom_collector", "clarification", "rag_agent", "report_agent", "emergency_response"]:
    builder.add_conditional_edges(node, should_route_to, destinations)

graph = builder.compile()
