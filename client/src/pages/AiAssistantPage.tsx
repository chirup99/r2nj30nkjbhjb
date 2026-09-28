import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  House,
  Landmark,
  ListFilter,
  MapPin,
  Send,
  Wallet,
} from "lucide-react";
import { PropertyMeetupMark } from "@/components/PropertyMeetupMark";
import {
  HyderabadPropertyMapOverlay,
} from "@/components/HyderabadPropertyMap";
import {
  PLOTSVIEW_PROJECTS,
  type PlotsViewProject,
} from "@/data/plotsviewProjects";

type AssistantQuery = {
  intent: "property" | "loan";
  location?: string;
  maxBudget?: number;
  propertyType?: "plot" | "farm" | "villa" | "flat";
};

type PropertyMatch = PlotsViewProject & {
  estimatedEntryPrice: number;
  pricePerSqYd: number;
};

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  matches?: PropertyMatch[];
  showLoanPlanner?: boolean;
};

type LoanSettings = {
  propertyValue: number;
  downPayment: number;
  interestRate: number;
  tenure: number;
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

const LOCATION_GROUPS: Record<string, string[]> = {
  "north hyderabad": ["medchal", "shamirpet", "ghatkesar", "gagillapur"],
  "west hyderabad": ["beeramguda", "shankarpally", "patloor", "sangareddy"],
  "south hyderabad": ["kadthal", "maheshwaram", "yacharam", "rajapur"],
  "east hyderabad": ["bibinagar", "yadadri", "bhongir", "bhuvanagiri"],
};

function parseAmount(value: string, unit?: string) {
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(number)) return undefined;
  if (unit?.startsWith("cr")) return number * 10_000_000;
  if (unit?.startsWith("l")) return number * 100_000;
  return number >= 100_000 ? number : undefined;
}

function parseBudget(text: string) {
  const normalized = text.toLowerCase().replace(/,/g, "");
  const amounts = Array.from(
    normalized.matchAll(
      /(?:₹\s*)?(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|l)\b/g,
    ),
  )
    .map((match) => parseAmount(match[1], match[2]))
    .filter((amount): amount is number => amount !== undefined);

  if (amounts.length > 0) {
    return Math.max(...amounts);
  }

  const rupeeAmount = normalized.match(/₹\s*(\d{5,})/);
  return rupeeAmount ? parseAmount(rupeeAmount[1]) : undefined;
}

function parseQuery(text: string): AssistantQuery {
  const normalized = text.toLowerCase();
  const location =
    Object.keys(LOCATION_GROUPS).find((group) =>
      normalized.includes(group),
    ) ||
    PLOTSVIEW_PROJECTS.map((project) => project.locality)
      .sort((a, b) => b.length - a.length)
      .find((locality) => normalized.includes(locality.toLowerCase()));

  const propertyType = normalized.includes("villa") || normalized.includes("house")
    ? "villa"
    : normalized.includes("flat") || normalized.includes("apartment")
      ? "flat"
      : normalized.includes("farm") || normalized.includes("land")
        ? "farm"
        : normalized.includes("plot")
          ? "plot"
          : undefined;

  return {
    intent: /loan|emi|interest|tenure|finance|down payment/.test(normalized)
      ? "loan"
      : "property",
    location,
    maxBudget: parseBudget(normalized),
    propertyType,
  };
}

function getPricePerSqYd(project: PlotsViewProject) {
  return Number(project.price.replace(/[^\d]/g, "")) || 0;
}

function getMinimumPlotSize(project: PlotsViewProject) {
  return Number(project.bedrooms.match(/\d+/)?.[0] || 0);
}

function formatCurrency(value: number) {
  if (value >= 10_000_000) {
    return `₹${(value / 10_000_000).toFixed(1).replace(".0", "")} Cr`;
  }
  return `₹${Math.round(value / 100_000)}L`;
}

function formatRate(value: number) {
  return `₹${value.toLocaleString("en-IN")} / sq yd`;
}

