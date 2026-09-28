import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronDown,
  House,
  Info,
  Landmark,
  ListFilter,
  MapPin,
  Navigation,
  Send,
  Trees,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PropertyMeetupMark } from "@/components/PropertyMeetupMark";
import {
  getProjectListingDetails,
  HyderabadPropertyMapOverlay,
} from "@/components/HyderabadPropertyMap";
import {
  PLOTSVIEW_PROJECTS,
  type PlotsViewProject,
} from "@/data/plotsviewProjects";
import { CURATED_RESIDENTIAL_PROPERTIES } from "@/data/curatedProperties";

type AssistantQuery = {
  intent: "property" | "loan";
  location?: string;
  maxBudget?: number;
  propertyType?: "plot" | "farm" | "villa" | "flat" | "commercial";
  compare?: boolean;
};

type AssistantProject = PlotsViewProject & {
  estimatedEntryPriceOverride?: number;
  pricePerSqYdOverride?: number;
  mapAvailable?: boolean;
};

type PropertyMatch = AssistantProject & {
  estimatedEntryPrice: number;
  pricePerSqYd: number;
};

const PROPERTY_CATALOG: AssistantProject[] = [
  ...PLOTSVIEW_PROJECTS,
  ...CURATED_RESIDENTIAL_PROPERTIES,
];

type PropertySearchSettings = {
  maxBudget: number;
  location: string;
  propertyType: "" | "flat" | "plot" | "villa" | "commercial";
};

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  matches?: PropertyMatch[];
  showLoanPlanner?: boolean;
  showPropertyPlanner?: boolean;
  showComparison?: boolean;
};

type LoanSettings = {
  propertyValue: number;
  downPayment: number;
  interestRate: number;
  tenure: number;
  monthlyIncome: number;
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
    label: "Compare",
    prompt: "Compare property prices by location, budget, and type",
    icon: ArrowRightLeft,
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

function normalizeLocationText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findLocationInText(text: string) {
  const normalized = normalizeLocationText(text);
  const group = Object.keys(LOCATION_GROUPS).find((candidate) =>
    normalized.includes(candidate),
  );
  if (group) return group;

  const localities = PROPERTY_CATALOG.map((project) => project.locality)
    .filter((locality, index, all) => all.indexOf(locality) === index)
    .sort((a, b) => b.length - a.length);

  const knownLocation = localities.find((locality) => {
    const candidate = normalizeLocationText(locality);
    if (normalized.includes(candidate)) return true;

    return candidate
      .split(" ")
      .filter((part) => part.length >= 5)
      .some((part) => normalized.includes(part));
  });

  if (knownLocation) return normalizeLocationText(knownLocation);

  // Preserve an explicitly named area even when the current catalog has no
  // listing there. Returning undefined here used to turn an unknown location
  // into an unfiltered search, which made "properties in Kokapet" show every
  // area instead of an empty Kokapet-only result.
  const locationBeforeFilter = normalized.match(
    /\b(?:in|near|at|around|from)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,2}?)(?=\s+(?:properties?|plots?|villas?|flats?|apartments?|under|below|within|for|with|and)\b|$)/,
  )?.[1];
  if (locationBeforeFilter) return locationBeforeFilter.trim();

  const locationBeforePropertyWord = normalized.match(
    /\b([a-z0-9]+(?:\s+[a-z0-9]+){0,2})\s+(?:properties?|plots?|villas?|flats?|apartments?)\b/,
  )?.[1];
  return locationBeforePropertyWord?.trim();
}

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
  const location = findLocationInText(text);

  const propertyType =
    /villa|bungalow|independent home|independent house/.test(normalized)
      ? "villa"
      : /flat|apartment|\bbhk\b/.test(normalized)
        ? "flat"
        : /commercial space|commercial|office|retail|shop/.test(normalized)
          ? "commercial"
          : /farm|farmland|agricultural land/.test(normalized)
            ? "farm"
            : /plot|open site|residential site|residential land/.test(normalized)
              ? "plot"
              : undefined;

  return {
    intent:
      /loan|emi|interest|tenure|finance|mortgage|borrow|down payment|monthly payment|home finance/.test(
        normalized,
      )
      ? "loan"
      : "property",
    location,
    maxBudget: parseBudget(normalized),
    propertyType,
    compare: /compare|versus|\bvs\b/.test(normalized),
  };
}

