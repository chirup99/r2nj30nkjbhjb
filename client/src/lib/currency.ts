export type DisplayCurrency = "INR" | "USD" | "AED";

export type DailyInrExchangeRates = {
  USD: number;
  AED: number;
  updatedAt: string;
  nextUpdateUnix: number;
  isStale?: boolean;
};

type OpenExchangeRateResponse = {
  result?: unknown;
  base_code?: unknown;
  time_last_update_utc?: unknown;
  time_next_update_unix?: unknown;
  rates?: Record<string, unknown>;
};

const RATES_URL = "https://open.er-api.com/v6/latest/INR";
const CACHE_KEY = "rciq-inr-exchange-rates-v1";

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

  try {
    const response = await fetch(RATES_URL, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) {
      throw new Error(`Exchange-rate service returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OpenExchangeRateResponse;
    const usd = payload.rates?.USD;
    const aed = payload.rates?.AED;
    if (
      payload.result !== "success" ||
      payload.base_code !== "INR" ||
      typeof payload.time_last_update_utc !== "string" ||
      typeof payload.time_next_update_unix !== "number" ||
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
      updatedAt: payload.time_last_update_utc,
      nextUpdateUnix: payload.time_next_update_unix,
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
    if (cached) return { ...cached, isStale: true };
    throw error;
  }
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