function getPropertyMatches(query: AssistantQuery): PropertyMatch[] {
  return PLOTSVIEW_PROJECTS.map((project) => {
    const pricePerSqYd = getPricePerSqYd(project);
    return {
      ...project,
      pricePerSqYd,
      estimatedEntryPrice: pricePerSqYd * getMinimumPlotSize(project),
    };
  })
    .filter((project) => {
      const locationTerms = query.location
        ? LOCATION_GROUPS[query.location] || [query.location.toLowerCase()]
        : [];
      const matchesLocation =
        locationTerms.length === 0 ||
        locationTerms.some((term) =>
          project.locality.toLowerCase().includes(term),
        );
      const matchesBudget =
        !query.maxBudget || project.estimatedEntryPrice <= query.maxBudget;
      const type = project.type.toLowerCase();
      const matchesType =
        !query.propertyType ||
        (query.propertyType === "plot" && type.includes("plot")) ||
        (query.propertyType === "farm" && type.includes("farm")) ||
        (query.propertyType === "villa" && type.includes("villa")) ||
        (query.propertyType === "flat" &&
          (type.includes("flat") || type.includes("apartment")));
      return matchesLocation && matchesBudget && matchesType;
    })
    .sort((a, b) => a.estimatedEntryPrice - b.estimatedEntryPrice)
    .slice(0, 4);
}

async function askGeminiForQuery(text: string): Promise<Partial<AssistantQuery> | null> {
  try {
    const response = await fetch("/api/assistant/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.available ? result.query : null;
  } catch {
    return null;
  }
}

function getLoanPayment(settings: LoanSettings) {
  const principal =
    settings.propertyValue * (1 - settings.downPayment / 100);
  const monthlyRate = settings.interestRate / 100 / 12;
  const months = settings.tenure * 12;
  if (!principal || !monthlyRate) return principal / months;
  return (
    (principal * monthlyRate * (1 + monthlyRate) ** months) /
    ((1 + monthlyRate) ** months - 1)
  );
}

function LoanPlanner({
  settings,
  onChange,
}: {
  settings: LoanSettings;
  onChange: (settings: LoanSettings) => void;
}) {
  const emi = getLoanPayment(settings);
  const loanAmount =
    settings.propertyValue * (1 - settings.downPayment / 100);
  const totalInterest = emi * settings.tenure * 12 - loanAmount;

  const update = (key: keyof LoanSettings, value: number) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="mt-5 rounded-2xl border border-purple-300/20 bg-purple-500/[0.08] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-200">
            Loan fit
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white">
            Find a comfortable monthly EMI
          </h2>
        </div>
        <Landmark className="h-4 w-4 text-purple-200" />
      </div>

      <div className="mt-4 space-y-4">
        {[
          {
            key: "propertyValue" as const,
            label: "Property value",
            value: settings.propertyValue,
            min: 2_500_000,
            max: 20_000_000,
            step: 250_000,
            display: formatCurrency(settings.propertyValue),
          },
          {
            key: "downPayment" as const,
            label: "Down payment",
            value: settings.downPayment,
            min: 10,
            max: 50,
            step: 5,
            display: `${settings.downPayment}%`,
          },
          {
            key: "interestRate" as const,
            label: "Interest rate",
            value: settings.interestRate,
            min: 6.5,
            max: 12,
            step: 0.1,
            display: `${settings.interestRate.toFixed(1)}%`,
          },
          {
            key: "tenure" as const,
            label: "Tenure",
            value: settings.tenure,
            min: 5,
            max: 30,
            step: 1,
            display: `${settings.tenure} years`,
          },
        ].map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1.5 flex items-center justify-between text-[11px] text-white/65">
              <span>{field.label}</span>
              <span className="font-semibold text-white">{field.display}</span>
            </span>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={field.value}
              onChange={(event) =>
                update(field.key, Number(event.target.value))
              }
              className="h-1.5 w-full accent-purple-300"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.08] p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            Estimated EMI
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatCurrency(emi)} / mo
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.08] p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            Total interest
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatCurrency(Math.max(0, totalInterest))}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/50">
        Best fit: keep the EMI near one-third of your monthly take-home income
        and compare offers from at least two lenders before deciding.
      </p>
    </div>
  );
}

