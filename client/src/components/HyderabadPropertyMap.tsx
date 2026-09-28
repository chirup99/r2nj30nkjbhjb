import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  Landmark,
  MapPin,
  Maximize2,
  Navigation,
  Ruler,
  Search,
  Sparkles,
  Trees,
  X,
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
} from "@/components/ui/map";
import { PLOTSVIEW_PROJECTS } from "@/data/plotsviewProjects";

type PropertyProject = (typeof PLOTSVIEW_PROJECTS)[number];

const HYDERABAD_CENTER: [number, number] = [78.385, 17.42];
const MAGIC_ANCHOR: [number, number] = [78.386, 17.455];

// Snapshot of every venture currently returned by PlotsView's public catalog.
const PROJECTS: PropertyProject[] = PLOTSVIEW_PROJECTS;

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
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#07111f]/90 to-transparent" />
      <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-white/80">
        <MapPin className="h-3 w-3 text-cyan-300" />
         PlotsView
      </div>
    </div>
  );
}

type ProjectListingDetails = {
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

function getProjectListingDetails(project: PropertyProject) {
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
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white text-slate-900 shadow-[0_-18px_60px_rgba(15,23,42,0.28)]"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} project details`}
    >
      <div className="shrink-0 border-b border-slate-100 bg-white px-4 pb-3 pt-2.5 sm:px-5">
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
}: {
  onClose: () => void;
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
      return matchesMagicFilter && matchesQuery;
    });
  }, [query, selectedIntent, selectedSubcategory]);

  const routeProjectIds = visibleProjects.map((project) => project.id).join(",");
  const selectedPinProject = PROJECTS.find(
    (project) => project.id === selectedPinProjectId,
  );

  useEffect(() => {
    if (!selectedIntent || !selectedSubcategory || visibleProjects.length === 0) {
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
    visibleProjects.length,
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
        <FitProjectPins projects={visibleProjects} />
        {selectedIntent && selectedSubcategory && visibleProjects.length > 0 && (
          <MagicProjectRoute
            projects={visibleProjects}
            intent={selectedIntent}
            subcategoryId={selectedSubcategory.id}
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
                selected={project.id === selectedPinProject?.id}
                onSelect={() => setSelectedPinProjectId(project.id)}
              />
            </MarkerContent>
            <MarkerTooltip>{project.name}</MarkerTooltip>
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
              {selectedIntent
                ? `${visibleProjects.length} ${selectedIntent.label.toLowerCase()} shown`
                : `${visibleProjects.length} of ${PROJECTS.length} projects pinned`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto rounded-full border border-white/30 bg-slate-950/80 p-3 text-white shadow-xl backdrop-blur-md transition-colors hover:bg-slate-900"
            aria-label="Close PlotsView projects map"
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