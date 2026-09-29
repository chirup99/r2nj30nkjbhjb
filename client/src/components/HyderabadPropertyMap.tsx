import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MapLayerMouseEvent } from "maplibre-gl";
import {
  BadgeCheck,
  Banknote,
  Building2,
  Check,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  FileText,
  House,
  Info,
  Layers,
  Landmark,
  List,
  MapPin,
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
import { PLOTSVIEW_PROJECTS } from "@/data/plotsviewProjects";
import { RRR_ALIGNMENT_COORDINATES } from "@/data/rrrAlignment";

type PropertyProject = (typeof PLOTSVIEW_PROJECTS)[number];

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

type MapCoordinate = [number, number];

type LakeCheck = {
  name: string;
  description?: string;
  longitude: number;
  latitude: number;
};

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
  { id: "commercial", label: "Malls & commerce", shortLabel: "Commerce", color: "#f472b6" },
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
    id: "sarath-city",
    name: "Sarath City Capital Mall",
    category: "commercial",
    detail: "Major retail and entertainment destination",
    longitude: 78.357,
    latitude: 17.456,
  },
  {
    id: "inorbit-mall",
    name: "Inorbit Mall",
    category: "commercial",
    detail: "Madhapur retail and dining hub",
    longitude: 78.385,
    latitude: 17.435,
  },
  {
    id: "amb-cinemas",
    name: "AMB Cinemas & Galleria",
    category: "commercial",
    detail: "Gachibowli entertainment hub",
    longitude: 78.345,
    latitude: 17.49,
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
    id: "forum-sujana",
    name: "Forum Sujana Mall",
    category: "commercial",
    detail: "Kukatpally commercial anchor",
    longitude: 78.364,
    latitude: 17.47,
  },
  {
    id: "gvk-one",
    name: "GVK One Mall",
    category: "commercial",
    detail: "Banjara Hills retail destination",
    longitude: 78.419,
    latitude: 17.414,
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
    longitude: 78.448,
    latitude: 17.437,
  },
  {
    id: "metro-nagole",
    name: "Nagole Metro",
    category: "metro",
    detail: "Red Line east terminus",
    longitude: 78.557,
    latitude: 17.39,
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
    id: "metro-raaidurg",
    name: "Raidurg Metro",
    category: "metro",
    detail: "West Hyderabad business corridor",
    longitude: 78.365,
    latitude: 17.431,
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
    id: "gachibowli-commerce",
    name: "Gachibowli commercial zone",
    category: "commercial",
    detail: "Approximate office, retail and entertainment catchment",
    center: [78.35, 17.474],
    radiusInKilometers: 2.8,
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
      properties: { name: "Hyderabad Metro Red Line" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.373, 17.496],
          [78.39, 17.475],
          [78.414, 17.454],
          [78.448, 17.437],
          [78.468, 17.427],
          [78.505, 17.404],
          [78.539, 17.39],
          [78.557, 17.39],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Hyderabad Metro Blue Line" },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.448, 17.437],
          [78.421, 17.414],
          [78.397, 17.407],
          [78.376, 17.414],
          [78.365, 17.431],
          [78.345, 17.45],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Airport Metro corridor" },
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

function Airport3DIllustration({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 84 62"
      aria-hidden="true"
      className={`h-[3.9rem] w-[5.25rem] overflow-visible transition-transform ${
        selected ? "scale-110" : ""
      }`}
    >
      <defs>
        <linearGradient id="airport-pad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4bd4e8" />
          <stop offset="1" stopColor="#16789f" />
        </linearGradient>
        <linearGradient id="airport-terminal" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#f8fdff" />
          <stop offset="1" stopColor="#b6cfda" />
        </linearGradient>
        <linearGradient id="airport-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#94f4ff" />
          <stop offset="1" stopColor="#2492bb" />
        </linearGradient>
        <filter id="airport-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#00131f" floodOpacity="0.5" />
        </filter>
      </defs>
      <ellipse cx="42" cy="55" rx="31" ry="4.5" fill="#020b13" opacity="0.38" />
      <g filter="url(#airport-shadow)">
        <path
          d="M8 42 42 24l34 15-34 18Z"
          fill="url(#airport-pad)"
          stroke="#c7f8ff"
          strokeOpacity="0.7"
          strokeWidth="1"
        />
        <path d="m19 42 23-12 23 10-23 12Z" fill="#163b55" opacity="0.9" />
        <path d="m24 40 18-9 18 8-18 9Z" fill="#d7fbff" opacity="0.78" />
        <path d="m42 31 1 17" stroke="#ffffff" strokeDasharray="2 2" strokeWidth="1.2" />
        <path
          d="m25 34 17-9 17 7-17 9Z"
          fill="url(#airport-terminal)"
          stroke="#ffffff"
          strokeWidth="0.8"
        />
        <path d="m25 34 0 8 17 8v-9Z" fill="#7ea5b5" />
        <path d="m42 41 17-9v8l-17 10Z" fill="#dbe9ed" />
        <path d="m27 34 15-7 15 6-15 8Z" fill="#ffae58" />
        <path d="m29 36 13-6 13 5-13 6Z" fill="url(#airport-glass)" />
        <path d="m34 34 0 5M39 32l0 8M44 31v8M49 33v7" stroke="#d9fbff" strokeWidth="0.8" />
        <path d="m62 26 5-2.5 5 2.2-5 2.7Z" fill="#f7fbff" />
        <path d="m63 26 0 12 4 2V28Z" fill="#8caab7" />
        <path d="m67 28 5-2.7v12l-5 2.7Z" fill="#d9e7eb" />
        <path d="m65 23 2-5 2 4-2 4Z" fill="#d7e9ee" />
        <path d="m66 18 1-2 1 2" stroke="#ffb454" strokeWidth="1" />
        <path
          d="m52 21 7 2-7 2 2-2-10-3 1-1 10 3Z"
          fill="#ffffff"
          stroke="#c7e5ed"
          strokeWidth="0.6"
        />
        <circle cx="53" cy="23" r="1.2" fill="#ff9c4a" />
        <circle cx="59" cy="23" r="1.2" fill="#ff9c4a" />
      </g>
    </svg>
  );
}

function CityContext3DIllustration({
  category,
  selected,
}: {
  category: Exclude<CityContextCategory, "airports">;
  selected: boolean;
}) {
  const baseColor =
    category === "industries"
      ? "#e98b43"
      : category === "sez"
        ? "#a978e8"
        : category === "commercial"
          ? "#ef6ea9"
          : category === "metro"
            ? "#55d48b"
            : category === "data-centers"
              ? "#36c9df"
              : "#e9c84e";

  return (
    <svg
      viewBox="0 0 84 62"
      aria-hidden="true"
      className={`h-[3.9rem] w-[5.25rem] overflow-visible transition-transform ${
        selected ? "scale-110" : ""
      }`}
      style={{ filter: "drop-shadow(0 3px 2px rgba(0, 10, 20, 0.45))" }}
    >
      <ellipse cx="42" cy="55" rx="31" ry="4.5" fill="#020b13" opacity="0.38" />
      <path
        d="M8 42 42 24l34 15-34 18Z"
        fill={`${baseColor}38`}
        stroke={baseColor}
        strokeOpacity="0.75"
        strokeWidth="1"
      />
      <path d="m19 42 23-12 23 10-23 12Z" fill="#10283a" opacity="0.92" />

      {category === "industries" && (
        <g>
          <path d="m25 36 18-10 18 8-18 10Z" fill="#ffe0ae" />
          <path d="m25 36v10l18 9V44Z" fill="#a85a35" />
          <path d="m43 44 18-10v10l-18 11Z" fill="#d77b43" />
          <path d="m29 34 14-8 14 6-14 8Z" fill="#7b3f36" />
          <path d="m31 37 4-2v11l-4-2Z" fill="#92e6e5" />
          <path d="m38 33 4-2v11l-4-2Z" fill="#92e6e5" />
          <path d="m51 25 5-2.5 4 2-5 2.8Z" fill="#ffe0ae" />
          <path d="m51 25v12l4 2V27Z" fill="#9b5c43" />
          <path d="m55 27 5-2.8v12l-5 2.8Z" fill="#ca7446" />
          <path d="m54 22 1-6 2 5-2 4Z" fill="#d8eced" />
          <path d="m31 47 4 2M38 44l4 2M48 43l5-3" stroke="#ffbd64" strokeWidth="1.1" />
        </g>
      )}

      {category === "sez" && (
        <g>
          <path d="m25 35 13-7 13 6-13 8Z" fill="#e9ddff" />
          <path d="m25 35v15l13 7V42Z" fill="#7955bc" />
          <path d="m38 42 13-8v15L38 57Z" fill="#a47ae0" />
          <path d="m31 31 13-8 13 6-13 8Z" fill="#f8f3ff" />
          <path d="m31 31v15l13 7V37Z" fill="#6c91bd" />
          <path d="m44 37 13-8v15l-13 8Z" fill="#b5c6e1" />
          <path d="m32 35 9 5M32 40l9 5M45 32l9 5M45 37l9 5" stroke="#d9fbff" strokeWidth="1.1" />
          <path d="m52 39 8-4 7 3-8 4Z" fill="#f5e6ff" />
          <path d="m52 39v8l7 4v-9Z" fill="#a172d1" />
          <path d="m59 42 8-4v8l-8 5Z" fill="#cc9ce9" />
        </g>
      )}

      {category === "commercial" && (
        <g>
          <path d="m23 37 22-12 23 10-22 12Z" fill="#fff2f8" />
          <path d="m23 37v12l23 11V47Z" fill="#b75483" />
          <path d="m46 47 22-12v12L46 60Z" fill="#d977a2" />
          <path d="m28 35 17-9 17 8-17 9Z" fill="#ffb4d2" />
          <path d="m30 38 14-7 14 6-14 8Z" fill="#4cc9d9" />
          <path d="m30 38v9l14 7v-9Z" fill="#6d9eb0" />
          <path d="m44 45 14-8v9l-14 8Z" fill="#d8f8fa" />
          <path d="M34 34h3v18h-3ZM42 30h3v23h-3ZM50 34h3v15h-3" fill="#ffffff" opacity="0.9" />
          <path d="m27 48 5 2.5M55 49l7-4" stroke="#ffd1e5" strokeWidth="1" />
        </g>
      )}

      {category === "metro" && (
        <g>
          <path d="m22 40 20-11 24 11-20 11Z" fill="#234c4d" />
          <path d="m27 40 15-8 19 9-15 8Z" fill="#b7f4dc" opacity="0.78" />
          <path d="m31 42 11-6M37 45l11-6M43 48l11-6" stroke="#f3fff9" strokeWidth="1" />
          <path d="m28 34 18-10 18 8-18 10Z" fill="#e6fff5" />
          <path d="m28 34v8l18 9v-9Z" fill="#6ca59c" />
          <path d="m46 42 18-10v8L46 51Z" fill="#9ed4c5" />
          <path d="m35 29 11-6 11 5-11 6Z" fill="#59d08a" />
          <path d="m37 31 9-5 9 4-9 5Z" fill="#163b55" />
          <path d="m39 32v5M44 30v6M49 29v6" stroke="#d6fff2" strokeWidth="1" />
          <circle cx="36" cy="43" r="1.3" fill="#ffdb75" />
          <circle cx="57" cy="42" r="1.3" fill="#ffdb75" />
        </g>
      )}

      {category === "data-centers" && (
        <g>
          <path d="m25 36 18-10 19 9-18 10Z" fill="#d8fbff" />
          <path d="m25 36v15l19 9V43Z" fill="#3a879e" />
          <path d="m44 43 18-8v15L44 60Z" fill="#7bc5d2" />
          <path d="m30 34 13-7 14 6-13 8Z" fill="#18394d" />
          <path d="m31 38 12-6v4l-12 6ZM31 44l12-6v4l-12 6ZM31 50l12-6v4l-12 6Z" fill="#66e5e8" />
          <path d="m46 43 11-5v4l-11 5ZM46 49l11-5v4l-11 5ZM46 55l11-5v4l-11 5Z" fill="#d8ffff" />
          <path d="m27 30 4-2 4 2-4 2Z" fill="#9bf5ff" />
          <path d="m58 31 4-2 4 2-4 2Z" fill="#9bf5ff" />
        </g>
      )}

      {category === "power-plants" && (
        <g>
          <path d="m24 38 19-10 20 9-19 11Z" fill="#fff1a5" />
          <path d="m24 38v11l20 10V48Z" fill="#b78e37" />
          <path d="m44 48 19-11v11L44 59Z" fill="#e0bd54" />
          <path d="m29 36 14-7 15 7-14 8Z" fill="#ffe98a" />
          <path d="m31 39 9-5 9 4-9 5Z" fill="#4b5961" />
          <path d="m34 40v7h10v-7Z" fill="#8fc5c7" />
          <path d="m48 28 5-3 5 2.5-5 3Z" fill="#f5f0d1" />
          <path d="m49 28-2 14 6 3 2-14Z" fill="#d4c078" />
          <path d="m55 29 5-3v13l-5 3Z" fill="#f0dd94" />
          <path d="m51 24 2-4 2 3-2 4Z" fill="#fff6bd" />
          <path d="m60 39 9-5 5 2-9 5Z" fill="#fff4a8" />
          <path d="m60 39v7l5 2v-7Z" fill="#a97d2c" />
          <path d="m65 41 9-5v7l-9 5Z" fill="#d1a83e" />
        </g>
      )}
    </svg>
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
        className="absolute bottom-1 left-1/2 h-2.5 w-8 -translate-x-1/2 rounded-full bg-black/35 blur-[2px]"
      />
      {point.category === "airports" ? (
        <Airport3DIllustration selected={selected} />
      ) : (
        <CityContext3DIllustration
          category={point.category}
          selected={selected}
        />
      )}
      <span
        className="absolute bottom-0 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full opacity-80"
        style={{ backgroundColor: accent }}
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

function PropertyPin({
  accent,
  selected = false,
  onSelect,
}: {
  accent: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label="View project details"
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

function FitProjectPins({ projects }: { projects: PropertyProject[] }) {
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
      const properties = event.features?.[0]?.properties ?? {};
      latestLakeSelect.current({
        name: String(properties.name || "Unnamed lake"),
        description: properties.description
          ? String(properties.description)
          : undefined,
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
      });
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
      const properties = features[0]?.properties;
      latestProjectCheck.current(
        properties
          ? {
              name: String(properties.name || "Unnamed lake"),
              description: properties.description
                ? String(properties.description)
                : undefined,
              longitude: checkedProject.longitude,
              latitude: checkedProject.latitude,
            }
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
        }`}
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
  value: string;
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
}: {
  project: PropertyProject;
  onClose: () => void;
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
          <DetailValue label="Price" value={project.price} icon={Banknote} />
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
              value={details.startingPrice}
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

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <a
            href={project.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            <FileText className="h-4 w-4" />
            View full listing
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-xl border border-slate-200 px-4 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close project details"
          >
            <ChevronRight className="h-5 w-5 rotate-90" />
          </button>
        </div>
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
  const [query, setQuery] = useState("");
  const [showMapInfo, setShowMapInfo] = useState(false);
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<
    string | null
  >(null);
  const [selectedPinProjectId, setSelectedPinProjectId] = useState<string | null>(
    null,
  );
  const [routeProgress, setRouteProgress] = useState(0);
  const [isDarkMap, setIsDarkMap] = useState(true);
  const [isSatelliteMap, setIsSatelliteMap] = useState(false);
  const [showLakes, setShowLakes] = useState(false);
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
  const [isRadiusFilterOpen, setIsRadiusFilterOpen] = useState(false);
  const [radiusInKilometers, setRadiusInKilometers] = useState(25);
  const [userLocation, setUserLocation] = useState<MapCoordinate | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "ready" | "fallback"
  >("idle");

  const selectedIntent = MAGIC_INTENTS.find(
    (intent) => intent.id === selectedIntentId,
  );
  const selectedSubcategory = selectedIntent?.subcategories.find(
    (subcategory) => subcategory.id === selectedSubcategoryId,
  );

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
      const matchesRadius =
        !isRadiusFilterOpen ||
        !userLocation ||
        distanceInKilometers(userLocation, [
          project.longitude,
          project.latitude,
        ]) <= radiusInKilometers;
      return matchesMagicFilter && matchesQuery && matchesRadius;
    });
  }, [
    isRadiusFilterOpen,
    query,
    radiusInKilometers,
    selectedIntent,
    selectedSubcategory,
    userLocation,
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

  const visibleMapProjects = showCityLayers ? [] : visibleProjects;
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
  const routeProjectIds = visibleMapProjects.map((project) => project.id).join(",");
  const selectedPinProject = PROJECTS.find(
    (project) => project.id === selectedPinProjectId,
  );
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
    (project) => project.id === initialProjectId,
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
  };

  useEffect(() => {
    if (!isRadiusFilterOpen || locationStatus !== "idle") return;

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
  }, [isRadiusFilterOpen, locationStatus]);

  const toggleRadiusFilter = () => {
    setIsRadiusFilterOpen((open) => {
      if (open) setLocationStatus("idle");
      return !open;
    });
  };

  const selectProjectPin = (projectId: string) => {
    setSelectedPinProjectId(projectId);
    setShowLakeHelp(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] overflow-hidden bg-[#07111f]"
      role="dialog"
      aria-modal="true"
      aria-label="PlotsView projects map"
    >
      <PropertyMap
        center={HYDERABAD_CENTER}
        zoom={9}
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
        <FocusProjectPin project={showCityLayers ? undefined : initialProject} />
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
        {!showCityLayers &&
          selectedIntent &&
          selectedSubcategory &&
          visibleMapProjects.length > 0 && (
          <MagicProjectRoute
            projects={visibleMapProjects}
            intent={selectedIntent}
            subcategoryId={selectedSubcategory.id}
            progress={routeProgress}
          />
        )}
        {isRadiusFilterOpen && userLocation && (
          <RadiusFilterLayer
            center={userLocation}
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
                selected={project.id === selectedPinProject?.id}
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

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto w-full max-w-[430px] rounded-2xl border border-white/60 bg-white/90 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search any PlotsView project or locality"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
                aria-label="Search PlotsView projects"
              />
            </label>
            <p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {showCityLayers
                ? `${visibleContextPoints.length} city context markers shown`
                : selectedIntent
                ? `${visibleProjects.length} ${selectedIntent.label.toLowerCase()} shown`
                : `${visibleProjects.length} of ${PROJECTS.length} projects pinned`}
            </p>
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
            <button
              type="button"
              onClick={() => {
                setShowLakes((visible) => !visible);
                setShowLakeHelp((visible) => !visible);
                setSelectedLake(null);
                setCheckedProjectLake(null);
              }}
              className={`rounded-full border p-2.5 text-white shadow-xl backdrop-blur-md transition-colors ${
                showLakes
                  ? "border-cyan-300/80 bg-cyan-950/90"
                  : "border-white/30 bg-slate-950/80 hover:bg-slate-900"
              }`}
              aria-label={showLakes ? "Hide lakes and FTL layer" : "Show lakes and FTL layer"}
              title={showLakes ? "Hide lakes and FTL layer" : "Show lakes and FTL layer"}
            >
              <Waves className="h-4 w-4" />
            </button>
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
              <Layers className="h-4 w-4" />
            </button>
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
                  SEZ, mall, metro, data centre, and power plant context.
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

      {showLakes && showLakeHelp && (
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

      {showLakes && (selectedLake || selectedPinProject) && (
        <div className="pointer-events-none absolute bottom-[86px] right-4 z-30 w-[min(330px,calc(100vw-2rem))] sm:bottom-[82px] sm:right-6">
          <div className="pointer-events-auto rounded-2xl border border-cyan-200/40 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl">
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
                {selectedLake.description && (
                  <p className="mt-1 text-xs leading-5 text-white/65">
                    {selectedLake.description}
                  </p>
                )}
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
              <p className="text-xs font-bold">Visible properties</p>
              <p className="mt-0.5 text-[10px] text-white/45">
                {visibleProjects.length} result
                {visibleProjects.length === 1 ? "" : "s"} on the map
              </p>
            </div>
            <div className="flex items-center gap-1.5">
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
              <button
                type="button"
                onClick={() => setShowProjectList(false)}
                className="rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close property list"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[calc(58vh-64px)] overflow-y-auto p-2">
            {visibleProjects.length > 0 ? (
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
                      {project.price}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-white/45">
                    {project.bedrooms} · {project.acres} acres ·{" "}
                    {project.type}
                  </p>
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-xs text-white/50">
                No properties match the current filters.
              </p>
            )}
          </div>
        </div>
      )}

      {isRadiusFilterOpen && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[82px] z-30 flex justify-center px-3 sm:bottom-[76px] sm:px-5">
          <RadiusArcControl
            radiusInKilometers={radiusInKilometers}
            onRadiusChange={setRadiusInKilometers}
            visibleProjectCount={visibleProjects.length}
            isDarkMap={isDarkMap}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-10 pt-3 sm:px-5 sm:pb-8 sm:pt-5">
        <div className="relative mx-auto w-full max-w-[680px]">
          {!showCityLayers && (
            <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-full border border-white/20 bg-slate-950/90 p-1.5 text-white shadow-2xl backdrop-blur-xl scrollbar-hide">
            <Sparkles className="ml-1.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <div className="flex min-w-max gap-1.5">
              {selectedIntent ? (
                <>
                  <button
                    type="button"
                    onClick={resetMagicFilters}
                    className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-left text-white/70 transition-all hover:border-white/40 hover:bg-white/10 hover:text-white"
                    aria-label="Show all projects"
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
                          {subcategory.label}
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
            Map tiles © OpenStreetMap contributors · {PROJECTS.length} project
            pins imported from the public PlotsView venture catalog.
          </div>
        )}
      </div>
      {selectedPinProject && (
        <ProjectDetailSheet
          project={selectedPinProject}
          onClose={() => setSelectedPinProjectId(null)}
        />
      )}
    </motion.div>
  );
}