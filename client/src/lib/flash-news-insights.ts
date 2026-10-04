import { HMDA_MASTER_PLAN_MAPS } from "@/data/hmdaMasterPlanMaps";
import { PLOTSVIEW_PROJECTS } from "@/data/plotsviewProjects";
import { DUBAI_PROPERTY_PROJECTS } from "@/data/dubaiProjects";

export type FlashNewsRegion = "india" | "dubai";

export type InsightHeadline = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  categories: string[];
};

export type MarketSignalId = "demand" | "policy" | "zones" | "infrastructure";

export type AreaNewsInsight = {
  area: string;
  articles: InsightHeadline[];
  signals: MarketSignalId[];
};

export type MarketNewsSignal = {
  id: MarketSignalId;
  title: string;
  description: string;
  articles: InsightHeadline[];
};

export type FlashNewsInsights = {
  areas: AreaNewsInsight[];
  signals: MarketNewsSignal[];
  localHeadlineCount: number;
};

const SIGNAL_RULES: {
  id: MarketSignalId;
  title: string;
  description: string;
  pattern: RegExp;
}[] = [
  {
    id: "demand",
    title: "Housing, demand & investment",
    description: "Housing, prices, sales, registrations, rentals, and investment.",
    pattern:
      /\b(demand|homebuyers?|housing|residential|commercial|developer|senior living|property prices?|home prices?|sales|registrations?|rentals?|real estate|realty|new launches?|new projects?|invest(?:s|ed|ment|ments|ing)?)\b/i,
  },
  {
    id: "policy",
    title: "Government & planning",
    description: "Government decisions, authority actions, urban plans, approvals, and zoning.",
    pattern:
      /\b(govt|government|minister|cabinet|policy|hmda|rera|dld|approval|approved|registration|order|act|section 22[- ]?a|master plan|urban plan|zoning|zone|land use|notification|clears?|committee|municipal|dubai municipality|executive council|regulation|dubai 2040)\b/i,
  },
  {
    id: "zones",
    title: "Free zones, SEZ & industrial zones",
    description: "Free and special economic zones, industrial parks, logistics, and employment hubs.",
    pattern:
      /\b(sez|special economic zone|free zones?|economic zones?|jafza|dmcc|difc|industrial (?:park|zone|corridor|area)|nimz|pharma city|data cent(?:er|re)|logistics park|it park|employment hub)\b/i,
  },
  {
    id: "infrastructure",
    title: "Transport & major projects",
    description: "Metro, roads, rail, airports, corridors, and riverfront projects.",
    pattern:
      /\b(metro|airport|ring road|orr|rrr|road widening|highway|expressway|rail|etihad rail|rta|port|bullet train|corridor|flyover|riverfront|infrastructure|connectivity)\b/i,
  },
];

const GENERIC_AREA_WORDS = new Set([
  "area",
  "city",
  "district",
  "dubai",
  "emirates",
  "east",
  "estate",
  "farmland",
  "farms",
  "green",
  "greens",
  "highway",
  "india",
  "land",
  "north",
  "park",
  "phase",
  "plots",
  "project",
  "real",
  "road",
  "sheet",
  "south",
  "telangana",
  "temple",
  "township",
  "uae",
  "united",
  "arab",
  "villas",
  "west",
  "zone",
  "zones",
]);

const EXTRA_AREAS: { name: string; aliases?: string[] }[] = [
  { name: "Adibatla" },
  { name: "Bachupally" },
  { name: "Bhongir", aliases: ["Bhuvanagiri"] },
  { name: "CURE" },
  { name: "Financial District" },
  { name: "Gachibowli" },
  { name: "HITEC City", aliases: ["Hi-Tech City", "Hitech City"] },
  { name: "Kokapet" },
  { name: "Kollur" },
  { name: "Kompally" },
  { name: "Manikonda" },
  { name: "Miyapur" },
  { name: "Mokila" },
  { name: "Musi Riverfront", aliases: ["Musi"] },
  { name: "Nanakramguda" },
  { name: "Narsingi" },
  { name: "Neopolis" },
  { name: "Old City" },
  { name: "Patancheru", aliases: ["Patancheruvu"] },
  { name: "Raidurg" },
  { name: "Shamshabad" },
  { name: "Tellapur" },
  { name: "Tukkuguda" },
];

