import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { MapLayerMouseEvent } from "maplibre-gl";
import {
  BadgeCheck,
  Banknote,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck2,
  Filter,
  House,
  Info,
  Layers,
  Landmark,
  Loader2,
  List,
  MapPin,
  MapPinned,
  Maximize2,
  Moon,
  Navigation,
  Ruler,
  Search,
  Satellite,
  Sparkles,
  Sun,
  Trees,
  X,
  Waves,
} from "lucide-react";
import {
  Map as PropertyMap,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
  RouteProgress,
  useMap,
  MapGeoJSON,
} from "@/components/ui/map";
import { Switch } from "@/components/ui/switch";
import { FlashNewsDialog } from "@/components/FlashNewsDialog";
import {
  FormattedCurrencyText,
  UaeDirhamSymbol,
} from "@/components/UaeDirhamSymbol";
import {
  HMDA_MASTER_PLAN_MAPS,
  type HmdaMasterPlanGroup,
} from "@/data/hmdaMasterPlanMaps";
import {
  detectDefaultDisplayCurrency,
  formatAmountFromInr,
  formatProjectPrice,
  formatStartingPrice,
  loadDailyInrExchangeRates,
  UAE_DIRHAM_SIGN,
  type DailyInrExchangeRates,
  type DisplayCurrency,
} from "@/lib/currency";
import { PLOTSVIEW_PROJECTS } from "@/data/plotsviewProjects";
import {
  DUBAI_MAP_CENTER,
  DUBAI_PROPERTY_PROJECTS,
  type DubaiPropertyProject,
} from "@/data/dubaiProjects";
import { RRR_ALIGNMENT_COORDINATES } from "@/data/rrrAlignment";

type PropertyProject = (typeof PLOTSVIEW_PROJECTS)[number];
type MapPinProject = Pick<
  DubaiPropertyProject,
  "id" | "name" | "longitude" | "latitude" | "accent"
>;

const HYDERABAD_CENTER: [number, number] = [78.385, 17.42];
const MAGIC_ANCHOR: [number, number] = [78.386, 17.455];
const SATELLITE_MAP_STYLE = {
  version: 8 as const,
  sources: {
    "esri-world-imagery": {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
    carto: {
      type: "vector" as const,
      url: "https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json",
      attribution: "© CARTO, © OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "esri-world-imagery",
      type: "raster" as const,
      source: "esri-world-imagery",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Snapshot of every venture currently returned by PlotsView's public catalog.
const PROJECTS: PropertyProject[] = PLOTSVIEW_PROJECTS;
const DUBAI_DEVELOPERS = Array.from(
  new Set(DUBAI_PROPERTY_PROJECTS.map((project) => project.developer)),
).sort((first, second) => first.localeCompare(second));

type MapCoordinate = [number, number];

type LakeCheck = {
  name: string;
  id?: string;
  type?: string;
  longitude: number;
  latitude: number;
  areaAcres?: number;
};

function cleanLakeText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLakeFields(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return {};

  const rows = raw.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  return Object.fromEntries(
    rows
      .map((row) =>
        Array.from(
          row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
        ).map((match) => cleanLakeText(match[1])),
      )
      .filter((cells) => cells.length >= 2)
      .map(([label, ...values]) => [
        label.trim().toUpperCase().replace(/\s+/g, "_"),
        values.filter(Boolean).join(" · "),
      ]),
  );
}

const EARTH_RADIUS_IN_METERS = 6_378_137;
const SQUARE_METERS_PER_ACRE = 4_046.8564224;

function ringAreaInSquareMeters(ring: GeoJSON.Position[]) {
  if (ring.length < 4) return 0;

  const area = ring.reduce((sum, position, index) => {
    const nextPosition = ring[(index + 1) % ring.length];
    const longitude = Number(position[0]);
    const latitude = Number(position[1]);
    const nextLongitude = Number(nextPosition[0]);
    const nextLatitude = Number(nextPosition[1]);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(nextLongitude) ||
      !Number.isFinite(nextLatitude)
    ) {
      return sum;
    }

    const longitudeDelta =
      ((nextLongitude - longitude) * Math.PI) / 180;
    const latitudeRadians = (latitude * Math.PI) / 180;
    const nextLatitudeRadians = (nextLatitude * Math.PI) / 180;

    return (
      sum +
      longitudeDelta *
        (2 + Math.sin(latitudeRadians) + Math.sin(nextLatitudeRadians))
    );
  }, 0);

  return Math.abs((area * EARTH_RADIUS_IN_METERS ** 2) / 2);
}

function polygonAreaInSquareMeters(polygon: GeoJSON.Polygon) {
  const [outerRing, ...innerRings] = polygon.coordinates;
  if (!outerRing) return 0;

  return Math.max(
    0,
    ringAreaInSquareMeters(outerRing) -
      innerRings.reduce(
        (area, ring) => area + ringAreaInSquareMeters(ring),
        0,
      ),
  );
}

function calculateLakeAreaAcres(geometry: GeoJSON.Geometry | null | undefined) {
  if (!geometry) return undefined;

  let areaInSquareMeters = 0;
  if (geometry.type === "Polygon") {
    areaInSquareMeters = polygonAreaInSquareMeters(geometry);
  } else if (geometry.type === "MultiPolygon") {
    areaInSquareMeters = geometry.coordinates.reduce(
      (area, coordinates) =>
        area +
        polygonAreaInSquareMeters({
          type: "Polygon",
          coordinates,
        }),
      0,
    );
  } else {
    return undefined;
  }

  return areaInSquareMeters > 0
    ? areaInSquareMeters / SQUARE_METERS_PER_ACRE
    : undefined;
}

function getLakeCheck(
  properties: Record<string, unknown>,
  longitude: number,
  latitude: number,
  geometry?: GeoJSON.Geometry | null,
): LakeCheck {
  const parsedFields = parseLakeFields(properties.description);
  const lakeName =
    cleanLakeText(properties.name) ||
    cleanLakeText(properties.LAKE_NAME) ||
    parsedFields.LAKE_NAME ||
    "Unnamed lake";

  return {
    name: lakeName,
    id: cleanLakeText(properties.FID) || parsedFields.FID || undefined,
    type: cleanLakeText(properties.TYPE) || parsedFields.TYPE || undefined,
    longitude,
    latitude,
    areaAcres: calculateLakeAreaAcres(geometry),
  };
}

const LAKES_TILE_URL =
  typeof window === "undefined"
    ? "/api/lakes/tiles/{z}/{x}/{y}.pbf"
    : `${window.location.origin}/api/lakes/tiles/{z}/{x}/{y}.pbf`;

function distanceInKilometers(
  from: MapCoordinate,
  to: MapCoordinate,
) {
  const earthRadius = 6371;
  const latitudeDelta = ((to[1] - from[1]) * Math.PI) / 180;
  const longitudeDelta = ((to[0] - from[0]) * Math.PI) / 180;
  const fromLatitude = (from[1] * Math.PI) / 180;
  const toLatitude = (to[1] * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.sin(longitudeDelta / 2) ** 2 *
      Math.cos(fromLatitude) *
      Math.cos(toLatitude);

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function createRadiusPolygon(
  center: MapCoordinate,
  radiusInKilometers: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const points = 96;
  const earthRadius = 6371;
  const latitude = (center[1] * Math.PI) / 180;
  const angularDistance = radiusInKilometers / earthRadius;
  const coordinates = Array.from({ length: points + 1 }, (_, index) => {
    const bearing = (index / points) * Math.PI * 2;
    const pointLatitude =
      Math.asin(
        Math.sin(latitude) * Math.cos(angularDistance) +
          Math.cos(latitude) *
            Math.sin(angularDistance) *
            Math.cos(bearing),
      ) *
      (180 / Math.PI);
    const pointLongitude =
      (center[0] +
        Math.atan2(
          Math.sin(bearing) *
            Math.sin(angularDistance) *
            Math.cos(latitude),
          Math.cos(angularDistance) -
            Math.sin(latitude) * Math.sin((pointLatitude * Math.PI) / 180),
        ) *
          (180 / Math.PI)) %
      360;

    return [pointLongitude, pointLatitude] as [number, number];
  });

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}

type CityContextCategory =
  | "airports"
  | "industries"
  | "sez"
  | "commercial"
  | "metro"
  | "data-centers"
  | "power-plants";

type CityContextPoint = {
  id: string;
  name: string;
  category: CityContextCategory;
  detail: string;
  longitude: number;
  latitude: number;
};

type CityContextArea = {
  id: string;
  name: string;
  category: Exclude<CityContextCategory, "metro">;
  detail: string;
  center: MapCoordinate;
  radiusInKilometers: number;
};

const CITY_CONTEXT_CATEGORIES: Array<{
  id: CityContextCategory;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { id: "airports", label: "Airports", shortLabel: "Air", color: "#38bdf8" },
  { id: "industries", label: "Industrial hubs", shortLabel: "Industry", color: "#fb923c" },
  { id: "sez", label: "SEZ zones", shortLabel: "SEZ", color: "#c084fc" },
  { id: "commercial", label: "Commercial", shortLabel: "Commerce", color: "#f472b6" },
  { id: "metro", label: "Metro network", shortLabel: "Metro", color: "#4ade80" },
  { id: "data-centers", label: "Data centers", shortLabel: "Data", color: "#22d3ee" },
  { id: "power-plants", label: "Power plants", shortLabel: "Power", color: "#facc15" },
];

const CITY_CONTEXT_POINTS: CityContextPoint[] = [
  {
    id: "rgia",
    name: "Rajiv Gandhi International Airport",
    category: "airports",
    detail: "Shamshabad airport corridor",
    longitude: 78.4294,
    latitude: 17.2403,
  },
  {
    id: "begumpet-airport",
    name: "Begumpet Airport",
    category: "airports",
    detail: "Central Hyderabad aviation landmark",
    longitude: 78.4676,
    latitude: 17.4531,
  },
  {
    id: "patancheru-industrial",
    name: "Patancheru industrial belt",
    category: "industries",
    detail: "Manufacturing and logistics corridor",
    longitude: 78.2674,
    latitude: 17.5312,
  },
  {
    id: "jeedimetla-industrial",
    name: "Jeedimetla industrial estate",
    category: "industries",
    detail: "Established north-west industrial cluster",
    longitude: 78.462,
    latitude: 17.531,
  },
  {
    id: "nacharam-industrial",
    name: "Nacharam industrial area",
    category: "industries",
    detail: "East Hyderabad production corridor",
    longitude: 78.577,
    latitude: 17.429,
  },
  {
    id: "cherlapally-industrial",
    name: "Cherlapally industrial corridor",
    category: "industries",
    detail: "Warehousing and manufacturing belt",
    longitude: 78.637,
    latitude: 17.455,
  },
  {
    id: "pharma-city",
    name: "Hyderabad Pharma City",
    category: "industries",
    detail: "Large-scale life sciences growth zone",
    longitude: 78.58,
    latitude: 17.19,
  },
  {
    id: "ctrls-hyderabad",
    name: "CtrlS Hyderabad data centre corridor",
    category: "data-centers",
    detail: "Enterprise colocation and hyperscale infrastructure cluster",
    longitude: 78.376,
    latitude: 17.438,
  },
  {
    id: "stt-gdc-hyderabad",
    name: "STT GDC Hyderabad",
    category: "data-centers",
    detail: "Data centre and cloud connectivity corridor",
    longitude: 78.347,
    latitude: 17.442,
  },
  {
    id: "sify-hyderabad",
    name: "Sify Hyderabad data centre",
    category: "data-centers",
    detail: "Managed hosting and digital infrastructure cluster",
    longitude: 78.354,
    latitude: 17.455,
  },
  {
    id: "yadadri-power",
    name: "Yadadri Thermal Power Station",
    category: "power-plants",
    detail: "Large thermal power generation project near Damaracherla",
    longitude: 79.171,
    latitude: 17.19,
  },
  {
    id: "kothagudem-power",
    name: "Kothagudem Thermal Power Station",
    category: "power-plants",
    detail: "Thermal generation and energy infrastructure corridor",
    longitude: 80.676,
    latitude: 17.55,
  },
  {
    id: "ramagundam-power",
    name: "Ramagundam power corridor",
    category: "power-plants",
    detail: "NTPC and industrial energy infrastructure cluster",
    longitude: 79.46,
    latitude: 18.76,
  },
  {
    id: "hitec-city",
    name: "HITEC City",
    category: "sez",
    detail: "Technology and office district",
    longitude: 78.377,
    latitude: 17.449,
  },
  {
    id: "mindspace-sez",
    name: "Mindspace Madhapur",
    category: "sez",
    detail: "Established IT and office campus",
    longitude: 78.381,
    latitude: 17.436,
  },
  {
    id: "genome-valley",
    name: "Genome Valley",
    category: "sez",
    detail: "Life sciences and biotech cluster",
    longitude: 78.559,
    latitude: 17.59,
  },
  {
    id: "fab-city",
    name: "Fab City",
    category: "sez",
    detail: "South Hyderabad electronics corridor",
    longitude: 78.534,
    latitude: 17.248,
  },
  {
    id: "adibatla-sez",
    name: "Adibatla aerospace zone",
    category: "sez",
    detail: "Aerospace and defence development corridor",
    longitude: 78.53,
    latitude: 17.23,
  },
  {
    id: "ikea-hyderabad",
    name: "IKEA Hyderabad",
    category: "commercial",
    detail: "HITEC City retail anchor",
    longitude: 78.381,
    latitude: 17.441,
  },
  {
    id: "metro-miyapur",
    name: "Miyapur Metro",
    category: "metro",
    detail: "Red Line north-west terminus",
    longitude: 78.373,
    latitude: 17.496,
  },
  {
    id: "metro-ameerpet",
    name: "Ameerpet Metro",
    category: "metro",
    detail: "Red and Blue Line interchange",
    longitude: 78.4448,
    latitude: 17.4355,
  },
  {
    id: "metro-uppal",
    name: "Uppal Metro",
    category: "metro",
    detail: "Blue Line station between Nagole and Stadium",
    longitude: 78.5602,
    latitude: 17.4002,
  },
  {
    id: "metro-rg-ia",
    name: "Airport Metro corridor",
    category: "metro",
    detail: "Proposed airport connectivity corridor",
    longitude: 78.429,
    latitude: 17.286,
  },
  {
    id: "metro-raidurg",
    name: "Raidurg Metro",
    category: "metro",
    detail: "West Hyderabad business corridor",
    longitude: 78.3772,
    latitude: 17.4422,
  },
];

const CITY_CONTEXT_AREAS: CityContextArea[] = [
  {
    id: "airport-zone",
    name: "Airport influence zone",
    category: "airports",
    detail: "Approximate airport development catchment",
    center: [78.4294, 17.2403],
    radiusInKilometers: 4.5,
  },
  {
    id: "patancheru-zone",
    name: "Patancheru industrial zone",
    category: "industries",
    detail: "Approximate industrial and logistics catchment",
    center: [78.2674, 17.5312],
    radiusInKilometers: 3.2,
  },
  {
    id: "jeedimetla-zone",
    name: "Jeedimetla industrial zone",
    category: "industries",
    detail: "Approximate established industrial catchment",
    center: [78.462, 17.531],
    radiusInKilometers: 2.8,
  },
  {
    id: "pharma-city-zone",
    name: "Pharma City growth zone",
    category: "industries",
    detail: "Approximate life sciences growth catchment",
    center: [78.58, 17.19],
    radiusInKilometers: 4.2,
  },
  {
    id: "hyderabad-data-centre-zone",
    name: "Hyderabad data centre zone",
    category: "data-centers",
    detail: "Approximate digital infrastructure and connectivity catchment",
    center: [78.36, 17.445],
    radiusInKilometers: 3.5,
  },
  {
    id: "yadadri-power-zone",
    name: "Yadadri power infrastructure zone",
    category: "power-plants",
    detail: "Approximate generation and transmission catchment",
    center: [79.171, 17.19],
    radiusInKilometers: 5,
  },
  {
    id: "kothagudem-power-zone",
    name: "Kothagudem power infrastructure zone",
    category: "power-plants",
    detail: "Approximate thermal generation catchment",
    center: [80.676, 17.55],
    radiusInKilometers: 5,
  },
  {
    id: "hitec-zone",
    name: "HITEC City / Madhapur zone",
    category: "sez",
    detail: "Approximate technology and office catchment",
    center: [78.38, 17.443],
    radiusInKilometers: 2.5,
  },
  {
    id: "genome-zone",
    name: "Genome Valley zone",
    category: "sez",
    detail: "Approximate biotech and life sciences catchment",
    center: [78.559, 17.59],
    radiusInKilometers: 3.8,
  },
  {
    id: "adibatla-zone",
    name: "Adibatla aerospace zone",
    category: "sez",
    detail: "Approximate aerospace development catchment",
    center: [78.53, 17.23],
    radiusInKilometers: 3.5,
  },
  {
    id: "madhapur-commerce",
    name: "Madhapur commercial zone",
    category: "commercial",
    detail: "Approximate retail and office catchment",
    center: [78.382, 17.44],
    radiusInKilometers: 1.8,
  },
];

const METRO_LINES: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Hyderabad Metro Red Line",
        status: "operational",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          // Miyapur → LB Nagar, Corridor I (station-aligned geometry).
          [78.373025, 17.496539], // Miyapur
          [78.388866, 17.498656], // JNTU College
          [78.401765, 17.493803], // KPHB Colony
          [78.411638, 17.485088], // Kukatpally
          [78.421965, 17.476822], // Balanagar
          [78.426036, 17.471970], // Moosapet
          [78.430005, 17.464160], // Bharat Nagar
          [78.433462, 17.457328], // Erragadda
          [78.438350, 17.447404], // ESI Hospital
          [78.441608, 17.441707], // S.R. Nagar
          [78.444793, 17.435721], // Ameerpet
          [78.451132, 17.428631], // Panjagutta
          [78.456101, 17.420556], // Irrum Manzil
          [78.460846, 17.411532], // Khairatabad
          [78.465025, 17.403906], // Lakdi-ka-pul
          [78.470818, 17.398109], // Assembly
          [78.470148, 17.392399], // Nampally
          [78.473100, 17.386107], // Gandhi Bhavan
          [78.481133, 17.382347], // Osmania Medical College
          [78.486202, 17.379857], // M.G. Bus Station
          [78.493936, 17.377189], // Malakpet
          [78.503178, 17.373427], // New Market
          [78.511948, 17.371073], // Musarambagh
          [78.525717, 17.368552], // Dilsukhnagar
          [78.535941, 17.368286], // Chaitanyapuri
          [78.543930, 17.361854], // Victoria Memorial
          [78.547914, 17.349829], // L.B. Nagar
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Hyderabad Metro Blue Line",
        status: "operational",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          // Nagole → Raidurg, Corridor III. This follows the Jubilee Hills
          // alignment rather than the former Shaikpet/Banjara Hills sketch.
          [78.558822, 17.390768], // Nagole
          [78.560183, 17.400161], // Uppal
          [78.554253, 17.407400], // Stadium
          [78.546335, 17.414826], // NGRI
          [78.540548, 17.420180], // Habsiguda
          [78.528441, 17.428296], // Tarnaka
          [78.519575, 17.435521], // Mettuguda
          [78.505462, 17.435718], // Secunderabad East
          [78.497469, 17.443194], // Parade Grounds
          [78.486244, 17.443467], // Paradise
          [78.476405, 17.443612], // Rasoolpura
          [78.465875, 17.444889], // Prakash Nagar
          [78.456934, 17.437566], // Begumpet
          [78.444783, 17.435286], // Ameerpet
          [78.439099, 17.436965], // Madhura Nagar
          [78.427322, 17.435113], // Yusufguda
          [78.423207, 17.430049], // Road No. 5 Jubilee Hills
          [78.413714, 17.428197], // Jubilee Hills Check Post
          [78.408372, 17.430651], // Peddamma Gudi
          [78.400426, 17.437264], // Madhapur
          [78.387572, 17.442947], // Durgam Cheruvu
          [78.383138, 17.449005], // HITEC City
          [78.377182, 17.442180], // Raidurg
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Hyderabad Metro Green Line",
        status: "operational",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          // JBS → M.G. Bus Station, Corridor II.
          [78.496484, 17.448818], // JBS
          [78.499518, 17.433803], // Secunderabad West
          [78.501956, 17.425515], // Gandhi Hospital
          [78.499505, 17.417874], // Musheerabad
          [78.496802, 17.407032], // RTC Cross Roads
          [78.494896, 17.400363], // Chikkadpally
          [78.489958, 17.394366], // Narayanaguda
          [78.484024, 17.384447], // Sultan Bazar
          [78.485863, 17.379695], // M.G. Bus Station
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        name: "Airport Metro corridor",
        status: "proposed",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.448, 17.437],
          [78.448, 17.39],
          [78.445, 17.34],
          [78.438, 17.29],
          [78.429, 17.24],
        ],
      },
    },
  ],
};

