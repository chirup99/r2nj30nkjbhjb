import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  LoaderCircle,
  Newspaper,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  { id: "all", label: "All news" },
  { id: "hyderabad", label: "Hyderabad" },
  { id: "hmda", label: "HMDA & planning" },
  { id: "india", label: "India real estate" },
];

const CATEGORY_LABELS: Record<FlashNewsCategory, string> = {
  hyderabad: "Hyderabad",
  hmda: "HMDA & planning",
  india: "India real estate",
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
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-[10px] font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          aria-label="Open latest real estate news"
          title="Latest real estate, HMDA, and Hyderabad development news"
        >
          <Newspaper className="h-3 w-3 shrink-0 text-amber-300" />
          <span>Flash News</span>
          <span className="relative ml-0.5 flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        overlayClassName="z-[150] bg-slate-950/75 backdrop-blur-sm"
        className="z-[151] top-[calc(50%_+_1.75rem)] flex max-h-[calc(100dvh_-_5.5rem)] w-[calc(100%_-_1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-white/10 bg-slate-950 p-0 text-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-white/10 px-5 py-5 pr-14 sm:px-7 sm:py-6 sm:pr-16">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live from Google News
              </p>
              <DialogTitle className="mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Flash News
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-xl text-xs leading-5 text-slate-400 sm:text-sm">
                The latest property, HMDA master plan, and Hyderabad
                development headlines with publisher timestamps.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => void loadNews(true)}
              disabled={loading}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh news"
              title="Fetch the latest headlines now"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Filter news topics"
              className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-1"
            >
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 ${
                    filter === item.id
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {news && (
              <p className="text-[10px] text-slate-500" title={news.updatedAt}>
                {news.isStale ? "Last successful update" : "Updated"}{" "}
                {formatUpdatedAt(news.updatedAt)}
              </p>
            )}
          </div>
        </header>

        {news?.warning && (
          <div
            role="status"
            className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-100 sm:mx-7"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span>{news.warning}</span>
          </div>
        )}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-7 sm:py-4"
          aria-busy={loading}
        >
          {loading && !news ? (
            <div className="space-y-3 py-1" aria-label="Loading news">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"
                >
                  <div className="h-3 w-28 rounded bg-white/10" />
                  <div className="mt-3 h-4 w-full rounded bg-white/10" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-white/10" />
                </div>
              ))}
            </div>
          ) : error && !news ? (
            <div
              role="alert"
              className="flex min-h-56 flex-col items-center justify-center px-5 text-center"
            >
              <AlertCircle className="h-8 w-8 text-amber-300" />
              <p className="mt-3 text-sm font-semibold text-white">
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
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <Newspaper className="h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">
                No recent headlines in this topic
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try another topic or refresh the Google News feed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {visibleItems.map((item) => (
                <article
                  key={`${item.title}-${item.publishedAt}`}
                  className="group py-4 first:pt-2 last:pb-2"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px] text-slate-500">
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
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-slate-400"
                      >
                        {CATEGORY_LABELS[category]}
                      </span>
                    ))}
                  </div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 flex items-start justify-between gap-3 text-sm font-semibold leading-5 text-white transition-colors group-hover:text-amber-100 sm:text-[15px]"
                  >
                    <span>{item.title}</span>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-amber-300" />
                  </a>
                </article>
              ))}
            </div>
          )}

          {error && news && (
            <p role="status" className="mt-3 text-center text-[11px] text-amber-200">
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 px-5 py-3 text-[10px] text-slate-500 sm:px-7">
          <span>
            Headlines and publish times are supplied by Google News and the
            original publishers.
          </span>
          <a
            href="https://news.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-white"
          >
            Google News
          </a>
        </footer>
      </DialogContent>
    </Dialog>
  );
}