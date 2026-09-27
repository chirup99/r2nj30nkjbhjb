import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Check,
  Info,
  MapPin,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  Map as PropertyMap,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  RouteProgress,
  useMap,
} from "@/components/ui/map";

type PropertyProject = {
  id: string;
  name: string;
  locality: string;
  developer: string;
  type: string;
  price: string;
  status: string;
  bedrooms: string;
  longitude: number;
  latitude: number;
  accent: string;
};

const HYDERABAD_CENTER: [number, number] = [78.385, 17.42];
const MAGIC_ANCHOR: [number, number] = [78.386, 17.455];

// Curated demo pins for the Hyderabad discovery experience. Exact availability
// and pricing should come from a verified listings feed before launch.
const PROJECTS: PropertyProject[] = [
  {
    id: "my-home-bhooja",
    name: "My Home Bhooja",
    locality: "HITEC City",
    developer: "My Home Constructions",
    type: "High-rise residences",
    price: "₹2.1 Cr onwards",
    status: "Ready to move",
    bedrooms: "3 & 4 BHK",
    longitude: 78.3547,
    latitude: 17.4228,
    accent: "#7c3aed",
  },
  {
    id: "rajapushpa-provincia",
    name: "Rajapushpa Provincia",
    locality: "Narsingi",
    developer: "Rajapushpa Properties",
    type: "Gated community",
    price: "₹1.3 Cr onwards",
    status: "Under construction",
    bedrooms: "2, 3 & 4 BHK",
    longitude: 78.3257,
    latitude: 17.3918,
    accent: "#f59e0b",
  },
  {
    id: "aparna-sarovar-zenith",
    name: "Aparna Sarovar Zenith",
    locality: "Nallagandla",
    developer: "Aparna Constructions",
    type: "Premium apartments",
    price: "₹1.5 Cr onwards",
    status: "Ready to move",
    bedrooms: "2, 3 & 4 BHK",
    longitude: 78.3035,
    latitude: 17.472,
    accent: "#10b981",
  },
  {
    id: "prestige-city",
    name: "Prestige City Hyderabad",
    locality: "Rajendra Nagar",
    developer: "Prestige Group",
    type: "Integrated township",
    price: "₹1.1 Cr onwards",
    status: "New launch",
    bedrooms: "2, 3 & 4 BHK",
    longitude: 78.412,
    latitude: 17.315,
    accent: "#ec4899",
  },
  {
    id: "kokapet-heights",
    name: "Kokapet Heights",
    locality: "Kokapet",
    developer: "Curated area watchlist",
    type: "New launch corridor",
    price: "₹95 L onwards",
    status: "Explore area",
    bedrooms: "2 & 3 BHK",
    longitude: 78.334,
    latitude: 17.384,
    accent: "#06b6d4",
  },
];

const MAGIC_INTENTS = [
  {
    id: "uber-class",
    label: "Uber-class",
    detail: "Signature living",
    projectId: "my-home-bhooja",
    accent: "#8b5cf6",
  },
  {
    id: "ultra-luxury",
    label: "Ultra luxury",
    detail: "Premium shortlist",
    projectId: "aparna-sarovar-zenith",
    accent: "#ec4899",
  },
  {
    id: "ready-now",
    label: "Ready to move",
    detail: "Move in sooner",
    projectId: "my-home-bhooja",
    accent: "#10b981",
  },
  {
    id: "growth-pick",
    label: "Growth pick",
    detail: "West Hyderabad",
    projectId: "rajapushpa-provincia",
    accent: "#f59e0b",
  },
] as const;

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
  project,
  intent,
  progress,
}: {
  project: PropertyProject;
  intent: (typeof MAGIC_INTENTS)[number];
  progress: number;
}) {
  const { map, isLoaded } = useMap();
  const [routeStart, setRouteStart] =
    useState<[number, number]>(MAGIC_ANCHOR);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const updateRouteStart = () => {
      const button = document.querySelector<HTMLElement>(
        `[data-magic-intent="${intent.id}"]`,
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
  }, [intent.id, isLoaded, map]);

  const route = createCurvedRoute(routeStart, [
    project.longitude,
    project.latitude,
  ]);

  return (
    <MapRoute
      id="magic-project-route"
      coordinates={route}
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
  );
}

function PropertyPin({
  accent,
  selected = false,
}: {
  accent: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`relative h-10 w-10 transition-transform ${
        selected ? "scale-125" : ""
      }`}
      aria-hidden="true"
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
    </div>
  );
}