function contextCategoryColor(category: CityContextCategory) {
  return (
    CITY_CONTEXT_CATEGORIES.find((item) => item.id === category)?.color ??
    "#94a3b8"
  );
}

function CityContextPin({
  point,
  selected,
  onSelect,
}: {
  point: CityContextPoint;
  selected: boolean;
  onSelect: () => void;
}) {
  const accent = contextCategoryColor(point.category);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative h-12 w-12 transition-transform ${
        selected ? "scale-125" : "hover:scale-110"
      }`}
      aria-label={`Show ${point.name}`}
    >
      <span
        className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md transition-shadow"
        style={{
          backgroundColor: accent,
          boxShadow: `0 0 0 6px ${accent}40, 0 0 0 12px ${accent}20, 0 2px 8px rgba(0, 0, 0, 0.45)`,
        }}
      />
    </button>
  );
}

function CityContextLayers({
  visibleCategories,
  show3d,
}: {
  visibleCategories: Record<CityContextCategory, boolean>;
  show3d: boolean;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const areasSourceId = "city-context-areas";
    const metroSourceId = "city-context-metro";
    const categoryIds = CITY_CONTEXT_CATEGORIES
      .filter((category) => category.id !== "metro")
      .map((category) => category.id);

    if (!map.getSource(areasSourceId)) {
      map.addSource(areasSourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: CITY_CONTEXT_AREAS.map((area) => ({
            ...createRadiusPolygon(area.center, area.radiusInKilometers),
            properties: {
              id: area.id,
              name: area.name,
              category: area.category,
              detail: area.detail,
            },
          })),
        },
      });
    }

    if (!map.getSource(metroSourceId)) {
      map.addSource(metroSourceId, {
        type: "geojson",
        data: METRO_LINES,
      });
    }

    for (const categoryId of categoryIds) {
      const fillLayerId = `city-context-${categoryId}-fill`;
      const lineLayerId = `city-context-${categoryId}-line`;
      const color = contextCategoryColor(categoryId);

      if (!map.getLayer(fillLayerId)) {
        map.addLayer({
          id: fillLayerId,
          type: "fill",
          source: areasSourceId,
          filter: ["==", ["get", "category"], categoryId],
          paint: {
            "fill-color": color,
            "fill-opacity": 0.12,
          },
          layout: { visibility: "none" },
        });
      }

      if (!map.getLayer(lineLayerId)) {
        map.addLayer({
          id: lineLayerId,
          type: "line",
          source: areasSourceId,
          filter: ["==", ["get", "category"], categoryId],
          paint: {
            "line-color": color,
            "line-width": 2,
            "line-opacity": 0.62,
            "line-dasharray": [2, 2],
          },
          layout: { visibility: "none" },
        });
      }
    }

    if (!map.getLayer("city-context-metro-line")) {
      map.addLayer({
        id: "city-context-metro-line",
        type: "line",
        source: metroSourceId,
        paint: {
          "line-color": "#4ade80",
          "line-width": 3.5,
          "line-opacity": 0.9,
          "line-dasharray": [1, 1.4],
        },
        layout: {
          visibility: "none",
          "line-cap": "round",
          "line-join": "round",
        },
      });
    }

    if (!map.getLayer("city-context-3d-buildings") && map.getSource("carto")) {
      map.addLayer({
        id: "city-context-3d-buildings",
        type: "fill-extrusion",
        source: "carto",
        "source-layer": "building",
        minzoom: 10,
        paint: {
          "fill-extrusion-color": "#8bd5f5",
          "fill-extrusion-opacity": 0.72,
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0,
            12,
            ["coalesce", ["get", "render_height"], ["get", "height"], 12],
          ],
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_min_height"],
            ["get", "min_height"],
            0,
          ],
        },
        layout: { visibility: "none" },
      });
    }

    return () => {
      if (map.getLayer("city-context-3d-buildings")) {
        map.removeLayer("city-context-3d-buildings");
      }
      if (map.getLayer("city-context-metro-line")) {
        map.removeLayer("city-context-metro-line");
      }
      for (const categoryId of categoryIds) {
        for (const suffix of ["fill", "line"]) {
          const layerId = `city-context-${categoryId}-${suffix}`;
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        }
      }
      if (map.getSource(metroSourceId)) map.removeSource(metroSourceId);
      if (map.getSource(areasSourceId)) map.removeSource(areasSourceId);
    };
  }, [isLoaded, map]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    for (const category of CITY_CONTEXT_CATEGORIES) {
      const layerIds =
        category.id === "metro"
          ? ["city-context-metro-line"]
          : [
              `city-context-${category.id}-fill`,
              `city-context-${category.id}-line`,
            ];

      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            "visibility",
            visibleCategories[category.id] ? "visible" : "none",
          );
        }
      }
    }

    if (map.getLayer("city-context-3d-buildings")) {
      map.setLayoutProperty(
        "city-context-3d-buildings",
        "visibility",
        show3d ? "visible" : "none",
      );
    }
  }, [isLoaded, map, show3d, visibleCategories]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const camera: Parameters<typeof map.easeTo>[0] = {
      pitch: show3d ? 48 : 0,
      bearing: show3d ? -16 : 0,
      duration: 700,
      essential: true,
    };

    if (show3d) {
      camera.zoom = Math.max(map.getZoom(), 10.5);
    }

    map.easeTo(camera);
  }, [isLoaded, map, show3d]);

  return null;
}

function getPricePerSquareYard(project: PropertyProject) {
  const price = project.price.replace(/[^\d]/g, "");
  return Number(price) || 0;
}

function getMinimumPlotSize(project: PropertyProject) {
  const size = project.bedrooms.match(/[\d,]+/);
  return size ? Number(size[0].replace(/,/g, "")) : 0;
}

function getEstimatedMinimumPlotValue(project: PropertyProject) {
  return getPricePerSquareYard(project) * getMinimumPlotSize(project);
}

type MagicApprovalFilter = "any" | "HMDA" | "DTCP" | "other";

type MagicPropertyFilters = {
  maxBudget: number;
  minimumPlotSize: number;
  approval: MagicApprovalFilter;
  activeOnly: boolean;
};

const MAGIC_BUDGET_STEP = 100_000;
const MAGIC_BUDGET_MIN = 500_000;
const PROJECT_STARTING_BUDGETS = PROJECTS.map(getEstimatedMinimumPlotValue).filter(
  (budget) => budget > 0,
);
const MAGIC_BUDGET_MAX =
  Math.ceil(Math.max(...PROJECT_STARTING_BUDGETS) / MAGIC_BUDGET_STEP) *
  MAGIC_BUDGET_STEP;
const MAGIC_PLOT_SIZE_MAX =
  Math.ceil(Math.max(...PROJECTS.map(getMinimumPlotSize)) / 100) * 100;

const DEFAULT_MAGIC_PROPERTY_FILTERS: MagicPropertyFilters = {
  maxBudget: MAGIC_BUDGET_MAX,
  minimumPlotSize: 0,
  approval: "any",
  activeOnly: false,
};

type MagicSubcategory = {
  id: string;
  label: string;
  detail: string;
  filter: (project: PropertyProject) => boolean;
};

type MagicIntent = {
  id: string;
  label: string;
  detail: string;
  accent: string;
  filter: (project: PropertyProject) => boolean;
  subcategories: readonly MagicSubcategory[];
};

const MAGIC_INTENTS = [
  {
    id: "uber-class",
    label: "Premium plots",
    detail: "Higher-value shortlist",
    accent: "#8b5cf6",
    filter: (project) => getPricePerSquareYard(project) >= 40000,
    subcategories: [
      {
        id: "all-premium",
        label: "All premium",
        detail: "All higher-value projects",
        filter: () => true,
      },
      {
        id: "two-crore-plus",
        label: "₹2Cr+",
        detail: "Estimated minimum plot value",
        filter: (project) => getEstimatedMinimumPlotValue(project) >= 20000000,
      },
      {
        id: "forty-thousand-plus",
        label: "₹40k+ / sq yd",
        detail: "Higher rate per square yard",
        filter: (project) => getPricePerSquareYard(project) >= 40000,
      },
      {
        id: "large-premium-plots",
        label: "200+ sq yd",
        detail: "Larger villa plot sizes",
        filter: (project) => getMinimumPlotSize(project) >= 200,
      },
    ],
  },
  {
    id: "ultra-luxury",
    label: "Large layouts",
    detail: "Big development",
    accent: "#ec4899",
    filter: (project) => project.acres >= 20,
    subcategories: [
      {
        id: "all-large",
        label: "All large layouts",
        detail: "Every 20+ acre project",
        filter: () => true,
      },
      {
        id: "fifty-acres-plus",
        label: "50+ acres",
        detail: "The biggest developments",
        filter: (project) => project.acres >= 50,
      },
      {
        id: "twenty-to-fifty-acres",
        label: "20–50 acres",
        detail: "Large mid-size layouts",
        filter: (project) => project.acres >= 20 && project.acres < 50,
      },
      {
        id: "large-plot-sizes",
        label: "500+ sq yd",
        detail: "Large individual plots",
        filter: (project) => getMinimumPlotSize(project) >= 500,
      },
    ],
  },
  {
    id: "ready-now",
    label: "Ready now",
    detail: "Active listings",
    accent: "#10b981",
    filter: (project) => project.status.toLowerCase().includes("active"),
    subcategories: [
      {
        id: "all-ready",
        label: "All active listings",
        detail: "Every active listing",
        filter: () => true,
      },
      {
        id: "ready-hmda",
        label: "HMDA plots",
        detail: "Active HMDA listings",
        filter: (project) => project.approvalType === "HMDA",
      },
      {
        id: "ready-dtcp",
        label: "DTCP plots",
        detail: "Active DTCP listings",
        filter: (project) => project.approvalType === "DTCP",
      },
      {
        id: "ready-large-plots",
        label: "200+ sq yd",
        detail: "Active larger plots",
        filter: (project) => getMinimumPlotSize(project) >= 200,
      },
    ],
  },
  {
    id: "growth-pick",
    label: "Growth pick",
    detail: "Value-led corridors",
    accent: "#f59e0b",
    filter: (project) =>
      getPricePerSquareYard(project) <= 30000 && project.acres >= 5,
    subcategories: [
      {
        id: "all-growth",
        label: "All growth picks",
        detail: "Every value-led project",
        filter: () => true,
      },
      {
        id: "under-two-crore",
        label: "Under ₹2Cr",
        detail: "Estimated minimum plot value",
        filter: (project) => getEstimatedMinimumPlotValue(project) < 20000000,
      },
      {
        id: "entry-price",
        label: "Under ₹30k / sq yd",
        detail: "Lower entry rate",
        filter: (project) => getPricePerSquareYard(project) < 30000,
      },
      {
        id: "growth-large-plots",
        label: "200+ sq yd",
        detail: "Bigger growth-corridor plots",
        filter: (project) => getMinimumPlotSize(project) >= 200,
      },
    ],
  },
] satisfies readonly MagicIntent[];

const CURRENCY_OPTIONS: { currency: DisplayCurrency; symbol: string }[] = [
  { currency: "INR", symbol: "₹" },
  { currency: "USD", symbol: "$" },
  { currency: "AED", symbol: UAE_DIRHAM_SIGN },
];

function getSubcategoryDisplayLabel(
  subcategory: MagicSubcategory,
  currency: DisplayCurrency,
  rates: DailyInrExchangeRates | null,
) {
  if (currency === "INR") return subcategory.label;

  switch (subcategory.id) {
    case "two-crore-plus":
      return `${formatAmountFromInr(20_000_000, currency, rates)}+`;
    case "forty-thousand-plus":
      return `${formatAmountFromInr(40_000, currency, rates)}+ / sq yd`;
    case "under-two-crore":
      return `Under ${formatAmountFromInr(20_000_000, currency, rates)}`;
    case "entry-price":
      return `Under ${formatAmountFromInr(30_000, currency, rates)} / sq yd`;
    default:
      return subcategory.label;
  }
}

function createCurvedRoute(
  start: [number, number],
  end: [number, number],
): [number, number][] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = Math.min(0.055, Math.max(0.018, distance * 0.22));
  const control: [number, number] = [
    (start[0] + end[0]) / 2 - (dy / distance) * bend,
    (start[1] + end[1]) / 2 + (dx / distance) * bend,
  ];

  return Array.from({ length: 32 }, (_, index) => {
    const t = index / 31;
    const inverse = 1 - t;
    return [
      inverse * inverse * start[0] +
        2 * inverse * t * control[0] +
        t * t * end[0],
      inverse * inverse * start[1] +
        2 * inverse * t * control[1] +
        t * t * end[1],
    ];
  });
}

function MagicProjectRoute({
  projects,
  intent,
  subcategoryId,
  progress,
}: {
  projects: PropertyProject[];
  intent: MagicIntent;
  subcategoryId: string;
  progress: number;
}) {
  const { map, isLoaded } = useMap();
  const [routeStart, setRouteStart] =
    useState<[number, number]>(MAGIC_ANCHOR);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const updateRouteStart = () => {
      const button = document.querySelector<HTMLElement>(
        `[data-magic-subcategory="${subcategoryId}"]`,
      );
      const container = map.getContainer();
      if (!button || !container) return;

      const buttonBounds = button.getBoundingClientRect();
      const mapBounds = container.getBoundingClientRect();
      const startPoint: [number, number] = [
        buttonBounds.left + buttonBounds.width / 2 - mapBounds.left,
        buttonBounds.top - mapBounds.top,
      ];
      const start = map.unproject(startPoint);
      setRouteStart([start.lng, start.lat]);
    };

    updateRouteStart();
    const frame = requestAnimationFrame(updateRouteStart);
    window.addEventListener("resize", updateRouteStart);
    map.on("move", updateRouteStart);
    map.on("resize", updateRouteStart);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRouteStart);
      map.off("move", updateRouteStart);
      map.off("resize", updateRouteStart);
    };
  }, [intent.id, isLoaded, map, subcategoryId]);

  return (
    <>
      {projects.map((project) => (
        <MapRoute
          key={`${intent.id}-${project.id}`}
          id={`magic-project-route-${intent.id}-${project.id}`}
          coordinates={createCurvedRoute(routeStart, [
            project.longitude,
            project.latitude,
          ])}
          color="#f9a8d4"
          width={2}
          opacity={0.45}
          dashArray={[2, 2]}
          active
          activeColor={intent.accent}
          activeWidth={4}
          activeOpacity={0.95}
          activeDashArray={[1.5, 1.5]}
          progress={progress}
        >
          <RouteProgress
            color="#fff7ed"
            width={5}
            opacity={0.9}
            dashArray={[1, 1]}
          />
        </MapRoute>
      ))}
    </>
  );
}

function DubaiDeveloperProjectRoute({
  project,
  progress,
}: {
  project: DubaiPropertyProject;
  progress: number;
}) {
  const { map, isLoaded } = useMap();
  const [routeStart, setRouteStart] =
    useState<[number, number]>(DUBAI_MAP_CENTER);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const updateRouteStart = () => {
      const button = document.querySelector<HTMLElement>(
        `[data-dubai-project="${project.id}"]`,
      );
      const container = map.getContainer();
      if (!button || !container) return;

      const buttonBounds = button.getBoundingClientRect();
      const mapBounds = container.getBoundingClientRect();
      const startPoint: [number, number] = [
        buttonBounds.left + buttonBounds.width / 2 - mapBounds.left,
        buttonBounds.top - mapBounds.top,
      ];
      const start = map.unproject(startPoint);
      setRouteStart([start.lng, start.lat]);
    };

    updateRouteStart();
    const frame = requestAnimationFrame(updateRouteStart);
    window.addEventListener("resize", updateRouteStart);
    map.on("move", updateRouteStart);
    map.on("resize", updateRouteStart);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRouteStart);
      map.off("move", updateRouteStart);
      map.off("resize", updateRouteStart);
    };
  }, [isLoaded, map, project.id]);

  return (
    <MapRoute
      id={`dubai-developer-route-${project.id}`}
      coordinates={createCurvedRoute(routeStart, [
        project.longitude,
        project.latitude,
      ])}
      color="#f9a8d4"
      width={2}
      opacity={0.45}
      dashArray={[2, 2]}
      active
      activeColor={project.accent}
      activeWidth={4}
      activeOpacity={0.95}
      activeDashArray={[1.5, 1.5]}
      progress={progress}
    >
      <RouteProgress
        color="#fff7ed"
        width={5}
        opacity={0.9}
        dashArray={[1, 1]}
      />
    </MapRoute>
  );
}

function PropertyPin({
  accent,
  projectName,
  selected = false,
  onSelect,
}: {
  accent: string;
  projectName: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`View ${projectName} project details`}
      className={`relative h-10 w-10 transition-transform ${
        selected ? "scale-125" : ""
      }`}
    >
      <span
        className={`absolute inset-0 rounded-full opacity-30 ${
          selected ? "animate-ping" : "animate-pulse"
        }`}
        style={{ backgroundColor: accent, boxShadow: `0 0 24px ${accent}` }}
      />
      <span
        className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg"
        style={{ backgroundColor: accent }}
      >
        <Building2 className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </span>
      <span
        className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white"
        style={{ backgroundColor: accent }}
      />
    </button>
  );
}

function FitProjectPins({ projects }: { projects: MapPinProject[] }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || projects.length === 0) return;

    const longitudes = projects.map((project) => project.longitude);
    const latitudes = projects.map((project) => project.latitude);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ];

    map.fitBounds(bounds, {
      padding: { top: 150, right: 100, bottom: 170, left: 100 },
      maxZoom: 10.5,
      duration: 650,
    });
  }, [isLoaded, map, projects]);

  return null;
}

function FocusProjectPin({
  project,
}: {
  project?: PropertyProject;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || !project) return;

    map.flyTo({
      center: [project.longitude, project.latitude],
      zoom: 13.5,
      duration: 900,
      essential: true,
    });
  }, [isLoaded, map, project]);

  return null;
}

function RadiusFilterLayer({
  center,
  radiusInKilometers,
}: {
  center: MapCoordinate;
  radiusInKilometers: number;
}) {
  const { map, isLoaded } = useMap();
  const radiusPolygon = useMemo(
    () => createRadiusPolygon(center, radiusInKilometers),
    [center, radiusInKilometers],
  );

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.flyTo({
      center,
      zoom: Math.max(map.getZoom(), 9.75),
      duration: 900,
      essential: true,
    });
  }, [center, isLoaded, map]);

  return (
    <MapGeoJSON
      id="active-radius-filter"
      data={radiusPolygon}
      fillPaint={{
        "fill-color": "#22d3ee",
        "fill-opacity": 0.1,
      }}
      linePaint={{
        "line-color": "#67e8f9",
        "line-width": 2,
        "line-opacity": 0.95,
        "line-dasharray": [2, 2],
      }}
    />
  );
}

function DigitizedLakesLayer({
  visible,
  checkedProject,
  onLakeSelect,
  onMapTap,
  onProjectCheck,
}: {
  visible: boolean;
  checkedProject?: PropertyProject;
  onLakeSelect: (lake: LakeCheck) => void;
  onMapTap: () => void;
  onProjectCheck: (lake: LakeCheck | null) => void;
}) {
  const { map, isLoaded } = useMap();
  const latestLakeSelect = useRef(onLakeSelect);
  const latestMapTap = useRef(onMapTap);
  const latestProjectCheck = useRef(onProjectCheck);
  latestLakeSelect.current = onLakeSelect;
  latestMapTap.current = onMapTap;
  latestProjectCheck.current = onProjectCheck;

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "digitized-lakes-source";
    const fillLayerId = "digitized-lakes-fill";
    const lineLayerId = "digitized-lakes-line";

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "vector",
        tiles: [LAKES_TILE_URL],
        minzoom: 5,
        maxzoom: 16,
        attribution: "Digitized lake data © 1acre.in",
      });
    }

    if (!map.getLayer(fillLayerId)) {
      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        "source-layer": "lakes_map",
        minzoom: 5,
        maxzoom: 18,
        paint: {
          "fill-color": "#22d3ee",
          "fill-opacity": 0.32,
        },
        layout: { visibility: "none" },
      });
    }

    if (!map.getLayer(lineLayerId)) {
      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        "source-layer": "lakes_map",
        minzoom: 5,
        maxzoom: 18,
        paint: {
          "line-color": "#0e7490",
          "line-width": 2,
          "line-opacity": 0.95,
        },
        layout: { visibility: "none" },
      });
    }

    const handleLakeClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const properties = feature?.properties ?? {};
      latestLakeSelect.current(
        getLakeCheck(
          properties,
          event.lngLat.lng,
          event.lngLat.lat,
          feature?.geometry,
        ),
      );
    };
    const handleLakeMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLakeMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    const handleMapTap = () => {
      latestMapTap.current();
    };

    map.on("click", fillLayerId, handleLakeClick);
    map.on("mouseenter", fillLayerId, handleLakeMouseEnter);
    map.on("mouseleave", fillLayerId, handleLakeMouseLeave);
    map.on("click", handleMapTap);

    return () => {
      map.off("click", fillLayerId, handleLakeClick);
      map.off("mouseenter", fillLayerId, handleLakeMouseEnter);
      map.off("mouseleave", fillLayerId, handleLakeMouseLeave);
      map.off("click", handleMapTap);
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [isLoaded, map]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    for (const layerId of ["digitized-lakes-fill", "digitized-lakes-line"]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    }
  }, [isLoaded, map, visible]);

  useEffect(() => {
    if (!map || !isLoaded || !visible || !checkedProject) {
      latestProjectCheck.current(null);
      return;
    }

    const checkProject = () => {
      if (!map.getLayer("digitized-lakes-fill")) return;
      const point = map.project({
        lng: checkedProject.longitude,
        lat: checkedProject.latitude,
      });
      const features = map.queryRenderedFeatures(point, {
        layers: ["digitized-lakes-fill"],
      });
      const feature = features[0];
      const properties = feature?.properties;
      latestProjectCheck.current(
        properties
          ? getLakeCheck(
              properties,
              checkedProject.longitude,
              checkedProject.latitude,
              feature?.geometry,
            )
          : null,
      );
    };

    checkProject();
    map.on("idle", checkProject);
    map.on("moveend", checkProject);
    return () => {
      map.off("idle", checkProject);
      map.off("moveend", checkProject);
    };
  }, [
    checkedProject?.id,
    checkedProject?.latitude,
    checkedProject?.longitude,
    isLoaded,
    map,
    visible,
  ]);

  return null;
}

function OuterRingRoadLayer() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || !map.getSource("carto")) return;

    const casingLayerId = "outer-ring-road-highlight-casing";
    const highlightLayerId = "outer-ring-road-highlight";
    const beforeId = map.getLayer("roadname_major")
      ? "roadname_major"
      : undefined;

    map.addLayer(
      {
        id: casingLayerId,
        type: "line",
        source: "carto",
        "source-layer": "transportation_name",
        filter: [
          "any",
          ["==", "name", "Outer Ring Road"],
          ["==", "name", "Nehru Outer Ring Road"],
          ["==", "name_en", "Outer Ring Road"],
          ["==", "name_en", "Nehru Outer Ring Road"],
          ["==", "name:en", "Outer Ring Road"],
          ["==", "ref", "ORR"],
        ],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#4a2b00",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            1.5,
            9,
            2.5,
            12,
            5,
            16,
            13,
          ],
          "line-opacity": 0.95,
          "line-blur": 1,
        },
      },
      beforeId,
    );
    map.addLayer(
      {
        id: highlightLayerId,
        type: "line",
        source: "carto",
        "source-layer": "transportation_name",
        filter: [
          "any",
          ["==", "name", "Outer Ring Road"],
          ["==", "name", "Nehru Outer Ring Road"],
          ["==", "name_en", "Outer Ring Road"],
          ["==", "name_en", "Nehru Outer Ring Road"],
          ["==", "name:en", "Outer Ring Road"],
          ["==", "ref", "ORR"],
        ],
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#f6bd45",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.75,
            9,
            1.5,
            12,
            3,
            16,
            8,
          ],
          "line-opacity": 1,
        },
      },
      beforeId,
    );

    return () => {
      if (map.getLayer(highlightLayerId)) map.removeLayer(highlightLayerId);
      if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
    };
  }, [isLoaded, map]);

  return null;
}

function RegionalRingRoadLayer({ visible }: { visible: boolean }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "regional-ring-road-source";
    const casingLayerId = "regional-ring-road-casing";
    const highlightLayerId = "regional-ring-road-highlight";

    const ensureLayers = () => {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {
              name: "Proposed Regional Ring Road",
              ref: "RRR",
            },
            geometry: {
              type: "LineString",
              coordinates: RRR_ALIGNMENT_COORDINATES,
            },
          },
        });
      }

      const beforeId = map.getLayer("roadname_major")
        ? "roadname_major"
        : undefined;

      if (!map.getLayer(casingLayerId)) {
        map.addLayer(
          {
            id: casingLayerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-cap": "round",
              "line-join": "round",
              visibility: visible ? "visible" : "none",
            },
            paint: {
              "line-color": "#201047",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                2.5,
                9,
                4,
                12,
                8,
                16,
                20,
              ],
              "line-opacity": 0.95,
              "line-blur": 1,
            },
          },
          beforeId,
        );
      }

      if (!map.getLayer(highlightLayerId)) {
        map.addLayer(
          {
            id: highlightLayerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-cap": "round",
              "line-join": "round",
              visibility: visible ? "visible" : "none",
            },
            paint: {
              "line-color": "#c084fc",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                5,
                1,
                9,
                2,
                12,
                4,
                16,
                10,
              ],
              "line-opacity": 0.98,
              "line-dasharray": [1, 1.25],
            },
          },
          beforeId,
        );
      }

      for (const layerId of [casingLayerId, highlightLayerId]) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            "visibility",
            visible ? "visible" : "none",
          );
        }
      }
    };

    ensureLayers();
    map.on("styledata", ensureLayers);

    return () => {
      map.off("styledata", ensureLayers);
      if (map.getLayer(highlightLayerId)) map.removeLayer(highlightLayerId);
      if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [isLoaded, map, visible]);

  useEffect(() => {
    if (!map || !isLoaded || !visible) return;

    const longitudes = RRR_ALIGNMENT_COORDINATES.map(([longitude]) => longitude);
    const latitudes = RRR_ALIGNMENT_COORDINATES.map(([, latitude]) => latitude);
    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      {
        padding: { top: 150, right: 100, bottom: 180, left: 100 },
        maxZoom: 9.1,
        duration: 850,
      },
    );
  }, [isLoaded, map, visible]);

  return null;
}

function RadiusArcControl({
  radiusInKilometers,
  onRadiusChange,
  visibleProjectCount,
  isDarkMap,
}: {
  radiusInKilometers: number;
  onRadiusChange: (radius: number) => void;
  visibleProjectCount: number;
  isDarkMap: boolean;
}) {
  const minimumRadius = 5;
  const maximumRadius = 100;
  const progress =
    (radiusInKilometers - minimumRadius) / (maximumRadius - minimumRadius);
  const centerX = 140;
  const centerY = 122;
  const arcRadius = 101;
  const angle = Math.PI + progress * Math.PI;
  const handleX = centerX + arcRadius * Math.cos(angle);
  const handleY = centerY + arcRadius * Math.sin(angle);
  const arcPath = "M 39 122 A 101 101 0 0 1 241 122";
  const [isDragging, setIsDragging] = useState(false);

  const updateRadiusFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 280;
    const y = ((event.clientY - bounds.top) / bounds.height) * 150;
    let pointerAngle = Math.atan2(y - centerY, x - centerX);

    if (pointerAngle < Math.PI) pointerAngle += Math.PI * 2;
    const nextProgress = Math.min(
      1,
      Math.max(0, (pointerAngle - Math.PI) / Math.PI),
    );
    const nextRadius =
      Math.round(
        (minimumRadius + nextProgress * (maximumRadius - minimumRadius)) / 5,
      ) * 5;

    onRadiusChange(Math.min(maximumRadius, Math.max(minimumRadius, nextRadius)));
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    updateRadiusFromPointer(event);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) updateRadiusFromPointer(event);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 24, stiffness: 300 }}
      className={`pointer-events-auto relative h-[142px] w-[282px] overflow-visible px-0 pt-0 ${
        isDarkMap ? "text-white" : "text-slate-950"
      }`}
      aria-label="Adjust search radius"
    >
      <button
        type="button"
        onClick={() => onRadiusChange(minimumRadius)}
        className={`absolute right-3 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
          isDarkMap
            ? "text-white/65 hover:bg-white/10 hover:text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
        aria-label="Reset search radius to 5 kilometres"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <svg
        viewBox="0 0 280 150"
        className={`h-[124px] w-full touch-none select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } focus:outline-none focus-visible:outline-none`}
        role="slider"
        aria-label="Drag to adjust search radius"
        aria-valuemin={minimumRadius}
        aria-valuemax={maximumRadius}
        aria-valuenow={radiusInKilometers}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onRadiusChange(Math.max(minimumRadius, radiusInKilometers - 5));
          }
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onRadiusChange(Math.min(maximumRadius, radiusInKilometers + 5));
          }
        }}
      >
        <path
          d={arcPath}
          fill="none"
          stroke={isDarkMap ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.16)"}
          strokeLinecap="round"
          strokeWidth="25"
        />
        <motion.path
          d={arcPath}
          pathLength={1}
          fill="none"
          stroke={isDarkMap ? "#d7d8dc" : "#0891b2"}
          strokeLinecap="round"
          strokeWidth="25"
          animate={{ strokeDasharray: `${progress} 1` }}
          transition={{ type: "spring", damping: 24, stiffness: 180 }}
        />
        <path
          d={arcPath}
          fill="none"
          stroke={isDarkMap ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.38)"}
          strokeLinecap="round"
          strokeWidth="2"
        />
        <motion.circle
          cx={handleX}
          cy={handleY}
          r="12"
          fill={isDarkMap ? "#d7d8dc" : "#0891b2"}
          stroke={isDarkMap ? "#ffffff" : "#ffffff"}
          strokeWidth="2"
          animate={{ cx: handleX, cy: handleY }}
          transition={{ type: "spring", damping: 24, stiffness: 180 }}
          style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.35))" }}
        />
        <circle
          cx={centerX}
          cy={centerY}
          r="36"
          fill={isDarkMap ? "#050505" : "#f8fafc"}
          stroke={
            isDarkMap ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.16)"
          }
          strokeWidth="1"
        />
        <text
          x={centerX}
          y="112"
          fill={isDarkMap ? "white" : "#0f172a"}
          textAnchor="middle"
          className="text-[22px] font-bold"
        >
          {radiusInKilometers} km
        </text>
        <text
          x={centerX}
          y="130"
          fill={isDarkMap ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.58)"}
          textAnchor="middle"
          className="text-[8px] font-bold uppercase tracking-[0.14em]"
        >
          {visibleProjectCount} projects nearby
        </text>
      </svg>
      <p
        className={`absolute bottom-0 left-0 right-0 text-center text-[8px] font-semibold uppercase tracking-[0.14em] drop-shadow-sm ${
          isDarkMap ? "text-white/55" : "text-slate-700"
        }`}
      >
        Drag the arc to expand or compress
      </p>
    </motion.div>
  );
}