function getPricePerSqYd(project: AssistantProject) {
  if (project.pricePerSqYdOverride !== undefined) {
    return project.pricePerSqYdOverride;
  }
  return Number(project.price.replace(/[^\d]/g, "")) || 0;
}

function getMinimumPlotSize(project: AssistantProject) {
  return Number(project.bedrooms.match(/\d+/)?.[0] || 0);
}

function formatCurrency(value: number) {
  if (value >= 10_000_000) {
    return `₹${(value / 10_000_000).toFixed(1).replace(".0", "")} Cr`;
  }
  return `₹${Math.round(value / 100_000)}L`;
}

function formatMonthlyCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatRate(value: number) {
  return `₹${value.toLocaleString("en-IN")} / sq yd`;
}

function formatProjectPrice(project: PropertyMatch) {
  return project.pricePerSqYd > 0
    ? formatRate(project.pricePerSqYd)
    : project.price;
}

function getPropertyMatches(query: AssistantQuery): PropertyMatch[] {
  return PROPERTY_CATALOG.map((project) => {
    const pricePerSqYd = getPricePerSqYd(project);
    return {
      ...project,
      pricePerSqYd,
      estimatedEntryPrice:
        project.estimatedEntryPriceOverride ??
        pricePerSqYd * getMinimumPlotSize(project),
    };
  })
    .filter((project) => {
      const locationTerms = query.location
        ? LOCATION_GROUPS[query.location] || [normalizeLocationText(query.location)]
        : [];
      const matchesLocation =
        locationTerms.length === 0 ||
        locationTerms.some((term) =>
          normalizeLocationText(project.locality).includes(
            normalizeLocationText(term),
          ),
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
          (type.includes("flat") || type.includes("apartment"))) ||
        (query.propertyType === "commercial" &&
          (type.includes("commercial") ||
            type.includes("office") ||
            type.includes("retail") ||
            type.includes("shop")));
      return matchesLocation && matchesBudget && matchesType;
    })
    .sort((a, b) => a.estimatedEntryPrice - b.estimatedEntryPrice)
    .slice(0, 4);
}

type InsightMetric = {
  label: string;
  value: number;
  detail: string;
};

