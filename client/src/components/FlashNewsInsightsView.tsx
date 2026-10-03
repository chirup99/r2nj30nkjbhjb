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
      <div className="rounded-xl border border-violet-300/15 bg-violet-400/[0.05] p-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-violet-300" />
          <div>
            <p className="text-xs font-semibold text-white">
              Headline-based market signals
            </p>
            <p className="mt-0.5 text-[9px] text-slate-400">
              Feed updated {formatUpdatedAt(updatedAt)}
            </p>
          </div>
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
                className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-[9px] font-semibold tabular-nums text-violet-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h4 className="truncate text-xs font-semibold text-white">
                      {insight.area}
                    </h4>
                  </div>
                  <span className="text-[9px] text-slate-500">
                    {insight.articles.length}{" "}
                    {insight.articles.length === 1 ? "headline" : "headlines"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {insight.signals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-violet-300/15 bg-violet-400/[0.06] px-1.5 py-0.5 text-[8px] text-violet-200"
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
          {insights.signals.map((signal) => (
            <article
              key={signal.id}
              className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-semibold text-slate-200">
                  {signal.title}
                </h4>
                <span className="shrink-0 text-[9px] text-slate-500">
                  {signal.articles.length}{" "}
                  {signal.articles.length === 1 ? "story" : "stories"}
                </span>
              </div>
              <p className="mt-1 text-[9px] leading-4 text-slate-500">
                {signal.description}
              </p>
              {signal.articles.length > 0 ? (
                <div className="mt-1 divide-y divide-white/[0.05]">
                  {signal.articles.slice(0, 2).map((item) => (
                    <ArticleLink key={`${item.link}-${item.title}`} item={item} />
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[9px] text-slate-500">
                  No matching local headlines in this scan.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <p className="pb-1 text-center text-[9px] text-slate-500">
        Scanned {insights.localHeadlineCount} local headlines. Open sources to
        verify details before making property decisions.
      </p>
    </div>
  );
}