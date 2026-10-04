export type DisplayCurrency = "INR" | "USD" | "AED";

export type DailyInrExchangeRates = {
  USD: number;
  AED: number;
  updatedAt: string;
  nextUpdateUnix: number;
  isStale?: boolean;
};

type DailyCurrencyResponse = {
  date?: unknown;
  inr?: Record<string, unknown>;
};

const CACHE_KEY = "rciq-inr-exchange-rates-v2";
const SECONDS_PER_DAY = 24 * 60 * 60;
const US_TIME_ZONES = new Set([
  "America/Adak",
  "America/Anchorage",
  "America/Boise",
  "America/Chicago",
  "America/Denver",
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Indiana/Knox",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Tell_City",
  "America/Indiana/Vevay",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Juneau",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Los_Angeles",
  "America/Menominee",
  "America/Metlakatla",
  "America/New_York",
  "America/Nome",
  "America/North_Dakota/Beulah",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/Phoenix",
  "America/Sitka",
  "America/Yakutat",
  "Pacific/Honolulu",
]);

function getDailyRateUrls() {
  const now = new Date();
  const dates = [
    now.toISOString().slice(0, 10),
    new Date(now.getTime() - SECONDS_PER_DAY * 1000)
      .toISOString()
      .slice(0, 10),
  ];
  const datedUrls = dates.flatMap((date) => [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/inr.json`,
    `https://${date}.currency-api.pages.dev/v1/currencies/inr.json`,
  ]);

  return [
    ...datedUrls,
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json",
    "https://latest.currency-api.pages.dev/v1/currencies/inr.json",
  ];
}

export function detectDefaultDisplayCurrency(): DisplayCurrency {
  let timeZone = "";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Use locale detection when the browser does not expose a time zone.
  }

  if (timeZone === "Asia/Dubai") return "AED";
  if (timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta") {
    return "INR";
  }
  if (US_TIME_ZONES.has(timeZone)) return "USD";

  const languages =
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  const country = languages
    .map((language) =>
      language
        .replace(/_/g, "-")
        .split("-")
        .slice(1)
        .find((part) => /^[a-z]{2}$/i.test(part))
        ?.toUpperCase(),
    )
    .find((code) => code === "US" || code === "AE" || code === "IN");

  if (country === "US") return "USD";
  if (country === "AE") return "AED";
  return "INR";
}

function isExchangeRateSnapshot(value: unknown): value is DailyInrExchangeRates {
  if (!value || typeof value !== "object") return false;
  const rates = value as Partial<DailyInrExchangeRates>;
  return (
    typeof rates.USD === "number" &&
    Number.isFinite(rates.USD) &&
    rates.USD > 0 &&
    typeof rates.AED === "number" &&
    Number.isFinite(rates.AED) &&
    rates.AED > 0 &&
    typeof rates.updatedAt === "string" &&
    Number.isFinite(Date.parse(rates.updatedAt)) &&
    typeof rates.nextUpdateUnix === "number" &&
    Number.isFinite(rates.nextUpdateUnix)
  );
}

function readCachedRates(): DailyInrExchangeRates | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isExchangeRateSnapshot(parsed)
      ? { ...parsed, isStale: false }
      : null;
  } catch {
    return null;
  }
}

export async function loadDailyInrExchangeRates(
  signal?: AbortSignal,
): Promise<DailyInrExchangeRates> {
  const cached = readCachedRates();
  const nowUnix = Math.floor(Date.now() / 1000);

  if (cached && cached.nextUpdateUnix > nowUnix) return cached;

  let lastError: unknown;
  for (const url of getDailyRateUrls()) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Exchange-rate service returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as DailyCurrencyResponse;
      const rateDate = payload.date;
      const usd = payload.inr?.usd;
      const aed = payload.inr?.aed;
      if (
        typeof rateDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(rateDate) ||
        !Number.isFinite(Date.parse(rateDate)) ||
        typeof usd !== "number" ||
        typeof aed !== "number" ||
        !Number.isFinite(usd) ||
        !Number.isFinite(aed) ||
        usd <= 0 ||
        aed <= 0
      ) {
        throw new Error("Exchange-rate service returned invalid INR, USD, or AED data");
      }

      const latest: DailyInrExchangeRates = {
        USD: usd,
        AED: aed,
        updatedAt: rateDate,
        nextUpdateUnix: Math.floor(Date.now() / 1000) + SECONDS_PER_DAY,
        isStale: false,
      };

      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            USD: latest.USD,
            AED: latest.AED,
            updatedAt: latest.updatedAt,
            nextUpdateUnix: latest.nextUpdateUnix,
          }),
        );
      } catch {
        // The rate data remains usable even when browser storage is unavailable.
      }

      return latest;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }

  if (cached) return { ...cached, isStale: true };
  if (lastError instanceof Error) throw lastError;
  throw new Error("No daily exchange rates are available.");
}

export function formatAmountFromInr(
  amountInr: number,
  currency: DisplayCurrency,
  rates: DailyInrExchangeRates | null,
): string {
  const rate = currency === "INR" ? 1 : rates?.[currency];
  if (
    !Number.isFinite(amountInr) ||
    amountInr < 0 ||
    typeof rate !== "number" ||
    !Number.isFinite(rate)
  ) {
    return "Rate unavailable";
  }

  const amount = amountInr * rate;
  const formatted = new Intl.NumberFormat(
    currency === "INR" ? "en-IN" : "en-US",
    { maximumFractionDigits: 0 },
  ).format(amount);

  if (currency === "INR") return `₹${formatted}`;
  if (currency === "USD") return `$${formatted}`;
  return `د.إ ${formatted}`;
}

export function formatProjectPrice(
  price: string,
  currency: DisplayCurrency,
  rates: DailyInrExchangeRates | null,
): string {
  if (currency === "INR") return price;

  const match = price.match(/^\s*₹\s*([\d,]+(?:\.\d+)?)\s*(.*?)\s*$/);
  if (!match) return "Price unavailable";

  const amountInr = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amountInr)) return "Price unavailable";

  const unit = match[2].trim();
  const converted = formatAmountFromInr(amountInr, currency, rates);
  return unit ? `${converted} ${unit}` : converted;
}

export function formatStartingPrice(
  price: string,
  currency: DisplayCurrency,
  rates: DailyInrExchangeRates | null,
): string {
  if (currency === "INR") return price;

  const match = price.match(
    /^\s*₹\s*([\d,.]+)\s*(Crores?|Cr|Lakhs?|Lacs?|Lakh|Lac|L)\b\s*(.*)$/i,
  );
  if (!match) return "Price unavailable";

  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return "Price unavailable";

  const multiplier = /^(?:cr|crore)/i.test(match[2]) ? 10_000_000 : 100_000;
  const converted = formatAmountFromInr(amount * multiplier, currency, rates);
  const suffix = match[3].trim();
  return suffix ? `${converted} ${suffix}` : converted;
}