function distanceFromHyderabadMapCenter(project: PlotsViewProject) {
  const center: [number, number] = [78.385, 17.42];
  const earthRadius = 6371;
  const latitudeDelta = ((project.latitude - center[1]) * Math.PI) / 180;
  const longitudeDelta = ((project.longitude - center[0]) * Math.PI) / 180;
  const centerLatitude = (center[1] * Math.PI) / 180;
  const projectLatitude = (project.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.sin(longitudeDelta / 2) ** 2 *
      Math.cos(centerLatitude) *
      Math.cos(projectLatitude);

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getProjectInsights(project: PropertyMatch) {
  const details = getProjectListingDetails(project);
  const distance = distanceFromHyderabadMapCenter(project);
  const approvalValue =
    project.approvalType === "HMDA"
      ? 92
      : project.approvalType === "DTCP"
        ? 78
        : project.approvalType === "FCDA"
          ? 70
          : 64;
  const priceValue = Math.max(
    18,
    Math.min(96, Math.round(100 - project.pricePerSqYd / 450)),
  );

  return {
    details,
    distance,
    growthSignals: [
      {
        label: "Project scale",
        value: Math.min(100, Math.round((project.acres / 50) * 100)),
        detail: `${project.acres} acres`,
      },
      {
        label: "Approval signal",
        value: approvalValue,
        detail: `${project.approvalType} listed`,
      },
      {
        label: "Price signal",
        value: priceValue,
        detail: formatProjectPrice(project),
      },
    ] satisfies InsightMetric[],
    connectivitySignals: [
      {
        label: "Map proximity",
        value: Math.max(12, Math.round(100 - Math.min(distance, 100))),
        detail: `~${Math.round(distance)} km from map center`,
      },
    ] satisfies InsightMetric[],
  };
}

function InsightBar({ metric }: { metric: InsightMetric }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-white/55">{metric.label}</span>
        <span className="font-semibold text-white/75">{metric.detail}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-300"
          style={{ width: `${metric.value}%` }}
        />
      </div>
    </div>
  );
}

function PropertyInsightPanel({ project }: { project: PropertyMatch }) {
  const { details, growthSignals, connectivitySignals, distance } =
    getProjectInsights(project);
  const amenities = details.amenities ?? [];

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-purple-300/15 bg-purple-500/[0.06] p-3">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-purple-200" />
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200">
          Indicative growth signals
        </p>
      </div>
      <div className="space-y-2.5">
        {growthSignals.map((metric) => (
          <InsightBar key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5 text-blue-200" />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">
            Connectivity context
          </p>
        </div>
        <div className="mt-2 space-y-2.5">
          {connectivitySignals.map((metric) => (
            <InsightBar key={metric.label} metric={metric} />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-white/45">
          {details.locationDetail ?? `${project.locality}, Telangana`} · map
          distance {Math.round(distance)} km
        </p>
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center gap-1.5">
          <Trees className="h-3.5 w-3.5 text-emerald-200" />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
            Amenities
          </p>
        </div>
        {amenities.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {amenities.slice(0, 8).map((amenity) => (
              <span
                key={amenity}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-1 text-[10px] text-white/65"
              >
                <Check className="h-3 w-3 text-emerald-300" />
                {amenity}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-white/45">
            Amenities are not listed for this project in the imported catalog.
          </p>
        )}
      </div>

      <p className="flex items-start gap-1.5 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-white/35">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Growth bars are indicative signals from listed scale, approval, pricing,
        and map position—not a guaranteed forecast. Verify details with the
        project team.
      </p>
    </div>
  );
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

function getMaximumLoanForEmi(emi: number, interestRate: number, tenure: number) {
  const monthlyRate = interestRate / 100 / 12;
  const months = tenure * 12;
  if (!monthlyRate) return emi * months;
  return (
    (emi * ((1 + monthlyRate) ** months - 1)) /
    (monthlyRate * (1 + monthlyRate) ** months)
  );
}

function LoanPlanner({
  settings,
  onChange,
  onSave,
}: {
  settings: LoanSettings;
  onChange: (settings: LoanSettings) => void;
  onSave: () => void;
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
            key: "monthlyIncome" as const,
            label: "Monthly income",
            value: settings.monthlyIncome,
            min: 30_000,
            max: 500_000,
            step: 10_000,
            display: formatMonthlyCurrency(settings.monthlyIncome),
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
            {formatMonthlyCurrency(emi)} / mo
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
        We use up to 35% of your monthly income as a comfortable EMI estimate.
      </p>
      <button
        type="button"
        onClick={onSave}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#141419] transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Save & find eligible properties
        <ArrowRight className="h-3.5 w-3.5 text-[#7c2cff]" />
      </button>
    </div>
  );
}

const PROPERTY_TYPE_OPTIONS = [
  { value: "", label: "Any property type" },
  { value: "flat", label: "Flat / apartment" },
  { value: "plot", label: "Plot" },
  { value: "villa", label: "Villa" },
  { value: "commercial", label: "Commercial space" },
] as const;

const LOCATION_OPTIONS = [
  { value: "", label: "Any Hyderabad location" },
  ...Object.keys(LOCATION_GROUPS).map((location) => ({
    value: location,
    label: location.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  })),
  ...Array.from(
    new Set(PROPERTY_CATALOG.map((project) => project.locality)),
  ).map((location) => ({
    value: normalizeLocationText(location),
    label: location,
  })),
];

function PropertySearchPlanner({
  settings,
  locationLocked,
  locationLabel,
  onChange,
  onSearch,
  onShowAll,
}: {
  settings: PropertySearchSettings;
  locationLocked: boolean;
  locationLabel?: string;
  onChange: (settings: PropertySearchSettings) => void;
  onSearch: () => void;
  onShowAll: () => void;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-purple-300/20 bg-purple-500/[0.08] p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-200">
          Search preferences
        </p>
        <h2 className="mt-1 text-sm font-semibold text-white">
          What is your budget and preferred property?
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-white/50">
          Choose a budget first, then narrow the search by location and type.
        </p>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 flex items-center justify-between text-[11px] text-white/65">
          <span>Maximum budget</span>
          <span className="font-semibold text-white">
            {formatCurrency(settings.maxBudget)}
          </span>
        </span>
        <input
          type="range"
          min={1_500_000}
          max={500_000_000}
          step={500_000}
          value={settings.maxBudget}
          onChange={(event) =>
            onChange({
              ...settings,
              maxBudget: Number(event.target.value),
            })
          }
          className="h-1.5 w-full accent-purple-300"
          aria-label="Maximum property budget"
        />
        <span className="mt-1 flex justify-between text-[10px] text-white/35">
          <span>₹15L</span>
          <span>₹50Cr</span>
        </span>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {locationLocked ? (
          <div className="rounded-xl border border-purple-300/20 bg-purple-300/[0.08] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-purple-200/70">
              Location from your question
            </p>
            <p className="mt-1 text-xs font-semibold text-white">
              {locationLabel ?? "Selected area"}
            </p>
          </div>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-[11px] text-white/65">
              Location
            </span>
            <select
              value={settings.location}
              onChange={(event) =>
                onChange({ ...settings, location: event.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-[#17151d] px-3 py-2.5 text-xs text-white outline-none focus:border-purple-300/50"
              aria-label="Property location"
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value || "any-location"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[11px] text-white/65">
            Property type
          </span>
          <select
            value={settings.propertyType}
            onChange={(event) =>
              onChange({
                ...settings,
                propertyType: event.target
                  .value as PropertySearchSettings["propertyType"],
              })
            }
            className="w-full rounded-xl border border-white/10 bg-[#17151d] px-3 py-2.5 text-xs text-white outline-none focus:border-purple-300/50"
            aria-label="Property type"
          >
            {PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option.value || "any-type"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#141419] transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Find matching properties
        <ArrowRight className="h-3.5 w-3.5 text-[#7c2cff]" />
      </button>
      {locationLocked && (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-2 w-full rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/75 transition-colors hover:border-white/35 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Show all properties in {locationLabel ?? "this area"}
        </button>
      )}
    </div>
  );
}

function PropertyComparison({ matches }: { matches: PropertyMatch[] }) {
  if (matches.length === 0) return null;

  const sortedMatches = [...matches].sort(
    (a, b) => a.estimatedEntryPrice - b.estimatedEntryPrice,
  );

  return (
    <div className="mt-3 rounded-2xl border border-blue-300/15 bg-blue-500/[0.06] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">
          Price comparison
        </p>
        <span className="text-[10px] text-white/40">
          {sortedMatches.length} options
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {sortedMatches.map((project, index) => (
          <div
            key={project.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                <span className="mr-1.5 text-white/35">{index + 1}.</span>
                {project.name}
              </p>
              <p className="mt-0.5 text-[10px] text-white/45">
                {project.locality} · {formatProjectPrice(project)}
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-white">
              {formatCurrency(project.estimatedEntryPrice)}+
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiAssistantPage() {
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showLoanPlanner, setShowLoanPlanner] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] =
    useState<AssistantQuery | null>(null);
  const [propertySearchSettings, setPropertySearchSettings] =
    useState<PropertySearchSettings>({
      maxBudget: 5_000_000,
      location: "",
      propertyType: "",
    });
  const [selectedMapProjectId, setSelectedMapProjectId] = useState<string | null>(
    null,
  );
  const [expandedInsightIds, setExpandedInsightIds] = useState<string[]>([]);
  const [loanSettings, setLoanSettings] = useState<LoanSettings>({
    propertyValue: 6_000_000,
    downPayment: 20,
    interestRate: 8.5,
    tenure: 20,
    monthlyIncome: 150_000,
  });

  const loanEmi = useMemo(() => getLoanPayment(loanSettings), [loanSettings]);

  const saveLoanAndFindProperties = () => {
    const comfortableEmi = loanSettings.monthlyIncome * 0.35;
    const maximumLoan = getMaximumLoanForEmi(
      comfortableEmi,
      loanSettings.interestRate,
      loanSettings.tenure,
    );
    const maximumPropertyValue =
      maximumLoan / (1 - loanSettings.downPayment / 100);
    const matches = getPropertyMatches({
      intent: "property",
      maxBudget: maximumPropertyValue,
    });

    if (matches.length === 0) {
      addAssistantMessage(
        `I couldn't find a map listing that fits your current eligibility up to ${formatCurrency(
          maximumPropertyValue,
        )}. Try a higher down payment, a longer tenure, or a wider property search.`,
      );
      return;
    }

    addAssistantMessage(
      `Saved. Based on a ${formatMonthlyCurrency(
        loanSettings.monthlyIncome,
      )} monthly income, your comfortable EMI is about ${formatMonthlyCurrency(
        comfortableEmi,
      )}. I found ${matches.length} properties up to about ${formatCurrency(
        maximumPropertyValue,
      )}.`,
      matches,
    );
  };

  const searchWithPropertyPreferences = (
    settings = propertySearchSettings,
  ) => {
    const query: AssistantQuery = {
      ...(propertySearchQuery ?? { intent: "property" }),
      maxBudget: settings.maxBudget,
      location: settings.location || undefined,
      propertyType: settings.propertyType || undefined,
    };
    const matches = getPropertyMatches(query);
    const typeLabel =
      PROPERTY_TYPE_OPTIONS.find(
        (option) => option.value === settings.propertyType,
      )?.label ?? "properties";
    const locationLabel =
      LOCATION_OPTIONS.find(
        (option) => option.value === settings.location,
      )?.label ?? "Hyderabad";
    const filters = [
      `up to ${formatCurrency(settings.maxBudget)}`,
      settings.location ? `in ${locationLabel}` : "",
      settings.propertyType ? `for ${typeLabel.toLowerCase()}` : "",
    ].filter(Boolean);
    const filterText = filters.join(" ");
    const textResponse = matches.length
      ? propertySearchQuery?.compare
        ? `Here is a price comparison of ${matches.length} options ${filterText}. Lower prices are listed first.`
        : `I found ${matches.length} map listings ${filterText}. These are ranked by the lowest estimated entry price from the published plot size and rate.`
      : "I couldn’t find a matching listing in the imported Hyderabad catalog for those filters. Try a higher budget, another location, or Any property type.";

    addAssistantMessage(
      textResponse,
      matches,
      false,
      false,
      Boolean(propertySearchQuery?.compare),
    );
  };

  const showAllPropertiesInArea = () => {
    const nextSettings = {
      ...propertySearchSettings,
      propertyType: "" as const,
    };
    setPropertySearchSettings(nextSettings);
    searchWithPropertyPreferences(nextSettings);
  };

  const addAssistantMessage = (
    text: string,
    matches?: PropertyMatch[],
    showLoan = false,
    showProperty = false,
    showComparison = false,
  ) => {
    setMessages((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        role: "assistant",
        text,
        matches,
        showLoanPlanner: showLoan,
        showPropertyPlanner: showProperty,
        showComparison,
      },
    ]);
  };

  const respondToQuery = (text: string) => {
    const localQuery = parseQuery(text);
    const query: AssistantQuery = localQuery;

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

    setPropertySearchQuery(query);

    if (query.compare && query.maxBudget) {
      const matches = getPropertyMatches(query);
      addAssistantMessage(
        matches.length
          ? `Here is a price comparison of ${matches.length} options up to ${formatCurrency(
              query.maxBudget,
            )}. Lower prices are listed first.`
          : "I couldn’t find properties to compare for those filters. Try a higher budget or another area.",
        matches,
        false,
        false,
        true,
      );
      return;
    }

    if (query.location && !query.maxBudget) {
      const matches = getPropertyMatches(query);
      const propertyText = query.propertyType
        ? ` for ${query.propertyType} properties`
        : "";
      const textResponse = matches.length
        ? `I found ${matches.length} properties${propertyText} near ${query.location}. Tap Budget whenever you want to narrow these results by price.`
        : "I couldn’t find a matching property in that area yet. Tap Budget to add a budget filter or try another area.";

      addAssistantMessage(textResponse, matches);
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

  const submitQuestion = (question: string) => {
    const text = question.trim();
    if (!text || isThinking) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text },
    ]);
    setDraft("");
    setIsThinking(true);
    window.setTimeout(() => {
      respondToQuery(text);
      setIsThinking(false);
    }, 650);
  };

  const sendMessage = (event?: FormEvent) => {
    event?.preventDefault();
    submitQuestion(draft);
  };

  const handleQuickAction = (label: string, prompt: string) => {
    if (label === "Loan") {
      setShowLoanPlanner(true);
      addAssistantMessage(
        `Let’s compare your loan options. The current estimate is ${formatMonthlyCurrency(
          loanEmi,
        )} per month. Adjust the sliders below for a better fit.`,
        undefined,
        true,
      );
      return;
    }
    if (label === "Budget") {
      const baseQuery = propertySearchQuery ?? { intent: "property" as const };
      const nextSettings: PropertySearchSettings = {
        maxBudget: baseQuery.maxBudget ?? 5_000_000,
        location: baseQuery.location ?? "",
        propertyType:
          baseQuery.propertyType === "flat" ||
          baseQuery.propertyType === "plot" ||
          baseQuery.propertyType === "villa" ||
          baseQuery.propertyType === "commercial"
            ? baseQuery.propertyType
            : "",
      };
      setPropertySearchQuery(baseQuery);
      setPropertySearchSettings(nextSettings);
      addAssistantMessage(
        baseQuery.location
          ? `Set a maximum budget to filter properties near ${baseQuery.location}.`
          : "Set a maximum budget, location, and property type to filter properties.",
        undefined,
        false,
        true,
      );
      return;
    }
    submitQuestion(prompt);
  };

  const toggleInsights = (projectId: string) => {
    setExpandedInsightIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
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
                                {formatProjectPrice(project)}
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
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleInsights(project.id)}
                                className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-white/75 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                              >
                                Insights
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform ${
                                    expandedInsightIds.includes(project.id)
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                              </button>
                              {project.mapAvailable !== false && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedMapProjectId(project.id)}
                                  className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-white/75 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                                >
                                  Map
                                </button>
                              )}
                            </div>
                          </div>
                          {expandedInsightIds.includes(project.id) && (
                            <PropertyInsightPanel project={project} />
                          )}
                        </article>
                      ))}
                    </div>
                  )}

                  {message.showComparison && message.matches && (
                    <PropertyComparison matches={message.matches} />
                  )}

                  {message.showLoanPlanner && (
                    <LoanPlanner
                      settings={loanSettings}
                      onChange={setLoanSettings}
                      onSave={saveLoanAndFindProperties}
                    />
                  )}
                  {message.showPropertyPlanner && (
                    <PropertySearchPlanner
                      settings={propertySearchSettings}
                      locationLocked={Boolean(propertySearchQuery?.location)}
                      locationLabel={
                        LOCATION_OPTIONS.find(
                          (option) =>
                            option.value === propertySearchQuery?.location,
                        )?.label
                      }
                      onChange={setPropertySearchSettings}
                      onSearch={searchWithPropertyPreferences}
                      onShowAll={showAllPropertiesInArea}
                    />
                  )}
                </div>
              ))}
              {isThinking && (
                <div
                  className="flex justify-start"
                  aria-live="polite"
                  aria-label="R Cliq AI is thinking"
                >
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-3 text-xs text-white/45">
                    <span>Thinking</span>
                    <span className="flex items-center gap-1" aria-hidden="true">
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-300"
                          style={{ animationDelay: `${index * 140}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
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