const DUBAI_EXTRA_AREAS: { name: string; aliases?: string[] }[] = [
  { name: "Academic City", aliases: ["Dubai Academic City"] },
  { name: "Al Jaddaf" },
  { name: "Business Bay" },
  { name: "Dubai 2040 Urban Master Plan", aliases: ["Dubai 2040"] },
  { name: "Dubai Creek Harbour", aliases: ["Creek Harbour"] },
  { name: "Dubai Healthcare City" },
  { name: "Dubai Industrial City" },
  { name: "Dubai International Financial Centre", aliases: ["DIFC"] },
  { name: "Dubai Internet City" },
  { name: "Dubai Islands" },
  { name: "Dubai Maritime City" },
  { name: "Dubai Media City" },
  { name: "Dubai Multi Commodities Centre", aliases: ["DMCC"] },
  { name: "Dubai Production City" },
  { name: "Dubai Silicon Oasis", aliases: ["DSO"] },
  { name: "Dubai South" },
  { name: "Dubailand" },
  { name: "Jebel Ali Free Zone", aliases: ["JAFZA"] },
  { name: "Jumeirah Village Circle", aliases: ["JVC"] },
  { name: "Jumeirah Village Triangle", aliases: ["JVT"] },
  { name: "Meydan" },
  { name: "Palm Jumeirah" },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase()}`,
    );
}

function cleanAreaName(value: string) {
  return value
    .replace(/\s+(?:zone|district)\b.*$/i, "")
    .replace(/\s*[—–-]\s*sheet.*$/i, "")
    .trim();
}

function isUsableAreaName(value: string) {
  const normalized = normalize(value);
  if (normalized.length < 4) return false;
  const words = normalized.split(" ");
  return !words.every((word) => GENERIC_AREA_WORDS.has(word));
}

function buildAreaAliases(region: FlashNewsRegion) {
  const aliases = new Map<string, string>();
  const add = (name: string, displayName = name, isExplicitArea = false) => {
    const normalized = normalize(name);
    if (
      normalized &&
      normalized !== "dubai" &&
      normalized !== "uae" &&
      (isExplicitArea || isUsableAreaName(name))
    ) {
      aliases.set(normalized, displayName);
    }
  };

  if (region === "dubai") {
    for (const project of DUBAI_PROPERTY_PROJECTS) {
      for (const localityPart of project.locality.split(/[·,]/)) {
        const locality = cleanAreaName(localityPart);
        if (locality) add(locality, locality, true);
      }
    }

    for (const area of DUBAI_EXTRA_AREAS) {
      add(area.name, area.name, true);
      for (const alias of area.aliases ?? []) add(alias, area.name, true);
    }
  } else {
    for (const project of PLOTSVIEW_PROJECTS) {
      const locality = cleanAreaName(project.locality);
      if (!locality) continue;
      add(locality, titleCase(locality));
      for (const word of locality.split(/\s+/)) {
        if (isUsableAreaName(word)) add(word, titleCase(word));
      }
    }

    for (const map of HMDA_MASTER_PLAN_MAPS) {
      const area = cleanAreaName(map.area);
      if (!area) continue;
      add(area, titleCase(area));
      for (const word of area.split(/\s+/)) {
        if (isUsableAreaName(word)) add(word, titleCase(word));
      }
    }

    for (const area of EXTRA_AREAS) {
      add(area.name, area.name);
      for (const alias of area.aliases ?? []) add(alias, area.name);
    }
  }

  return Array.from(aliases.entries())
    .map(([alias, displayName]) => ({ alias, displayName }))
    .sort((left, right) => right.alias.length - left.alias.length);
}

const AREA_ALIASES: Record<FlashNewsRegion, ReturnType<typeof buildAreaAliases>> = {
  india: buildAreaAliases("india"),
  dubai: buildAreaAliases("dubai"),
};

function findAreaMentions(
  title: string,
  aliases: ReturnType<typeof buildAreaAliases>,
) {
  const normalizedTitle = ` ${normalize(title)} `;
  const mentions: { start: number; end: number; area: string }[] = [];

  for (const { alias, displayName } of aliases) {
    const start = normalizedTitle.indexOf(` ${alias} `);
    if (start < 0) continue;

    const phraseStart = start + 1;
    const end = phraseStart + alias.length;
    if (mentions.some((mention) => phraseStart < mention.end && end > mention.start)) {
      continue;
    }
    mentions.push({ start: phraseStart, end, area: displayName });
  }

  return Array.from(new Set(mentions.map((mention) => mention.area)));
}

function isHyderabadHeadline(item: InsightHeadline) {
  if (/\b(hyderabad|telangana|hmda)\b/i.test(item.title)) return true;
  const cameFromLocalFeed =
    item.categories.includes("hyderabad") || item.categories.includes("hmda");
  return cameFromLocalFeed && findAreaMentions(item.title, AREA_ALIASES.india).length > 0;
}

function isDubaiHeadline(item: InsightHeadline) {
  return (
    /\b(dubai|united arab emirates|uae)\b/i.test(item.title) ||
    item.categories.some((category) =>
      ["dubai", "uae-government", "uae-zones"].includes(category),
    )
  );
}

function uniqueArticles(items: InsightHeadline[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.link || `${item.title}-${item.publishedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function newestFirst(items: InsightHeadline[]) {
  return uniqueArticles(items).sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime(),
  );
}

