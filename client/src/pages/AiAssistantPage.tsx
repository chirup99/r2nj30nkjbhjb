import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  House,
  Landmark,
  ListFilter,
  MapPin,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

const QUICK_ACTIONS = [
  {
    label: "Budget",
    prompt: "Help me find properties within my budget",
    icon: Wallet,
  },
  {
    label: "Location",
    prompt: "Which Hyderabad locations are best for me?",
    icon: MapPin,
  },
  {
    label: "Villa",
    prompt: "Show me villa options",
    icon: House,
  },
  {
    label: "Loan",
    prompt: "Explain my home loan options",
    icon: Landmark,
  },
  {
    label: "All questions",
    prompt: "I have questions about buying a property",
    icon: ListFilter,
  },
] as const;

export default function AiAssistantPage() {
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const sendMessage = (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text },
      {
        id: Date.now() + 1,
        role: "assistant",
        text: "I can help you narrow that down. Tell me your preferred area, budget, and property type to get started.",
      },
    ]);
    setDraft("");
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-4 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d12] shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
        <header className="relative flex h-16 shrink-0 items-center justify-center border-b border-white/10 px-4">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="absolute left-4 rounded-full p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-300" />
            <span className="font-display text-sm font-bold tracking-[0.16em]">
              R Cliq +AI
            </span>
          </div>
        </header>

        <section className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8">
          {messages.length === 0 ? (
            <div className="m-auto max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-300/20 bg-purple-500/10">
                <Sparkles className="h-6 w-6 text-purple-200" />
              </div>
              <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.24em] text-purple-300">
                Property assistant
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
                What can I help you find?
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/45">
                Ask about properties, neighbourhoods, budgets, loans, and more
                across Hyderabad.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-br-md bg-purple-500 text-white"
                        : "rounded-bl-md border border-white/10 bg-white/[0.06] text-white/75"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="shrink-0 border-t border-white/10 bg-[#0a0a0e] p-4 sm:p-5">
          <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto pb-1">
            {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => setDraft(prompt)}
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/65 transition-colors hover:border-purple-300/40 hover:bg-purple-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                <Icon className="h-3.5 w-3.5 text-purple-300" />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <label htmlFor="ai-question" className="sr-only">
              Ask R Cliq +AI
            </label>
            <input
              id="ai-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask anything about property..."
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/50"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500 text-white transition-colors hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              aria-label="Send question"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </div>
    </main>
  );
}