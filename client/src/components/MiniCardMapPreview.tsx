import { MapPin } from "lucide-react";
import { CURATED_RESIDENTIAL_PROPERTIES } from "@/data/curatedProperties";
import {
  Map as PropertyMap,
  MapMarker,
  MarkerContent,
} from "@/components/ui/map";

type MiniCardLocationData = {
  name?: unknown;
  title?: unknown;
  location?: unknown;
  subname?: unknown;
  longitude?: unknown;
  latitude?: unknown;
};

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
        <MapMarker
          longitude={location.longitude}
          latitude={location.latitude}
          anchor="center"
        >
          <MarkerContent className="pointer-events-none">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f7f2e7] text-white shadow-[0_2px_8px_rgba(24,25,20,0.35)]"
              style={{ backgroundColor: location.accent }}
            >
              <MapPin
                className="h-3.5 w-3.5"
                fill="currentColor"
                strokeWidth={1.5}
              />
            </span>
          </MarkerContent>
        </MapMarker>
      </PropertyMap>
      {location.approximate && (
        <span className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[7px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
          Approx. area
        </span>
      )}
      <span className="absolute bottom-1.5 right-2 rounded-sm bg-black/35 px-1 py-0.5 text-[6px] leading-none text-white/75">
        © CARTO · © OpenStreetMap
      </span>
    </div>
  );
}
