import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  Newspaper,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FlashNewsCategory = "hyderabad" | "hmda" | "india";
type NewsFilter = "all" | FlashNewsCategory;

type FlashNewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  categories: FlashNewsCategory[];
};

type FlashNewsResponse = {
  items: FlashNewsItem[];
  updatedAt: string;
  isStale: boolean;
  warning?: string;
};

const FILTERS: { id: NewsFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hyderabad", label: "Hyderabad" },
  { id: "hmda", label: "HMDA" },
  { id: "india", label: "India RE" },
];

const CATEGORY_LABELS: Record<FlashNewsCategory, string> = {
  hyderabad: "Hyderabad",
  hmda: "HMDA",
  india: "India RE",
};

function formatPublishedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Update time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function FlashNewsDialog() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [news, setNews] = useState<FlashNewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestController = useRef<AbortController | null>(null);

  useEffect(
    () => () => requestController.current?.abort(),
    [],
  );

  async function loadNews(forceRefresh = false) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/news/flash${forceRefresh ? "?refresh=true" : ""}`,
        { signal: controller.signal, cache: "no-store" },
      );
      const payload = (await response.json()) as
        | FlashNewsResponse
        | { message?: string };

      if (!response.ok || !("items" in payload)) {
        throw new Error(
          "message" in payload && payload.message
            ? payload.message
            : "Could not load the latest headlines.",
        );
      }

      setNews(payload);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the latest headlines.",
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const visibleItems = useMemo(
    () =>
      news?.items.filter(
        (item) => filter === "all" || item.categories.includes(filter),
      ) ?? [],
    [filter, news],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void loadNews();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-[10px] font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          aria-label="Open latest real estate news"
          title="Latest real estate, HMDA, and Hyderabad development news"
        >
          <Newspaper className="h-3 w-3 shrink-0 text-violet-300" />
          <span>Flash News</span>
          <span className="relative ml-0.5 flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        overlayClassName="z-[150] bg-slate-950/45 backdrop-blur-[1px]"
        className="z-[151] bottom-0 left-1/2 top-auto flex h-[min(68dvh,560px)] max-h-[min(68dvh,560px)] w-[calc(100%_-_0.75rem)] max-w-3xl translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl border border-white/15 bg-slate-950/95 p-0 text-white shadow-[0_-12px_36px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:bottom-4 sm:w-[calc(100%_-_2rem)] sm:rounded-2xl"
      >
        <header className="shrink-0 border-b border-white/10 px-3.5 pb-3 pt-3 pr-12 sm:px-5 sm:pb-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Newspaper className="h-4 w-4 shrink-0 text-violet-300" />
              <DialogTitle className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                Flash News
              </DialogTitle>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                <span className="h-1 w-1 rounded-full bg-emerald-300" />
                Live
              </span>
            </div>
            <button
              type="button"
              onClick={() => void loadNews(true)}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh news"
              title="Fetch the latest headlines now"
            >
              <RefreshCw
                className={`h-3 w-3 text-violet-300 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>

          <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Filter news topics"
              className="flex min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-lg border border-white/10 bg-slate-950/80 p-0.5"
            >
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors sm:px-2.5 ${
                    filter === item.id
                      ? "border border-violet-300/20 bg-violet-500/15 text-violet-100"
                      : "border border-transparent text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {news && (
              <p
                className="hidden shrink-0 text-[9px] text-slate-500 sm:block"
                title={news.updatedAt}
              >
                {news.isStale ? "Last update" : "Updated"}{" "}
                {formatUpdatedAt(news.updatedAt)}
              </p>
            )}
          </div>
        </header>

        {news?.warning && (
          <div
            role="status"
            className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] px-2.5 py-1.5 text-[10px] text-amber-100 sm:mx-5"
          >
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
            <span>{news.warning}</span>
          </div>
        )}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-1.5 sm:px-5 sm:py-2"
          aria-busy={loading}
        >
          {loading && !news ? (
            <div className="space-y-2 py-1" aria-label="Loading news">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"
                >
                  <div className="h-3 w-28 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-full rounded bg-white/10" />
                  <div className="mt-1.5 h-3 w-2/3 rounded bg-white/10" />
                </div>
              ))}
            </div>
          ) : error && !news ? (
            <div
              role="alert"
              className="flex min-h-40 flex-col items-center justify-center px-5 text-center"
            >
              <AlertCircle className="h-6 w-6 text-amber-300" />
              <p className="mt-2 text-sm font-semibold text-white">
                News could not be loaded
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void loadNews(true)}
                className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
              >
                Try again
              </button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <Newspaper className="h-6 w-6 text-slate-600" />
              <p className="mt-2 text-sm font-medium text-slate-300">
                No recent headlines in this topic
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try another topic or refresh the feed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {visibleItems.map((item) => (
                <article
                  key={`${item.title}-${item.publishedAt}`}
                  className="group py-2.5 first:pt-1 last:pb-1"
                >
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[9px] text-slate-500">
                    <span className="font-semibold text-slate-300">
                      {item.source}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={new Intl.DateTimeFormat(undefined, {
                        dateStyle: "full",
                        timeStyle: "short",
                      }).format(new Date(item.publishedAt))}
                    >
                      <Clock3 className="h-3 w-3" />
                      {formatPublishedAt(item.publishedAt)}
                    </span>
                    {item.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-slate-400"
                      >
                        {CATEGORY_LABELS[category]}
                      </span>
                    ))}
                  </div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-start justify-between gap-2 text-[13px] font-semibold leading-[1.2rem] text-white transition-colors group-hover:text-violet-100"
                  >
                    <span>{item.title}</span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-violet-300" />
                  </a>
                </article>
              ))}
            </div>
          )}

          {error && news && (
            <p role="status" className="mt-2 text-center text-[10px] text-amber-200">
              {error}
            </p>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}