export function buildFlashNewsInsights(
  items: InsightHeadline[],
  region: FlashNewsRegion = "india",
): FlashNewsInsights {
  const isRegionalHeadline =
    region === "dubai" ? isDubaiHeadline : isHyderabadHeadline;
  const areaAliases = AREA_ALIASES[region];
  const localItems = items.filter(isRegionalHeadline);
  const areas = new Map<string, { area: string; articles: InsightHeadline[] }>();

  for (const item of localItems) {
    const matchedSignals = SIGNAL_RULES.filter((signal) =>
      signal.pattern.test(item.title),
    ).map((signal) => signal.id);
    if (matchedSignals.length === 0) continue;

    for (const area of findAreaMentions(item.title, areaAliases)) {
      const key = normalize(area);
      const insight = areas.get(key) ?? { area, articles: [] };
      insight.articles.push(item);
      areas.set(key, insight);
    }
  }

  const areaInsights = Array.from(areas.values())
    .map(({ area, articles }) => {
      const latestArticles = newestFirst(articles);
      return {
        area,
        articles: latestArticles,
        signals: SIGNAL_RULES.filter((signal) =>
          latestArticles.some((item) => signal.pattern.test(item.title)),
        ).map((signal) => signal.id),
      };
    })
    .sort((left, right) => {
      if (right.articles.length !== left.articles.length) {
        return right.articles.length - left.articles.length;
      }
      return (
        new Date(right.articles[0].publishedAt).getTime() -
        new Date(left.articles[0].publishedAt).getTime()
      );
    })
    .slice(0, 8);

  return {
    areas: areaInsights,
    signals: SIGNAL_RULES.map((signal) => ({
      id: signal.id,
      title: signal.title,
      description: signal.description,
      articles: newestFirst(
        localItems.filter((item) => signal.pattern.test(item.title)),
      ).slice(0, 3),
    })),
    localHeadlineCount: localItems.length,
  };
}