export function HyderabadPropertyMapThumbnail() {
  const previewZoom = 10;
  const tileSize = 256;
  const thumbnailWidth = 132;
  const thumbnailHeight = 76;
  const centerX =
    ((HYDERABAD_CENTER[0] + 180) / 360) * 2 ** previewZoom;
  const centerY =
    ((1 -
      Math.asinh(
        Math.tan((HYDERABAD_CENTER[1] * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
    2 ** previewZoom;
  const tileOriginX = Math.floor(centerX) - 1;
  const tileOriginY = Math.floor(centerY) - 1;
  const tilePositions = Array.from({ length: 9 }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const tileX = tileOriginX + column;
    const tileY = tileOriginY + row;

    return {
      src: `https://tile.openstreetmap.de/${previewZoom}/${tileX}/${tileY}.png`,
      left: (tileX - centerX) * tileSize + thumbnailWidth / 2,
      top: (tileY - centerY) * tileSize + thumbnailHeight / 2,
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-[#121b2a]">
      <div className="absolute inset-0 overflow-hidden bg-[#121b2a]">
        {tilePositions.map((tile) => (
          <img
            key={tile.src}
            src={tile.src}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: tileSize,
              height: tileSize,
              left: tile.left,
              top: tile.top,
              filter:
                "grayscale(1) invert(0.9) brightness(0.72) contrast(1.4)",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(8,8,10,0.24),rgba(36,36,40,0.02)_46%,rgba(6,6,8,0.34))]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0b0b0d]/45 to-transparent" />
    </div>
  );
}

export type ProjectListingDetails = {
  imageUrl?: string;
  startingPrice?: string;
  availablePlots?: number;
  about?: string;
  locationDetail?: string;
  rera?: string;
  loan?: string;
  amenities?: string[];
};

const ASTA_MEADOWS_DETAILS: ProjectListingDetails = {
  imageUrl:
    "https://plotsview.com/api/storage/objects/uploads/81f67f12-84bc-412a-a6d3-63be7123350f",
  startingPrice: "₹1.40 Cr onwards",
  availablePlots: 46,
  about:
    "Premium HMDA & RERA approved villa plots located at Beeramguda – BHEL, one of Hyderabad’s fastest-growing residential corridors. Spread across 15+ acres, the project offers well-planned villa plots with 100% Vastu-compliant layout, wide CC roads, and underground infrastructure. Designed for luxury living and long-term investment.",
  locationDetail: "Beeramguda – BHEL, Telangana, India",
  rera: "RERA approved",
  loan: "Loan Calculator available on PlotsView",
  amenities: [
    "Pickle ball court",
    "Tennis court",
    "Children's play area",
    "Central lawn for yoga",
    "Meridian landscape",
    "Cricket pitch",
    "OAT seating",
    "Open fitness area",
  ],
};

const PROJECT_LISTING_DETAILS: Record<string, ProjectListingDetails> = {
  "asta-meadows": ASTA_MEADOWS_DETAILS,
};

export function getProjectListingDetails(project: PropertyProject) {
  return PROJECT_LISTING_DETAILS[project.slug] ?? {};
}

function DetailValue({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon: typeof MapPin;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-sm font-bold leading-tight text-slate-800">
        {value}
      </p>
    </div>
  );
}

function ProjectDetailSheet({
  project,
  onClose,
  currency,
  rates,
}: {
  project: PropertyProject;
  onClose: () => void;
  currency: DisplayCurrency;
  rates: DailyInrExchangeRates | null;
}) {
  const details = getProjectListingDetails(project);
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`;

  return (
    <motion.section
      initial={{ y: "100%", opacity: 0.8 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-white text-slate-900 shadow-[0_-18px_60px_rgba(15,23,42,0.28)]"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} project details`}
    >
      <div className="shrink-0 bg-white px-4 pb-3 pt-2.5 sm:px-5">
        <div className="mx-auto mb-2.5 h-1 w-12 rounded-full bg-slate-300" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-slate-950">
              {project.name}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-violet-500" />
              {details.locationDetail ?? `${project.locality}, Telangana`}
              <span className="text-slate-300">·</span>
              PlotsView listing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close project details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-5">
        <div className="relative mb-4 h-44 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-100 via-slate-100 to-cyan-50">
          {details.imageUrl ? (
            <img
              src={details.imageUrl}
              alt={`${project.name} layout`}
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(135deg,transparent_24%,rgba(124,58,237,.2)_25%,transparent_26%,transparent_49%,rgba(124,58,237,.2)_50%,transparent_51%,transparent_74%,rgba(124,58,237,.2)_75%,transparent_76%)] [background-size:42px_42px]" />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/35 to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 backdrop-blur-sm">
                <House className="h-3.5 w-3.5 text-violet-600" />
                {project.type}
              </div>
            </>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm">
            <BadgeCheck className="h-3.5 w-3.5" />
            Verified listing
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <DetailValue
            label="Price"
            value={
              <FormattedCurrencyText
                value={formatProjectPrice(project.price, currency, rates)}
              />
            }
            icon={Banknote}
          />
          <DetailValue label="Plot sizes" value={project.bedrooms} icon={Ruler} />
          <DetailValue
            label="Total plots"
            value={project.totalPlots.toLocaleString("en-IN")}
            icon={House}
          />
          <DetailValue
            label="Project area"
            value={`${project.acres} acres`}
            icon={Maximize2}
          />
          {details.startingPrice && (
            <DetailValue
              label="Starting from"
              value={
                <FormattedCurrencyText
                  value={formatStartingPrice(
                    details.startingPrice,
                    currency,
                    rates,
                  )}
                />
              }
              icon={Banknote}
            />
          )}
          {details.availablePlots !== undefined && (
            <DetailValue
              label="Available"
              value={`${details.availablePlots} plots`}
              icon={Check}
            />
          )}
        </div>

        <div className="space-y-3">
          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Info className="h-4 w-4 text-violet-600" />
              About this project
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {details.about ??
                `${project.name} is a ${project.type.toLowerCase()} project in ${project.locality}. View the full project description, documents, and current availability on PlotsView.`}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              Approvals & documentation
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700/70">
                  Approval
                </p>
                <p className="mt-1 text-sm font-bold text-emerald-900">
                  {project.approvalType} approved
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/70">
                  RERA
                </p>
                <p className="mt-1 text-sm font-bold text-blue-900">
                  {details.rera ?? "Not listed"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Verify approval documents and registration details with the seller
              before making a purchase.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Landmark className="h-4 w-4 text-amber-600" />
              Location & connectivity
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {details.locationDetail ?? `${project.locality}, Telangana, India`}
            </p>
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:underline"
            >
              <Navigation className="h-3.5 w-3.5" />
              Open location in Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Trees className="h-4 w-4 text-green-600" />
              Amenities
            </h3>
            {details.amenities?.length ? (
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                {details.amenities.map((amenity) => (
                  <div
                    key={amenity}
                    className="flex items-start gap-2 text-xs text-slate-600"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {amenity}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Amenities are not listed in the imported catalog.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Banknote className="h-4 w-4 text-violet-600" />
              Loan & purchase information
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {details.loan ??
                "Loan information is not listed in the imported catalog. Contact the listing team for lender and eligibility details."}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Final loan approval, interest rate, and eligibility depend on the
              lender’s legal, technical, and borrower checks.
            </p>
          </section>
        </div>

      </div>
    </motion.section>
  );
}

function DubaiProjectDetailSheet({
  project,
  onClose,
}: {
  project: DubaiPropertyProject;
  onClose: () => void;
}) {
  const mapSearch = encodeURIComponent(
    `${project.locality}, Dubai, United Arab Emirates`,
  );

  return (
    <motion.section
      initial={{ y: "100%", opacity: 0.8 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[75vh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-white p-5 text-slate-900 shadow-[0_-18px_60px_rgba(15,23,42,0.28)]"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} Dubai project details`}
    >
      <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
            {project.developer}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {project.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          aria-label="Close project details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600">
        <MapPin className="mt-1 h-4 w-4 shrink-0 text-violet-600" />
        {project.locality}, Dubai
      </p>
      {project.note && (
        <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm leading-6 text-violet-950">
          {project.note}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapSearch}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-violet-600"
        >
          <Navigation className="h-3.5 w-3.5" />
          Open community in Maps
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href={project.developerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Developer website
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </motion.section>
  );
}

export function HyderabadPropertyMapOverlay({
  onClose,
  initialProjectId = null,
}: {
  onClose: () => void;
  initialProjectId?: string | null;
}) {
  const [activeCity, setActiveCity] = useState<"hyderabad" | "dubai">(
    "hyderabad",
  );
  const [selectedDubaiDeveloper, setSelectedDubaiDeveloper] = useState<
    string | null
  >(null);
  const [selectedDubaiRouteProjectId, setSelectedDubaiRouteProjectId] =
    useState<string | null>(null);
  const [dubaiRouteProgress, setDubaiRouteProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [showMapInfo, setShowMapInfo] = useState(false);
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<
    string | null
  >(null);
  const [magicPropertyFilters, setMagicPropertyFilters] =
    useState<MagicPropertyFilters>(DEFAULT_MAGIC_PROPERTY_FILTERS);
  const [isMagicFiltersOpen, setIsMagicFiltersOpen] = useState(false);
  const [selectedPinProjectId, setSelectedPinProjectId] = useState<string | null>(
    null,
  );
  const [routeProgress, setRouteProgress] = useState(0);
  const [isDarkMap, setIsDarkMap] = useState(true);
  const [isSatelliteMap, setIsSatelliteMap] = useState(false);
  const [showLakes, setShowLakes] = useState(false);
  const [isMasterPlanSelected, setIsMasterPlanSelected] = useState(false);
  const [masterPlanMapGroup, setMasterPlanMapGroup] =
    useState<HmdaMasterPlanGroup>("plan-2031");
  const [masterPlanSearch, setMasterPlanSearch] = useState("");
  const [selectedMasterPlanMapId, setSelectedMasterPlanMapId] = useState(
    HMDA_MASTER_PLAN_MAPS[0].id,
  );
  const [masterPlanImageLoading, setMasterPlanImageLoading] = useState(true);
  const [masterPlanImageFailed, setMasterPlanImageFailed] = useState(false);
  const [showProjectPins, setShowProjectPins] = useState(true);
  const [showCityLayers, setShowCityLayers] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [visibleContextCategories, setVisibleContextCategories] = useState<
    Record<CityContextCategory, boolean>
  >({
    airports: true,
    industries: true,
    sez: true,
    commercial: true,
    metro: true,
    "data-centers": true,
    "power-plants": true,
  });
  const [selectedContextPoint, setSelectedContextPoint] =
    useState<CityContextPoint | null>(null);
  const [showLakeHelp, setShowLakeHelp] = useState(false);
  const [selectedLake, setSelectedLake] = useState<LakeCheck | null>(null);
  const [checkedProjectLake, setCheckedProjectLake] = useState<LakeCheck | null>(
    null,
  );
  const [showProjectList, setShowProjectList] = useState(false);
  const [listSort, setListSort] = useState<"price" | "rate" | "size">("price");
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>(() => detectDefaultDisplayCurrency());
  const [currencyOptionsOpen, setCurrencyOptionsOpen] = useState(false);
  const [exchangeRates, setExchangeRates] =
    useState<DailyInrExchangeRates | null>(null);
  const [isRadiusFilterOpen, setIsRadiusFilterOpen] = useState(false);
  const [radiusInKilometers, setRadiusInKilometers] = useState(25);
  const [userLocation, setUserLocation] = useState<MapCoordinate | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "ready" | "fallback"
  >("idle");
  const radiusCenter =
    activeCity === "dubai" ? DUBAI_MAP_CENTER : userLocation;

  const selectedIntent = MAGIC_INTENTS.find(
    (intent) => intent.id === selectedIntentId,
  );
  const selectedSubcategory = selectedIntent?.subcategories.find(
    (subcategory) => subcategory.id === selectedSubcategoryId,
  );
  const activeMagicFilterCount =
    Number(magicPropertyFilters.maxBudget < MAGIC_BUDGET_MAX) +
    Number(magicPropertyFilters.minimumPlotSize > 0) +
    Number(magicPropertyFilters.approval !== "any") +
    Number(magicPropertyFilters.activeOnly) +
    Number(Boolean(selectedIntent)) +
    Number(Boolean(selectedSubcategory));
  const formatMagicBudget = (amountInr: number) => {
    const displayAmount = formatAmountFromInr(
      amountInr,
      displayCurrency,
      exchangeRates,
    );
    return displayAmount === "Rate unavailable"
      ? formatAmountFromInr(amountInr, "INR", null)
      : displayAmount;
  };
  const visibleMasterPlanMaps = useMemo(() => {
    const normalizedSearch = masterPlanSearch.trim().toLowerCase();
    return HMDA_MASTER_PLAN_MAPS.filter(
      (mapSheet) =>
        mapSheet.group === masterPlanMapGroup &&
        (!normalizedSearch ||
          mapSheet.area.toLowerCase().includes(normalizedSearch)),
    );
  }, [masterPlanMapGroup, masterPlanSearch]);
  const selectedMasterPlanMap =
    visibleMasterPlanMaps.find(
      (mapSheet) => mapSheet.id === selectedMasterPlanMapId,
    ) ?? visibleMasterPlanMaps[0];

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return PROJECTS.filter((project) => {
      const matchesMagicFilter =
        !selectedIntent ||
        (selectedIntent.filter(project) &&
          (!selectedSubcategory || selectedSubcategory.filter(project)));
      const matchesQuery =
        !normalizedQuery ||
        `${project.name} ${project.locality} ${project.developer}`
          .toLowerCase()
          .includes(normalizedQuery);
      const estimatedBudget = getEstimatedMinimumPlotValue(project);
      const startingPlotSize = getMinimumPlotSize(project);
      const matchesBudget =
        magicPropertyFilters.maxBudget >= MAGIC_BUDGET_MAX ||
        (estimatedBudget > 0 &&
          estimatedBudget <= magicPropertyFilters.maxBudget);
      const matchesPlotSize =
        magicPropertyFilters.minimumPlotSize <= 0 ||
        (startingPlotSize > 0 &&
          startingPlotSize >= magicPropertyFilters.minimumPlotSize);
      const matchesApproval =
        magicPropertyFilters.approval === "any" ||
        project.approvalType === magicPropertyFilters.approval ||
        (magicPropertyFilters.approval === "other" &&
          project.approvalType !== "HMDA" &&
          project.approvalType !== "DTCP");
      const matchesListingStatus =
        !magicPropertyFilters.activeOnly ||
        project.status.toLowerCase().includes("active");
      const matchesRadius =
        !isRadiusFilterOpen ||
        !userLocation ||
        distanceInKilometers(userLocation, [
          project.longitude,
          project.latitude,
        ]) <= radiusInKilometers;
      return (
        matchesMagicFilter &&
        matchesQuery &&
        matchesBudget &&
        matchesPlotSize &&
        matchesApproval &&
        matchesListingStatus &&
        matchesRadius
      );
    });
  }, [
    isRadiusFilterOpen,
    magicPropertyFilters,
    query,
    radiusInKilometers,
    selectedIntent,
    selectedSubcategory,
    userLocation,
  ]);

  const visibleDubaiProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return DUBAI_PROPERTY_PROJECTS.filter((project) => {
      const matchesDeveloper =
        !selectedDubaiDeveloper ||
        project.developer === selectedDubaiDeveloper;
      const matchesQuery =
        !normalizedQuery ||
        `${project.name} ${project.locality} ${project.developer} ${project.note ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesRadius =
        !isRadiusFilterOpen ||
        !radiusCenter ||
        distanceInKilometers(radiusCenter, [
          project.longitude,
          project.latitude,
        ]) <= radiusInKilometers;
      return matchesDeveloper && matchesQuery && matchesRadius;
    });
  }, [
    isRadiusFilterOpen,
    query,
    radiusCenter,
    radiusInKilometers,
    selectedDubaiDeveloper,
  ]);

  const sortedVisibleProjects = useMemo(() => {
    return [...visibleProjects].sort((a, b) => {
      if (listSort === "rate") {
        return getPricePerSquareYard(a) - getPricePerSquareYard(b);
      }
      if (listSort === "size") {
        return a.acres - b.acres;
      }
      return getEstimatedMinimumPlotValue(a) - getEstimatedMinimumPlotValue(b);
    });
  }, [listSort, visibleProjects]);

  const visibleHyderabadMapProjects =
    activeCity === "hyderabad" && !showCityLayers && showProjectPins
      ? visibleProjects
      : [];
  const visibleMapProjects: MapPinProject[] =
    activeCity === "dubai"
      ? showProjectPins
        ? visibleDubaiProjects
        : []
      : visibleHyderabadMapProjects;
  const visibleProjectCount =
    activeCity === "dubai" ? visibleDubaiProjects.length : visibleProjects.length;
  const contextCategoriesForMap: Record<CityContextCategory, boolean> =
    showCityLayers
      ? visibleContextCategories
      : {
          airports: false,
          industries: false,
          sez: false,
          commercial: false,
          metro: false,
          "data-centers": false,
          "power-plants": false,
        };
  const routeProjectIds = visibleHyderabadMapProjects
    .map((project) => project.id)
    .join(",");
  const selectedPinProject =
    activeCity === "hyderabad"
      ? PROJECTS.find((project) => project.id === selectedPinProjectId)
      : undefined;
  const selectedDubaiProject =
    activeCity === "dubai"
      ? DUBAI_PROPERTY_PROJECTS.find(
          (project) => project.id === selectedPinProjectId,
        )
      : undefined;
  const selectedDubaiRouteProject =
    activeCity === "dubai"
      ? visibleDubaiProjects.find(
          (project) => project.id === selectedDubaiRouteProjectId,
        )
      : undefined;

  useEffect(() => {
    if (
      selectedPinProjectId &&
      !visibleMapProjects.some((project) => project.id === selectedPinProjectId)
    ) {
      setSelectedPinProjectId(null);
    }
  }, [selectedPinProjectId, visibleMapProjects]);

  useEffect(() => {
    if (
      selectedDubaiRouteProjectId &&
      !visibleDubaiProjects.some(
        (project) => project.id === selectedDubaiRouteProjectId,
      )
    ) {
      setSelectedDubaiRouteProjectId(null);
    }
  }, [selectedDubaiRouteProjectId, visibleDubaiProjects]);

  const visibleContextPoints = useMemo(
    () =>
      showCityLayers
        ? CITY_CONTEXT_POINTS.filter(
            (point) => visibleContextCategories[point.category],
          )
        : [],
    [showCityLayers, visibleContextCategories],
  );
  const initialProject = PROJECTS.find(
    (project) => activeCity === "hyderabad" && project.id === initialProjectId,
  );

  useEffect(() => {
    setSelectedPinProjectId(initialProjectId);
    if (initialProjectId) {
      setQuery("");
      setSelectedIntentId(null);
      setSelectedSubcategoryId(null);
    }
  }, [initialProjectId]);

  useEffect(() => {
    if (!showCityLayers) return;
    setSelectedPinProjectId(null);
    setShowProjectList(false);
    setIsRadiusFilterOpen(false);
    setSelectedContextPoint(null);
  }, [showCityLayers]);

  useEffect(() => {
    if (
      showCityLayers ||
      !selectedIntent ||
      !selectedSubcategory ||
      visibleMapProjects.length === 0
    ) {
      setRouteProgress(0);
      return;
    }

    setRouteProgress(0);
    const startedAt = performance.now();
    let frame = 0;
    const animateRoute = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 850);
      setRouteProgress(progress);
      if (progress < 1) frame = requestAnimationFrame(animateRoute);
    };
    frame = requestAnimationFrame(animateRoute);
    return () => cancelAnimationFrame(frame);
  }, [
    routeProjectIds,
    selectedIntent,
    selectedSubcategory,
    showCityLayers,
    visibleMapProjects.length,
  ]);

  useEffect(() => {
    if (
      activeCity !== "dubai" ||
      !selectedDubaiRouteProject ||
      !showProjectPins
    ) {
      setDubaiRouteProgress(0);
      return;
    }

    setDubaiRouteProgress(0);
    const startedAt = performance.now();
    let frame = 0;
    const animateRoute = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 850);
      setDubaiRouteProgress(progress);
      if (progress < 1) frame = requestAnimationFrame(animateRoute);
    };
    frame = requestAnimationFrame(animateRoute);
    return () => cancelAnimationFrame(frame);
  }, [activeCity, selectedDubaiRouteProject?.id, showProjectPins]);

  const chooseMagicIntent = (intentId: string) => {
    const intent = MAGIC_INTENTS.find((item) => item.id === intentId);
    if (!intent) return;

    if (selectedIntentId === intentId) {
      setSelectedIntentId(null);
      setSelectedSubcategoryId(null);
      return;
    }

    setSelectedIntentId(intentId);
    setSelectedSubcategoryId(null);
    setQuery("");
  };

  const chooseMagicSubcategory = (subcategoryId: string) => {
    setSelectedSubcategoryId(subcategoryId);
    setQuery("");
  };

  const resetMagicFilters = () => {
    setSelectedIntentId(null);
    setSelectedSubcategoryId(null);
    setMagicPropertyFilters(DEFAULT_MAGIC_PROPERTY_FILTERS);
  };

  const selectMasterPlanGroup = (group: HmdaMasterPlanGroup) => {
    setMasterPlanMapGroup(group);
    setMasterPlanSearch("");
    setMasterPlanImageLoading(true);
    setMasterPlanImageFailed(false);
    const firstMap = HMDA_MASTER_PLAN_MAPS.find(
      (mapSheet) => mapSheet.group === group,
    );
    if (firstMap) setSelectedMasterPlanMapId(firstMap.id);
  };

  const searchMasterPlanMaps = (value: string) => {
    setMasterPlanSearch(value);
    const normalizedSearch = value.trim().toLowerCase();
    if (!normalizedSearch) return;

    const firstMatch = HMDA_MASTER_PLAN_MAPS.find(
      (mapSheet) =>
        mapSheet.group === masterPlanMapGroup &&
        mapSheet.area.toLowerCase().includes(normalizedSearch),
    );
    if (firstMatch) {
      setSelectedMasterPlanMapId(firstMatch.id);
      setMasterPlanImageLoading(true);
      setMasterPlanImageFailed(false);
    }
  };

  useEffect(() => {
    if (
      !isRadiusFilterOpen ||
      activeCity === "dubai" ||
      locationStatus !== "idle"
    ) {
      return;
    }

    if (!("geolocation" in navigator)) {
      setUserLocation(HYDERABAD_CENTER);
      setLocationStatus("fallback");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([
          position.coords.longitude,
          position.coords.latitude,
        ]);
        setLocationStatus("ready");
      },
      () => {
        setUserLocation(HYDERABAD_CENTER);
        setLocationStatus("fallback");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );
  }, [activeCity, isRadiusFilterOpen, locationStatus]);

  const toggleRadiusFilter = () => {
    setIsRadiusFilterOpen((open) => {
      if (open) setLocationStatus("idle");
      return !open;
    });
  };

  useEffect(() => {
    let isActive = true;
    let controller: AbortController | null = null;

    const refreshRates = async () => {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;

      try {
        const rates = await loadDailyInrExchangeRates(requestController.signal);
        if (!isActive) return;
        setExchangeRates(rates);
      } catch (error) {
        if (!isActive || requestController.signal.aborted) return;
        console.error("Unable to load daily exchange rates", error);
      }
    };

    void refreshRates();
    const refreshInterval = window.setInterval(
      () => void refreshRates(),
      6 * 60 * 60 * 1000,
    );

    return () => {
      isActive = false;
      controller?.abort();
      window.clearInterval(refreshInterval);
    };
  }, []);

  const selectProjectPin = (projectId: string) => {
    if (activeCity === "dubai") setSelectedDubaiRouteProjectId(null);
    setSelectedPinProjectId(projectId);
    setShowLakeHelp(false);
  };

  const selectCity = (city: "hyderabad" | "dubai") => {
    if (city === activeCity) return;
    setActiveCity(city);
    setSelectedDubaiDeveloper(null);
    setSelectedDubaiRouteProjectId(null);
    setQuery("");
    setSelectedIntentId(null);
    setSelectedSubcategoryId(null);
    setSelectedPinProjectId(null);
    setShowProjectList(false);
    setShowCityLayers(false);
    setShowContextPanel(false);
    setIsRadiusFilterOpen(false);
    setShowLakes(false);
    setShowLakeHelp(false);
    setSelectedLake(null);
    setCheckedProjectLake(null);
    setIsMasterPlanSelected(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] overflow-hidden bg-[#07111f]"
      role="dialog"
      aria-modal="true"
      aria-label={`${activeCity === "dubai" ? "Dubai developments" : "Hyderabad properties"} map`}
    >
      <PropertyMap
        key={activeCity}
        center={activeCity === "dubai" ? DUBAI_MAP_CENTER : HYDERABAD_CENTER}
        zoom={activeCity === "dubai" ? 10 : 9}
        theme={isDarkMap ? "dark" : "light"}
        styles={
          isSatelliteMap
            ? { light: SATELLITE_MAP_STYLE, dark: SATELLITE_MAP_STYLE }
            : undefined
        }
        attributionControl={false}
        className="h-full w-full"
      >
        <MapControls
          position="bottom-right"
          showZoom={false}
          showLocate
          className="!bottom-28"
        />
        <FitProjectPins projects={visibleMapProjects} />
        <FocusProjectPin
          project={
            showCityLayers || !showProjectPins ? undefined : initialProject
          }
        />
        {activeCity === "hyderabad" && (
          <>
            <DigitizedLakesLayer
              visible={showLakes}
              checkedProject={selectedPinProject}
              onLakeSelect={(lake) => {
                setSelectedLake(lake);
                setShowLakeHelp(false);
                setCheckedProjectLake(null);
              }}
              onMapTap={() => {
                setShowLakeHelp(false);
                setShowContextPanel(false);
              }}
              onProjectCheck={setCheckedProjectLake}
            />
            <CityContextLayers
              visibleCategories={contextCategoriesForMap}
              show3d={showCityLayers}
            />
            <OuterRingRoadLayer />
            <RegionalRingRoadLayer visible />
          </>
        )}
        {activeCity === "hyderabad" &&
          !showCityLayers &&
          selectedIntent &&
          selectedSubcategory &&
          visibleHyderabadMapProjects.length > 0 && (
            <MagicProjectRoute
              projects={visibleHyderabadMapProjects}
              intent={selectedIntent}
              subcategoryId={selectedSubcategory.id}
              progress={routeProgress}
            />
          )}
        {activeCity === "dubai" &&
          showProjectPins &&
          selectedDubaiRouteProject && (
            <DubaiDeveloperProjectRoute
              key={selectedDubaiRouteProject.id}
              project={selectedDubaiRouteProject}
              progress={dubaiRouteProgress}
            />
          )}
        {isRadiusFilterOpen && radiusCenter && (
          <RadiusFilterLayer
            center={radiusCenter}
            radiusInKilometers={radiusInKilometers}
          />
        )}
        {visibleMapProjects.map((project) => (
          <MapMarker
            key={project.id}
            longitude={project.longitude}
            latitude={project.latitude}
          >
            <MarkerContent>
              <PropertyPin
                accent={project.accent}
                projectName={project.name}
                selected={
                  activeCity === "dubai"
                    ? project.id === selectedDubaiProject?.id ||
                      project.id === selectedDubaiRouteProjectId
                    : project.id === selectedPinProject?.id
                }
                onSelect={() => selectProjectPin(project.id)}
              />
            </MarkerContent>
            <MarkerTooltip>{project.name}</MarkerTooltip>
          </MapMarker>
        ))}
        {visibleContextPoints.map((point) => (
          <MapMarker
            key={point.id}
            longitude={point.longitude}
            latitude={point.latitude}
          >
            <MarkerContent>
              <CityContextPin
                point={point}
                selected={selectedContextPoint?.id === point.id}
                onSelect={() => {
                  setSelectedContextPoint(point);
                  setSelectedPinProjectId(null);
                }}
              />
            </MarkerContent>
            <MarkerTooltip>{point.name}</MarkerTooltip>
          </MapMarker>
        ))}
      </PropertyMap>

      <div className="pointer-events-none absolute inset-0 z-20 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto w-full max-w-[430px]">
            <div className="w-full rounded-2xl border border-white/60 bg-white/90 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeCity === "dubai"
                      ? "Search Dubai projects, developers or areas"
                      : "Search projects, areas or developers"
                  }
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
                  aria-label={
                    activeCity === "dubai"
                      ? "Search Dubai projects, developers or areas"
                      : "Search projects, areas or developers"
                  }
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  selectCity(activeCity === "dubai" ? "hyderabad" : "dubai")
                }
                aria-pressed={activeCity === "dubai"}
                aria-label={
                  activeCity === "dubai"
                    ? "Dubai map is active; switch back to the India map"
                    : "Switch to the Dubai map"
                }
                title={
                  activeCity === "dubai"
                    ? "Dubai map active · click to return to India"
                    : "Switch to Dubai"
                }
                className={`flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                  activeCity === "dubai"
                    ? "border-violet-600 bg-violet-700 text-white shadow-sm"
                    : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                <MapPin className="h-3 w-3" aria-hidden="true" />
                <span>Dubai</span>
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="min-w-0 text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-slate-500">
                {showCityLayers
                  ? `${visibleContextPoints.length} city context markers shown`
                  : activeCity === "dubai"
                    ? `${visibleDubaiProjects.length} of ${DUBAI_PROPERTY_PROJECTS.length} Dubai developments ${showProjectPins ? "pinned" : "found"}`
                    : selectedIntent
                    ? `${visibleProjects.length} ${selectedIntent.label.toLowerCase()} ${showProjectPins ? "shown" : "found"}`
                    : `${visibleProjects.length} of ${PROJECTS.length} projects ${showProjectPins ? "pinned" : "found"}`}
              </p>
              {!showCityLayers && (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Pins
                  </span>
                  <Switch
                    checked={showProjectPins}
                    onCheckedChange={(show) => {
                      setShowProjectPins(show);
                      if (!show) setSelectedPinProjectId(null);
                    }}
                    aria-label="Show project pins on map"
                    className="h-5 w-9 data-[state=checked]:bg-violet-600 data-[state=unchecked]:bg-slate-300 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                  />
                </div>
              )}
            </div>
            </div>
            <div className="mt-2 inline-flex max-w-full items-center gap-0.5 rounded-lg border border-white/15 bg-slate-950/80 px-1 py-1 shadow-md backdrop-blur-md">
              {activeCity === "hyderabad" && (
                <>
              <button
                type="button"
                onClick={() => {
                  setShowLakes((visible) => !visible);
                  setShowLakeHelp((visible) => !visible);
                  setSelectedLake(null);
                  setCheckedProjectLake(null);
                }}
                className={`flex shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 ${
                  showLakes
                    ? "border-cyan-300/60 bg-cyan-500 text-slate-950"
                    : "border-transparent text-white/75 hover:bg-white/10 hover:text-white"
                }`}
                aria-label={showLakes ? "Hide lakes and FTL layer" : "Show lakes and FTL layer"}
                aria-pressed={showLakes}
                title={showLakes ? "Hide lakes and FTL layer" : "Show lakes and FTL layer"}
              >
                <Waves className="h-3 w-3 shrink-0" />
                <span>Lakes</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMasterPlanSelected((selected) => !selected)}
                className={`flex shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 ${
                  isMasterPlanSelected
                    ? "border-violet-300/60 bg-violet-500 text-white"
                    : "border-transparent text-white/75 hover:bg-white/10 hover:text-white"
                }`}
                aria-label={
                  isMasterPlanSelected
                    ? "Close HMDA master plan map viewer"
                    : "Open official HMDA master plan area maps"
                }
                aria-pressed={isMasterPlanSelected}
                title="Browse official HMDA master plan maps"
              >
                <Layers className="h-3 w-3 shrink-0" />
                <span>Master Plan</span>
              </button>
                </>
              )}
              <FlashNewsDialog
                region={activeCity === "dubai" ? "dubai" : "india"}
              />
              </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <div
                className="inline-flex items-center gap-1"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCurrencyOptionsOpen(false);
                }}
              >
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrencyOptionsOpen((isOpen) => !isOpen)
                    }
                    aria-expanded={currencyOptionsOpen}
                    aria-controls="map-currency-options"
                    aria-label={
                      currencyOptionsOpen
                        ? "Close currency options"
                        : `Change price currency; current selection ${displayCurrency}`
                    }
                    title={
                      currencyOptionsOpen
                        ? "Close currency options"
                        : "Change display currency"
                    }
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-slate-950/80 px-2 text-[10px] font-semibold text-white/85 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                  >
                    {currencyOptionsOpen ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <>
                        <span dir="ltr">
                          {displayCurrency === "AED" ? (
                            <UaeDirhamSymbol />
                          ) : (
                            CURRENCY_OPTIONS.find(
                              (option) => option.currency === displayCurrency,
                            )?.symbol ?? "₹"
                          )}
                        </span>
                        <span>{displayCurrency}</span>
                        <ChevronDown className="h-3 w-3 text-white/55" />
                      </>
                    )}
                  </button>
                  {currencyOptionsOpen && (
                    <div
                      id="map-currency-options"
                      role="group"
                      aria-label="Select project display currency"
                      className="inline-flex items-center gap-0.5 rounded-lg border border-white/15 bg-slate-950/80 p-1 shadow-md backdrop-blur-md"
                    >
                    {CURRENCY_OPTIONS.map((option) => {
                      const isSelected = displayCurrency === option.currency;
                      const isUnavailable =
                        option.currency !== "INR" && !exchangeRates;
                      return (
                        <button
                          key={option.currency}
                          type="button"
                          onClick={() => {
                            setDisplayCurrency(option.currency);
                            setCurrencyOptionsOpen(false);
                          }}
                          disabled={isUnavailable}
                          aria-pressed={isSelected}
                          aria-label={`Show project prices in ${option.currency}`}
                          title={
                            isUnavailable
                              ? "Daily exchange rates are unavailable"
                              : `Show prices in ${option.currency}`
                          }
                          className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                            isSelected
                              ? "bg-violet-500 text-white shadow-sm"
                              : "text-white/70 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span dir="ltr">
                            {option.currency === "AED" ? (
                              <UaeDirhamSymbol />
                            ) : (
                              option.symbol
                            )}
                          </span>
                          <span>{option.currency}</span>
                        </button>
                      );
                    })}
                    </div>
                  )}
                </>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/30 bg-slate-950/80 p-3 text-white shadow-xl backdrop-blur-md transition-colors hover:bg-slate-900"
              aria-label="Close PlotsView projects map"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsDarkMap((dark) => !dark)}
              className="rounded-full border border-white/30 bg-slate-950/80 p-2.5 text-white shadow-xl backdrop-blur-md transition-colors hover:bg-slate-900"
              aria-label={isDarkMap ? "Use light map" : "Use dark map"}
              title={isDarkMap ? "Use light map" : "Use dark map"}
            >
              {isDarkMap ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsSatelliteMap((satellite) => !satellite)}
              className={`rounded-full border p-2.5 text-white shadow-xl backdrop-blur-md transition-colors ${
                isSatelliteMap
                  ? "border-cyan-300/80 bg-cyan-950/90"
                  : "border-white/30 bg-slate-950/80 hover:bg-slate-900"
              }`}
              aria-label={
                isSatelliteMap ? "Use street map" : "Use satellite map"
              }
              title={isSatelliteMap ? "Use street map" : "Use satellite map"}
            >
              <Satellite className="h-4 w-4" />
            </button>
            {activeCity === "hyderabad" && (
              <button
                type="button"
                onClick={() =>
                  setShowCityLayers((visible) => {
                    const nextVisible = !visible;
                    setShowContextPanel(nextVisible);
                    return nextVisible;
                  })
                }
                className={`rounded-full border p-2.5 text-white shadow-xl backdrop-blur-md transition-colors ${
                  showCityLayers
                    ? "border-emerald-300/80 bg-emerald-950/90"
                    : "border-white/30 bg-slate-950/80 hover:bg-slate-900"
                }`}
                aria-label={
                  showCityLayers
                    ? "Exit city context mode"
                    : "Show city context mode"
                }
                title={
                  showCityLayers
                    ? "Exit city context mode"
                    : "Show city context mode"
                }
              >
                <MapPinned className="h-5 w-5" />
              </button>
            )}
            {!showCityLayers && (
              <>
                <button
                  type="button"
                  onClick={toggleRadiusFilter}
                  className={`rounded-full border p-2.5 text-white shadow-xl backdrop-blur-md transition-colors ${
                    isRadiusFilterOpen
                      ? "border-cyan-300/80 bg-cyan-950/90"
                      : "border-white/30 bg-slate-950/80 hover:bg-slate-900"
                  }`}
                  aria-label={
                    isRadiusFilterOpen
                      ? "Adjust search radius"
                      : "Enable search radius filter"
                  }
                  title={
                    isRadiusFilterOpen
                      ? "Adjust search radius"
                      : "Search by radius"
                  }
                >
                  <Ruler className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowProjectList((visible) => !visible)}
                  className={`rounded-full border p-2.5 text-white shadow-xl backdrop-blur-xl transition-colors ${
                    showProjectList
                      ? "border-cyan-300/80 bg-cyan-950/90"
                      : "border-white/30 bg-slate-950/80 hover:bg-slate-900"
                  }`}
                  aria-label={
                    showProjectList ? "Hide property list" : "Show property list"
                  }
                  title={showProjectList ? "Hide property list" : "Show property list"}
                >
                  <List className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {isMasterPlanSelected && (
          <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5">
            <section
              className="flex h-full max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 text-white shadow-2xl"
              aria-label="HMDA official master plan maps"
            >
              <header className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">
                    Hyderabad Metropolitan Development Authority
                  </p>
                  <h2 className="mt-1 text-lg font-semibold sm:text-xl">
                    Master plan area maps
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Optimized previews; open full-size sheets from HMDA.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMasterPlanSelected(false)}
                  className="rounded-full border border-white/20 p-2 text-white transition-colors hover:bg-white/10"
                  aria-label="Close master plan map viewer"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3 sm:px-5">
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => selectMasterPlanGroup("plan-2031")}
                    aria-pressed={masterPlanMapGroup === "plan-2031"}
                    className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      masterPlanMapGroup === "plan-2031"
                        ? "bg-violet-500 text-white"
                        : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Master Plan 2031
                  </button>
                  <button
                    type="button"
                    onClick={() => selectMasterPlanGroup("revised-huda")}
                    aria-pressed={masterPlanMapGroup === "revised-huda"}
                    className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                      masterPlanMapGroup === "revised-huda"
                        ? "bg-violet-500 text-white"
                        : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Revised HUDA zones
                  </button>
                </div>
                <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    value={masterPlanSearch}
                    onChange={(event) =>
                      searchMasterPlanMaps(event.target.value)
                    }
                    placeholder="Find a district or zone"
                    className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
                    aria-label="Search HMDA master plan areas"
                  />
                </label>
              </div>

              <div className="grid min-h-0 flex-1 grid-rows-[minmax(105px,0.38fr)_minmax(0,1fr)] gap-3 p-3 sm:p-4 md:grid-cols-[250px_minmax(0,1fr)] md:grid-rows-1">
                <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {visibleMasterPlanMaps.length} area maps
                  </p>
                  <div className="flash-news-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
                    {visibleMasterPlanMaps.map((mapSheet) => (
                      <button
                        key={mapSheet.id}
                        type="button"
                        onClick={() => {
                          setSelectedMasterPlanMapId(mapSheet.id);
                          setMasterPlanImageLoading(true);
                          setMasterPlanImageFailed(false);
                        }}
                        aria-pressed={selectedMasterPlanMap?.id === mapSheet.id}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          selectedMasterPlanMap?.id === mapSheet.id
                            ? "border-violet-300/60 bg-violet-500/15 text-white"
                            : "border-transparent text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        {mapSheet.area}
                      </button>
                    ))}
                    {visibleMasterPlanMaps.length === 0 && (
                      <p className="px-3 py-4 text-xs text-slate-400">
                        No districts or zones match that search.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
                  {selectedMasterPlanMap ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
                        <h3 className="text-sm font-semibold">
                          {selectedMasterPlanMap.area}
                        </h3>
                        <a
                          href={selectedMasterPlanMap.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-violet-200 hover:bg-white/10"
                        >
                          Open full-size sheet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                          href={`/api/master-plan/maps/${encodeURIComponent(selectedMasterPlanMap.id)}/download`}
                          download={`hmda-${selectedMasterPlanMap.id}.jpg`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-violet-200 hover:bg-white/10"
                        >
                          Download sheet
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                      <div
                        className="flash-news-scrollbar relative min-h-0 flex-1 overflow-auto overscroll-contain bg-slate-900 p-2"
                        aria-busy={masterPlanImageLoading}
                      >
                        {masterPlanImageLoading && !masterPlanImageFailed && (
                          <div
                            className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-xs text-slate-300"
                            role="status"
                            aria-live="polite"
                          >
                            <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
                            <span>Preparing map preview…</span>
                          </div>
                        )}
                        {masterPlanImageFailed ? (
                          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-3 text-center text-sm text-slate-300">
                            <p>The preview could not be prepared.</p>
                            <a
                              href={selectedMasterPlanMap.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-violet-300 underline underline-offset-4"
                            >
                              Open the HMDA map sheet
                            </a>
                          </div>
                        ) : (
                          <img
                            key={selectedMasterPlanMap.id}
                            src={`/api/master-plan/maps/${encodeURIComponent(selectedMasterPlanMap.id)}/preview.webp`}
                            alt={`HMDA master plan map for ${selectedMasterPlanMap.area}`}
                            loading="eager"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onLoad={() => setMasterPlanImageLoading(false)}
                            onError={() => {
                              setMasterPlanImageLoading(false);
                              setMasterPlanImageFailed(true);
                            }}
                            className="mx-auto h-auto max-w-full object-contain"
                          />
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="m-auto px-4 text-center text-sm text-slate-400">
                      Select a district or zone to view its official plan sheet.
                    </p>
                  )}
                </div>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">
                <a
                  href={
                    masterPlanMapGroup === "plan-2031"
                      ? "https://www.hmda.gov.in/master-planning-2031/"
                      : "https://www.hmda.gov.in/masterplan-huda/"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-violet-300 underline underline-offset-4"
                >
                  HMDA source page
                </a>
              </footer>
            </section>
          </div>
        )}
      </div>

      {showCityLayers && showContextPanel && (
        <div className="pointer-events-auto absolute right-4 top-4 z-20 mt-[286px] w-[min(290px,calc(100vw-2rem))] sm:right-6">
          <div className="rounded-2xl border border-emerald-200/25 bg-slate-950/92 p-3 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-bold">
                  <Layers className="h-3.5 w-3.5 text-emerald-300" />
                  City context mode
                </p>
                <p className="mt-1 text-[10px] text-white/50">
                  Property pins stay hidden. Toggle airport, industry,
                  SEZ, commercial, metro, data centre, and power plant context.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowContextPanel(false)}
                className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Hide city context panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {CITY_CONTEXT_CATEGORIES.map((category) => {
                const isVisible = visibleContextCategories[category.id];
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setVisibleContextCategories((current) => ({
                        ...current,
                        [category.id]: !current[category.id],
                      }));
                      setSelectedContextPoint(null);
                    }}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                      isVisible
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/40"
                    }`}
                    aria-pressed={isVisible}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: isVisible
                          ? category.color
                          : "rgba(255,255,255,0.25)",
                      }}
                    />
                    <span className="truncate text-[10px] font-semibold">
                      {category.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 border-t border-white/10 pt-2 text-[9px] leading-4 text-white/40">
              Zones are approximate planning context, not official boundaries.
              Verify airport, metro, SEZ, industrial, data centre, and power
              infrastructure notifications before making a purchase decision.
            </p>
          </div>
        </div>
      )}

      {selectedContextPoint && (
        <div className="pointer-events-none absolute bottom-[86px] left-4 z-30 w-[min(300px,calc(100vw-2rem))] sm:bottom-[82px] sm:left-6">
          <div
            className="pointer-events-auto rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl"
            style={{
              boxShadow: `0 18px 45px ${contextCategoryColor(
                selectedContextPoint.category,
              )}26`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    color: contextCategoryColor(selectedContextPoint.category),
                  }}
                >
                  {
                    CITY_CONTEXT_CATEGORIES.find(
                      (category) => category.id === selectedContextPoint.category,
                    )?.label
                  }
                </p>
                <p className="mt-1 text-sm font-bold">
                  {selectedContextPoint.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContextPoint(null)}
                className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close selected city layer detail"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/70">
              {selectedContextPoint.detail}
            </p>
            <p className="mt-3 text-[9px] leading-4 text-white/40">
              Map reference point only. Confirm current official project,
              transport, and zoning information independently.
            </p>
          </div>
        </div>
      )}

      {activeCity === "hyderabad" && showLakes && showLakeHelp && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 mt-[238px] w-[min(290px,calc(100vw-2rem))] sm:right-6">
          <div className="pointer-events-auto rounded-2xl border border-cyan-200/40 bg-slate-950/90 px-3 py-2.5 text-white shadow-2xl backdrop-blur-xl">
            <p className="flex items-center gap-2 text-[11px] font-bold">
              <Waves className="h-3.5 w-3.5 text-cyan-300" />
              Lakes / FTL check is on
            </p>
            <p className="mt-1 text-[10px] leading-4 text-white/60">
              Click a highlighted lake for its name, or select a project pin to
              check whether its map point falls inside the mapped FTL/buffer coverage.
            </p>
          </div>
        </div>
      )}

      {activeCity === "hyderabad" &&
        showLakes &&
        (selectedLake || selectedPinProject) && (
        <div className="pointer-events-none absolute bottom-[86px] right-4 z-30 w-[min(330px,calc(100vw-2rem))] sm:bottom-[82px] sm:right-6">
          <div className="pointer-events-auto relative rounded-2xl border border-cyan-200/40 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                setSelectedLake(null);
                setSelectedPinProjectId(null);
                setCheckedProjectLake(null);
              }}
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              aria-label="Close lake details"
            >
              <X className="h-4 w-4" />
            </button>
            {selectedPinProject && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                  FTL / lake point check
                </p>
                <p className="mt-1 text-sm font-bold">{selectedPinProject.name}</p>
                <p className="mt-2 text-xs leading-5 text-white/75">
                  {checkedProjectLake
                    ? `This project point falls inside the mapped ${checkedProjectLake.name} FTL/buffer polygon.`
                    : "This project point is outside the mapped lake/FTL polygons currently visible."}
                </p>
              </>
            )}
            {selectedLake && (
              <div className={selectedPinProject ? "mt-3 border-t border-white/10 pt-3" : ""}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                  Selected mapped water area
                </p>
                <p className="mt-1 text-sm font-bold">{selectedLake.name}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs leading-5">
                  <dt className="text-white/45">Type</dt>
                  <dd className="break-words text-white/75">
                    {selectedLake.type || "—"}
                  </dd>
                  <dt className="text-white/45">ID</dt>
                  <dd className="break-words text-white/75">
                    {selectedLake.id || "—"}
                  </dd>
                  <dt className="text-white/45">Area</dt>
                  <dd className="break-words text-white/75">
                    {selectedLake.areaAcres !== undefined
                      ? `${selectedLake.areaAcres.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} acres`
                      : "Unavailable"}
                  </dd>
                </dl>
              </div>
            )}
            <p className="mt-3 text-[9px] leading-4 text-white/40">
              Preliminary map overlay only; confirm official FTL and buffer
              boundaries before making a purchase or title decision.
            </p>
          </div>
        </div>
      )}

      {showProjectList && !showCityLayers && (
        <div className="pointer-events-auto absolute right-4 top-28 z-30 max-h-[58vh] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/20 bg-slate-950/90 text-white shadow-2xl backdrop-blur-xl sm:right-6">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-xs font-bold">
                {activeCity === "dubai"
                  ? "Dubai developments"
                  : "Visible properties"}
              </p>
              <p className="mt-0.5 text-[10px] text-white/45">
                {visibleProjectCount}{" "}
                {activeCity === "dubai"
                  ? "developments"
                  : `result${visibleProjectCount === 1 ? "" : "s"}`}{" "}
                on the map
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {activeCity === "hyderabad" && (
                <select
                  value={listSort}
                  onChange={(event) =>
                    setListSort(event.target.value as typeof listSort)
                  }
                  className="rounded-lg border border-white/15 bg-white/[0.08] px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-300/60"
                  aria-label="Sort visible properties"
                >
                  <option value="price">Lowest price</option>
                  <option value="rate">Lowest rate</option>
                  <option value="size">Smallest layout</option>
                </select>
              )}
              <button
                type="button"
                onClick={() => setShowProjectList(false)}
                className="rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close project list"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flash-news-scrollbar max-h-[calc(58vh-64px)] overflow-y-auto p-2">
            {visibleProjectCount > 0 ? (
              activeCity === "dubai" ? (
                visibleDubaiProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      selectProjectPin(project.id);
                      setShowProjectList(false);
                    }}
                    className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <p className="truncate text-xs font-semibold">
                      {project.name}
                    </p>
                    <p className="mt-1 flex items-start gap-1 text-[10px] leading-4 text-white/55">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
                      {project.locality}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-cyan-200">
                      {project.developer}
                    </p>
                    {project.note && (
                      <p className="mt-1 text-[10px] leading-4 text-white/45">
                        {project.note}
                      </p>
                    )}
                  </button>
                ))
              ) : (
                sortedVisibleProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    selectProjectPin(project.id);
                    setShowProjectList(false);
                  }}
                  className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {project.name}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-white/45">
                        <MapPin className="h-3 w-3 text-cyan-300" />
                        {project.locality} · {project.approvalType}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-cyan-200">
                      <FormattedCurrencyText
                        value={formatProjectPrice(
                          project.price,
                          displayCurrency,
                          exchangeRates,
                        )}
                      />
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-white/45">
                    {project.bedrooms} · {project.acres} acres ·{" "}
                    {project.type}
                  </p>
                </button>
                ))
              )
            ) : (
              <p className="px-3 py-6 text-center text-xs text-white/50">
                No properties match the current filters.
              </p>
            )}
          </div>
        </div>
      )}

      {isRadiusFilterOpen && radiusCenter && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[82px] z-30 flex justify-center px-3 sm:bottom-[76px] sm:px-5">
          <RadiusArcControl
            radiusInKilometers={radiusInKilometers}
            onRadiusChange={setRadiusInKilometers}
            visibleProjectCount={visibleProjectCount}
            isDarkMap={isDarkMap}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-10 pt-3 sm:px-5 sm:pb-8 sm:pt-5">
        <div className="relative mx-auto w-full max-w-[680px]">
          {isMagicFiltersOpen &&
            activeCity === "hyderabad" &&
            !showCityLayers &&
            !isMasterPlanSelected && (
              <section
                id="magic-property-filters"
                aria-label="Property filters"
                className="pointer-events-auto absolute bottom-full left-0 right-0 z-40 mb-2 max-h-[min(55vh,460px)] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">Refine properties</p>
                    <p
                      className="mt-1 text-[10px] text-white/55"
                      aria-live="polite"
                    >
                      {visibleProjects.length} of {PROJECTS.length} projects
                      match
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetMagicFilters}
                    className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-[10px] font-semibold text-white/75 transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white"
                  >
                    Clear filters
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="magic-budget-slider"
                        className="text-[10px] font-semibold text-white/80"
                      >
                        Maximum starting budget
                      </label>
                      <output
                        htmlFor="magic-budget-slider"
                        className="text-[10px] font-semibold text-cyan-100"
                        aria-live="polite"
                      >
                        {magicPropertyFilters.maxBudget >= MAGIC_BUDGET_MAX
                          ? "Any budget"
                          : `Up to ${formatMagicBudget(
                              magicPropertyFilters.maxBudget,
                            )}`}
                      </output>
                    </div>
                    <input
                      id="magic-budget-slider"
                      type="range"
                      min={MAGIC_BUDGET_MIN}
                      max={MAGIC_BUDGET_MAX}
                      step={MAGIC_BUDGET_STEP}
                      value={magicPropertyFilters.maxBudget}
                      onChange={(event) => {
                        const maxBudget = Number(event.currentTarget.value);
                        setMagicPropertyFilters((filters) => ({
                          ...filters,
                          maxBudget,
                        }));
                      }}
                      aria-label="Maximum estimated starting plot budget"
                      aria-valuetext={
                        magicPropertyFilters.maxBudget >= MAGIC_BUDGET_MAX
                          ? "Any budget"
                          : `Up to ${formatMagicBudget(
                              magicPropertyFilters.maxBudget,
                            )}`
                      }
                      className="mt-3 h-2 w-full cursor-pointer accent-cyan-300"
                    />
                    <div className="mt-1 flex justify-between text-[9px] text-white/45">
                      <span>{formatMagicBudget(MAGIC_BUDGET_MIN)}</span>
                      <span>{formatMagicBudget(MAGIC_BUDGET_MAX)}</span>
                    </div>
                    <span className="mt-1.5 block text-[9px] leading-4 text-white/45">
                      Estimated from rate × smallest plot size
                    </span>
                  </div>

                  <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="magic-plot-size-slider"
                        className="text-[10px] font-semibold text-white/80"
                      >
                        Minimum plot size
                      </label>
                      <output
                        htmlFor="magic-plot-size-slider"
                        className="text-[10px] font-semibold text-cyan-100"
                        aria-live="polite"
                      >
                        {magicPropertyFilters.minimumPlotSize <= 0
                          ? "Any size"
                          : `${magicPropertyFilters.minimumPlotSize}+ sq yd`}
                      </output>
                    </div>
                    <input
                      id="magic-plot-size-slider"
                      type="range"
                      min={0}
                      max={MAGIC_PLOT_SIZE_MAX}
                      step={25}
                      value={magicPropertyFilters.minimumPlotSize}
                      onChange={(event) => {
                        const minimumPlotSize = Number(
                          event.currentTarget.value,
                        );
                        setMagicPropertyFilters((filters) => ({
                          ...filters,
                          minimumPlotSize,
                        }));
                      }}
                      aria-label="Minimum starting plot size"
                      aria-valuetext={
                        magicPropertyFilters.minimumPlotSize <= 0
                          ? "Any size"
                          : `At least ${magicPropertyFilters.minimumPlotSize} square yards`
                      }
                      className="mt-3 h-2 w-full cursor-pointer accent-cyan-300"
                    />
                    <div className="mt-1 flex justify-between text-[9px] text-white/45">
                      <span>Any size</span>
                      <span>{MAGIC_PLOT_SIZE_MAX}+ sq yd</span>
                    </div>
                    <span className="mt-1.5 block text-[9px] leading-4 text-white/45">
                      Based on each project’s smallest listed plot
                    </span>
                  </div>

                  <label className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                    <span className="block text-[10px] font-semibold text-white/80">
                      Approval type
                    </span>
                    <select
                      value={magicPropertyFilters.approval}
                      onChange={(event) => {
                        const approval = event.currentTarget
                          .value as MagicApprovalFilter;
                        setMagicPropertyFilters((filters) => ({
                          ...filters,
                          approval,
                        }));
                      }}
                      aria-label="Filter by approval type"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-300/60"
                    >
                      <option value="any">Any approval</option>
                      <option value="HMDA">HMDA approved</option>
                      <option value="DTCP">DTCP approved</option>
                      <option value="other">Other approval types</option>
                    </select>
                    <span className="mt-1.5 block text-[9px] leading-4 text-white/45">
                      Choose an approval listed for the project
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  aria-pressed={magicPropertyFilters.activeOnly}
                  onClick={() =>
                    setMagicPropertyFilters((filters) => ({
                      ...filters,
                      activeOnly: !filters.activeOnly,
                    }))
                  }
                  className={`mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-semibold transition-colors ${
                    magicPropertyFilters.activeOnly
                      ? "border-cyan-300/45 bg-cyan-300/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      magicPropertyFilters.activeOnly
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-white/30"
                    }`}
                  >
                    {magicPropertyFilters.activeOnly && (
                      <Check aria-hidden="true" className="h-3 w-3" />
                    )}
                  </span>
                  Show active listings only
                </button>
              </section>
            )}
          {activeCity === "hyderabad" &&
            !showCityLayers &&
            !isMasterPlanSelected && (
            <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/20 bg-slate-950/90 p-1.5 text-white shadow-2xl backdrop-blur-xl scrollbar-hide">
            <Sparkles className="ml-1.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <button
              type="button"
              onClick={() => setIsMagicFiltersOpen((open) => !open)}
              aria-expanded={isMagicFiltersOpen}
              aria-controls={
                isMagicFiltersOpen ? "magic-property-filters" : undefined
              }
              aria-label={`Property filters${
                activeMagicFilterCount > 0
                  ? `, ${activeMagicFilterCount} active`
                  : ""
              }`}
              title={`Property filters${
                activeMagicFilterCount > 0
                  ? ` · ${activeMagicFilterCount} active`
                  : ""
              }`}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border p-0 transition-colors ${
                isMagicFiltersOpen || activeMagicFilterCount > 0
                  ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-cyan-300/50 hover:bg-white/10"
              }`}
            >
              <Filter aria-hidden="true" className="h-4 w-4" />
            </button>
            <div className="flex min-w-max gap-1.5">
              {selectedIntent ? (
                <>
                  <button
                    type="button"
                    onClick={resetMagicFilters}
                    className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-left text-white/70 transition-all hover:border-white/40 hover:bg-white/10 hover:text-white"
                    aria-label="Clear property filters"
                  >
                    <span className="block text-[10px] font-bold">All</span>
                  </button>
                  <button
                    type="button"
                    data-magic-intent={selectedIntent.id}
                    onClick={() => chooseMagicIntent(selectedIntent.id)}
                    className="shrink-0 rounded-full border border-white/80 bg-white px-3 py-2 text-left text-slate-950 shadow-lg"
                  >
                    <span className="block text-[10px] font-bold">
                      {selectedIntent.label}
                    </span>
                  </button>
                  {selectedIntent.subcategories.map((subcategory) => {
                    const isSelected =
                      selectedSubcategoryId === subcategory.id;
                    return (
                      <button
                        key={subcategory.id}
                        type="button"
                        data-magic-subcategory={subcategory.id}
                        onClick={() => chooseMagicSubcategory(subcategory.id)}
                        className={`shrink-0 rounded-full border px-3 py-2 text-left transition-all ${
                          isSelected
                            ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-100 shadow-lg"
                            : "border-white/10 bg-white/5 text-white/75 hover:border-cyan-300/50 hover:bg-white/10"
                        }`}
                        title={subcategory.detail}
                      >
                        <span className="block text-[10px] font-bold">
                          <FormattedCurrencyText
                            value={getSubcategoryDisplayLabel(
                              subcategory,
                              displayCurrency,
                              exchangeRates,
                            )}
                          />
                        </span>
                      </button>
                    );
                  })}
                </>
              ) : (
                MAGIC_INTENTS.map((intent) => (
                  <button
                    key={intent.id}
                    type="button"
                    data-magic-intent={intent.id}
                    onClick={() => chooseMagicIntent(intent.id)}
                    className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-white/75 transition-all hover:border-cyan-300/50 hover:bg-white/10"
                    title={intent.detail}
                  >
                    <span className="block truncate text-[10px] font-bold">
                      {intent.label}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          )}
          {activeCity === "dubai" && (
            <section
              className="pointer-events-auto rounded-2xl border border-white/20 bg-slate-950/90 p-2 text-white shadow-2xl backdrop-blur-xl"
              aria-label="Dubai developers and projects"
            >
              <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
                <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
                  <Building2
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-violet-300"
                  />
                  <span className="truncate">
                    {selectedDubaiDeveloper ?? "Dubai developers"}
                  </span>
                </p>
                {selectedDubaiDeveloper && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDubaiDeveloper(null);
                      setSelectedPinProjectId(null);
                      setSelectedDubaiRouteProjectId(null);
                    }}
                    className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold text-violet-200 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Show all Dubai developers"
                  >
                    All developers
                  </button>
                )}
              </div>
              <div
                className="flex min-w-0 gap-1.5 overflow-x-auto scrollbar-hide"
                aria-label={
                  selectedDubaiDeveloper
                    ? `${selectedDubaiDeveloper} projects`
                    : "Dubai developers"
                }
              >
                {selectedDubaiDeveloper
                  ? visibleDubaiProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        data-dubai-project={project.id}
                        onClick={() => {
                          setSelectedPinProjectId(null);
                          setSelectedDubaiRouteProjectId(project.id);
                        }}
                        className={`shrink-0 rounded-full border px-3 py-2 text-left text-[10px] font-semibold transition-colors ${
                          selectedPinProjectId === project.id ||
                          selectedDubaiRouteProjectId === project.id
                            ? "border-violet-300/70 bg-violet-300/20 text-violet-100"
                            : "border-white/10 bg-white/5 text-white/80 hover:border-violet-300/50 hover:bg-white/10 hover:text-white"
                        }`}
                        aria-pressed={
                          selectedPinProjectId === project.id ||
                          selectedDubaiRouteProjectId === project.id
                        }
                        title={`${project.name} · ${project.locality}`}
                      >
                        {project.name}
                      </button>
                    ))
                  : DUBAI_DEVELOPERS.map((developer) => {
                      const projectCount = DUBAI_PROPERTY_PROJECTS.filter(
                        (project) => project.developer === developer,
                      ).length;
                      return (
                        <button
                          key={developer}
                          type="button"
                          onClick={() => {
                            setSelectedDubaiDeveloper(developer);
                            setSelectedPinProjectId(null);
                            setSelectedDubaiRouteProjectId(null);
                          }}
                          className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-[10px] font-semibold text-white/80 transition-colors hover:border-violet-300/50 hover:bg-white/10 hover:text-white"
                          aria-label={`${developer}, ${projectCount} projects`}
                        >
                          {developer}
                          <span className="ml-1.5 text-white/45">
                            {projectCount}
                          </span>
                        </button>
                      );
                    })}
                {selectedDubaiDeveloper && visibleDubaiProjects.length === 0 && (
                  <p className="px-2 py-2 text-[10px] text-white/55">
                    No projects match the current search.
                  </p>
                )}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => setShowMapInfo((visible) => !visible)}
            className="pointer-events-auto absolute -bottom-10 left-0 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-slate-950/80 p-0 text-white/80 shadow-lg backdrop-blur-md transition-colors hover:text-white sm:-bottom-8 sm:-left-10"
            aria-label="Map information"
            title="Map information"
          >
            <Info className="h-2.5 w-2.5" />
          </button>
        </div>
        {showMapInfo && (
          <div className="pointer-events-auto absolute bottom-14 left-3 max-w-[280px] rounded-xl border border-white/20 bg-slate-950/90 px-3 py-2 text-[10px] text-white/70 shadow-xl backdrop-blur-md sm:left-5">
            Map tiles © OpenStreetMap contributors ·{" "}
            {activeCity === "dubai"
              ? `${DUBAI_PROPERTY_PROJECTS.length} named Dubai developments.`
              : `${PROJECTS.length} project pins imported from the public PlotsView venture catalog.`}
          </div>
        )}
      </div>
      {selectedPinProject && (
        <ProjectDetailSheet
          project={selectedPinProject}
          onClose={() => setSelectedPinProjectId(null)}
          currency={displayCurrency}
          rates={exchangeRates}
        />
      )}
      {selectedDubaiProject && (
        <DubaiProjectDetailSheet
          project={selectedDubaiProject}
          onClose={() => setSelectedPinProjectId(null)}
        />
      )}
    </motion.div>
  );
}