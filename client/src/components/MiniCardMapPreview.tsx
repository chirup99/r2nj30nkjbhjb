import { MapPin } from "lucide-react";
import { CURATED_RESIDENTIAL_PROPERTIES } from "@/data/curatedProperties";

type MiniCardLocationData = {
  name?: unknown;
  title?: unknown;
  location?: unknown;
  subname?: unknown;
  longitude?: unknown;
  latitude?: unknown;
};

const MAP_ZOOM = 12;
const TILE_SIZE = 256;
const MAX_MERCATOR_LATITUDE = 85.05112878;

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

  const tileCount = 2 ** MAP_ZOOM;
  const latitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, location.latitude),
  );
  const centerX = ((location.longitude + 180) / 360) * tileCount;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const centerY =
    ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * tileCount;
  const originX = Math.floor(centerX);
  const originY = Math.floor(centerY);
  const tiles = [];

  for (let row = -1; row <= 1; row += 1) {
    for (let column = -1; column <= 1; column += 1) {
      const tileX = originX + column;
      const tileY = originY + row;
      if (tileY < 0 || tileY >= tileCount) continue;

      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        src: `https://tile.openstreetmap.de/${MAP_ZOOM}/${wrappedTileX}/${tileY}.png`,
        left: (tileX - centerX) * TILE_SIZE,
        top: (tileY - centerY) * TILE_SIZE,
      });
    }
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#15151b]"
      role="img"
      aria-label={`Map preview centered on ${String(card.location || card.name || "property location")}`}
    >
      {tiles.map((tile) => (
        <img
          key={tile.src}
          src={tile.src}
          alt=""
          draggable={false}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            width: TILE_SIZE,
            height: TILE_SIZE,
            left: `calc(50% ${tile.left < 0 ? "-" : "+"} ${Math.abs(tile.left)}px)`,
            top: `calc(50% ${tile.top < 0 ? "-" : "+"} ${Math.abs(tile.top)}px)`,
            filter: "grayscale(1) invert(0.9) brightness(0.72) contrast(1.4)",
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/15" />
      <div
        className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
        style={{ backgroundColor: location.accent }}
        aria-hidden="true"
      >
        <MapPin className="h-4 w-4 text-white" strokeWidth={2.2} />
      </div>
      {location.approximate && (
        <span className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[7px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
          Approx. area
        </span>
      )}
      <span className="absolute bottom-1.5 right-2 rounded-sm bg-black/35 px-1 py-0.5 text-[6px] leading-none text-white/75">
        © OpenStreetMap
      </span>
    </div>
  );
}
