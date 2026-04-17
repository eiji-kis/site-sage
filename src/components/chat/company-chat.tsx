"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logPublicAnalytics } from "@/actions/analytics-actions";
import BorderGlow from "@/components/BorderGlow";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = { role: "user" | "assistant"; content: string };

const pageViewStorageKey = (slug: string) => `ss_pcv_${slug}`;

export function CompanyChat({
  slug,
  companyName,
  publicAgentDescription,
}: {
  slug: string;
  companyName: string;
  publicAgentDescription?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const key = pageViewStorageKey(slug);
    if (sessionStorage.getItem(key)) {
      return;
    }
    sessionStorage.setItem(key, "1");
    void logPublicAnalytics({
      type: "PUBLIC_CHAT_VIEW",
      slug,
      referrer: document.referrer ? document.referrer.slice(0, 2000) : undefined,
      search: window.location.search ? window.location.search.slice(0, 2000) : undefined,
      userAgent: navigator.userAgent ? navigator.userAgent.slice(0, 500) : undefined,
    });
  }, [slug]);

  async function send() {
    const text = input.trim();
    if (!text || pending) {
      return;
    }
    setError(null);
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setPending(true);
    const clientRequestId = crypto.randomUUID();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, clientRequestId, messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setError(errText || "Could not load the assistant.");
        setPending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";

      setMessages([...nextMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        assistant += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: assistant }]);
        scrollToBottom();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
      scrollToBottom();
    }
  }

  return (
    <div className="flex min-h-[56vh] flex-col gap-4">
      <BorderGlow
        className="border-0 shadow-lg shadow-black/30 ring-1 ring-white/[0.06] backdrop-blur-md"
        borderRadius={14}
        backgroundColor="rgba(32, 28, 48, 0.55)"
        colors={["#8b5cf6", "#22d3ee", "#e879f9"]}
        glowColor="285 55% 68"
        glowRadius={18}
        edgeSensitivity={32}
        fillOpacity={0.35}
      >
        <div className="p-4">
          <div className="mb-3 text-sm font-semibold tracking-tight">{companyName}</div>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1 text-sm">
            {messages.length === 0 ? (
              <p className="text-pretty text-muted-foreground">
                {publicAgentDescription?.trim()
                  ? "Ask a question below. Replies use only the curated knowledge base for this company."
                  : "Ask a question about this company. Answers use the generated knowledge base only."}
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-xl border border-primary/25 bg-primary/15 px-3 py-2 shadow-sm shadow-black/20"
                    : "mr-auto max-w-[85%] rounded-xl border border-border/80 bg-muted/35 px-3 py-2 shadow-sm shadow-black/15 backdrop-blur-sm"
                }
              >
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {m.role === "user" ? "You" : "Assistant"}
                </div>
                <ChatMessageMarkdown content={m.content} companySlug={slug} />
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </BorderGlow>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          rows={3}
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !input.trim()}>
            {pending ? "Thinking…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