export function HyderabadPropertyMapThumbnail() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-[#121b2a]">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute -left-8 top-10 h-24 w-48 rotate-12 rounded-full border border-cyan-300/20" />
        <div className="absolute left-1/4 top-1/3 h-28 w-48 -rotate-12 rounded-full border border-white/10" />
        <div className="absolute left-1/3 top-1/2 h-40 w-px rotate-[35deg] bg-white/20" />
        <div className="absolute left-1/2 top-0 h-48 w-px rotate-[65deg] bg-white/15" />
        <div className="absolute right-0 top-1/2 h-px w-48 -rotate-12 bg-white/15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_48%,rgba(34,211,238,0.3),transparent_26%),linear-gradient(135deg,rgba(16,185,129,0.14),transparent_55%)]" />
      </div>
      {PROJECTS.slice(0, 4).map((project, index) => (
        <span
          key={project.id}
          className="absolute h-2.5 w-2.5 rounded-full border border-white shadow-[0_0_10px_currentColor]"
          style={{
            left: `${26 + (index % 2) * 28 + index * 2}%`,
            top: `${27 + index * 13}%`,
            color: project.accent,
            backgroundColor: project.accent,
          }}
        />
      ))}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#07111f]/90 to-transparent" />
      <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-white/80">
        <MapPin className="h-3 w-3 text-cyan-300" />
        Hyderabad
      </div>
    </div>
  );
}

export function HyderabadPropertyMapOverlay({
  onClose,
}: {
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<"all" | "ready" | "new">("all");
  const [showMapInfo, setShowMapInfo] = useState(false);
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
  const [routeProgress, setRouteProgress] = useState(0);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return PROJECTS.filter((project) => {
      const matchesQuery =
        !normalizedQuery ||
        `${project.name} ${project.locality} ${project.developer}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesType =
        activeType === "all" ||
        (activeType === "ready" && project.status === "Ready to move") ||
        (activeType === "new" && project.status !== "Ready to move");
      return matchesQuery && matchesType;
    });
  }, [activeType, query]);

  const selectedIntent = MAGIC_INTENTS.find(
    (intent) => intent.id === selectedIntentId,
  );
  const selectedProject = PROJECTS.find(
    (project) => project.id === selectedIntent?.projectId,
  );

  useEffect(() => {
    if (!selectedProject) {
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
  }, [selectedProject?.id]);

  const chooseMagicIntent = (intentId: string) => {
    if (selectedIntentId === intentId) {
      setSelectedIntentId(null);
      return;
    }

    setSelectedIntentId(intentId);
    setActiveType("all");
    setQuery("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] overflow-hidden bg-[#07111f]"
      role="dialog"
      aria-modal="true"
      aria-label="Hyderabad property map"
    >
      <PropertyMap
        center={HYDERABAD_CENTER}
        zoom={10.65}
        theme="light"
        attributionControl={false}
        className="h-full w-full"
      >
        <MapControls
          position="bottom-right"
          showZoom={false}
          showLocate
          className="!bottom-28"
        />
        {selectedProject && selectedIntent && (
          <MagicProjectRoute
            project={selectedProject}
            intent={selectedIntent}
            progress={routeProgress}
          />
        )}
        {visibleProjects.map((project) => (
          <MapMarker
            key={project.id}
            longitude={project.longitude}
            latitude={project.latitude}
          >
            <MarkerContent>
              <PropertyPin
                accent={project.accent}
                selected={project.id === selectedProject?.id}
              />
            </MarkerContent>
            <MarkerTooltip>{project.name}</MarkerTooltip>
            <MarkerPopup closeButton>
              <div className="min-w-[220px] space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">
                      {project.name}
                    </p>
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project.accent }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {project.locality} · {project.developer}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-muted px-2 py-1.5">
                    <p className="text-muted-foreground">From</p>
                    <p className="font-semibold text-foreground">
                      {project.price}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted px-2 py-1.5">
                    <p className="text-muted-foreground">Layout</p>
                    <p className="font-semibold text-foreground">
                      {project.bedrooms}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                  {project.status}
                </div>
              </div>
            </MarkerPopup>
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
                placeholder="Search locality or project"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
                aria-label="Search Hyderabad projects"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto rounded-full border border-white/30 bg-slate-950/80 p-3 text-white shadow-xl backdrop-blur-md transition-colors hover:bg-slate-900"
            aria-label="Close Hyderabad property map"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-10 pt-3 sm:px-5 sm:pb-8 sm:pt-5">
        <div className="relative mx-auto w-full max-w-[680px]">
          <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-full border border-white/20 bg-slate-950/90 p-1.5 text-white shadow-2xl backdrop-blur-xl scrollbar-hide">
            <Sparkles className="ml-1.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <div className="flex min-w-max gap-1.5">
              {MAGIC_INTENTS.map((intent) => {
                const isSelected = selectedIntentId === intent.id;
                return (
                  <button
                    key={intent.id}
                    type="button"
                    data-magic-intent={intent.id}
                    onClick={() => chooseMagicIntent(intent.id)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "border-white/80 bg-white text-slate-950 shadow-lg"
                        : "border-white/10 bg-white/5 text-white/75 hover:border-cyan-300/50 hover:bg-white/10"
                    }`}
                  >
                    <span className="block truncate text-[10px] font-bold">
                      {intent.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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
            Map tiles © OpenStreetMap contributors · project pins are curated
            demo data for the product concept.
          </div>
        )}
      </div>
    </motion.div>
  );
}