export type FlashNewsRegion = "india" | "dubai";
export type FlashNewsCategory =
  | "hyderabad"
  | "hmda"
  | "india"
  | "dubai"
  | "uae-government"
  | "uae-zones";

export type FlashNewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  categories: FlashNewsCategory[];
};

export type FlashNewsResponse = {
  items: FlashNewsItem[];
  updatedAt: string;
  isStale: boolean;
  warning?: string;
};

const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ITEMS_PER_FEED = 40;
const MAX_TOTAL_ITEMS = 100;
const DUBAI_NEWS_RELEVANCE =
  /\b(dubai|uae|united arab emirates|jafza|difc|dmcc|emaar|damac|binghatti|imtiaz|ellington|omniyat|sobha|nakheel|meraas|wasl|azizi|deyaar|aldar|dubai land department|government of dubai|dubai municipality|dubai media office)\b/i;
const DUBAI_NEWS_TOPICS =
  /\b(real estate|properties|property|housing|residential|commercial|development|developers?|projects?|launch(?:es)?|off-plan|master plan|urban|planning|zoning|polic(?:y|ies)|regulations?|laws?|rules?|approvals?|government|cabinet|free zones?|special economic|sez|industrial|logistics|investment|market|infrastructure|construction|buildings?|offices?|transport|rail|metro|airport|roads?|ports?)\b/i;

const NEWS_FEEDS: {
  region: FlashNewsRegion;
  category: FlashNewsCategory;
  query: string;
}[] = [
  {
    region: "india",
    category: "hyderabad",
    query: "Hyderabad real estate property housing Telangana when:30d",
  },
  {
    region: "india",
    category: "hyderabad",
    query:
      "Hyderabad real estate demand emerging localities housing registrations prices when:30d",
  },
  {
    region: "india",
    category: "hmda",
    query:
      "HMDA Hyderabad Metropolitan Development Authority master plan development when:90d",
  },
  {
    region: "india",
    category: "hmda",
    query:
      "Hyderabad Telangana SEZ special economic zone industrial zone announcement new zones real estate when:90d",
  },
  {
    region: "india",
    category: "india",
    query: "India real estate property market news when:30d",
  },
  {
    region: "dubai",
    category: "dubai",
    query:
      "Dubai real estate property project launches new development residential commercial when:30d",
  },
  {
    region: "dubai",
    category: "uae-government",
    query:
      "Dubai 2040 urban master plan government planning property regulation development when:90d",
  },
  {
    region: "dubai",
    category: "uae-government",
    query:
      "site:mediaoffice.ae Dubai government urban planning real estate development policy when:90d",
  },
  {
    region: "dubai",
    category: "uae-government",
    query:
      "site:wam.ae UAE Dubai government housing planning property master plan when:90d",
  },
  {
    region: "dubai",
    category: "uae-zones",
    query:
      "Dubai UAE free zones special economic zones SEZ industrial logistics development when:90d",
  },
  {
    region: "dubai",
    category: "uae-zones",
    query:
      "Dubai free zone investment industrial area policy JAFZA DMCC DIFC when:90d",
  },
];

const cachedNews = new Map<
  FlashNewsRegion,
  { response: FlashNewsResponse; expiresAt: number }
>();
const pendingRefresh = new Map<FlashNewsRegion, Promise<FlashNewsResponse>>();

function decodeXmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'");
}

