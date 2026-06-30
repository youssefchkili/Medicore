"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost, apiGet, getWsToken } from "@/lib/api";
import NotificationBell from "@/components/dashboard/NotificationBell";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type SessionInfo = {
  chatSessionId: string;
  wsPath: string;
};

type Me = {
  patient?: { id: string } | null;
};

const SUGGESTED_PROMPTS = [
  "I have a persistent headache for the past 3 days",
  "I'm experiencing chest pain and shortness of breath",
  "I have a high fever and sore throat",
  "I've been feeling very fatigued and dizzy lately",
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "streaming" | "completed" | "error">("idle");
  const [error, setError] = useState("");
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startSession = useCallback(async () => {
    setStatus("connecting");
    setError("");
    try {
      const me = await apiGet<Me>("/users/me");
      if (!me.patient) {
        await apiPost("/users/me/patient/init");
      }
      const info = await apiPost<SessionInfo>("/ai-proxy/chat/start");
      setSessionInfo(info);

      const token = await getWsToken();
      // Use the dedicated AI WebSocket URL if configured, otherwise fall through NGINX
      const aiWsBase = process.env.NEXT_PUBLIC_AI_WS_URL;
      let wsUrl: string;
      if (aiWsBase) {
        // NEXT_PUBLIC_AI_WS_URL points directly to FastAPI; wsPath has /ai prefix stripped
        const localPath = info.wsPath.replace(/^\/ai/, "");
        wsUrl = `${aiWsBase}${localPath}${token ? `?token=${token}` : ""}`;
      } else {
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        wsUrl = `${proto}://${window.location.host}${info.wsPath}${token ? `?token=${token}` : ""}`;
      }
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: "Hello! I'm MediCore AI. Please describe your symptoms and I'll help assess them. The more detail you provide, the better I can assist you.",
          timestamp: new Date(),
        }]);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string) as {
          type: string;
          delta?: string;
          content?: string;
          preDiagnosticId?: string;
        };

        if (data.type === "token" || data.type === "delta") {
          setStatus("streaming");
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.id === "streaming") {
              return [...prev.slice(0, -1), { ...last, content: last.content + (data.delta ?? data.content ?? "") }];
            }
            return [...prev, { id: "streaming", role: "assistant", content: data.delta ?? data.content ?? "", timestamp: new Date() }];
          });
        } else if (data.type === "end" || data.type === "message_end") {
          setStatus("connected");
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === "streaming") {
              return [...prev.slice(0, -1), { ...last, id: crypto.randomUUID() }];
            }
            return prev;
          });
        } else if (data.type === "message") {
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.content ?? "",
            timestamp: new Date(),
          }]);
          setStatus("connected");
        } else if (data.type === "complete" || data.type === "diagnostic_complete" || data.type === "diagnostic_ready") {
          setStatus("completed");
          if (data.preDiagnosticId) setDiagnosticId(data.preDiagnosticId);
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Your pre-diagnostic report is ready! A doctor will review it shortly. You can view it in your Diagnostics section.",
            timestamp: new Date(),
          }]);
        } else if (data.type === "error") {
          setStatus("error");
          setError((data as { type: string; message?: string }).message ?? "An error occurred in the AI service.");
        }
      };

      ws.onerror = () => {
        setStatus("error");
        setError("Connection to AI service failed. Please ensure the service is running.");
      };

      ws.onclose = (e) => {
        if (e.code !== 1000 && status !== "completed") {
          setStatus("error");
          setError("Connection closed unexpectedly.");
        }
      };
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to start chat session.");
    }
  }, [status]);

  useEffect(() => {
    startSession();
    return () => { wsRef.current?.close(1000, "unmount"); };
  }, []);

  function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    wsRef.current.send(JSON.stringify({ message: content }));
    setStatus("streaming");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-7 h-16 flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-[17px] text-[#0F172A]">AI Health Assistant</p>
          <p className="text-[12px] text-[#94A3B8]">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {status === "connected" && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#059669]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" style={{ animation: "pulseDot 2s ease-in-out infinite" }} />
              Connected
            </span>
          )}
          {status === "streaming" && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#2563EB]">
              <span className="w-2 h-2 rounded-full bg-[#2563EB] inline-block animate-pulse" />
              AI thinking…
            </span>
          )}
          {status === "completed" && (
            <span className="text-[12px] font-medium text-[#059669]">Session complete</span>
          )}
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 gap-4" style={{ minHeight: 0 }}>
        {/* Chat container */}
        <div className="flex-1 bg-white rounded-[20px] border border-[#E2E8F0] flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

          {/* Status / error banner */}
          {status === "connecting" && (
            <div className="flex items-center justify-center gap-3 py-6">
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="4" />
                <path className="opacity-75" fill="#2563EB" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[14px] text-[#64748B]">Starting AI session…</span>
            </div>
          )}

          {status === "error" && (
            <div className="m-4 p-4 rounded-xl bg-[#FFF1F2] border border-[#FECDD3]">
              <p className="font-heading font-semibold text-[14px] text-[#BE123C] mb-1">Connection Error</p>
              <p className="text-[13px] text-[#E11D48]">{error}</p>
              <button
                onClick={startSession}
                className="mt-3 px-4 py-2 rounded-[10px] bg-[#2563EB] text-white font-heading font-semibold text-[13px] hover:bg-[#1D4ED8] transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Suggested prompts — shown when no messages yet */}
          {messages.length === 0 && status !== "connecting" && status !== "error" && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-[20px] bg-[#EFF6FF] flex items-center justify-center mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <h3 className="font-heading font-bold text-[18px] text-[#0F172A] mb-2">Start describing your symptoms</h3>
              <p className="text-[14px] text-[#64748B] mb-8 text-center max-w-sm">
                Our AI will analyze your symptoms and create a pre-diagnostic report for doctor review.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="px-4 py-3 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[13px] text-[#374151] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] hover:text-[#2563EB] transition-all text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[12px] text-white"
                    style={{
                      background: msg.role === "user"
                        ? "linear-gradient(135deg,#2563EB,#1D4ED8)"
                        : "linear-gradient(135deg,#059669,#10B981)",
                    }}
                  >
                    {msg.role === "user" ? "U" : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    )}
                  </div>
                  {/* Bubble */}
                  <div
                    className="max-w-[75%] px-4 py-3 rounded-[16px] text-[14px] leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: msg.role === "user" ? "linear-gradient(135deg,#2563EB,#1D4ED8)" : "#F8FAFC",
                      color: msg.role === "user" ? "#fff" : "#1E293B",
                      borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      border: msg.role === "user" ? "none" : "1px solid #E2E8F0",
                    }}
                  >
                    {msg.content}
                    {msg.id === "streaming" && (
                      <span className="inline-block w-1.5 h-4 bg-[#2563EB] ml-1 animate-pulse rounded-sm" style={{ verticalAlign: "text-bottom" }} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Diagnostic complete CTA */}
          {status === "completed" && (
            <div
              className="mx-4 mb-4 flex items-center justify-between px-5 py-4 rounded-[16px] border border-[#A7F3D0]"
              style={{ background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#D1FAE5] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <p className="font-heading font-bold text-[14px] text-[#064E3B]">Pre-diagnostic complete</p>
                  <p className="text-[12px] text-[#065F46]">A doctor will review your report shortly</p>
                </div>
              </div>
              <Link
                href={diagnosticId ? `/dashboard/patient/diagnostics` : "/dashboard/patient/diagnostics"}
                className="px-4 py-2 rounded-[10px] bg-[#059669] text-white font-heading font-semibold text-[13px] hover:bg-[#047857] transition-colors"
              >
                View Report
              </Link>
            </div>
          )}

          {/* Input area */}
          {status !== "completed" && (
            <div className="border-t border-[#F1F5F9] p-4">
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your symptoms…"
                  disabled={status === "connecting" || status === "streaming" || status === "error"}
                  className="flex-1 resize-none px-4 py-3 rounded-xl text-[14px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] outline-none focus:border-[#2563EB] focus:bg-white transition-all disabled:opacity-50"
                  style={{ minHeight: "46px", maxHeight: "120px" }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || status === "connecting" || status === "streaming" || status === "error"}
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 text-center">
                AI-generated content is for informational purposes only. Always consult a doctor for medical advice.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