export default function AiAssistantPage() {
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showLoanPlanner, setShowLoanPlanner] = useState(false);
  const [selectedMapProjectId, setSelectedMapProjectId] = useState<string | null>(
    null,
  );
  const [loanSettings, setLoanSettings] = useState<LoanSettings>({
    propertyValue: 6_000_000,
    downPayment: 20,
    interestRate: 8.5,
    tenure: 20,
  });

  const loanEmi = useMemo(() => getLoanPayment(loanSettings), [loanSettings]);

  const addAssistantMessage = (
    text: string,
    matches?: PropertyMatch[],
    showLoan = false,
  ) => {
    setMessages((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        role: "assistant",
        text,
        matches,
        showLoanPlanner: showLoan,
      },
    ]);
  };

  const respondToQuery = async (text: string) => {
    const localQuery = parseQuery(text);
    const modelQuery = await askGeminiForQuery(text);
    const query: AssistantQuery = {
      ...localQuery,
      ...modelQuery,
      intent: modelQuery?.intent || localQuery.intent,
    };

    if (query.intent === "loan") {
      setShowLoanPlanner(true);
      addAssistantMessage(
        `Here is a loan estimate for a ${formatCurrency(
          loanSettings.propertyValue,
        )} property. Adjust the sliders to compare EMI, down payment, interest, and tenure.`,
        undefined,
        true,
      );
      return;
    }

    const matches = getPropertyMatches(query);
    const filters = [
      query.location ? `near ${query.location}` : "",
      query.maxBudget ? `within ${formatCurrency(query.maxBudget)}` : "",
      query.propertyType ? `for ${query.propertyType}s` : "",
    ].filter(Boolean);
    const filterText = filters.length ? ` ${filters.join(" ")}` : "";
    const textResponse = matches.length
      ? `I found ${matches.length} map listings${filterText}. These are ranked by the lowest estimated entry price from the published plot size and rate.`
      : query.propertyType === "villa" || query.propertyType === "flat"
        ? "The current map feed contains approved plot and farm-land listings, not villas or flats. Try “plots near Shamirpet” or “land under ₹50 lakh”."
        : "I couldn’t find a map listing matching those filters. Try a wider budget or another Hyderabad location.";

    addAssistantMessage(textResponse, matches);
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || isThinking) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text },
    ]);
    setDraft("");
    setIsThinking(true);
    try {
      await respondToQuery(text);
    } finally {
      setIsThinking(false);
    }
  };

  const handleQuickAction = (label: string, prompt: string) => {
    if (label === "Loan") {
      setShowLoanPlanner(true);
      addAssistantMessage(
        `Let’s compare your loan options. The current estimate is ${formatCurrency(
          loanEmi,
        )} per month. Adjust the sliders below for a better fit.`,
        undefined,
        true,
      );
      return;
    }
    setDraft(prompt);
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
            <PropertyMeetupMark className="h-5 w-6" />
            <span className="font-display text-sm font-bold tracking-[0.16em]">
              R Cliq +AI
            </span>
          </div>
        </header>

        <section className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8">
          {messages.length === 0 ? (
            <div className="m-auto max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <PropertyMeetupMark className="h-8 w-9" />
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
                <div key={message.id}>
                  <div
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

                  {message.matches && message.matches.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {message.matches.map((project) => (
                        <article
                          key={project.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-white">
                                {project.name}
                              </h3>
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-white/45">
                                <MapPin className="h-3 w-3 text-purple-300" />
                                {project.locality} · {project.approvalType}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#141419]">
                              {formatCurrency(project.estimatedEntryPrice)}+
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <p className="text-white/35">Rate</p>
                              <p className="mt-0.5 font-semibold text-white/75">
                                {formatRate(project.pricePerSqYd)}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/35">Plot range</p>
                              <p className="mt-0.5 font-semibold text-white/75">
                                {project.bedrooms}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/35">Project size</p>
                              <p className="mt-0.5 font-semibold text-white/75">
                                {project.acres} acres
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <p className="text-[10px] leading-relaxed text-white/40">
                              {project.totalPlots} plots · {project.type}
                            </p>
                            <button
                              type="button"
                              onClick={() => setSelectedMapProjectId(project.id)}
                              className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold text-white/75 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                            >
                              View on map
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {message.showLoanPlanner && (
                    <LoanPlanner
                      settings={loanSettings}
                      onChange={setLoanSettings}
                    />
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="text-xs text-white/40">Finding the best matches…</div>
              )}
            </div>
          )}
        </section>

        <footer className="shrink-0 border-t border-white/10 bg-[#0a0a0e] p-4 sm:p-5">
          <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto pb-1">
            {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleQuickAction(label, prompt)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#141419] transition-colors hover:border-white/80 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Icon className="h-3 w-3 text-[#7c2cff]" />
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
              placeholder="Ask about location, budget, plots or loans..."
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/50"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isThinking}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/90 bg-white text-[#7c2cff] shadow-[0_8px_22px_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_10px_26px_rgba(255,255,255,0.2)] active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/25 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Send question"
              title="Send question"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </div>

      {selectedMapProjectId && (
        <HyderabadPropertyMapOverlay
          initialProjectId={selectedMapProjectId}
          onClose={() => setSelectedMapProjectId(null)}
        />
      )}
    </main>
  );
}