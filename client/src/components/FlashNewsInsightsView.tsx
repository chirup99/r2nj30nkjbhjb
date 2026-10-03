import { ArrowUpRight, Clock3, Lightbulb, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  buildFlashNewsInsights,
  type InsightHeadline,
  type MarketSignalId,
} from "@/lib/flash-news-insights";

type FlashNewsInsightsViewProps = {
  items: InsightHeadline[];
  updatedAt: string;
};

const SIGNAL_LABELS: Record<MarketSignalId, string> = {
  demand: "Housing, demand & investment",
  policy: "Government & planning",
  zones: "SEZ & industrial zones",
  infrastructure: "Transport & major projects",
};

const AREA_CARD_PALETTES = [
  {
    card: "border-purple-300/25 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950",
    number: "text-purple-200",
    count: "text-purple-100/65",
    badge: "border-purple-300/20 bg-purple-400/10 text-purple-100",
  },
  {
    card: "border-emerald-300/25 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-950",
    number: "text-emerald-200",
    count: "text-emerald-100/65",
    badge: "border-teal-300/20 bg-teal-400/10 text-teal-100",
  },
  {
    card: "border-blue-300/25 bg-gradient-to-br from-blue-950 via-indigo-900 to-slate-950",
    number: "text-blue-200",
    count: "text-blue-100/65",
    badge: "border-indigo-300/20 bg-indigo-400/10 text-indigo-100",
  },
  {
    card: "border-amber-300/25 bg-gradient-to-br from-amber-950 via-orange-900 to-slate-950",
    number: "text-amber-200",
    count: "text-amber-100/65",
    badge: "border-orange-300/20 bg-orange-400/10 text-orange-100",
  },
  {
    card: "border-rose-300/25 bg-gradient-to-br from-rose-950 via-fuchsia-900 to-slate-950",
    number: "text-rose-200",
    count: "text-rose-100/65",
    badge: "border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-100",
  },
  {
    card: "border-cyan-300/25 bg-gradient-to-br from-cyan-950 via-sky-900 to-slate-950",
    number: "text-cyan-200",
    count: "text-cyan-100/65",
    badge: "border-sky-300/20 bg-sky-400/10 text-sky-100",
  },
  {
    card: "border-violet-300/25 bg-gradient-to-br from-violet-950 via-indigo-900 to-slate-950",
    number: "text-violet-200",
    count: "text-violet-100/65",
    badge: "border-indigo-300/20 bg-indigo-400/10 text-indigo-100",
  },
  {
    card: "border-lime-300/25 bg-gradient-to-br from-lime-950 via-green-900 to-slate-950",
    number: "text-lime-200",
    count: "text-lime-100/65",
    badge: "border-green-300/20 bg-green-400/10 text-green-100",
  },
] as const;

function formatPublishedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ArticleLink({ item }: { item: InsightHeadline }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group/link flex items-start justify-between gap-2 rounded-md py-1 text-[10px] leading-4 text-slate-300 transition-colors hover:text-white"
    >
      <span className="min-w-0">
        <span className="block">{item.title}</span>
        <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] text-slate-500">
          <span>{item.source}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-2.5 w-2.5" />
            {formatPublishedAt(item.publishedAt)}
          </span>
        </span>
      </span>
      <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-500 group-hover/link:text-violet-300" />
    </a>
  );
}

export function FlashNewsInsightsView({
  items,
  updatedAt,
}: FlashNewsInsightsViewProps) {
  const insights = buildFlashNewsInsights(items);

  return (
    <div className="space-y-4 py-1">
      <div className="sticky top-0 z-10 rounded-xl border border-violet-300/20 bg-slate-950 p-3 shadow-[0_8px_20px_rgba(2,6,23,0.65)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Lightbulb className="h-4 w-4 shrink-0 text-violet-300" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">
                Headline-based market signals
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                Feed updated {formatUpdatedAt(updatedAt)}
              </p>
            </div>
          </div>
          <span
            aria-label="Insights from current headlines"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-violet-200"
          >
            <Lightbulb className="h-2.5 w-2.5" />
            Insights
          </span>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-400">
          This scan groups current Hyderabad and HMDA headlines by named areas
          and topics. Mentions show news coverage, not verified buyer demand or
          an investment forecast.
        </p>
      </div>

      <section aria-labelledby="flash-insights-areas">
        <div className="mb-2 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-violet-300" />
          <h3
            id="flash-insights-areas"
            className="text-xs font-semibold text-white"
          >
            Areas mentioned in recent headlines
          </h3>
        </div>

        {insights.areas.length > 0 ? (
          <div className="space-y-2">
            {insights.areas.map((insight, index) => (
              <article
                key={insight.area}
                className={`rounded-lg border px-3 py-2.5 transition-colors ${AREA_CARD_PALETTES[index % AREA_CARD_PALETTES.length].card}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`text-[9px] font-semibold tabular-nums ${AREA_CARD_PALETTES[index % AREA_CARD_PALETTES.length].number}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h4 className="truncate text-xs font-semibold text-white">
                      {insight.area}
                    </h4>
                  </div>
                  <span
                    className={`text-[9px] ${AREA_CARD_PALETTES[index % AREA_CARD_PALETTES.length].count}`}
                  >
                    {insight.articles.length}{" "}
                    {insight.articles.length === 1 ? "headline" : "headlines"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {insight.signals.map((signal) => (
                    <span
                      key={signal}
                      className={`rounded-full border px-1.5 py-0.5 text-[8px] ${AREA_CARD_PALETTES[index % AREA_CARD_PALETTES.length].badge}`}
                    >
                      {SIGNAL_LABELS[signal]}
                    </span>
                  ))}
                </div>
                <div className="mt-1 divide-y divide-white/[0.05]">
                  {insight.articles.slice(0, 2).map((item) => (
                    <ArticleLink key={`${item.link}-${item.title}`} item={item} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-3 text-[10px] leading-4 text-slate-400">
            No headline matched both a named local area and a housing, policy,
            zone, or infrastructure signal in this scan.
          </p>
        )}
      </section>

      <section aria-labelledby="flash-insights-topics">
        <h3
          id="flash-insights-topics"
          className="mb-2 text-xs font-semibold text-white"
        >
          Policy and market coverage
        </h3>
        <div className="space-y-2">
          {insights.signals.map((signal, index) => {
            const palette =
              AREA_CARD_PALETTES[index % AREA_CARD_PALETTES.length];

            return (
              <article
                key={signal.id}
                className={`rounded-lg border px-3 py-2.5 ${palette.card}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-[11px] font-semibold ${palette.number}`}>
                    {signal.title}
                  </h4>
                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] ${palette.badge}`}
                  >
                    {signal.articles.length}{" "}
                    {signal.articles.length === 1 ? "story" : "stories"}
                  </span>
                </div>
                <p className="mt-1 text-[9px] leading-4 text-slate-300/75">
                  {signal.description}
                </p>
                {signal.articles.length > 0 ? (
                  <div className="mt-1 divide-y divide-white/[0.05]">
                    {signal.articles.slice(0, 2).map((item) => (
                      <ArticleLink
                        key={`${item.link}-${item.title}`}
                        item={item}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[9px] text-slate-300/55">
                    No matching local headlines in this scan.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <p className="pb-1 text-center text-[9px] text-slate-500">
        Scanned {insights.localHeadlineCount} local headlines. Open sources to
        verify details before making property decisions.
      </p>
    </div>
  );
}