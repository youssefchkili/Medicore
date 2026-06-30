import json
import time
from typing import List
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from app.agents.state import MedicalAgentState
from app.rag.qdrant_store import get_retriever
from app.db.client import log_agent_invocation


class RAGOutput(BaseModel):
    possible_conditions: List[dict] = Field(
        default_factory=list,
        description="Possible conditions with confidence levels (low/medium/high)"
    )
    rag_sources: List[dict] = Field(
        default_factory=list,
        description="Source documents used to reach these conclusions"
    )


_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
_structured_llm = _llm.with_structured_output(RAGOutput, include_raw=True)

_prompt = ChatPromptTemplate.from_messages([
    ("system", """Based on the retrieved medical documents, suggest possible conditions that match the patient's symptoms.
Include confidence levels: low, medium, or high for each condition.
Do NOT diagnose. This output is for pre-screening only and will be reviewed by a doctor."""),
    ("human", "Symptoms: {symptoms}\n\nRetrieved medical knowledge:\n{context}"),
])

_chain = _prompt | _structured_llm


async def rag_agent(state: MedicalAgentState) -> dict:
    # Lazy connect — works even if Qdrant started after the AI service booted
    retriever = None
    try:
        retriever = get_retriever(k=5)
    except Exception as e:
        logger.warning("RAG retriever unavailable: %s", e)

    if not retriever:
        return {
            "possible_conditions": [],
            "rag_sources": [],
            "rag_complete": True,
            "current_agent": "rag_agent",
            "token_count": 0,
        }

    symptoms = state.get("symptoms", {})
    query = f"Patient symptoms: {json.dumps(symptoms)}. What medical conditions match these symptoms?"

    start = time.monotonic()
    docs = await retriever.ainvoke(query)

    context = "\n\n---\n\n".join([
        f"Source: {doc.metadata.get('source_title', 'Unknown')}\n{doc.page_content}"
        for doc in docs
    ])

    sources = [
        {
            "url": doc.metadata.get("source_url", ""),
            "title": doc.metadata.get("source_title", "Unknown"),
            "section": doc.metadata.get("section", ""),
        }
        for doc in docs
    ]

    raw_result = await _chain.ainvoke({
        "symptoms": json.dumps(symptoms),
        "context": context,
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
                agent_name="rag_agent",
                input_data={"symptoms": symptoms, "docs_retrieved": len(docs)},
                output_data=result.model_dump(),
                tokens_used=tokens,
                latency_ms=latency_ms,
            )
        except Exception:
            pass

    return {
        "possible_conditions": result.possible_conditions,
        "rag_sources": sources,
        "rag_complete": True,
        "current_agent": "rag_agent",
        "token_count": tokens,
        "messages": [
            {"role": "assistant", "content": f"Found {len(result.possible_conditions)} possible condition(s) from medical knowledge."}
        ],
    }