function readRssTag(itemXml: string, tagName: string) {
  const match = itemXml.match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "i"),
  );
  if (!match) return "";
  return decodeXmlText(match[1])
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml: string, category: FlashNewsCategory) {
  const items: FlashNewsItem[] = [];
  const rssItems = xml.match(/<item\b[^>]*>[\s\S]*?<\/item\s*>/gi) ?? [];

  for (const rssItem of rssItems.slice(0, MAX_ITEMS_PER_FEED)) {
    const title = readRssTag(rssItem, "title");
    const rawLink = readRssTag(rssItem, "link");
    const rawPublishedAt = readRssTag(rssItem, "pubDate");
    const source = readRssTag(rssItem, "source") || "Google News";
    const publishedAtDate = new Date(rawPublishedAt);

    if (!title || !rawLink || !Number.isFinite(publishedAtDate.getTime())) {
      continue;
    }
    if (
      category !== "hyderabad" &&
      category !== "hmda" &&
      category !== "india" &&
      (!DUBAI_NEWS_RELEVANCE.test(`${title} ${source}`) ||
        !DUBAI_NEWS_TOPICS.test(title))
    ) {
      continue;
    }

    const now = Date.now();
    if (publishedAtDate.getTime() > now + 6 * 60 * 60 * 1000) continue;

    let link: URL;
    try {
      link = new URL(rawLink);
    } catch {
      continue;
    }
    if (link.protocol !== "https:") continue;

    items.push({
      title,
      link: link.toString(),
      source,
      publishedAt: publishedAtDate.toISOString(),
      categories: [category],
    });
  }

  return items;
}

async function fetchFeed(feed: (typeof NEWS_FEEDS)[number]) {
  const url = new URL(GOOGLE_NEWS_RSS_URL);
  url.searchParams.set("q", feed.query);
  const isDubaiFeed = feed.region === "dubai";
  url.searchParams.set("hl", isDubaiFeed ? "en-AE" : "en-IN");
  url.searchParams.set("gl", isDubaiFeed ? "AE" : "IN");
  url.searchParams.set("ceid", isDubaiFeed ? "AE:en" : "IN:IN");

  const response = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "RCiQ-AI-Flash-News/1.0",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Google News returned HTTP ${response.status}`);
  }

  return parseRssItems(await response.text(), feed.category);
}

function mergeAndSortNews(items: FlashNewsItem[]) {
  const byTitle = new Map<string, FlashNewsItem>();

  for (const item of items) {
    const key = item.title.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    const existing = byTitle.get(key);
    if (existing) {
      existing.categories = Array.from(
        new Set([...existing.categories, ...item.categories]),
      );
      if (existing.source === "Google News" && item.source !== "Google News") {
        existing.source = item.source;
      }
      continue;
    }
    byTitle.set(key, item);
  }

  return Array.from(byTitle.values())
    .sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() -
        new Date(left.publishedAt).getTime(),
    )
    .slice(0, MAX_TOTAL_ITEMS);
}

async function refreshNews(region: FlashNewsRegion): Promise<FlashNewsResponse> {
  const feeds = NEWS_FEEDS.filter((feed) => feed.region === region);
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const successfulFeeds = results.filter(
    (result): result is PromiseFulfilledResult<FlashNewsItem[]> =>
      result.status === "fulfilled",
  );
  const failedFeeds = results.length - successfulFeeds.length;

  if (successfulFeeds.length === 0) {
    throw new Error("Google News could not be reached. Please try again shortly.");
  }

  const response: FlashNewsResponse = {
    items: mergeAndSortNews(successfulFeeds.flatMap((result) => result.value)),
    updatedAt: new Date().toISOString(),
    isStale: false,
    ...(failedFeeds > 0
      ? {
          warning: `Some Google News topics could not be refreshed (${failedFeeds} of ${feeds.length}).`,
        }
      : {}),
  };

  cachedNews.set(region, {
    response,
    expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
  });
  return response;
}

export async function getFlashNews(
  forceRefresh = false,
  region: FlashNewsRegion = "india",
): Promise<FlashNewsResponse> {
  const cached = cachedNews.get(region);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }
  const pending = pendingRefresh.get(region);
  if (pending) return pending;

  const refresh = refreshNews(region)
    .catch((error: unknown) => {
      const staleCache = cachedNews.get(region);
      if (staleCache) {
        return {
          ...staleCache.response,
          isStale: true,
          warning:
            "Google News could not be refreshed. Showing the last successful update.",
        };
      }
      throw error;
    })
    .finally(() => {
      pendingRefresh.delete(region);
    });
  pendingRefresh.set(region, refresh);

  return refresh;
}