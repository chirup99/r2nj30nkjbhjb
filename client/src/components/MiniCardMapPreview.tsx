import { MapPin } from "lucide-react";
import { CURATED_RESIDENTIAL_PROPERTIES } from "@/data/curatedProperties";
import {
  Map as PropertyMap,
} from "@/components/ui/map";

type MiniCardLocationData = {
  name?: unknown;
  title?: unknown;
  location?: unknown;
  subname?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  color?: unknown;
};

const CARD_MAP_PALETTES = [
  { token: "lime", accent: "#a3e635", tint: "rgba(132, 204, 22, 0.22)" },
  { token: "emerald", accent: "#34d399", tint: "rgba(16, 185, 129, 0.2)" },
  { token: "teal", accent: "#2dd4bf", tint: "rgba(20, 184, 166, 0.2)" },
  { token: "green", accent: "#4ade80", tint: "rgba(34, 197, 94, 0.2)" },
  { token: "cyan", accent: "#22d3ee", tint: "rgba(6, 182, 212, 0.2)" },
  { token: "sky", accent: "#38bdf8", tint: "rgba(14, 165, 233, 0.2)" },
  { token: "blue", accent: "#60a5fa", tint: "rgba(59, 130, 246, 0.2)" },
  { token: "indigo", accent: "#818cf8", tint: "rgba(99, 102, 241, 0.2)" },
  { token: "violet", accent: "#a78bfa", tint: "rgba(139, 92, 246, 0.2)" },
  { token: "purple", accent: "#c084fc", tint: "rgba(168, 85, 247, 0.2)" },
  { token: "amber", accent: "#fbbf24", tint: "rgba(245, 158, 11, 0.2)" },
  { token: "orange", accent: "#fb923c", tint: "rgba(249, 115, 22, 0.2)" },
  { token: "rose", accent: "#fb7185", tint: "rgba(244, 63, 94, 0.2)" },
  { token: "fuchsia", accent: "#e879f9", tint: "rgba(217, 70, 239, 0.2)" },
] as const;

function resolveCardMapPalette(color: unknown, fallbackAccent: string) {
  const colorClasses = typeof color === "string" ? color.toLowerCase() : "";
  const palette = CARD_MAP_PALETTES.find(({ token }) =>
    colorClasses.includes(token),
  );
  return (
    palette ?? {
      accent: fallbackAccent,
      tint: "rgba(139, 92, 246, 0.14)",
    }
  );
}

function resolveLocation(card: MiniCardLocationData) {
  const longitude = Number(card.longitude);
  const latitude = Number(card.latitude);
  const hasCoordinates =
    card.longitude !== undefined &&
    card.longitude !== null &&
    card.longitude !== "" &&
    card.latitude !== undefined &&
    card.latitude !== null &&
    card.latitude !== "" &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90;

  if (hasCoordinates) {
    return { longitude, latitude, accent: "#8b5cf6", approximate: false };
  }

  const names = [card.name, card.title]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
  const address = [card.location, card.subname]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const curatedProperty = CURATED_RESIDENTIAL_PROPERTIES.find((property) => {
    const propertyName = property.name.toLowerCase();
    return (
      names.includes(propertyName) ||
      address.includes(property.locality.toLowerCase())
    );
  });

  if (!curatedProperty) return null;

  return {
    longitude: curatedProperty.longitude,
    latitude: curatedProperty.latitude,
    accent: curatedProperty.accent,
    approximate: true,
  };
}

export function MiniCardMapPreview({
  card,
}: {
  card: MiniCardLocationData;
}) {
  const location = resolveLocation(card);

  if (!location) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-[#15151b] text-center"
        role="img"
        aria-label="Map preview unavailable because this card has no mapped location"
      >
        <div>
          <MapPin className="mx-auto h-5 w-5 text-white/60" />
          <p className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-white/65">
            Location map unavailable
          </p>
        </div>
      </div>
    );
  }

  const mapPalette = resolveCardMapPalette(card.color, location.accent);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#15151b]"
      role="img"
      aria-label={`Map preview centered on ${String(card.location || card.name || "property location")}`}
    >
      <PropertyMap
        center={[location.longitude, location.latitude]}
        zoom={12.4}
        theme="dark"
        interactive={false}
        attributionControl={false}
        className="absolute inset-0 h-full w-full"
      >
      </PropertyMap>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: mapPalette.tint,
          mixBlendMode: "soft-light",
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#f7f2e7] text-white shadow-[0_2px_8px_rgba(24,25,20,0.35)]"
        style={{ backgroundColor: mapPalette.accent }}
        aria-hidden="true"
      >
        <MapPin
          className="h-3.5 w-3.5"
          fill="currentColor"
          strokeWidth={1.5}
        />
      </span>
      {location.approximate && (
        <span className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[7px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
          Approx. area
        </span>
      )}
    </div>
  );
}
