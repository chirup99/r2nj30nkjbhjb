import { QRCodeSVG } from "qrcode.react";
import * as htmlToImage from "html-to-image";
import { BrowserMultiFormatReader } from "@zxing/library";

// ... existing imports
import { useState, useMemo, useEffect, useRef, forwardRef } from "react";
import { useLocation } from "wouter";
import {
  Infinity as InfinityIcon,
  ArrowRight,
  Loader2,
  Play,
  Mic,
  QrCode,
  Instagram,
  Linkedin,
  MessageCircle,
  Globe,
  Save,
  Check,
  ChevronDown,
  Plus,
  X,
  Trash2,
  TrendingUp,
  Video,
  Package,
  FileText,
  User,
  Pencil,
  Palette,
  Layout,
  Mail,
  Navigation,
  Info,
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  CheckCircle2,
  ChevronRight,
  Building2,
  Search,
  Lock,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertUserSchema,
  type InsertUser,
  type CardData,
} from "@shared/schema";
import { useLogin, useRegister, useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import clsx from "clsx";
import { SiInstagram, SiWhatsapp, SiX } from "react-icons/si";
import avatarWoman from "@assets/female.png";
import avatarMan from "@assets/male.png";
import villaSunset from "@assets/generated_images/rciq-villa-sunset.png";
import villaCommunity from "@assets/generated_images/rciq-community.png";
import apartmentResidence from "@assets/generated_images/rciq-residence.png";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import {
  Map as PersonaMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
} from "@/components/ui/map";
import {
  HyderabadPropertyMapOverlay,
  HyderabadPropertyMapThumbnail,
} from "@/components/HyderabadPropertyMap";
import { PropertyMeetupMark } from "@/components/PropertyMeetupMark";
import { PLOTSVIEW_PROJECTS } from "@/data/plotsviewProjects";

type AuthMode = "login" | "register" | "customize" | "swipe";

type PropertyEvent = {
  id: string;
  title: string;
  type: string;
  propertyType: "Villa" | "Plots" | "Flat" | "Meetup";
  dateLabel: string;
  timeLabel: string;
  location: string;
  area: string;
  host: string;
  description: string;
  attendees: number;
  capacity: number;
  icon: typeof Building2;
};

const PROPERTY_EVENTS: PropertyEvent[] = [
  {
    id: "uber-villa-luxury-walkthrough",
    title: "Uber Villa Luxury Walkthrough",
    type: "Villa visit",
    propertyType: "Villa",
    dateLabel: "Sunday, 4 October",
    timeLabel: "11:00 AM – 1:00 PM",
    location: "Uber Villa Luxury, Kokapet",
    area: "West Hyderabad",
    host: "Uber Villa Luxury",
    description:
      "Walk through the show villa, compare floor plans, and meet the project team on site.",
    attendees: 18,
    capacity: 30,
    icon: Building2,
  },
  {
    id: "financial-district-investor-open-house",
    title: "Financial District Investor Open House",
    type: "Investor meetup",
    propertyType: "Meetup",
    dateLabel: "Sunday, 11 October",
    timeLabel: "4:00 PM – 6:00 PM",
    location: "The Grand Courtyard, Nanakramguda",
    area: "Financial District",
    host: "RCiQ-AI Curated",
    description:
      "Meet developers, understand rental demand, and see the strongest investment-ready projects nearby.",
    attendees: 24,
    capacity: 40,
    icon: Users,
  },
  {
    id: "lakefront-plots-site-meet",
    title: "Lakefront Plots Site Meet",
    type: "Site visit",
    propertyType: "Plots",
    dateLabel: "Saturday, 17 October",
    timeLabel: "9:30 AM – 12:00 PM",
    location: "Lakefront Estates, Shamirpet",
    area: "North Hyderabad",
    host: "Lakefront Estates",
    description:
      "See the plotted development in person, review approvals, and ask the sales team anything before you visit again.",
    attendees: 11,
    capacity: 25,
    icon: MapPin,
  },
  {
    id: "kokapet-skyline-flat-open-house",
    title: "Kokapet Skyline Flat Open House",
    type: "Flat open house",
    propertyType: "Flat",
    dateLabel: "Sunday, 25 October",
    timeLabel: "2:00 PM – 5:00 PM",
    location: "Skyline Residences, Kokapet",
    area: "West Hyderabad",
    host: "Skyline Residences",
    description:
      "Tour the model flat, compare 2 and 3 BHK layouts, and speak with the project team about possession and pricing.",
    attendees: 15,
    capacity: 35,
    icon: Building2,
  },
];

const PROPERTY_ADS = [
  {
    eyebrow: "LUXURY VILLAS · WEST HYDERABAD",
    title: "A better address starts here.",
    description: "Explore design-led villas made for the way you want to live.",
    cta: "Explore villas",
    image: villaSunset,
  },
  {
    eyebrow: "GATED COMMUNITIES · HYDERABAD",
    title: "Find space for what matters.",
    description: "Compare curated villa communities with confidence.",
    cta: "View communities",
    image: villaCommunity,
  },
  {
    eyebrow: "PREMIUM RESIDENCES · HYDERABAD",
    title: "Your next move, made clearer.",
    description: "Discover apartments with the details that help you decide.",
    cta: "See residences",
    image: apartmentResidence,
  },
] as const;

function getPropertyProjectImage(project: (typeof PLOTSVIEW_PROJECTS)[number], index: number) {
  const projectType = project.type.toLowerCase();

  if (projectType.includes("flat") || projectType.includes("apartment")) {
    return apartmentResidence;
  }

  if (projectType.includes("villa")) {
    return villaSunset;
  }

  return index % 2 === 0 ? villaCommunity : villaSunset;
}

function PropertyProjectFeed({
  onProjectSelect,
}: {
  onProjectSelect: (projectId: string) => void;
}) {
  return (
    <section
      aria-labelledby="mapped-projects-heading"
      className="mt-2 w-full space-y-3 text-left"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-purple-300">
            Map collection
          </p>
          <h4
            id="mapped-projects-heading"
            className="mt-1 text-base font-bold tracking-tight text-white"
          >
            Projects on your map
          </h4>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/45">
          {PLOTSVIEW_PROJECTS.length} sites
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-white/40">
        Explore every mapped project with local details and current plot pricing.
        Tap a card to open its full listing.
      </p>

      <div className="space-y-2.5 pr-1">
        {PLOTSVIEW_PROJECTS.map((project, index) => (
          <motion.button
            key={project.id}
            type="button"
            onClick={() => onProjectSelect(project.id)}
            className="group grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 text-left transition-all hover:border-purple-300/40 hover:bg-white/[0.07] hover:shadow-[0_8px_24px_rgba(124,58,237,0.14)]"
          >
            <div className="relative min-h-[92px] overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <img
                src={getPropertyProjectImage(project, index)}
                alt={`${project.name} property`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full border border-white/20 bg-black/35 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
                <MapPin className="h-3 w-3" />
                View on map
              </span>
            </div>
            <div className="flex min-w-0 flex-col justify-between gap-1.5 py-0.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15"
                  style={{
                    backgroundColor: `${project.accent}22`,
                    color: project.accent,
                  }}
                >
                  <MapPin className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                    <h5 className="text-xs font-bold leading-tight text-white group-hover:text-purple-200">
                    {project.name}
                    </h5>
                    <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.08em] text-white/40">
                    {project.locality} · {project.approvalType}
                    </p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-white/30">
                  Price
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-emerald-300">
                  {project.price}
                  </p>
                </div>
                <div className="rounded-lg bg-black/20 px-2.5 py-2">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-white/30">
                  Plot range
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-white/75">
                  {project.bedrooms}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-[9px] leading-tight text-white/40">
                <p className="truncate">{project.type}</p>
                <p className="shrink-0">
                  {project.acres} acres · {project.totalPlots} plots
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

    </section>
  );
}

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+47", country: "Norway", flag: "🇳🇴" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+43", country: "Austria", flag: "🇦🇹" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+60", country: "Malaysia", flag: "🇲🇾" },
];

const CARD_TYPES = [
  {
    type: "property",
    label: "Property / Villa",
    icon: Building2,
    color: "from-slate-900 via-purple-950 to-slate-950",
  },
  {
    type: "reel",
    label: "Reel / Short",
    icon: Video,
    color: "from-purple-500 to-purple-600",
  },
  {
    type: "revenue",
    label: "Revenue / Sales",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-600",
  },
  {
    type: "traction",
    label: "Traction / Growth",
    icon: TrendingUp,
    color: "from-amber-500 to-amber-600",
  },
  {
    type: "product",
    label: "Product Show",
    icon: Package,
    color: "from-orange-500 to-orange-600",
  },
  {
    type: "tweet",
    label: "X Tweet",
    icon: SiX,
    color: "from-neutral-900 to-black",
  },
];

const ROLES = [
  { value: "founder", label: "Founder" },
  { value: "co-founder", label: "Co-Founder" },
  { value: "ceo", label: "CEO" },
  { value: "cto", label: "CTO" },
  { value: "cmo", label: "CMO" },
  { value: "coo", label: "COO" },
  { value: "cfo", label: "CFO" },
  { value: "director", label: "Director" },
  { value: "investor", label: "Investor" },
  { value: "vc", label: "VC (Venture Capitalist)" },
  { value: "angel-investor", label: "Angel Investor" },
  { value: "advisor", label: "Advisor" },
  { value: "consultant", label: "Consultant" },
  { value: "lawyer", label: "Lawyer" },
  { value: "mentor", label: "Mentor" },
  { value: "product-manager", label: "Product Manager" },
  { value: "software-engineer", label: "Software Engineer" },
  { value: "designer", label: "UI/UX Designer" },
  { value: "marketing-specialist", label: "Marketing Specialist" },
  { value: "sales-executive", label: "Sales Executive" },
  { value: "hr-manager", label: "HR Manager" },
  { value: "student", label: "Student" },
  { value: "intern", label: "Intern" },
  { value: "employee", label: "Employee" },
  { value: "startup-enthusiast", label: "Startup Enthusiast" },
  { value: "business-owner", label: "Business Owner" },
  { value: "freelancer", label: "Freelancer" },
  { value: "other", label: "Other" },
];

const CARDS = [
  {
    id: 1,
    type: "property",
    title: "PREMIUM VILLA",
    name: "Palm Grove Villas",
    subname: "Kokapet · West Hyderabad",
    location: "Kokapet, Hyderabad",
    price: "₹2.4 Cr onwards",
    details: "4 BHK · 3,200 sq ft",
    imageUrl: villaSunset,
    color: "from-slate-900 via-purple-950 to-slate-950",
    bgStack1: "bg-purple-950/50",
    bgStack2: "bg-slate-950/60",
  },
  {
    id: 2,
    type: "property",
    title: "GATED COMMUNITY",
    name: "The Courtyard",
    subname: "Financial District · Hyderabad",
    location: "Nanakramguda, Hyderabad",
    price: "₹1.85 Cr onwards",
    details: "3 BHK · 2,450 sq ft",
    imageUrl: villaCommunity,
    color: "from-emerald-950 via-teal-900 to-slate-950",
    bgStack1: "bg-teal-950/50",
    bgStack2: "bg-emerald-950/60",
  },
  {
    id: 3,
    type: "property",
    title: "MODERN RESIDENCES",
    name: "Aster Heights",
    subname: "Narsingi · West Hyderabad",
    location: "Narsingi, Hyderabad",
    price: "₹1.25 Cr onwards",
    details: "3 BHK · 1,980 sq ft",
    imageUrl: apartmentResidence,
    color: "from-blue-950 via-indigo-900 to-slate-950",
    bgStack1: "bg-indigo-950/50",
    bgStack2: "bg-blue-950/60",
  },
  {
    id: 4,
    type: "property",
    title: "LAKEFRONT VILLAS",
    name: "Willow Creek",
    subname: "Shamirpet · North Hyderabad",
    location: "Shamirpet, Hyderabad",
    price: "₹98 L onwards",
    details: "3 BHK · 2,200 sq ft",
    imageUrl: villaSunset,
    color: "from-amber-950 via-orange-900 to-slate-950",
    bgStack1: "bg-orange-950/50",
    bgStack2: "bg-amber-950/60",
  },
  {
    id: 5,
    type: "property",
    title: "SIGNATURE VILLAS",
    name: "Olive Grove",
    subname: "Tellapur · Hyderabad",
    location: "Tellapur, Hyderabad",
    price: "₹1.6 Cr onwards",
    details: "4 BHK · 2,850 sq ft",
    imageUrl: villaCommunity,
    color: "from-rose-950 via-fuchsia-900 to-slate-950",
    bgStack1: "bg-fuchsia-950/50",
    bgStack2: "bg-rose-950/60",
  },
  {
    id: 6,
    type: "property",
    title: "GARDEN VILLAS",
    name: "Cedar Grove",
    subname: "Gachibowli · Hyderabad",
    location: "Gachibowli, Hyderabad",
    price: "₹1.95 Cr onwards",
    details: "4 BHK · 2,900 sq ft",
    imageUrl: villaSunset,
    color: "from-cyan-950 via-sky-900 to-slate-950",
    bgStack1: "bg-sky-950/50",
    bgStack2: "bg-cyan-950/60",
  },
  {
    id: 7,
    type: "property",
    title: "SKYLINE RESIDENCES",
    name: "The Vertex",
    subname: "Kondapur · Hyderabad",
    location: "Kondapur, Hyderabad",
    price: "₹1.1 Cr onwards",
    details: "3 BHK · 1,850 sq ft",
    imageUrl: apartmentResidence,
    color: "from-violet-950 via-indigo-900 to-slate-950",
    bgStack1: "bg-violet-950/50",
    bgStack2: "bg-indigo-950/60",
  },
  {
    id: 8,
    type: "property",
    title: "HILLSIDE VILLAS",
    name: "Mango Valley",
    subname: "Mokila · West Hyderabad",
    location: "Mokila, Hyderabad",
    price: "₹1.35 Cr onwards",
    details: "3 BHK · 2,400 sq ft",
    imageUrl: villaCommunity,
    color: "from-lime-950 via-green-900 to-slate-950",
    bgStack1: "bg-green-950/50",
    bgStack2: "bg-lime-950/60",
  },
];

type PersonaMapLocation = {
  id: string;
  name: string;
  description: string;
  longitude: number;
  latitude: number;
};

const PERSONA_NETWORK_CENTER: [number, number] = [78.9629, 20.5937];

function PersonaLocationDot() {
  return (
    <div className="relative h-7 w-7" aria-hidden="true">
      <span className="absolute inset-0 rounded-full bg-purple-500/25 shadow-[0_0_18px_rgba(168,85,247,0.7)] ring-1 ring-purple-300/40" />
      <span
        className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-purple-600"
      />
    </div>
  );
}

function PersonaMapThumbnail() {
  const previewZoom = 4;
  const centerX =
    ((PERSONA_NETWORK_CENTER[0] + 180) / 360) * 2 ** previewZoom;
  const centerY =
    ((1 -
      Math.asinh(
        Math.tan((PERSONA_NETWORK_CENTER[1] * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
    2 ** previewZoom;
  const tileOriginX = Math.floor(centerX) - 1;
  const tileOriginY = Math.floor(centerY) - 1;
  const tileSize = 256;
  const tilePositions = Array.from({ length: 9 }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const tileX = tileOriginX + column;
    const tileY = tileOriginY + row;

    return {
      src: `https://tile.openstreetmap.de/${previewZoom}/${tileX}/${tileY}.png`,
      left: (tileX - centerX) * tileSize + 38,
      top: (tileY - centerY) * tileSize + 38,
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div className="absolute inset-0 bg-[#171222]">
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
                "invert(0.9) hue-rotate(180deg) brightness(0.65) saturate(0.8) contrast(1.15)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PersonaMapOverlay({ onClose }: { onClose: () => void }) {
  const [showMapInfo, setShowMapInfo] = useState(false);

  const networkLocation: PersonaMapLocation = {
    id: "persona-network",
    name: "Persona Network",
    description: "Explore the Persona network and find your next connection.",
    longitude: PERSONA_NETWORK_CENTER[0],
    latitude: PERSONA_NETWORK_CENTER[1],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] overflow-hidden bg-[#050505]"
      role="dialog"
      aria-modal="true"
      aria-label="Persona map"
    >
      <PersonaMap
        center={PERSONA_NETWORK_CENTER}
        zoom={4.25}
        theme="dark"
        attributionControl={false}
        className="h-full w-full"
      >
        <MapMarker
          longitude={networkLocation.longitude}
          latitude={networkLocation.latitude}
        >
          <MarkerContent>
            <PersonaLocationDot />
          </MarkerContent>
          <MarkerTooltip>{networkLocation.name}</MarkerTooltip>
          <MarkerPopup closeButton>
            <div className="min-w-[190px] space-y-2">
              <p className="text-foreground text-sm font-bold">
                {networkLocation.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {networkLocation.description}
              </p>
              <div className="flex items-center gap-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-purple-500">
                <Navigation className="h-3.5 w-3.5" />
                Network starting point
              </div>
            </div>
          </MarkerPopup>
        </MapMarker>

      </PersonaMap>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-black/45 p-3 text-white/75 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Close map"
      >
        <X className="h-5 w-5" />
      </button>

      {showMapInfo && (
        <div className="absolute bottom-16 right-4 z-20 max-w-[260px] rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-[10px] text-white/70 shadow-xl backdrop-blur-md">
          Map tiles © OpenStreetMap contributors
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowMapInfo((visible) => !visible)}
        className="absolute bottom-4 right-4 z-20 rounded-full border border-white/15 bg-black/45 p-2.5 text-white/70 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Map information"
        title="Map information"
      >
        <Info className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

interface SwipeCardProps {
  card: {
    title: string;
    name: string;
    subname: string;
    type?: string;
    location?: string;
    price?: string;
    details?: string;
    imageUrl?: string;
    color: string;
    bgStack1: string;
    bgStack2: string;
  };
  currentIndex: number;
  totalCards: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const getThumbnailUrl = (url: string) => {
  if (!url) return null;
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|v\/|embed\/|reels\/))([\w-]{11})/,
  );
  if (ytMatch)
    return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  return null;
};

const getTweetId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
};

const getTweetEmbedUrl = (url: string): string | null => {
  const id = getTweetId(url);
  return id ? `https://platform.twitter.com/embed/Tweet.html?id=${id}` : null;
};

const TrendLine = () => (
  <div className="w-full h-24 relative mt-4 overflow-hidden rounded-lg bg-black/10 backdrop-blur-sm border border-white/10">
    <svg
      viewBox="0 0 200 100"
      className="w-full h-full preserve-3d"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.8)" />
        </linearGradient>
        <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 0 80 C 20 85, 40 60, 60 75 S 100 50, 120 70 S 160 30, 200 20"
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 3, ease: "linear", repeat: Infinity }}
      />
      <motion.path
        d="M 0 80 C 20 85, 40 60, 60 75 S 100 50, 120 70 S 160 30, 200 20 L 200 100 L 0 100 Z"
        fill="url(#fillGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, ease: "linear", repeat: Infinity }}
      />
    </svg>
  </div>
);

const SwipeCardContent = forwardRef(
  ({ card, currentIndex, onSwipeLeft, onSwipeRight }: SwipeCardProps, ref) => {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-30, 30]);
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [xVideoUrl, setXVideoUrl] = useState<string | null>(null);
    const [xVideoThumbnail, setXVideoThumbnail] = useState<string | null>(null);
    const [isFetchingXVideo, setIsFetchingXVideo] = useState(false);
    const [xVideoError, setXVideoError] = useState<string | null>(null);

    const fetchXVideoSwipe = async (tweetUrl: string) => {
      if (xVideoUrl) { setIsPlaying(true); return; }
      setIsFetchingXVideo(true);
      setXVideoError(null);
      try {
        const res = await fetch(`/api/tweet-video?url=${encodeURIComponent(tweetUrl)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load video");
        setXVideoUrl(data.videoUrl);
        setXVideoThumbnail(data.thumbnailUrl || null);
        setIsPlaying(true);
      } catch (err: any) {
        setXVideoError(err.message || "Could not load video");
      } finally {
        setIsFetchingXVideo(false);
      }
    };

    const handleSpeak = async (text: string) => {
      if (isSpeaking) {
        const audio = document.getElementById(
          "edge-tts-audio",
        ) as HTMLAudioElement;
        if (audio) {
          audio.pause();
          audio.src = "";
        }
        setIsSpeaking(false);
        return;
      }

      if (!text) return;

      setIsSpeaking(true);
      try {
        // Prioritize Edge Neural voices if available in the browser
        const voices = window.speechSynthesis.getVoices();
        const edgeNaturalVoice = voices.find(
          (v) =>
            v.name.includes("Natural") &&
            v.name.includes("Microsoft") &&
            v.lang.startsWith("en"),
        );

        if (edgeNaturalVoice && !window.chrome) {
          // window.chrome check is a rough proxy for "might be in Edge/Chrome with online voices"
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = edgeNaturalVoice;
          utterance.pitch = 1;
          utterance.rate = 1;
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          // Fallback to a high-quality neural-like TTS proxy that uses Microsoft Edge voices
          // This is a common public endpoint used for accessing Edge TTS without an API key
          const voice = "en-US-AndrewNeural";
          const url = `https://api.lowline.ai/v1/tts?text=${encodeURIComponent(text)}&voice=${voice}`;

          let audio = document.getElementById(
            "edge-tts-audio",
          ) as HTMLAudioElement;
          if (!audio) {
            audio = document.createElement("audio");
            audio.id = "edge-tts-audio";
            audio.style.display = "none";
            document.body.appendChild(audio);
          }

          audio.src = url;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => {
            // Final fallback to Google TTS if the neural proxy fails
            audio.src = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
            audio.play().catch(() => setIsSpeaking(false));
          };
          await audio.play();
        }
      } catch (error) {
        console.error("TTS Error:", error);
        setIsSpeaking(false);
      }
    };

    const thumbnailUrl = useMemo(() => {
      if (card.type !== "reel") return null;
      const url = (card as any).url;
      if (!url) return null;
      const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|v\/|embed\/|reels\/))([\w-]{11})/,
      );
      if (ytMatch)
        return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
      return null;
    }, [card.type, (card as any).url]);

    const embedUrl = useMemo(() => {
      if (card.type !== "reel") return null;
      const url = (card as any).url;
      if (!url) return null;
      const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|v\/|embed\/|reels\/))([\w-]{11})/,
      );
      if (ytMatch)
        return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&loop=1&playlist=${ytMatch[1]}&modestbranding=1&rel=0`;
      const igMatch = url.match(
        /(?:instagram\.com\/(?:reels|reel|p|tv)\/)([\w-]+)/,
      );
      if (igMatch) return `https://www.instagram.com/reel/${igMatch[1]}/embed/`;
      return null;
    }, [card.type, (card as any).url]);

    const swipeCardTweetEmbedUrl = useMemo(() => {
      if (card.type !== "tweet") return null;
      return getTweetEmbedUrl((card as any).tweetUrl || "");
    }, [card.type, (card as any).tweetUrl]);

    return (
      <motion.div
        ref={ref}
        key={currentIndex}
        style={{ x, rotate, opacity }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) onSwipeLeft();
          else if (info.offset.x > 80) onSwipeRight();
        }}
        className={clsx(
          "absolute inset-0 bg-gradient-to-b rounded-[24px] p-4 shadow-2xl cursor-grab active:cursor-grabbing overflow-hidden group",
          card.color,
        )}
      >
        {isPlaying && card.type === "reel" ? (
          <div className="absolute inset-0 z-50 bg-black">
            {embedUrl ? (
              <div className="w-full h-full overflow-hidden flex items-center justify-center">
                <iframe
                  src={embedUrl}
                  className="w-full h-[calc(100%+80px)] -mt-[40px] border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="text-white text-xs p-4 text-center h-full flex items-center justify-center">
                Invalid Video URL
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(false);
              }}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-[60]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : isPlaying && card.type === "tweet" && (card as any).tweetType === "video" && xVideoUrl ? (
          <div className="absolute inset-0 z-50 bg-black rounded-[24px] overflow-hidden">
            <video
              src={xVideoUrl}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "contain", objectPosition: "center" }}
              autoPlay
              controls
              playsInline
            />
            <button
              onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-[60]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : isPlaying && card.type === "tweet" && (card as any).tweetType === "text" ? (
          <div className="absolute inset-0 z-50 bg-black rounded-[24px] overflow-hidden">
            {swipeCardTweetEmbedUrl ? (
              <div className="w-full h-full overflow-hidden bg-white">
                <div className="flex items-center gap-2 px-4 py-2 bg-black">
                  <SiX className="w-3.5 h-3.5 text-white" />
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest">X Tweet</span>
                </div>
                <iframe
                  src={swipeCardTweetEmbedUrl}
                  className="w-full border-0"
                  style={{ height: "calc(100% - 36px)" }}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </div>
            ) : (
              <div className="text-white text-xs p-4 text-center h-full flex items-center justify-center">
                Invalid tweet URL
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-[60]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-white/90 text-[9px] font-bold tracking-[0.2em] uppercase">
                {card.title}
              </span>
              {card.type !== "product" && card.type !== "tweet" && (
                <Mic className="w-3.5 h-3.5 text-white/90" />
              )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center w-full space-y-3">
              {card.type === "reel" ? (
                thumbnailUrl ? (
                  <div
                    className="w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-white/10 cursor-pointer group/thumb relative"
                    onClick={() => setIsPlaying(true)}
                  >
                    <img
                      src={thumbnailUrl}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110"
                      alt="Thumbnail"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          thumbnailUrl.replace("maxresdefault", "hqdefault");
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-6 h-6 text-white fill-current" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center space-y-3 py-4 cursor-pointer"
                    onClick={() => setIsPlaying(true)}
                  >
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Video className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-white text-xl font-bold">
                        {card.name}
                      </h3>
                      <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">
                        Watch Reel
                      </p>
                    </div>
                  </div>
                )
              ) : card.type === "property" ? (
                <div className="w-full space-y-3">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/15 bg-black/20 shadow-lg">
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
                    <span className="absolute bottom-2 left-2 rounded-full border border-white/20 bg-black/40 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white/85 backdrop-blur-sm">
                      {card.location}
                    </span>
                  </div>
                  <div className="text-center">
                    <h3 className="text-white text-xl font-bold leading-tight">
                      {card.name}
                    </h3>
                    <p className="mt-1 text-white/60 text-[10px] uppercase tracking-wider font-bold">
                      {card.subname}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2 text-[10px]">
                      <span className="rounded-full bg-white/15 px-2.5 py-1 font-bold text-emerald-200">
                        {card.price}
                      </span>
                      <span className="text-white/55">{card.details}</span>
                    </div>
                  </div>
                </div>
              ) : card.type === "product" ? (
                (card as any).imageUrl ? (
                  <div className="w-full aspect-square rounded-xl overflow-hidden shadow-lg border border-white/10 mb-4">
                    <img
                      src={(card as any).imageUrl}
                      className="w-full h-full object-cover"
                      alt={card.name}
                    />
                  </div>
                ) : (
                  <div className="text-center space-y-0.5">
                    <h3 className="text-white text-2xl font-bold leading-tight">
                      {card.name}
                    </h3>
                    <h3 className="text-white text-sm opacity-60 font-medium leading-tight line-clamp-2 px-2">
                      {card.subname}
                    </h3>
                  </div>
                )
              ) : card.type === "revenue" || card.type === "traction" ? (
                <div className="w-full flex flex-col items-center">
                  <div className="text-center space-y-0.5 mb-2">
                    <h3 className="text-white text-3xl font-bold leading-tight">
                      {card.name}
                    </h3>
                    <h3 className="text-white text-sm opacity-60 font-medium leading-tight uppercase tracking-wider">
                      {card.subname}
                    </h3>
                  </div>
                  <TrendLine />
                </div>
              ) : card.type === "tweet" ? (
                <div
                  className="flex flex-col items-center justify-center space-y-3 py-4 cursor-pointer"
                  onClick={() => {
                    if ((card as any).tweetType === "video" && (card as any).tweetUrl) {
                      fetchXVideoSwipe((card as any).tweetUrl);
                    } else {
                      setIsPlaying(true);
                    }
                  }}
                >
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                    {isFetchingXVideo ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (card as any).tweetType === "video" ? (
                      <Play className="w-8 h-8 text-white fill-current" />
                    ) : (
                      <SiX className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-white text-xl font-bold">{card.name}</h3>
                    <p className="text-white/60 text-[10px] uppercase tracking-widest font-bold">
                      {isFetchingXVideo ? "Loading..." : xVideoError ? xVideoError : (card as any).tweetType === "video" ? "Tap to play" : "X Tweet"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-0.5">
                  <h3 className="text-white text-2xl font-bold leading-tight">
                    {card.name}
                  </h3>
                  <h3 className="text-white text-sm opacity-60 font-medium leading-tight line-clamp-2 px-2">
                    {card.subname}
                  </h3>
                  {card.type === "pitch" && (card as any).content && (
                    <p className="text-white/80 text-xs mt-2 px-4 line-clamp-3">
                      {(card as any).content}
                    </p>
                  )}
                </div>
              )}
            </div>

            {card.type !== "property" &&
              card.type !== "product" &&
              card.type !== "traction" &&
              card.type !== "revenue" && (
                <div className="w-full">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (card.type === "pitch" && (card as any).content) {
                        handleSpeak((card as any).content);
                      } else if (card.type === "tweet" && (card as any).tweetType === "video" && (card as any).tweetUrl) {
                        fetchXVideoSwipe((card as any).tweetUrl);
                      } else {
                        setIsPlaying(true);
                      }
                    }}
                    className="w-full bg-white text-black rounded-full py-3 flex items-center justify-center gap-2 font-bold shadow-xl hover:scale-105 transition-transform text-sm"
                  >
                    {isSpeaking ? (
                      <>
                        <Mic className="w-3.5 h-3.5 animate-pulse text-red-500" />
                        Speaking...
                      </>
                    ) : isFetchingXVideo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading...
                      </>
                    ) : card.type === "tweet" ? (
                      <>
                        {(card as any).tweetType === "video" ? (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <SiX className="w-3.5 h-3.5" />
                        )}
                        {(card as any).tweetType === "video" ? "Play X Video" : "View Tweet"}
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Play Now
                      </>
                    )}
                  </button>
                </div>
              )}
          </div>
        )}
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>
    );
  },
);

SwipeCardContent.displayName = "SwipeCardContent";

const SwipeCard = ({
  cards,
  user: propsUser,
}: {
  cards: string[];
  user?: any;
}) => {
  const displayCards = useMemo(() => {
    if (cards.length > 0) {
      return cards.map((c) => {
        try {
          const card = JSON.parse(c);
          if (!card || !card.type) return CARDS[0];
          const typeInfo = CARD_TYPES.find((t) => t.type === card.type);

          // Set name field based on card type
          let name = card.title || "Untitled";
          if (card.type === "revenue" || card.type === "traction") {
            name = card.value || card.title || "Growth";
          } else if (card.type === "reel") {
            name = card.title || "Video";
          } else if (card.type === "product") {
            name = card.title || "Product";
          } else if (card.type === "tweet") {
            name = card.title || (card.tweetType === "video" ? "X Video" : "X Tweet");
          }

          // Determine subname based on card type
          let subname = "";
          if (card.type === "reel") {
            subname = card.url || "";
          } else if (card.type === "revenue") {
            subname = card.revenue || "Sales";
          } else if (card.type === "traction") {
            subname = card.traction || "Growth";
          } else if (card.type === "tweet") {
            subname = card.tweetUrl || "";
          } else {
            subname = card.url || "Persona";
          }

          return {
            ...card,
            type: card.type,
            title: card.title || "Untitled",
            name: name,
            subname: subname,
            thumbnailUrl:
              card.type === "reel" ? getThumbnailUrl(card.url) : null,
            color: typeInfo?.color || "from-gray-700 to-gray-800",
            bgStack1: "bg-black/20",
            bgStack2: "bg-black/10",
          };
        } catch (e) {
          return CARDS[0];
        }
      });
    }

    // If we are viewing another persona (isOtherPersona) or we are a logged in user with no cards
    // and cards array is empty, show the "NO CARDS" state instead of demo cards.
    if (propsUser || (cards.length === 0 && window.location.pathname !== "/")) {
      return [
        {
          title: "NO CARDS",
          name: "EMPTY",
          subname: "PERSONA",
          color: "from-gray-800 to-gray-900",
          bgStack1: "bg-black/20",
          bgStack2: "bg-black/10",
        },
      ];
    }

    return CARDS.map((c) => ({
      ...c,
      name: c.name.toUpperCase(),
      subname: c.subname.toUpperCase(),
    }));
  }, [cards, propsUser]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index if displayCards changes and current index is out of bounds
  useEffect(() => {
    if (currentIndex >= displayCards.length) {
      setCurrentIndex(0);
    }
  }, [displayCards.length, currentIndex]);

  const handleSwipeLeft = () => {
    if (displayCards.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % displayCards.length);
  };

  const handleSwipeRight = () => {
    if (displayCards.length === 0) return;
    setCurrentIndex(
      (prev) => (prev - 1 + displayCards.length) % displayCards.length,
    );
  };

  const currentCard = displayCards[currentIndex];

  if (!currentCard) return null;

  // Get next two cards for the stack effect
  const nextCard = displayCards[(currentIndex + 1) % displayCards.length];
  const nextNextCard = displayCards[(currentIndex + 2) % displayCards.length];

  return (
    <div className="mx-auto w-full max-w-[240px]">
      <div className="relative aspect-[3/4] w-full perspective-1000">
        {/* Background stacked cards - only show if there's more than 1 card */}
        {displayCards.length > 1 && (
          <>
            {/* Second card - furthest back */}
            <div
              className={clsx(
                "absolute inset-0 rounded-[24px] pointer-events-none z-0 shadow-2xl bg-gradient-to-b",
                nextNextCard?.color || "from-gray-700 to-gray-800",
              )}
              style={{
                transform: "translateY(24px) translateX(12px) scale(0.98)",
              }}
            >
              <div className="absolute inset-0 bg-black/40 rounded-[24px]" />
            </div>
            {/* First card - middle layer */}
            <div
              className={clsx(
                "absolute inset-0 rounded-[24px] pointer-events-none z-10 shadow-xl bg-gradient-to-b",
                nextCard?.color || "from-gray-700 to-gray-800",
              )}
              style={{
                transform: "translateY(12px) translateX(6px) scale(0.99)",
              }}
            >
              <div className="absolute inset-0 bg-black/25 rounded-[24px]" />
            </div>
          </>
        )}

        {/* Main card - front */}
        <SwipeCardContent
          key={currentIndex}
          card={currentCard}
          currentIndex={currentIndex}
          totalCards={displayCards.length}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
        />
      </div>

      <div
        className="relative z-10 mt-8 space-y-2 px-2 pt-1"
        aria-label="Saved card progress"
      >
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
          <span>Property cards</span>
          <span className="tabular-nums text-white/75">
            {currentIndex + 1} / {displayCards.length}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-purple-400 to-emerald-300"
            animate={{
              width: `${((currentIndex + 1) / displayCards.length) * 100}%`,
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
};

const MiniCard = ({
  idx,
  cardJson,
  onUpdate,
  onDelete,
}: {
  idx: number;
  cardJson?: string;
  onUpdate: (json: string) => void;
  onDelete: () => void;
}) => {
  const card: CardData | null = useMemo(() => {
    try {
      return cardJson ? JSON.parse(cardJson) : null;
    } catch (e) {
      return null;
    }
  }, [cardJson]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [visibleWords, setVisibleWords] = useState(18);
  const [xVideoUrl, setXVideoUrl] = useState<string | null>(null);
  const [xVideoThumbnail, setXVideoThumbnail] = useState<string | null>(null);
  const [isFetchingXVideo, setIsFetchingXVideo] = useState(false);
  const [xVideoError, setXVideoError] = useState<string | null>(null);

  const fetchXVideo = async (tweetUrl: string) => {
    if (xVideoUrl) { setIsPlaying(true); return; }
    setIsFetchingXVideo(true);
    setXVideoError(null);
    try {
      const res = await fetch(`/api/tweet-video?url=${encodeURIComponent(tweetUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load video");
      setXVideoUrl(data.videoUrl);
      setXVideoThumbnail(data.thumbnailUrl || null);
      setIsPlaying(true);
    } catch (err: any) {
      setXVideoError(err.message || "Could not load video");
    } finally {
      setIsFetchingXVideo(false);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    const ytMatch = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|v\/|embed\/|reels\/))([\w-]{11})/,
    );
    if (ytMatch)
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&loop=1&playlist=${ytMatch[1]}&modestbranding=1&rel=0`;
    const igMatch = url.match(
      /(?:instagram\.com\/(?:reels|reel|p|tv)\/)([\w-]+)/,
    );
    if (igMatch) return `https://www.instagram.com/reel/${igMatch[1]}/embed/`;
    return null;
  };

  const getThumbnailUrl = (url: string) => {
    if (!url) return null;
    const ytMatch = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|v\/|embed\/|reels\/))([\w-]{11})/,
    );
    if (ytMatch)
      return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    return null;
  };

  const embedUrl = useMemo(
    () => (card.type === "reel" ? getEmbedUrl((card as any).url) : null),
    [card.type, (card as any).url],
  );
  const thumbnailUrl = useMemo(
    () => (card.type === "reel" ? getThumbnailUrl((card as any).url) : null),
    [card.type, (card as any).url],
  );
  const tweetEmbedUrl = useMemo(
    () => (card.type === "tweet" ? getTweetEmbedUrl((card as any).tweetUrl) : null),
    [card.type, (card as any).tweetUrl],
  );

  if (!card) return null;

  const handleSpeak = async (text: string) => {
    if (isSpeaking) {
      const audio = document.getElementById(
        "edge-tts-audio-mini",
      ) as HTMLAudioElement;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      setIsSpeaking(false);
      return;
    }

    if (!text) return;

    setIsSpeaking(true);
    try {
      const voices = window.speechSynthesis.getVoices();
      const edgeNaturalVoice = voices.find(
        (v) =>
          v.name.includes("Natural") &&
          v.name.includes("Microsoft") &&
          v.lang.startsWith("en"),
      );

      if (edgeNaturalVoice) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = edgeNaturalVoice;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        let audio = document.getElementById(
          "edge-tts-audio-mini",
        ) as HTMLAudioElement;
        if (!audio) {
          audio = document.createElement("audio");
          audio.id = "edge-tts-audio-mini";
          audio.style.display = "none";
          document.body.appendChild(audio);
        }

        const voice = "en-US-AndrewNeural";
        audio.src = `https://api.lowline.ai/v1/tts?text=${encodeURIComponent(text)}&voice=${voice}`;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          audio.src = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
          audio.play().catch(() => setIsSpeaking(false));
        };
        await audio.play();
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  const cardTypeInfo = CARD_TYPES.find((t) => t.type === card.type);

  return (
    <motion.div
      layoutId={`card-${idx}`}
      className={clsx(
        "h-full rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-xl bg-gradient-to-b",
        isPlaying && card.type === "reel" ? "p-0" : "p-4",
        cardTypeInfo?.color || "from-gray-700 to-gray-800",
      )}
    >
      {(!isPlaying || card.type !== "reel") && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 p-1 bg-black/20 rounded-full text-white/60 hover:text-white transition-colors z-20"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {(!isPlaying || card.type !== "reel") && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            {card.type}
          </p>
          <h5 className="text-white font-bold text-lg leading-tight">
            {card.title}
          </h5>
        </div>
      )}
      <div
        className={clsx(
          "flex-1 flex items-center justify-center relative",
          isPlaying && card.type === "reel" ? "w-full h-full" : "",
        )}
      >
        {isEditing ? (
          <div className="w-full space-y-2 bg-black/40 p-3 rounded-xl backdrop-blur-sm z-10">
            <input
              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
              placeholder="Title"
              defaultValue={card.title}
              onBlur={(e) => {
                onUpdate(JSON.stringify({ ...card, title: e.target.value }));
              }}
            />
            {card.type === "pitch" && (
              <textarea
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white h-20"
                placeholder="Pitch content"
                defaultValue={(card as any).content}
                onBlur={(e) => {
                  onUpdate(
                    JSON.stringify({ ...card, content: e.target.value }),
                  );
                }}
              />
            )}
            {card.type === "reel" && (
              <input
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
                placeholder="Reel/Short URL"
                defaultValue={(card as any).url}
                onBlur={(e) => {
                  onUpdate(JSON.stringify({ ...card, url: e.target.value }));
                }}
              />
            )}
            {card.type === "revenue" && (
              <div className="space-y-1">
                <input
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
                  placeholder="Value (e.g. $10k)"
                  defaultValue={(card as any).value}
                  onBlur={(e) => {
                    onUpdate(
                      JSON.stringify({ ...card, value: e.target.value }),
                    );
                  }}
                />
              </div>
            )}
            {card.type === "traction" && (
              <div className="space-y-1">
                <input
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
                  placeholder="Value (e.g. +20%)"
                  defaultValue={(card as any).value}
                  onBlur={(e) => {
                    onUpdate(
                      JSON.stringify({ ...card, value: e.target.value }),
                    );
                  }}
                />
              </div>
            )}
            {card.type === "tweet" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <SiX className="w-3 h-3 text-white/60" />
                  <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold">
                    {(card as any).tweetType === "video" ? "X Video URL" : "X Tweet URL"}
                  </span>
                </div>
                <input
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-white/30"
                  placeholder="https://x.com/user/status/..."
                  defaultValue={(card as any).tweetUrl}
                  onBlur={(e) => {
                    onUpdate(JSON.stringify({ ...card, tweetUrl: e.target.value }));
                  }}
                />
                {(card as any).tweetUrl && getTweetId((card as any).tweetUrl) === null && (
                  <p className="text-[9px] text-red-400">Invalid tweet URL. Use a link from x.com or twitter.com</p>
                )}
              </div>
            )}
            {card.type === "product" && (
              <div className="space-y-1">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id={`product-image-${idx}`}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Compress image before storing
                      const canvas = document.createElement("canvas");
                      const ctx = canvas.getContext("2d");
                      const img = new Image();
                      
                      img.onload = () => {
                        // Set max dimensions
                        const maxWidth = 800;
                        const maxHeight = 600;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > height) {
                          if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                          }
                        } else {
                          if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                          }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        ctx?.drawImage(img, 0, 0, width, height);
                        
                        // Convert to WebP with quality 0.7 for better compression
                        const compressedData = canvas.toDataURL("image/webp", 0.7);
                        onUpdate(
                          JSON.stringify({
                            ...card,
                            imageUrl: compressedData,
                          }),
                        );
                      };
                      
                      img.src = URL.createObjectURL(file);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(`product-image-${idx}`)?.click()
                  }
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-2 text-[10px] text-white flex items-center justify-center gap-2 hover:bg-white/20"
                >
                  <Plus className="w-3 h-3" />{" "}
                  {(card as any).imageUrl ? "Change Image" : "Upload Image"}
                </button>
                {(card as any).imageUrl && (
                  <div className="relative w-full aspect-video rounded overflow-hidden border border-white/10">
                    <img
                      src={(card as any).imageUrl}
                      className="w-full h-full object-cover"
                      alt="Product"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate(JSON.stringify({ ...card, imageUrl: "" }))
                      }
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-full bg-white text-black py-1 rounded text-[10px] font-bold"
            >
              Done
            </button>
          </div>
        ) : card.type === "reel" && !isEditing && isPlaying ? (
          <div className="w-full h-full relative group bg-black">
            {embedUrl ? (
              <div className="w-full h-full overflow-hidden flex items-center justify-center">
                <iframe
                  src={embedUrl}
                  className="w-full h-[calc(100%+80px)] -mt-[40px] border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="text-white text-xs p-4 text-center">
                Invalid Video URL
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(false);
              }}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-4 left-4 right-4 z-40 pointer-events-none"></div>
          </div>
        ) : card.type === "reel" && !isEditing && !isPlaying ? (
          <div
            className="w-full h-full cursor-pointer group relative overflow-hidden rounded-xl"
            onClick={() => {
              if ((card as any).url) {
                setIsPlaying(true);
              } else {
                setIsEditing(true);
              }
            }}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                alt="Video thumbnail"
                onError={(e) => {
                  // Fallback to hqdefault if maxres isn't available
                  (e.target as HTMLImageElement).src = thumbnailUrl.replace(
                    "maxresdefault",
                    "hqdefault",
                  );
                }}
              />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                {(card as any).url ? (
                  <Video className="w-12 h-12 text-white/40" />
                ) : (
                  <Plus className="w-12 h-12 text-white/40 group-hover:scale-110 transition-transform" />
                )}
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                {(card as any).url ? (
                  <Play className="w-8 h-8 text-white fill-current" />
                ) : (
                  <Plus className="w-8 h-8 text-white" />
                )}
              </div>
            </div>
          </div>
        ) : card.type === "pitch" ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden">
            <div
              className="w-full h-full overflow-y-auto custom-scrollbar flex items-start pt-2"
              onScroll={(e) => {
                const element = e.currentTarget;
                // If we've scrolled near the bottom, show more words
                if (
                  element.scrollHeight - element.scrollTop <=
                  element.clientHeight + 20
                ) {
                  const content = (card as any).content || "";
                  const totalWords = content.split(/\s+/).length;
                  if (visibleWords < totalWords) {
                    setVisibleWords((prev) => prev + 18);
                  }
                }
              }}
            >
              <p
                onClick={() => setIsEditing(true)}
                className="text-white/90 text-sm text-center italic leading-relaxed cursor-pointer hover:bg-white/5 p-4 rounded-lg transition-colors w-full break-words"
              >
                {(() => {
                  const content =
                    (card as any).content || "No pitch content yet...";
                  const words = content.split(/\s+/);
                  if (words.length <= 18) return `"${content}"`;

                  const displayed = words.slice(0, visibleWords).join(" ");
                  return `"${displayed}${visibleWords < words.length ? "..." : ""}"`;
                })()}
              </p>
            </div>
          </div>
        ) : card.type === "product" ? (
          <div className="w-full h-full flex items-center justify-center p-2">
            {(card as any).imageUrl ? (
              <img
                src={(card as any).imageUrl}
                alt={card.title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setIsEditing(true)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all group"
              >
                <Plus className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        ) : card.type === "revenue" && isPlaying ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2">
            <div className="w-full h-24 relative overflow-visible">
              <svg
                className="w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <motion.path
                  d="M 10 90 L 90 10"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <motion.circle
                  cx="90"
                  cy="10"
                  r="5"
                  fill="white"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.5, duration: 0.3 }}
                />
              </svg>
              <motion.div
                className="absolute -top-2 right-0 text-white font-bold text-xl"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
              >
                {(card as any).value}
              </motion.div>
            </div>
          </div>
        ) : card.type === "revenue" || card.type === "traction" ? (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-4 cursor-pointer group/card-content"
            onClick={() => setIsEditing(true)}
          >
            <div className="text-center mb-4">
              <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">
                {card.type === "revenue" ? "Live Revenue" : "User Growth"}
              </div>
              <div className="text-white text-3xl font-bold tracking-tight">
                {(card as any).value ||
                  (card.type === "revenue" ? "$1.2M" : "50k+")}
              </div>
            </div>
            <div className="w-full h-32 relative group/chart">
              <TrendLine />
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/chart:opacity-100 transition-opacity rounded-xl -m-2" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card-content:opacity-100 transition-opacity">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Plus className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        ) : card.type === "tweet" && (card as any).tweetType === "video" ? (
          <div className="w-full h-full relative overflow-hidden rounded-xl bg-black">
            {isPlaying && xVideoUrl ? (
              <>
                <video
                  src={xVideoUrl}
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: "contain", objectPosition: "center" }}
                  autoPlay
                  controls
                  playsInline
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white z-30"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                {xVideoThumbnail ? (
                  <img src={xVideoThumbnail} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Video thumbnail" />
                ) : null}
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                  <SiX className="w-2.5 h-2.5 text-white" />
                  <span className="text-[7px] font-bold uppercase tracking-widest text-white/70">X Video</span>
                </div>
                <div className="relative z-10 flex flex-col items-center gap-2">
                  {!(card as any).tweetUrl ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all group"
                    >
                      <Play className="w-8 h-8 text-white/60 group-hover:text-white transition-colors" />
                      <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Tap to add video URL</span>
                    </button>
                  ) : isFetchingXVideo ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                      <span className="text-[9px] text-white/60 uppercase tracking-widest font-bold">Loading video...</span>
                    </div>
                  ) : xVideoError ? (
                    <div className="flex flex-col items-center gap-2 px-2 text-center">
                      <span className="text-[9px] text-red-400 font-bold">{xVideoError}</span>
                      <button type="button" onClick={() => { setXVideoError(null); fetchXVideo((card as any).tweetUrl); }} className="text-[8px] text-white/50 underline">Retry</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fetchXVideo((card as any).tweetUrl)}
                      className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-all hover:scale-110"
                    >
                      <Play className="w-8 h-8 text-white fill-current" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : card.type === "tweet" && (card as any).tweetType === "text" ? (
          <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
            {tweetEmbedUrl ? (
              <>
                <div className="absolute top-1 left-2 flex items-center gap-1 z-10 pointer-events-none">
                  <SiX className="w-2.5 h-2.5 text-white/70" />
                  <span className="text-[7px] font-bold uppercase tracking-widest text-white/50">X Tweet</span>
                </div>
                <div className="w-full h-full overflow-hidden rounded-xl border border-white/10 bg-white">
                  <iframe
                    src={tweetEmbedUrl}
                    className="w-full h-full border-0"
                    style={{ transform: "scale(0.8)", transformOrigin: "top center", height: "125%" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all group"
              >
                <SiX className="w-8 h-8 text-white/60 group-hover:text-white transition-colors" />
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Tap to add tweet URL</span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all group"
          >
            <Plus className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>
      <div className="pt-2">
        {card.type === "reel" ? null : card.type === "pitch" ? (
          <button
            onClick={() => handleSpeak((card as any).content || "")}
            className={clsx(
              "w-full rounded-full py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors",
              isSpeaking ? "bg-red-500 text-white" : "bg-white text-black",
            )}
          >
            {isSpeaking ? (
              <>
                <X className="w-3 h-3" /> Stop Pitch
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" /> Play Pitch
              </>
            )}
          </button>
        ) : card.type === "revenue" ? (
          <div className="space-y-2">
            {!isPlaying && (
              <div className="text-center">
                <div className="text-white font-bold text-xl">
                  {(card as any).value}
                </div>
                {(card as any).revenue && (
                  <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Total: {(card as any).revenue}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : card.type === "traction" ? (
          <div className="space-y-2">
            {!isPlaying && (
              <div className="text-center">
                <div className="text-white font-bold text-xl">
                  {(card as any).value}
                </div>
                {(card as any).traction && (
                  <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Users: {(card as any).traction}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : card.type === "product" ? (
          <div className="space-y-1 text-center">
            {(card as any).traction && (
              <div className="text-emerald-400 font-bold text-sm mb-1 flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {(card as any).traction}
              </div>
            )}
          </div>
        ) : card.type === "tweet" ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full bg-white/10 hover:bg-white/20 text-white rounded-full py-2 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <SiX className="w-3 h-3" />
            {(card as any).tweetUrl ? "Change URL" : "Add URL"}
          </button>
        ) : null}
      </div>
    </motion.div>
  );
};

const CustomSwipeCard = ({ cards }: { cards: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipeLeft = () => {
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handleSwipeRight = () => {
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const parsedCards = useMemo(() => {
    return cards
      .map((c) => {
        try {
          const card = JSON.parse(c);
          const typeInfo = CARD_TYPES.find((t) => t.type === card.type);
          return {
            title: card.title,
            name: card.type.toUpperCase(),
            subname: card.value || card.url || "Persona",
            color: typeInfo?.color || "from-gray-700 to-gray-800",
            bgStack1: "bg-black/20",
            bgStack2: "bg-black/10",
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
  }, [cards]);

  if (parsedCards.length === 0) return null;

  const currentCard = parsedCards[currentIndex]!;
  const nextCard = parsedCards[(currentIndex + 1) % parsedCards.length]!;
  const nextNextCard = parsedCards[(currentIndex + 2) % parsedCards.length]!;

  return (
    <div className="relative w-full max-w-[240px] aspect-[3/4] mx-auto perspective-1000">
      <div
        key={`stack2-${(currentIndex + 2) % parsedCards.length}`}
        className={clsx(
          "absolute inset-0 translate-y-4 translate-x-2 rounded-[24px] -z-20 transition-all duration-700 opacity-40 scale-95",
          nextNextCard.bgStack2,
        )}
      />
      <div
        key={`stack1-${(currentIndex + 1) % parsedCards.length}`}
        className={clsx(
          "absolute inset-0 translate-y-2 translate-x-1 rounded-[24px] -z-10 transition-all duration-700 opacity-70 scale-[0.98]",
          nextCard.bgStack1,
        )}
      />

      <AnimatePresence mode="popLayout" initial={false}>
        <SwipeCardContent
          key={currentIndex}
          card={currentCard}
          currentIndex={currentIndex}
          totalCards={parsedCards.length}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
        />
      </AnimatePresence>
    </div>
  );
};

export default function AuthPage({ slug }: { slug?: string }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [whatsappCountryCode, setWhatsappCountryCode] = useState("+91");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const [localUser, setLocalUser] = useState<any>(() => {
    const saved = localStorage.getItem("persona_user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Use authUser if available, otherwise fallback to localUser
  // This ensures that as soon as the useQuery finishes, it takes precedence
  const loggedInUser = authUser || localUser;
  const [publicUser, setPublicUser] = useState<any>(null);
  const [lastLoadedSlug, setLastLoadedSlug] = useState<string | null>(null);

  // When viewing another persona, we want to make sure registration starts fresh
  // unless we are explicitly trying to "claim" or "edit" that persona (which requires PIN)
  const user = slug ? publicUser : loggedInUser;
  const isOtherPersona =
    slug && loggedInUser && loggedInUser.uniqueSlug !== slug;

  useEffect(() => {
    // If we are switching from viewing a persona to the root path,
    // and we are NOT logged in, we should clear the public user and form
    if (!slug && !authUser && publicUser) {
      setPublicUser(null);
      setLastLoadedSlug(null);
      form.reset({
        email: "",
        name: "",
        role: "founder",
        bio: "",
        instagram: "",
        linkedin: "",
        whatsapp: "",
        website: "",
        cards: [],
      });
      setSelectedCards([]);
    }

    // Only fetch if the slug changed to a new slug we haven't loaded yet
    if (slug && lastLoadedSlug !== slug) {
      const isSelf = loggedInUser?.uniqueSlug === slug;
      fetch(`/api/user/slug/${slug}${isSelf ? "?self=true" : ""}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setPublicUser(data);
            setMode("login");
            setLastLoadedSlug(slug);
            // If viewing a public profile, update form to show its data
            Object.entries(data).forEach(([key, value]) => {
              if (value !== null && value !== undefined && key !== "password") {
                form.setValue(key as any, value);
              }
            });
            if (data.cards) {
              setSelectedCards(data.cards);
            }
          }
        });
    } else if (user && window.location.pathname === "/" && !slug) {
      // If we are logged in but at root, go to our own slug
      if (user.uniqueSlug) {
        setLocation(`/${user.uniqueSlug}`);
      }
    }
  }, [slug, setLocation, loggedInUser, lastLoadedSlug]);

  const trackClick = async (
    type: "insta" | "linkedin" | "whatsapp" | "website",
  ) => {
    if (!publicUser?.id) return;
    try {
      await apiRequest("POST", `/api/user/${publicUser.id}/click`, { type });
    } catch (err) {
      console.error("Failed to track click:", err);
    }
  };

  const onSubmit = async (values: InsertUser) => {
    try {
      console.log("Submitting values:", values, "Mode:", mode);
      let result;
      const isRegistering = mode === "register" && !loggedInUser;
      const isCustomizing = mode === "customize";
      const isUpdatingProfile = !!loggedInUser?.id;

      if (isUpdatingProfile) {
        // If logged in and viewing own profile, update data
        const { id, password, createdAt, uniqueSlug, ...updateData } =
          values as any;
        const payload = {
          ...updateData,
          cards: selectedCards.filter(
            (c): c is string =>
              typeof c === "string" && c !== "null" && c !== "",
          ),
        };
        result = await updateProfileMutation.mutateAsync(payload);
      } else if (mode === "login") {
        result = await loginMutation.mutateAsync(values);
      } else if (isRegistering || isCustomizing) {
        const payload = {
          ...values,
          cards: selectedCards.filter(
            (c): c is string =>
              typeof c === "string" && c !== "null" && c !== "",
          ),
        };
        console.log("Registration payload:", payload);
        result = await registerMutation.mutateAsync(payload);
      }

      if (result) {
        setLocalUser(result);
        localStorage.setItem("persona_user", JSON.stringify(result));
        localStorage.setItem("persona_user_id", result.id);

        // If it's a new registration or missing pin, show the PIN setup dialog
        if (isRegistering || (isCustomizing && !result.pin && !isUpdatingProfile)) {
          setShowHomeDialog(true);
          setMode("login");
        } else if (result.uniqueSlug && (isCustomizing || isRegistering) && (result.pin || isUpdatingProfile)) {
          // If we were in customize mode and have a pin (or are updating an existing profile), show QR
          setShowQRDialog(true);
          setMode("login");
          // Also redirect to the profile after a short delay or when they close
          setTimeout(() => {
            setLocation(`/${result.uniqueSlug}`);
          }, 500);
        } else if (isUpdatingProfile) {
          // For profile updates of logged in users, just stay on login/dashboard view
          setMode("login");
        } else {
          // For other cases (like login)
          setMode("login");
          if (result.uniqueSlug && (isRegistering || isCustomizing)) {
            setLocation(`/${result.uniqueSlug}`);
          }
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const [selectedCards, setSelectedCards] = useState<string[]>(() => {
    // Get initial cards from the current user being viewed
    const currentUser = slug ? null : loggedInUser;
    return currentUser?.cards || [];
  });
  const savedCardCount =
    user || publicUser ? selectedCards.length : CARDS.length;

  useEffect(() => {
    // Sync selectedCards whenever user data changes
    if (publicUser?.cards) {
      setSelectedCards(publicUser.cards);
    } else if (user?.cards) {
      setSelectedCards(user.cards);
    } else if (!user?.cards && user) {
      // If user exists but has no cards, set empty array
      setSelectedCards([]);
    }
  }, [publicUser?.cards, user?.cards, publicUser, user]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tweetSubChooser, setTweetSubChooser] = useState<number | null>(null);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [newPinValue, setNewPinValue] = useState("");
  const [showCreatePropertyPinDialog, setShowCreatePropertyPinDialog] =
    useState(false);
  const [createPropertyPin, setCreatePropertyPin] = useState("");

  const updatePinMutation = useMutation({
    mutationFn: async (newPin: string) => {
      const res = await apiRequest("PATCH", `/api/user/${user?.id}`, {
        pin: newPin,
      });
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/me"], updatedUser);
      toast({
        title: "Success",
        description: "PIN updated successfully",
      });
      setIsEditingPin(false);
      setNewPinValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update PIN",
        variant: "destructive",
      });
    },
  });

  const handlePinUpdate = () => {
    if (newPinValue.length !== 5) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 5 digits",
        variant: "destructive",
      });
      return;
    }
    updatePinMutation.mutate(newPinValue);
  };

  const startPropertyCreation = () => {
    setMode("register");
    setPublicUser(null);
    setLastLoadedSlug(null);
    form.reset({
      password: "",
      name: "",
      role: "founder",
      bio: "",
      instagram: "",
      linkedin: "",
      whatsapp: "",
      website: "",
      cards: [],
      email: "",
    });
    setSelectedCards([]);
    setLocation("/");
    setIsMenuOpen(false);
  };

  const handleCreatePropertyAccess = () => {
    if (createPropertyPin !== "0001") {
      setCreatePropertyPin("");
      toast({
        title: "Access denied",
        description: "Enter the correct 4-digit PIN to create a property profile.",
        variant: "destructive",
      });
      return;
    }

    setCreatePropertyPin("");
    setShowCreatePropertyPinDialog(false);
    startPropertyCreation();
  };

  const [qrColor, setQrColor] = useState("#000000");
  const [qrBgColor, setQrBgColor] = useState("#ffffff");
  const professionalAvatars = [avatarWoman, avatarMan];

  const [avatarUrl, setAvatarUrl] = useState(professionalAvatars[0]);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);

  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const [qrLayout, setQrLayout] = useState<"standard" | "compact" | "minimal">(
    "standard",
  );

  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showScannerDialog, setShowScannerDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [selectedMapProjectId, setSelectedMapProjectId] = useState<string | null>(
    null,
  );
  const [scannerTab, setScannerTab] = useState<"scan" | "code">("scan");
  const [showNavToggle, setShowNavToggle] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showMapThumbnail, setShowMapThumbnail] = useState(true);
  const [showPropertyAd, setShowPropertyAd] = useState(true);
  const [activePropertyAd, setActivePropertyAd] = useState(0);
  const [isTradersExpanded, setIsTradersExpanded] = useState(false);
  const [showTradersModal, setShowTradersModal] = useState(false);
  const [selectedPropertyEvent, setSelectedPropertyEvent] =
    useState<PropertyEvent | null>(null);
  const [eventRegistration, setEventRegistration] = useState(() => {
    try {
      const saved = localStorage.getItem("nest_property_event_registrations");
      return saved
        ? (JSON.parse(saved) as Record<string, { name: string; phone: string }>)
        : {};
    } catch {
      return {};
    }
  });
  const [eventName, setEventName] = useState(
    loggedInUser?.name || "",
  );
  const [eventPhone, setEventPhone] = useState(
    loggedInUser?.whatsapp || "",
  );
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<
    "All" | "Villa" | "Plots" | "Flat" | "Meetup"
  >("All");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivePropertyAd((current) => (current + 1) % PROPERTY_ADS.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredPropertyEvents = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();
    return PROPERTY_EVENTS.filter((event) => {
      const matchesFilter =
        eventFilter === "All" || event.propertyType === eventFilter;
      const searchableText = [
        event.title,
        event.type,
        event.propertyType,
        event.location,
        event.area,
        event.host,
        event.description,
      ]
        .join(" ")
        .toLowerCase();
      return matchesFilter && (!query || searchableText.includes(query));
    });
  }, [eventFilter, eventSearch]);

  const registerForPropertyEvent = async (event: PropertyEvent) => {
    if (!eventName.trim() || !eventPhone.trim()) {
      toast({
        title: "Add your contact details",
        description: "Your name and mobile number help the host confirm your spot.",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", `/api/property-events/${event.id}/register`, {
        name: eventName.trim(),
        phone: eventPhone.trim(),
        userId: loggedInUser?.id,
      });
      const updatedRegistrations = {
        ...eventRegistration,
        [event.id]: { name: eventName.trim(), phone: eventPhone.trim() },
      };
      setEventRegistration(updatedRegistrations);
      localStorage.setItem(
        "nest_property_event_registrations",
        JSON.stringify(updatedRegistrations),
      );
      toast({
        title: "Spot reserved",
        description: `You're registered for ${event.title}.`,
      });
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const isAtBottom = documentHeight - currentScrollY - windowHeight < 100;
      const isScrollingDown = currentScrollY > lastScrollY;

      setShowMobileNav(isAtBottom && showNavToggle);
      setShowMapThumbnail(!isScrollingDown || currentScrollY < 24);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, showNavToggle]);
  const personaCardRef = useRef<HTMLDivElement>(null);
  const lastFeedScrollTopRef = useRef(0);
  const tradersRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"notes" | "events" | "connect">(
    "notes",
  );
  const [connections, setConnections] = useState<
    { name: string; industry: string; slug: string; expiresAt: string }[]
  >([]);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/user/${user.id}/connections`)
        .then((res) => res.json())
        .then((data) => setConnections(data))
        .catch(console.error);
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isTradersExpanded &&
        tradersRef.current &&
        !tradersRef.current.contains(event.target as Node)
      ) {
        setIsTradersExpanded(false);
      }
    };

    if (isTradersExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTradersExpanded]);

  useEffect(() => {
    const handleScroll = () => {
      if (personaCardRef.current) {
        const { scrollTop, scrollHeight, clientHeight } =
          personaCardRef.current;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
        const isScrollingDown =
          scrollTop > lastFeedScrollTopRef.current;
        setShowMapThumbnail(!isScrollingDown || scrollTop < 24);
        setShowPropertyAd(scrollTop < 24);
        lastFeedScrollTopRef.current = scrollTop;
        setShowNavToggle(isAtBottom);
      }
    };

    const ref = personaCardRef.current;
    if (ref) {
      ref.addEventListener("scroll", handleScroll);
      return () => ref.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    // Only save connections for logged-in users visiting someone else's profile
    if (
      authUser &&
      isOtherPersona &&
      publicUser &&
      authUser.uniqueSlug !== publicUser.uniqueSlug
    ) {
      apiRequest("POST", "/api/user/connect", {
        userId: authUser.id,
        targetSlug: publicUser.uniqueSlug,
      })
        .then(() => {
          fetch(`/api/user/${authUser.id}/connections`)
            .then((res) => res.json())
            .then((data) => setConnections(data));
        })
        .catch(console.error);
    }
  }, [isOtherPersona, authUser, publicUser]);

  const getRemainingTime = (expiresAt: string) => {
    if (!expiresAt) return "48H";
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    if (diffMs <= 0) return "0H";
    const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60));
    return `${diffHrs}H`;
  };
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugValue, setSlugValue] = useState(user?.uniqueSlug || "");

  const [isSlugTaken, setIsSlugTaken] = useState(false);

  const checkSlugMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await apiRequest("GET", `/api/user/check-slug/${slug}`);
      return res.json();
    },
    onSuccess: (data) => {
      setIsSlugTaken(data.taken);
    },
  });

  const [displaySlug, setDisplaySlug] = useState<string>("");

  const updateSlugMutation = useMutation({
    mutationFn: async (newSlug: string) => {
      const res = await apiRequest("PATCH", "/api/user/slug", {
        uniqueSlug: newSlug,
        userId: user?.id,
      });
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/me"], updatedUser);
      setIsEditingSlug(false);
      setDisplaySlug(updatedUser.uniqueSlug);
      toast({
        title: "Success",
        description: "Persona code updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveSlug = async () => {
    if (slugValue === user?.uniqueSlug) {
      setIsEditingSlug(false);
      return;
    }
    try {
      await updateSlugMutation.mutateAsync(slugValue);
      setIsEditingSlug(false);
      setShowQRDialog(true);
    } catch (error) {
      console.error("Failed to update persona code:", error);
    }
  };
  const [notes, setNotes] = useState<
    { id: string; text: string; completed: boolean; expiresAt: string }[]
  >([]);
  const [newNote, setNewNote] = useState("");

  // Sync displaySlug with user whenever user changes
  useEffect(() => {
    if (user?.uniqueSlug) {
      setDisplaySlug(user.uniqueSlug);
    }
  }, [user?.uniqueSlug]);

  // Sync notes from user object
  useEffect(() => {
    if (user?.notes) {
      setNotes(user.notes);
    }
  }, [user?.notes]);

  // Auto-expire notes
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setNotes((prev) => {
        const filtered = prev.filter((note) => new Date(note.expiresAt) > now);
        if (filtered.length !== prev.length && user) {
          updateProfileMutation.mutate({ notes: filtered });
        }
        return filtered;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [user]);

  const addNote = () => {
    if (!newNote.trim() || notes.length >= 5) return;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const note = {
      id: Math.random().toString(36).substr(2, 9),
      text: newNote,
      completed: false,
      expiresAt,
    };
    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    setNewNote("");
    if (user) {
      updateProfileMutation.mutate({ notes: updatedNotes });
    }
  };

  const toggleNote = (id: string) => {
    const updatedNotes = notes.map((n) =>
      n.id === id ? { ...n, completed: !n.completed } : n,
    );
    setNotes(updatedNotes);
    if (user) {
      updateProfileMutation.mutate({ notes: updatedNotes });
    }
  };

  const getTimerColor = (expiresAt: string) => {
    const hoursLeft =
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft > 12) return "text-green-400";
    if (hoursLeft > 3) return "text-white";
    return "text-red-500 font-bold";
  };

  const formatTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };
  const [showHomeDialog, setShowHomeDialog] = useState(false);
  const [showPersonaDialog, setShowPersonaDialog] = useState(false);
  const [personaSlug, setPersonaSlug] = useState("");
  const [personaPin, setPersonaPin] = useState("");
  const [personaCode, setPersonaCode] = useState("");
  const [pin, setPin] = useState("");
  const [verifyPin, setVerifyPin] = useState("");
  const [isEditingDialogCode, setIsEditingDialogCode] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const handleScan = async (data: string | null) => {
    if (data) {
      // The QR code contains the URL like "https://domain.com/slug" or just "slug"
      const slug = data.split("/").pop() || data;

      if (user?.id) {
        try {
          // Connect first
          await apiRequest("POST", "/api/user/connect", {
            userId: user.id,
            targetSlug: slug,
          });

          // Then refresh connections
          const res = await fetch(`/api/user/${user.id}/connections`);
          const updatedConnections = await res.json();
          setConnections(updatedConnections);

          toast({
            title: "Connected!",
            description: `Added ${slug} to your connections.`,
          });
        } catch (err) {
          console.error("Connect error during scan:", err);
        }
      }

      setLocation(`/${slug}`);
      setShowScannerDialog(false);
    }
  };

  const qrRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Preload all videos when component mounts for instant playback
  useEffect(() => {
    const videoUrls = ["/1.mp4", "/2.mp4", "/3.mp4", "/4.mp4"];
    videoUrls.forEach((url) => {
      const video = document.createElement("video");
      video.src = url;
      video.preload = "auto";
      video.load();
    });
  }, []);

  useEffect(() => {
    let controls: any = null;
    let isMounted = true;
    const codeReader = new BrowserMultiFormatReader();

    const startScanner = async () => {
      if (showScannerDialog && scannerTab === "scan" && videoRef.current) {
        try {
          const ctrl = await codeReader.decodeFromVideoDevice(
            null,
            videoRef.current,
            async (result, err) => {
              if (result && isMounted) {
                const text = result.getText();
                const slug = text.includes("/") ? text.split("/").pop() : text;
                if (slug) {
                  // Verify if persona exists on backend before navigating
                  try {
                    const res = await fetch(`/api/user/slug/${slug}`);
                    if (res.ok) {
                      setLocation(`/${slug}`);
                      setShowScannerDialog(false);
                      toast({
                        title: "QR Code Scanned",
                        description: `Loading persona: ${slug}`,
                      });
                    } else {
                      toast({
                        title: "Not Found",
                        description: "Scanned persona does not exist.",
                        variant: "destructive",
                      });
                    }
                  } catch (e) {
                    console.error("Scan verification error:", e);
                  }
                }
              }
            },
          );

          if (!isMounted || !showScannerDialog || scannerTab !== "scan") {
            if (ctrl && typeof ctrl.stop === "function") {
              ctrl.stop();
            }
          } else {
            controls = ctrl;
          }
        } catch (err) {
          console.error("Scanner error:", err);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (controls) {
        if (typeof controls.stop === "function") {
          controls.stop();
        }
      }
      codeReader.reset();
    };
  }, [showScannerDialog, scannerTab, setLocation, toast]);

  useEffect(() => {
    if (user && !publicUser) {
      // Check if we need to update form values from the authenticated user
      const currentValues = form.getValues();

      Object.entries(user).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== "password") {
          if (currentValues[key as keyof InsertUser] !== value) {
            form.setValue(key as any, value);
          }
        }
      });

      if (
        user.cards &&
        JSON.stringify(user.cards) !== JSON.stringify(selectedCards)
      ) {
        setSelectedCards(user.cards);
      }

      // Keep local storage in sync with the latest auth data
      if (!isOtherPersona) {
        localStorage.setItem("persona_user", JSON.stringify(user));
        localStorage.setItem("persona_user_id", user.id);
      }
    }
  }, [user, publicUser, isOtherPersona]);

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const isPending = loginMutation.isPending || registerMutation.isPending;

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      password: "",
      name: user?.name || "",
      role: user?.role || "founder",
      bio: user?.bio || "Collaborate & Grow your Startup",
      instagram: user?.instagram || "",
      linkedin: user?.linkedin || "",
      whatsapp: user?.whatsapp || "",
      website: user?.website || "",
      cards: user?.cards || [],
      email:
        user?.email && !user.email.endsWith("@persona.local") ? user.email : "",
    },
  });

  const handleVerifyPersona = async () => {
    if (!personaSlug) {
      toast({
        title: "Error",
        description: "Please enter a persona code",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      // First check if persona exists on backend
      const checkRes = await fetch(`/api/user/slug/${personaSlug}`);
      if (!checkRes.ok) {
        toast({
          title: "Not Found",
          description: "This persona code does not exist.",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      // If no pin is provided, we're just loading public data
      if (!personaPin) {
        setLocation(`/${personaSlug}`);
        setShowScannerDialog(false);
        setShowPersonaDialog(false);
        return;
      }

      const res = await apiRequest("POST", "/api/auth/verify-persona", {
        slug: personaSlug,
        pin: personaPin,
      });
      const userData = await res.json();

      // Update local state and cache
      setLocalUser(userData);
      queryClient.setQueryData(["/api/me"], userData);

      localStorage.setItem("persona_user", JSON.stringify(userData));
      localStorage.setItem("persona_user_id", userData.id);

      toast({
        title: "Success",
        description: `Verified persona: ${userData.name}`,
      });
      setShowPersonaDialog(false);
      setShowScannerDialog(false);
      setLocation(`/${userData.uniqueSlug}`);
    } catch (err) {
      toast({
        title: "Verification failed",
        description: "Invalid persona code or pin",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };
  const logout = () => {
    localStorage.removeItem("persona_user");
    localStorage.removeItem("persona_user_id");
    setLocalUser(null);
    queryClient.setQueryData(["/api/me"], null);
    setLocation("/");
  };
  const downloadQR = async () => {
    const element = document.getElementById("iphone-screen-preview");
    if (!element) {
      toast({
        title: "Error",
        description: "Preview element not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use a filter function to exclude UI-only elements from the capture
      // without touching the live DOM (avoids the visual flash/duplicate effect)
      const EXCLUDED_CLASSES = [
        "status-bar-container",
        "home-indicator",
        "bottom-controls",
        "edit-avatar-button",
      ];

      const dataUrl = await htmlToImage.toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#050505",
        // cacheBust causes html-to-image to re-fetch all stylesheets including
        // remote CDN links which times out (~10s delay) — keep it off
        filter: (node) => {
          if (node instanceof HTMLElement) {
            const cls = Array.from(node.classList);
            if (cls.some((c) => EXCLUDED_CLASSES.includes(c))) return false;
          }
          return true;
        },
      });

      const link = document.createElement("a");
      link.download = `persona-${user?.uniqueSlug || "code"}.png`;
      link.href = dataUrl;
      link.click();
      toast({
        title: "Downloaded",
        description: "Persona card saved successfully.",
      });
    } catch (err) {
      console.error("Download error:", err);
      toast({
        title: "Download failed",
        description: "Could not generate the Persona image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<InsertUser>) => {
      if (!user?.id) throw new Error("Not authenticated");
      const res = await apiRequest("PATCH", `/api/user/${user.id}`, data);
      return res.json();
    },
    onSuccess: (updatedUser, variables) => {
      queryClient.setQueryData(["/api/me"], updatedUser);
      setLocalUser(updatedUser);
      localStorage.setItem("persona_user", JSON.stringify(updatedUser));
      localStorage.setItem("persona_user_id", updatedUser.id);
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      // Silent update for notes, cards, pin, uniqueSlug changes (handled by callers)
      const isSilentUpdate =
        "notes" in variables ||
        "cards" in variables ||
        "completed" in variables ||
        "pin" in variables ||
        "uniqueSlug" in variables;
      if (!isSilentUpdate) {
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
      }
    },
    onError: (error: Error, variables) => {
      const isSilentUpdate = "notes" in variables || "cards" in variables;
      if (!isSilentUpdate) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    if (user && !publicUser) {
      // Check if we need to update form values from the authenticated user
      const currentValues = form.getValues();

      Object.entries(user).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== "password") {
          if (currentValues[key as keyof InsertUser] !== value) {
            form.setValue(key as any, value);
          }
        }
      });

      if (
        user.cards &&
        JSON.stringify(user.cards) !== JSON.stringify(selectedCards)
      ) {
        setSelectedCards(user.cards);
      }

      // Keep local storage in sync with the latest auth data
      if (!isOtherPersona) {
        localStorage.setItem("persona_user", JSON.stringify(user));
        localStorage.setItem("persona_user_id", user.id);
      }
    }
  }, [user, publicUser, isOtherPersona]);

  const [isPersonaExpanded, setIsPersonaExpanded] = useState(false);

  if (isAuthLoading && localStorage.getItem("persona_user_id")) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] overflow-hidden relative">
      <div className="absolute inset-0 flex flex-col justify-start items-end p-12 pt-24 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: isMenuOpen ? 1 : 0, x: isMenuOpen ? 0 : 20 }}
          className="space-y-3 pointer-events-auto mb-4 pr-2"
        >
          {loggedInUser ? (
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={logout}
                className="flex items-center gap-3 p-1 pr-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all group ml-auto backdrop-blur-md shrink-0"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 group-hover:border-purple-500/30 transition-colors">
                  <User className="w-4 h-4 text-purple-400/80 group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-xs tracking-tight">
                      {loggedInUser.name || "Property User"}
                    </span>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
                      <Check className="w-2 h-2 text-black" strokeWidth={4} />
                    </div>
                  </div>
                  <span className="text-[8px] text-white/40 uppercase tracking-[0.2em] font-bold">
                    Logout
                  </span>
                </div>
              </button>

              <div className="w-full mt-1 space-y-3">
                <button
                  onClick={() => setIsPersonaExpanded(!isPersonaExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all group shrink-0"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-[10px] tracking-widest uppercase">
                      Property Profile
                    </span>
                  </div>
                  {isPersonaExpanded ? (
                    <ChevronDown className="w-3 h-3 text-white/40 rotate-180 transition-transform" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-white/40 transition-transform" />
                  )}
                </button>

                <AnimatePresence>
                  {isPersonaExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[8px] text-white/40 uppercase tracking-widest font-bold">
                            Profile Code
                          </label>
                          <div className="flex items-center justify-between group/item gap-2">
                            {isEditingSlug ? (
                              <div className="flex-1 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                                <input
                                  type="text"
                                  value={slugValue}
                                  onChange={(e) => {
                                    setSlugValue(e.target.value);
                                    if (
                                      e.target.value !== loggedInUser.uniqueSlug
                                    ) {
                                      checkSlugMutation.mutate(e.target.value);
                                    } else {
                                      setIsSlugTaken(false);
                                    }
                                  }}
                                  className="flex-1 bg-transparent border-none text-xs font-mono text-white focus:outline-none"
                                  autoFocus
                                />
                                <div className="flex flex-col items-end gap-0.5">
                                  <button
                                    onClick={handleSaveSlug}
                                    disabled={
                                      updateSlugMutation.isPending ||
                                      isSlugTaken
                                    }
                                    className={clsx(
                                      "p-0.5 rounded-full transition-colors disabled:opacity-50",
                                      isSlugTaken
                                        ? "bg-red-500/20 text-red-400 cursor-not-allowed"
                                        : "bg-white/10 text-green-400 hover:text-green-300",
                                    )}
                                  >
                                    {updateSlugMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : isSlugTaken ? (
                                      <X className="w-3 h-3" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </button>
                                  {isSlugTaken && (
                                    <span className="text-[7px] text-red-400 uppercase tracking-tighter font-bold">
                                      Taken
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-mono text-white">
                                  {loggedInUser.uniqueSlug || "---"}
                                </span>
                                <button
                                  onClick={() => {
                                    setSlugValue(loggedInUser.uniqueSlug || "");
                                    setIsEditingSlug(true);
                                  }}
                                  className="p-1 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors opacity-0 group-hover/item:opacity-100"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[8px] text-white/40 uppercase tracking-widest font-bold">
                            Change PIN
                          </label>
                          <div className="flex items-center justify-between group/item">
                            {isEditingPin ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <input
                                  type="text"
                                  maxLength={5}
                                  value={newPinValue}
                                  onChange={(e) =>
                                    setNewPinValue(
                                      e.target.value.replace(/\D/g, ""),
                                    )
                                  }
                                  placeholder="New PIN"
                                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                  autoFocus
                                />
                                <button
                                  onClick={handlePinUpdate}
                                  disabled={updatePinMutation.isPending}
                                  className="p-1 bg-purple-500/20 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                                >
                                  {updatePinMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setIsEditingPin(false);
                                    setNewPinValue("");
                                  }}
                                  className="p-1 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs tracking-[0.3em] text-white/60">
                                  •••••
                                </span>
                                <button
                                  onClick={() => setIsEditingPin(true)}
                                  className="p-1 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors opacity-0 group-hover/item:opacity-100"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Reach & Click Stats Display */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3 shrink-0">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-white/40 uppercase tracking-[0.2em] font-bold">
                      Reach Count
                    </span>
                    <span className="text-xl font-display font-bold text-white">
                      {loggedInUser.reachCount || 0}
                    </span>
                  </div>

                  {/* Reach Trend Chart */}
                  {loggedInUser.reachHistory &&
                    loggedInUser.reachHistory.length > 0 && (
                      <div className="h-12 w-full pt-1">
                        <div className="flex items-end justify-between h-full gap-0.5">
                          {(() => {
                            const history = [...loggedInUser.reachHistory].sort(
                              (a, b) => a.timestamp.localeCompare(b.timestamp),
                            );
                            const counts = history.map((h) => h.count);
                            const maxCount = Math.max(...counts, 1);

                            return (
                              <div className="w-full h-full relative flex items-end">
                                <svg
                                  className="w-full h-full overflow-visible"
                                  viewBox="0 0 100 100"
                                  preserveAspectRatio="none"
                                >
                                  <defs>
                                    <linearGradient
                                      id="chartGradient"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor="rgb(168, 85, 247)"
                                        stopOpacity="0.8"
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="rgb(168, 85, 247)"
                                        stopOpacity="0.1"
                                      />
                                    </linearGradient>
                                  </defs>
                                  {(() => {
                                    if (history.length < 2) return null;

                                    const points = history.map((h, i) => {
                                      const x =
                                        (i / (history.length - 1)) * 100;
                                      const y =
                                        100 - (h.count / maxCount) * 80 - 10; // Margin top/bottom
                                      return `${x},${y}`;
                                    });

                                    const pathData = points.reduce(
                                      (acc, point, i, arr) => {
                                        if (i === 0) return `M ${point}`;
                                        // Cubic bezier for smooth curve
                                        const prev = arr[i - 1].split(",");
                                        const curr = point.split(",");
                                        const cp1x =
                                          Number(prev[0]) +
                                          (Number(curr[0]) - Number(prev[0])) /
                                            2;
                                        return `${acc} C ${cp1x},${prev[1]} ${cp1x},${curr[1]} ${curr[0]},${curr[1]}`;
                                      },
                                      "",
                                    );

                                    const areaData = `${pathData} L 100,100 L 0,100 Z`;

                                    return (
                                      <>
                                        <motion.path
                                          initial={{
                                            pathLength: 0,
                                            opacity: 0,
                                          }}
                                          animate={{
                                            pathLength: 1,
                                            opacity: 1,
                                          }}
                                          transition={{
                                            duration: 1,
                                            ease: "easeOut",
                                          }}
                                          d={pathData}
                                          fill="none"
                                          stroke="rgb(168, 85, 247)"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                        />
                                        <motion.path
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          transition={{
                                            duration: 1.5,
                                            delay: 0.5,
                                          }}
                                          d={areaData}
                                          fill="url(#chartGradient)"
                                        />
                                      </>
                                    );
                                  })()}
                                </svg>
                                {/* Points for tooltips */}
                                <div className="absolute inset-0 flex justify-between">
                                  {history.map((day, i) => (
                                    <div
                                      key={i}
                                      className="flex-1 group relative h-full"
                                    >
                                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-white text-black text-[7px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {day.count}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex justify-between mt-1 px-0.5">
                          <span className="text-[5px] text-white/20 uppercase font-bold">
                            7d ago
                          </span>
                          <span className="text-[5px] text-white/20 uppercase font-bold">
                            Today
                          </span>
                        </div>
                      </div>
                    )}

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[7px] text-white/30 uppercase tracking-widest font-bold">
                        Insta
                      </span>
                      <span className="text-xs font-bold text-white/80">
                        {loggedInUser.instaClicks || 0}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[7px] text-white/30 uppercase tracking-widest font-bold">
                        LinkedIn
                      </span>
                      <span className="text-xs font-bold text-white/80">
                        {loggedInUser.linkedinClicks || 0}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[7px] text-white/30 uppercase tracking-widest font-bold">
                        WhatsApp
                      </span>
                      <span className="text-xs font-bold text-white/80">
                        {loggedInUser.whatsappClicks || 0}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[7px] text-white/30 uppercase tracking-widest font-bold">
                        Website
                      </span>
                      <span className="text-xs font-bold text-white/80">
                        {loggedInUser.websiteClicks || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Analysis Window */}
                <div className="p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10 rounded-xl space-y-3 backdrop-blur-md relative overflow-hidden group shrink-0">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                      <span className="text-[8px] text-purple-400 uppercase tracking-[0.2em] font-bold">
                        AI Analysis
                      </span>
                    </div>
                    <h4 className="text-white font-bold text-xs">
                      Growth Insights
                    </h4>
                  </div>

                  <div className="space-y-2 relative z-10">
                    {(() => {
                      const history = loggedInUser.reachHistory || [];
                      const todayDate = new Date().toISOString();
                      const twelveHoursAgo = new Date(
                        Date.now() - 12 * 60 * 60 * 1000,
                      ).toISOString();

                      const lastEntry =
                        history.length > 0
                          ? history[history.length - 1]
                          : { count: 0 };
                      const prevEntry =
                        history.length > 1
                          ? history[history.length - 2]
                          : { count: 0 };

                      const isDecreasing = lastEntry.count < prevEntry.count;
                      const industry = loggedInUser.industry || "General";

                      return (
                        <>
                          <div className="p-2 bg-white/5 rounded-lg border border-white/5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] text-white/40 uppercase font-bold tracking-tight">
                                Status
                              </span>
                              {isDecreasing ? (
                                <span className="text-[8px] text-red-400 font-bold flex items-center gap-1">
                                  <ChevronDown className="w-2 h-2" /> Decreasing
                                </span>
                              ) : (
                                <span className="text-[8px] text-green-400 font-bold flex items-center gap-1">
                                  <TrendingUp className="w-2 h-2" /> Growing
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-white/70 leading-tight">
                              {isDecreasing
                                ? `Reach down. In ${industry}, consistency is key.`
                                : `Profile gaining traction in ${industry}.`}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[8px] text-white/40 uppercase font-bold tracking-[0.1em]">
                              AI Suggestions
                            </span>
                            <ul className="space-y-1.5">
                              {[
                                `Update ${industry} pitch card.`,
                                "Share QR on LinkedIn.",
                                "Set QR as wallpaper for easy networking.",
                                "Write notes & todo list.",
                              ].map((s, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-1.5 text-[9px] text-white/60"
                                >
                                  <div className="w-0.5 h-0.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
            <button
              onClick={() => {
                setShowPersonaDialog(true);
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all group ml-auto"
            >
              <User className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-[10px] tracking-widest uppercase">
                My Persona
              </span>
            </button>
             {mode === "login" && (
               <button
                 type="button"
                 onClick={() => {
                    setCreatePropertyPin("");
                    setShowCreatePropertyPinDialog(true);
                 }}
                 className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black shadow-lg transition-all hover:bg-white/90"
               >
                  <Lock className="h-3.5 w-3.5" />
                  create your property profile
               </button>
              )}
            </>
          )}
        </motion.div>
      </div>
      <motion.div
        animate={{
          x: isMenuOpen ? "-80%" : "0%",
          scale: isMenuOpen ? 0.9 : 1,
          borderRadius: isMenuOpen ? "40px" : "0px",
        }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        onClick={() => isMenuOpen && setIsMenuOpen(false)}
        className={clsx(
          "h-[100dvh] overflow-hidden bg-mesh flex flex-col items-center justify-start p-4 shadow-2xl relative z-20",
          isMenuOpen ? "cursor-pointer select-none" : "",
        )}
      >
        <div
          className="absolute inset-0 bg-black/20 pointer-events-none opacity-0 transition-opacity duration-500"
          style={{ opacity: isMenuOpen ? 1 : 0 }}
        ></div>

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="absolute top-8 right-8 z-50 p-2 group"
        >
          {isMenuOpen ? (
            <div className="text-white/80 hover:text-white transition-colors">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 items-end">
              <div className="w-8 h-1 bg-white rounded-full transition-all group-hover:w-6"></div>
              <div className="w-5 h-1 bg-white rounded-full transition-all group-hover:w-8"></div>
            </div>
          )}
        </button>

        <AnimatePresence>
          {!showScannerDialog && !showMapDialog && showMapThumbnail && (
             <>
               <motion.button
                 initial={{ opacity: 0, scale: 0.5 }}
                 animate={{ opacity: 1, scale: 1 }}
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.9 }}
                 exit={{ opacity: 0, scale: 0.5 }}
                 onClick={() => setShowMapDialog(true)}
                 className="fixed bottom-8 right-8 z-50 h-[76px] w-[132px] overflow-hidden rounded-2xl border border-purple-300/50 bg-[#171222] text-white shadow-[0_12px_30px_rgba(124,58,237,0.4)] transition-shadow hover:shadow-[0_16px_36px_rgba(124,58,237,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                 aria-label="Open Hyderabad property map"
                 title="Open Hyderabad property map"
               >
                 <HyderabadPropertyMapThumbnail />
               </motion.button>
             </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!showTradersModal && (
            <motion.div
              ref={tradersRef}
              initial={{ opacity: 0, scale: 0.5, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: -20 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="fixed left-0 bottom-8 z-50"
            >
              <motion.button
                onClick={() => {
                  setIsTradersExpanded(!isTradersExpanded);
                  setShowTradersModal(true);
                }}
                animate={{
                  width: isTradersExpanded ? "auto" : "48px",
                  height: isTradersExpanded ? "auto" : "48px",
                  paddingLeft: "0px",
                  paddingRight: isTradersExpanded ? "16px" : "0",
                  paddingTop: isTradersExpanded ? "12px" : "0",
                  paddingBottom: isTradersExpanded ? "12px" : "0",
                }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="bg-slate-900/80 hover:bg-slate-800/80 border border-white/20 rounded-r-xl flex items-center justify-center shadow-lg transition-all py-2 group"
              >
                <motion.div
                  animate={{
                    opacity: isTradersExpanded ? 1 : 0,
                    width: isTradersExpanded ? "auto" : 0,
                  }}
                  transition={{ type: "spring", damping: 20, stiffness: 100 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">
                      Connect with
                    </span>
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                       Property Meetups
                    </span>
                  </div>
                </motion.div>
                <PropertyMeetupMark className="h-7 w-7 transition-transform group-hover:scale-110" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

                 {/* Property Meetup Bottom Sheet Modal */}
        <AnimatePresence>
          {showTradersModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setShowTradersModal(false);
                  setIsTradersExpanded(false);
                  setSelectedPropertyEvent(null);
                }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={isMobile ? { y: "100%" } : { x: "100%" }}
                animate={isMobile ? { y: 0 } : { x: 0 }}
                exit={isMobile ? { y: "100%" } : { x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                 className="fixed bottom-0 left-0 right-0 z-50 flex h-[74vh] max-h-[74vh] flex-col overflow-hidden rounded-t-[26px] border-t border-white/[.12] bg-[#0b0c0f] shadow-2xl md:bottom-0 md:left-auto md:top-0 md:right-0 md:h-full md:max-h-none md:w-[min(440px,100vw)] md:rounded-l-[26px] md:rounded-t-none md:border-l md:border-t-0"
              >
                 <div className="sticky top-0 z-10 shrink-0 border-b border-white/[.08] bg-[#0b0c0f]/95 px-4 pb-3 pt-4 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                        RCiQ-AI · HYDERABAD
                      </p>
                      <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
                        Meet the project
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setShowTradersModal(false);
                        setIsTradersExpanded(false);
                        setSelectedPropertyEvent(null);
                      }}
                      className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-white/[.08] hover:text-white"
                      aria-label="Close property meetups"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-white/45">
                    Visit, compare and decide in person.
                  </p>
                  <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      value={eventSearch}
                      onChange={(event) => setEventSearch(event.target.value)}
                      placeholder="Search villa, flat, plot or location"
                      className="h-10 w-full rounded-xl border border-white/[.10] bg-white/[.04] pl-9 pr-9 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/25 focus:bg-white/[.06]"
                      aria-label="Search property meetups"
                    />
                    {eventSearch && (
                      <button
                        onClick={() => setEventSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/35 hover:bg-white/10 hover:text-white"
                        aria-label="Clear property search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="scrollbar-hide mt-2 flex gap-1 overflow-x-auto">
                    {(["All", "Villa", "Plots", "Flat", "Meetup"] as const).map(
                      (filter) => (
                        <button
                          key={filter}
                          onClick={() => setEventFilter(filter)}
                          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                            eventFilter === filter
                              ? "bg-white text-[#0b0c0f]"
                              : "text-white/45 hover:bg-white/[.06] hover:text-white/80"
                          }`}
                        >
                          {filter === "All" ? "All" : filter}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                  <div className="flash-news-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
                   <div className="mb-3 flex items-center justify-between gap-3">
                     <div>
                       <h4 className="text-sm font-bold tracking-tight text-white">
                         {eventSearch || eventFilter !== "All"
                           ? "Matching projects"
                           : "Upcoming near Hyderabad"}
                       </h4>
                       <p className="mt-0.5 text-[10px] text-white/35">
                         {filteredPropertyEvents.length}{" "}
                         {filteredPropertyEvents.length === 1 ? "result" : "results"}{" "}
                         found
                       </p>
                     </div>
                     <span className="flex items-center gap-1 text-[10px] text-white/35">
                       <MapPin className="h-3 w-3" />
                       Hyderabad
                     </span>
                   </div>

                   <div className="space-y-3">
                     {filteredPropertyEvents.map((event) => {
                       const EventIcon = event.icon;
                       const isRegistered = Boolean(eventRegistration[event.id]);
                       const spotsLeft =
                         event.capacity -
                         event.attendees -
                         (isRegistered ? 1 : 0);
                       return (
                         <motion.button
                           key={event.id}
                           initial={{ opacity: 0, y: 12 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ duration: 0.25 }}
                           onClick={() => setSelectedPropertyEvent(event)}
                            className="group relative w-full overflow-hidden rounded-xl border border-white/[.09] bg-white/[.025] p-3 text-left transition-colors hover:border-white/20 hover:bg-white/[.05]"
                         >
                           <div className="flex items-start gap-3">
                             <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[.06] text-white/60"
                             >
                                <EventIcon className="h-4 w-4" />
                             </div>
                             <div className="min-w-0 flex-1">
                               <div className="flex items-start justify-between gap-3">
                                 <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">
                                      {event.propertyType}
                                   </p>
                                    <h5 className="mt-1 text-[13px] font-semibold leading-tight text-white">
                                     {event.title}
                                   </h5>
                                 </div>
                                 {isRegistered ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                                 ) : (
                                    <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                                 )}
                               </div>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/45">
                                 <span className="flex items-center gap-1.5">
                                   <CalendarDays className="h-3 w-3 text-white/35" />
                                   {event.dateLabel}
                                 </span>
                                 <span className="flex items-center gap-1.5">
                                   <Clock3 className="h-3 w-3 text-white/35" />
                                   {event.timeLabel}
                                 </span>
                                  <span className="flex min-w-0 items-center gap-1.5">
                                   <MapPin className="h-3 w-3 text-white/35" />
                                    <span className="truncate">{event.location}</span>
                                 </span>
                               </div>
                               <div className="mt-2 flex items-center justify-between gap-3">
                                  <span className="truncate text-[10px] text-white/30">
                                    {event.host}
                                 </span>
                                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-white/35">
                                    {spotsLeft} spots
                                    <span className="text-white/20">·</span>
                                    {isRegistered ? "Registered" : "RSVP"}
                                 </span>
                               </div>
                             </div>
                           </div>
                         </motion.button>
                       );
                     })}
                     {filteredPropertyEvents.length === 0 && (
                       <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                         <Search className="mx-auto h-5 w-5 text-white/25" />
                         <p className="mt-2 text-sm font-semibold text-white/70">
                           No projects found
                         </p>
                         <p className="mt-1 text-[10px] text-white/35">
                           Try another location, villa, plot or flat.
                         </p>
                       </div>
                     )}
                   </div>

                 </div>

                 <AnimatePresence>
                   {selectedPropertyEvent && (
                     <motion.div
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
                       onClick={() => setSelectedPropertyEvent(null)}
                     >
                       <motion.div
                         initial={{ y: 40, opacity: 0 }}
                         animate={{ y: 0, opacity: 1 }}
                         exit={{ y: 40, opacity: 0 }}
                         onClick={(event) => event.stopPropagation()}
                         className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#111318] p-5 shadow-2xl sm:rounded-3xl"
                       >
                         <div className="flex items-start justify-between gap-4">
                           <div>
                             <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                               {selectedPropertyEvent.type}
                             </p>
                             <h4 className="mt-2 text-xl font-bold leading-tight text-white">
                               {selectedPropertyEvent.title}
                             </h4>
                           </div>
                           <button
                             onClick={() => setSelectedPropertyEvent(null)}
                             className="rounded-full bg-white/10 p-2 text-white/60 hover:bg-white/20 hover:text-white"
                             aria-label="Close event details"
                           >
                             <X className="h-4 w-4" />
                           </button>
                         </div>

                         <p className="mt-3 text-sm leading-relaxed text-white/60">
                           {selectedPropertyEvent.description}
                         </p>

                         <div className="mt-5 grid grid-cols-2 gap-2">
                           <div className="rounded-xl border border-white/10 bg-white/[.04] p-3">
                             <CalendarDays className="mb-2 h-4 w-4 text-emerald-300" />
                             <p className="text-[10px] text-white/40">Date</p>
                             <p className="mt-1 text-xs font-semibold text-white">
                               {selectedPropertyEvent.dateLabel}
                             </p>
                           </div>
                           <div className="rounded-xl border border-white/10 bg-white/[.04] p-3">
                             <Clock3 className="mb-2 h-4 w-4 text-emerald-300" />
                             <p className="text-[10px] text-white/40">Time</p>
                             <p className="mt-1 text-xs font-semibold text-white">
                               {selectedPropertyEvent.timeLabel}
                             </p>
                           </div>
                           <div className="col-span-2 rounded-xl border border-white/10 bg-white/[.04] p-3">
                             <MapPin className="mb-2 h-4 w-4 text-emerald-300" />
                             <p className="text-[10px] text-white/40">Meeting point</p>
                             <p className="mt-1 text-xs font-semibold text-white">
                               {selectedPropertyEvent.location}
                             </p>
                           </div>
                         </div>

                         {eventRegistration[selectedPropertyEvent.id] ? (
                           <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                             <div className="flex items-center gap-2 text-emerald-300">
                               <CheckCircle2 className="h-5 w-5" />
                               <p className="text-sm font-bold">You’re on the guest list</p>
                             </div>
                             <p className="mt-2 text-xs leading-relaxed text-white/60">
                               We saved your interest for this meetup. Show up at the meeting point and the host will help you from there.
                             </p>
                           </div>
                         ) : (
                           <div className="mt-5 space-y-3">
                             <div>
                               <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/45">
                                 Your name
                               </label>
                               <input
                                 value={eventName}
                                 onChange={(event) => setEventName(event.target.value)}
                                 placeholder="Enter your full name"
                                 className="w-full rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-300/50"
                               />
                             </div>
                             <div>
                               <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/45">
                                 Mobile number
                               </label>
                               <input
                                 value={eventPhone}
                                 onChange={(event) => setEventPhone(event.target.value)}
                                 placeholder="+91 98765 43210"
                                 inputMode="tel"
                                 className="w-full rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-300/50"
                               />
                             </div>
                             <button
                               onClick={() => registerForPropertyEvent(selectedPropertyEvent)}
                               className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-bold text-[#07130e] transition-colors hover:bg-emerald-200"
                             >
                               Reserve my spot
                               <ArrowRight className="h-4 w-4" />
                             </button>
                             <p className="text-center text-[10px] text-white/30">
                               No payment now · just register your interest
                             </p>
                           </div>
                         )}
                       </motion.div>
                     </motion.div>
                   )}
                 </AnimatePresence>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showPropertyAd && mode !== "swipe" && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto", marginBottom: 24 }}
          exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="z-10 w-full max-w-md overflow-hidden"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-white">
                RCiQ-AI
              </span>
              <InfinityIcon
                className="h-3.5 w-3.5 text-purple-500/70"
                strokeWidth={2.5}
              />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[24px] border border-white/15 bg-[#101016] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <motion.div
              className="flex"
              style={{ width: `${PROPERTY_ADS.length * 100}%` }}
              animate={{
                x: `-${activePropertyAd * (100 / PROPERTY_ADS.length)}%`,
              }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {PROPERTY_ADS.map((ad) => (
                <article
                  key={ad.eyebrow}
                  className="relative h-[226px] shrink-0 overflow-hidden bg-[#101016]"
                  style={{ width: `${100 / PROPERTY_ADS.length}%` }}
                >
                  <img
                    src={ad.image}
                    alt={ad.title}
                    className="absolute inset-x-0 top-0 h-[226px] w-full object-contain object-right"
                  />
                  <div className="absolute inset-x-0 top-0 h-[226px] bg-gradient-to-r from-[#08080b]/95 via-[#08080b]/65 to-[#08080b]/10" />
                  <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
                    <span className="text-[10px] font-bold tabular-nums tracking-wider text-white">
                      {activePropertyAd + 1} / {PROPERTY_ADS.length}
                    </span>
                    <div className="flex items-center gap-1">
                      {PROPERTY_ADS.map((slide, index) => (
                        <button
                          key={slide.eyebrow}
                          type="button"
                          onClick={() => setActivePropertyAd(index)}
                          aria-label={`Show property ad ${index + 1}`}
                          className={`h-1.5 rounded-full transition-all ${
                            activePropertyAd === index
                              ? "w-5 bg-white"
                              : "w-1.5 bg-white/45 hover:bg-white/75"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="relative flex h-[226px] items-start p-5 pb-12 text-left flex-col justify-start">
                    <div className="max-w-[78%]">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300/90">
                        {ad.eyebrow}
                      </p>
                      <h2 className="mt-3 text-2xl font-bold leading-[1.05] tracking-tight text-white">
                        {ad.title}
                      </h2>
                      <p className="mt-2 max-w-[245px] text-xs leading-relaxed text-white/65">
                        {ad.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMapDialog(true)}
                      className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#111116] transition-colors hover:bg-emerald-200"
                    >
                      {ad.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </motion.div>
          </div>
        </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md flex-1 min-h-0 bg-card border border-white/10 rounded-[20px] shadow-2xl p-5 sm:p-6 z-10 relative overflow-hidden flex flex-col"
        >
          {(mode === "login" || mode === "swipe") && (
            <div className="sticky top-0 z-30 -mx-5 bg-card px-5 pb-2 pt-1 sm:-mx-6 sm:px-6">
              <div className="flex p-1 bg-white/10 rounded-lg relative shadow-lg">
              <button
                onClick={() => setMode("login")}
                className={clsx(
                  "flex-1 py-2 text-sm font-semibold rounded-md z-10 transition-colors",
                  mode === "login" || mode === "register"
                    ? "text-white"
                    : "text-white/50",
                )}
              >
                    Properties
              </button>
              <button
                onClick={() => setMode("swipe")}
                className={clsx(
                  "flex-1 py-2 text-sm font-semibold rounded-md z-10 transition-colors flex items-center justify-center gap-1.5",
                  mode === "swipe" ? "text-white" : "text-white/50",
                )}
              >
                <span>Saved Cards</span>
                <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] tabular-nums text-white/75">
                  {savedCardCount}
                </span>
              </button>
              <motion.div
                layoutId="activeTab"
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/20 rounded-md shadow-sm pointer-events-none"
                animate={{ left: mode === "swipe" ? "calc(50%)" : "4px" }}
              />
              </div>
            </div>
          )}

          {mode === "login" && (
            <div className="flex shrink-0 justify-end pb-2">
              <button
                type="button"
                onClick={() => setLocation("/ai")}
                className="flex h-6 w-[76px] items-center justify-center gap-0.5 rounded-md border border-purple-300/40 bg-gradient-to-r from-[#27134a] to-[#171222] text-white shadow-[0_5px_14px_rgba(124,58,237,0.22)] transition-shadow hover:shadow-[0_8px_18px_rgba(124,58,237,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
                aria-label="Ask AI"
                title="Ask AI"
              >
                <MessageCircle className="h-2.5 w-2.5 text-purple-200" />
                <span className="text-[7px] font-bold uppercase tracking-[0.08em]">
                  Ask AI
                </span>
              </button>
            </div>
          )}

          <div
            ref={personaCardRef}
            className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3"
            >
              {mode === "login" ? (
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <div className="flex flex-col items-center text-center space-y-4 py-2 relative">
                     <PropertyProjectFeed
                       onProjectSelect={(projectId) => {
                         setSelectedMapProjectId(projectId);
                         setShowMapDialog(true);
                       }}
                     />
                    <div className="hidden">
                    <div className="flex items-center justify-center gap-3 w-full pt-1">
                      {(() => {
                        const linkedin = form.watch("linkedin");
                        const hasLinkedin =
                          !!linkedin &&
                          linkedin.trim() !== "" &&
                          linkedin !== "#";
                        return (
                          <a
                            href={hasLinkedin ? linkedin : undefined}
                            target={hasLinkedin ? "_blank" : undefined}
                            rel={hasLinkedin ? "noreferrer" : undefined}
                            onClick={(e) => {
                              if (!hasLinkedin) {
                                e.preventDefault();
                                return;
                              }
                              trackClick("linkedin");
                            }}
                            className={clsx(
                              "p-2.5 rounded-lg transition-all",
                              hasLinkedin
                                ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                : "bg-white/5 text-white/20 cursor-not-allowed",
                            )}
                            title={
                              hasLinkedin
                                ? "LinkedIn"
                                : "LinkedIn (Not Available)"
                            }
                          >
                            <Linkedin className="w-4 h-4" />
                          </a>
                        );
                      })()}
                      {(() => {
                        const instagram = form.watch("instagram");
                        const hasInstagram =
                          !!instagram &&
                          instagram.trim() !== "" &&
                          instagram !== "#";
                        return (
                          <a
                            href={hasInstagram ? instagram : undefined}
                            target={hasInstagram ? "_blank" : undefined}
                            rel={hasInstagram ? "noreferrer" : undefined}
                            onClick={(e) => {
                              if (!hasInstagram) {
                                e.preventDefault();
                                return;
                              }
                              trackClick("insta");
                            }}
                            className={clsx(
                              "p-2.5 rounded-lg transition-all",
                              hasInstagram
                                ? "bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 hover:text-pink-300 shadow-[0_0_10px_rgba(236,72,153,0.2)]"
                                : "bg-white/5 text-white/20 cursor-not-allowed",
                            )}
                            title={
                              hasInstagram
                                ? "Instagram"
                                : "Instagram (Not Available)"
                            }
                          >
                            <SiInstagram className="w-4 h-4" />
                          </a>
                        );
                      })()}
                      {(() => {
                        const whatsapp = form.watch("whatsapp");
                        const hasWhatsapp =
                          !!whatsapp &&
                          whatsapp.trim() !== "" &&
                          whatsapp !== "#";
                        const whatsappUrl = hasWhatsapp
                          ? whatsapp.includes("http") ||
                            whatsapp.includes("wa.me")
                            ? whatsapp
                            : `https://wa.me/${whatsappCountryCode}${whatsapp.replace(/\D/g, "")}`
                          : undefined;
                        return (
                          <a
                            href={whatsappUrl}
                            target={hasWhatsapp ? "_blank" : undefined}
                            rel={hasWhatsapp ? "noreferrer" : undefined}
                            onClick={(e) => {
                              if (!hasWhatsapp) {
                                e.preventDefault();
                                return;
                              }
                              trackClick("whatsapp");
                            }}
                            className={clsx(
                              "p-2.5 rounded-lg transition-all",
                              hasWhatsapp
                                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                : "bg-white/5 text-white/20 cursor-not-allowed",
                            )}
                            title={
                              hasWhatsapp
                                ? "WhatsApp"
                                : "WhatsApp (Not Available)"
                            }
                          >
                            <SiWhatsapp className="w-4 h-4" />
                          </a>
                        );
                      })()}
                      {(() => {
                        const email = form.watch("email");
                        const hasEmail =
                          !!email && email.trim() !== "" && email !== "#";
                        return (
                          <a
                            href={hasEmail ? `mailto:${email}` : undefined}
                            target={hasEmail ? "_blank" : undefined}
                            rel={hasEmail ? "noreferrer" : undefined}
                            onClick={(e) => {
                              if (!hasEmail) {
                                e.preventDefault();
                                return;
                              }
                            }}
                            className={clsx(
                              "p-2.5 rounded-lg transition-all",
                              hasEmail
                                ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                                : "bg-white/5 text-white/20 cursor-not-allowed",
                            )}
                            title={hasEmail ? "Email" : "Email (Not Available)"}
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                  {loggedInUser && user && loggedInUser.id === user.id && mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        form.reset({
                          password: "",
                          name: user?.name || "",
                          role: user?.role || "founder",
                          bio: user?.bio || "",
                          instagram: user?.instagram || "",
                          linkedin: user?.linkedin || "",
                          whatsapp: user?.whatsapp || "",
                          website: user?.website || "",
                          cards: user?.cards || [],
                          email:
                            user?.email && !user.email.endsWith("@persona.local")
                              ? user.email
                              : "",
                        });
                        setSelectedCards(user?.cards || []);
                      }}
                      className="w-full bg-white text-black hover:bg-white/90 rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg mb-4"
                    >
                      <Pencil className="w-4 h-4" /> Edit Persona
                    </button>
                  )}
                  {loggedInUser && user && loggedInUser.id === user.id && (
                    <div className="pt-4 border-t border-white/10">
                      {/* Tabs Navigation */}
                      <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl mb-4">
                        <button
                          type="button"
                          onClick={() => setActiveTab("notes")}
                          className={clsx(
                            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
                            activeTab === "notes"
                              ? "bg-white/10 text-white shadow-lg"
                              : "text-white/40 hover:text-white/60",
                          )}
                        >
                          Notes
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("events")}
                          className={clsx(
                            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider",
                            activeTab === "events"
                              ? "bg-white/10 text-white shadow-lg"
                              : "text-white/40 hover:text-white/60",
                          )}
                        >
                          Upcoming Events
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("connect")}
                          className={clsx(
                            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-1.5",
                            activeTab === "connect"
                              ? "bg-white/10 text-white shadow-lg"
                              : "text-white/40 hover:text-white/60",
                          )}
                        >
                          <div className="w-3 h-3 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/40">
                            <div className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_4px_#60a5fa]" />
                          </div>
                          Connect
                        </button>
                      </div>

                      {/* Tab Content */}
                      <AnimatePresence mode="wait">
                        {activeTab === "notes" ? (
                          <motion.div
                            key="notes"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                          >
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                onKeyPress={(e) =>
                                  e.key === "Enter" && addNote()
                                }
                                placeholder={
                                  notes.length >= 5
                                    ? "Limit of 5 notes reached"
                                    : "Add a quick note..."
                                }
                                disabled={notes.length >= 5}
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <button
                                type="button"
                                onClick={addNote}
                                disabled={notes.length >= 5}
                                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-2">
                              {notes.map((note) => (
                                <div
                                  key={note.id}
                                  className="flex items-center gap-3 group"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleNote(note.id)}
                                    className={clsx(
                                      "w-4 h-4 rounded-full border transition-all flex items-center justify-center",
                                      note.completed
                                        ? "bg-purple-500 border-purple-500"
                                        : "border-white/20 hover:border-white/40",
                                    )}
                                  >
                                    {note.completed && (
                                      <Check className="w-2.5 h-2.5 text-white" />
                                    )}
                                  </button>
                                  <div className="flex flex-col flex-1">
                                    <span
                                      className={clsx(
                                        "text-xs transition-all",
                                        note.completed
                                          ? "text-white/20 line-through"
                                          : "text-white/70",
                                      )}
                                    >
                                      {note.text}
                                    </span>
                                    <span
                                      className={clsx(
                                        "text-[8px] uppercase tracking-tighter",
                                        getTimerColor(note.expiresAt),
                                      )}
                                    >
                                      Expires in{" "}
                                      {formatTimeLeft(note.expiresAt)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {notes.length === 0 && (
                                <p className="text-[10px] text-white/20 uppercase tracking-widest text-center py-4">
                                  No notes yet
                                </p>
                              )}
                            </div>
                          </motion.div>
                        ) : activeTab === "events" ? (
                          <motion.div
                            key="events"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-[120px] flex items-center justify-center border border-dashed border-white/10 rounded-2xl"
                          >
                            <div className="text-center space-y-2">
                              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">
                                Upcoming Events
                              </p>
                              <p className="text-xs text-white/20 font-medium">
                                Coming Soon
                              </p>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="connect"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                          >
                            <div className="space-y-2">
                              {connections.map((conn, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setLocation(`/${conn.slug}`)}
                                  className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                                      {conn.name}
                                    </span>
                                    <span className="text-[8px] uppercase tracking-widest text-white/40">
                                      {conn.industry}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-blue-400/80 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">
                                      {getRemainingTime(conn.expiresAt)}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
                                  </div>
                                </div>
                              ))}
                              {connections.length === 0 && (
                                <div className="h-[100px] flex items-center justify-center border border-dashed border-white/10 rounded-2xl bg-gradient-to-tr from-blue-500/5 to-purple-500/5">
                                  <div className="text-center space-y-2">
                                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">
                                      Exclusive Connect
                                    </p>
                                    <p className="text-xs text-white/20 font-medium">
                                      No connections yet
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                   </div>
                </form>
              ) : mode === "register" ? (
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-3 pr-2"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      Name
                    </label>
                    <input
                      {...form.register("name")}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        {...form.register("role")}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none"
                      >
                        {ROLES.map((r) => (
                          <option
                            key={r.value}
                            value={r.value}
                            className="bg-[#1a1a1a]"
                          >
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      Industry
                    </label>
                    <div className="relative">
                      <select
                        {...form.register("industry")}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none"
                      >
                        <option value="" className="bg-[#1a1a1a]">
                          Select Industry
                        </option>
                        {[
                          "Fintech",
                          "Healthtech",
                          "Edtech",
                          "Ecommerce & Retail",
                          "Agritech",
                          "SaaS",
                          "Cleantech & Greentech",
                          "Logistics",
                          "🌱 Sustainability & Energy (EVs)",
                          "DeepTech",
                          "Spacetech",
                          "Robotics & Automation",
                          "Cybersecurity",
                          "AR/VR",
                          "Media & Entertainment",
                        ].map((industry) => (
                          <option
                            key={industry}
                            value={industry}
                            className="bg-[#1a1a1a]"
                          >
                            {industry}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      Bio
                    </label>
                    <input
                      {...form.register("bio")}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="Startup / Business"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                        Instagram
                      </label>
                      <input
                        {...form.register("instagram")}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                        placeholder="URL"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                        LinkedIn
                      </label>
                      <input
                        {...form.register("linkedin")}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                        placeholder="URL"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                        WhatsApp
                      </label>
                      <div className="relative">
                        <div className="flex gap-2">
                          {(() => {
                            const whatsappValue =
                              form.watch("whatsapp")?.toString() || "";
                            const isUrl =
                              whatsappValue.includes("http") ||
                              whatsappValue.includes("whatsapp");
                            // Only show country dropdown if it's NOT a URL AND (it's empty OR contains a number)
                            const shouldShowCountry =
                              !isUrl &&
                              (whatsappValue === "" ||
                                /\d/.test(whatsappValue));

                            if (!shouldShowCountry) return null;

                            return (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowCountryDropdown(!showCountryDropdown)
                                  }
                                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white flex items-center gap-2 hover:bg-white/10 transition-colors"
                                >
                                  {
                                    COUNTRY_CODES.find(
                                      (c) => c.code === whatsappCountryCode,
                                    )?.flag
                                  }
                                  <span className="text-xs font-semibold">
                                    {whatsappCountryCode}
                                  </span>
                                  <ChevronDown className="w-3 h-3 text-white/40" />
                                </button>
                                {showCountryDropdown && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute top-full mt-2 left-0 bg-black/95 border border-white/10 rounded-lg shadow-2xl z-20 max-h-48 overflow-y-auto w-48"
                                  >
                                    {COUNTRY_CODES.map((country) => (
                                      <button
                                        key={country.code}
                                        type="button"
                                        onClick={() => {
                                          setWhatsappCountryCode(country.code);
                                          setShowCountryDropdown(false);
                                        }}
                                        className={clsx(
                                          "w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 transition-colors",
                                          whatsappCountryCode === country.code
                                            ? "bg-white/10 text-white"
                                            : "text-white/70 hover:bg-white/5 hover:text-white",
                                        )}
                                      >
                                        <span className="text-sm">
                                          {country.flag}
                                        </span>
                                        <span className="font-semibold">
                                          {country.code}
                                        </span>
                                        <span className="text-white/40 text-[10px]">
                                          {country.country}
                                        </span>
                                      </button>
                                    ))}
                                  </motion.div>
                                )}
                              </div>
                            );
                          })()}
                          <input
                            {...form.register("whatsapp")}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
                            placeholder="Phone number / WB community URL"
                            onChange={(e) => {
                              const value = e.target.value;
                              const isUrl =
                                value.includes("http") ||
                                value.includes("whatsapp");
                              if (isUrl && showCountryDropdown) {
                                setShowCountryDropdown(false);
                              }
                            }}
                          />
                        </div>
                        {form.watch("whatsapp") &&
                          !form
                            .watch("whatsapp")
                            .toString()
                            .includes("http") && (
                            <p className="text-[9px] text-emerald-400/70 mt-1 ml-1">
                              Will direct to: wa.me/{whatsappCountryCode}
                              {form
                                .watch("whatsapp")
                                ?.toString()
                                .replace(/\D/g, "")}
                            </p>
                          )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                        Email
                      </label>
                      <input
                        {...form.register("email")}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        placeholder="Email"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      Website URL
                    </label>
                    <input
                      {...form.register("website")}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="https://your-website.com"
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      disabled={!form.watch("name") || !form.watch("role")}
                      onClick={() => setMode("customize")}
                      className="flex-1 bg-white text-black rounded-lg py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.reset({
                          password: "",
                          name: "",
                          role: "founder",
                          bio: "",
                          instagram: "",
                          linkedin: "",
                          whatsapp: "",
                          website: "",
                          cards: [],
                          email: "",
                        });
                        setSelectedCards([]);
                        setMode("login");
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white rounded-lg py-3 px-3 font-bold text-sm flex items-center justify-center transition-all border border-white/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : mode === "customize" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Your Mini-Cards ({selectedCards.length}
                      /4)
                    </h4>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 px-1 custom-scrollbar snap-x">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className="min-w-[220px] aspect-[3/4] snap-center"
                      >
                        {selectedCards[idx] ? (
                          <MiniCard
                            idx={idx}
                            cardJson={selectedCards[idx]}
                            onUpdate={(newJson) => {
                              const currentCards = [...selectedCards];
                              currentCards[idx] = newJson;
                              setSelectedCards(currentCards);
                            }}
                            onDelete={() => {
                              const currentCards = [...selectedCards];
                              currentCards.splice(idx, 1);
                              setSelectedCards(currentCards);
                            }}
                          />
                        ) : (
                          <div className="h-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-4">
                            {tweetSubChooser === idx ? (
                              <div className="w-full space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <SiX className="w-4 h-4 text-white/60" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">Choose Type</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentCards = [...selectedCards];
                                    currentCards[idx] = JSON.stringify({ type: "tweet", title: "X Tweet", tweetUrl: "", tweetType: "text" });
                                    setSelectedCards(currentCards);
                                    setTweetSubChooser(null);
                                  }}
                                  className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-all"
                                >
                                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <SiX className="w-4 h-4 text-white" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-white text-[11px] font-bold">TWEET</p>
                                    <p className="text-white/40 text-[9px]">Display a post or thread</p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentCards = [...selectedCards];
                                    currentCards[idx] = JSON.stringify({ type: "tweet", title: "X Video", tweetUrl: "", tweetType: "video" });
                                    setSelectedCards(currentCards);
                                    setTweetSubChooser(null);
                                  }}
                                  className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-all"
                                >
                                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Play className="w-4 h-4 text-white fill-current" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-white text-[11px] font-bold">VIDEO</p>
                                    <p className="text-white/40 text-[9px]">Display a video tweet</p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTweetSubChooser(null)}
                                  className="w-full text-[9px] text-white/30 hover:text-white/50 uppercase tracking-widest font-bold py-1 transition-colors"
                                >
                                  — Back
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 w-full">
                                {CARD_TYPES.map((t) => {
                                  const productCount = selectedCards.filter((c) => {
                                    try {
                                      const parsed = JSON.parse(c);
                                      return parsed.type === "product";
                                    } catch {
                                      return false;
                                    }
                                  }).length;
                                  const isProductDisabled =
                                    t.type === "product" && productCount >= 2;

                                  return (
                                    <button
                                      key={t.type}
                                      type="button"
                                      disabled={isProductDisabled}
                                      onClick={() => {
                                        if (t.type === "tweet") {
                                          setTweetSubChooser(idx);
                                          return;
                                        }
                                        const currentCards = [...selectedCards];
                                        const newCard =
                                          t.type === "reel"
                                            ? {
                                                type: "reel",
                                                title: "New Reel",
                                                url: "",
                                              }
                                            : t.type === "revenue"
                                              ? {
                                                  type: "revenue",
                                                  title: "Monthly Sales",
                                                  value: "$0",
                                                  revenue: "",
                                                  imageUrl: "",
                                                }
                                              : t.type === "traction"
                                                ? {
                                                    type: "traction",
                                                    title: "Traction",
                                                    value: "0",
                                                    traction: "",
                                                    imageUrl: "",
                                                  }
                                                : {
                                                    type: "product",
                                                    title: "Product",
                                                    imageUrl: "",
                                                    traction: "",
                                                  };
                                        currentCards[idx] = JSON.stringify(newCard);
                                        setSelectedCards(currentCards);
                                      }}
                                      className={clsx(
                                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                                        isProductDisabled
                                          ? "bg-white/5 opacity-20 cursor-not-allowed"
                                          : "bg-white/5 hover:bg-white/10",
                                      )}
                                    >
                                      <t.icon className="w-5 h-5 text-white/60" />
                                      <span className="text-[8px] text-white/40 uppercase font-bold">
                                        {t.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={updateProfileMutation.isPending}
                    onClick={() => form.handleSubmit(onSubmit)()}
                    className="w-full bg-white text-black rounded-lg py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save All"
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  <SwipeCard cards={selectedCards} user={user} />
                </div>
              )}
            </motion.div>

            {mode === "swipe" && (
              <div className="flex items-center justify-between text-white/40 text-[10px] uppercase tracking-wider font-bold px-4 mt-3">
                <span>← Left Swipe</span>
                <span>Right Swipe →</span>
              </div>
            )}

            {isOtherPersona ? (
              <button
                type="button"
                onClick={() => setLocation(`/${loggedInUser.uniqueSlug}`)}
                className="w-full bg-white text-black hover:bg-white/90 rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg mt-2"
              >
                Back to My Persona
              </button>
            ) : null}

          </div>
        </motion.div>

        <AnimatePresence>
          {showCreatePropertyPinDialog && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setCreatePropertyPin("");
                  setShowCreatePropertyPinDialog(false);
                }}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.form
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreatePropertyAccess();
                }}
                className="relative z-10 w-full max-w-sm space-y-6 rounded-[24px] border border-white/10 bg-[#111116] p-7 text-center shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setCreatePropertyPin("");
                    setShowCreatePropertyPinDialog(false);
                  }}
                  className="absolute right-4 top-4 p-2 text-white/40 transition-colors hover:text-white"
                  aria-label="Close PIN dialog"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-300">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold uppercase tracking-widest text-white">
                    Create Property
                  </h3>
                  <p className="text-xs text-white/45">
                    Enter the access PIN to unlock property profile creation.
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <label
                    htmlFor="create-property-pin"
                    className="ml-1 text-[10px] font-bold uppercase tracking-widest text-white/40"
                  >
                    Access PIN
                  </label>
                  <input
                    id="create-property-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    maxLength={4}
                    value={createPropertyPin}
                    onChange={(event) =>
                      setCreatePropertyPin(
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    placeholder="••••"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-xl tracking-[0.7em] text-white focus:border-purple-500/50 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={createPropertyPin.length !== 4}
                  className="w-full rounded-xl bg-white py-4 text-sm font-bold text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Unlock and continue
                </button>
              </motion.form>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showScannerDialog && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowScannerDialog(false)}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
              >
                {/* Tabs */}
                <div className="flex p-2 bg-white/5 border-b border-white/10">
                  <button
                    onClick={() => setScannerTab("scan")}
                    className={clsx(
                      "flex-1 py-2.5 text-xs font-bold rounded-xl transition-all",
                      scannerTab === "scan"
                        ? "bg-white/10 text-white shadow-lg"
                        : "text-white/40 hover:text-white/60",
                    )}
                  >
                    Scan QR
                  </button>
                  <button
                    onClick={() => setScannerTab("code")}
                    className={clsx(
                      "flex-1 py-2.5 text-xs font-bold rounded-xl transition-all",
                      scannerTab === "code"
                        ? "bg-white/10 text-white shadow-lg"
                        : "text-white/40 hover:text-white/60",
                    )}
                  >
                          Profile Code
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  {scannerTab === "scan" ? (
                    <div className="space-y-6 text-center">
                      <div className="relative aspect-square max-w-[200px] mx-auto bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center group overflow-hidden">
                        <video
                          ref={videoRef}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <QrCode className="w-12 h-12 text-white/20 relative z-10" />
                        <div className="absolute bottom-4 left-0 right-0">
                          <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">
                            Scanner Active
                          </p>
                        </div>
                        {/* Scanning Corners */}
                        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
                        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white/20 rounded-tr-lg" />
                        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white/20 rounded-bl-lg" />
                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white/20 rounded-br-lg" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">
                          Scan to Connect
                        </h3>
                        <p className="text-white/40 text-xs">
                          Point your camera at a Persona QR code
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 text-center">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight uppercase tracking-widest">
                          Enter Code
                        </h3>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                          Connect with a unique persona code
                        </p>
                      </div>

                      <div className="space-y-4 text-left">
                        <div className="space-y-2">
                          <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold ml-1">
                            Persona Code
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. x8y2z"
                            value={personaSlug}
                            onChange={(e) =>
                              setPersonaSlug(e.target.value.toLowerCase())
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/20 transition-all font-mono"
                          />
                        </div>
                        <button
                          onClick={handleVerifyPersona}
                          className="w-full bg-white text-black rounded-xl py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-95"
                        >
                          Preview Profile <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowScannerDialog(false)}
                  className="w-full py-4 text-[10px] text-white/20 hover:text-white/40 uppercase tracking-[0.3em] font-bold border-t border-white/5 transition-colors"
                >
                  Close Scanner
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMapDialog && (
            <HyderabadPropertyMapOverlay
              initialProjectId={selectedMapProjectId}
              onClose={() => {
                setShowMapDialog(false);
                setSelectedMapProjectId(null);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPersonaDialog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPersonaDialog(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-card border border-white/10 rounded-[24px] p-8 shadow-2xl z-10"
              >
                <button
                  onClick={() => setShowPersonaDialog(false)}
                  className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-2 mb-8">
                  <h3 className="text-2xl font-bold text-white uppercase tracking-widest">
                    Access Property Profile
                  </h3>
                  <p className="text-white/40 text-xs uppercase tracking-wider">
                    Enter your unique credentials
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold ml-1">
                      Profile Code
                    </label>
                    <input
                      type="text"
                      value={personaSlug}
                      onChange={(e) => setPersonaSlug(e.target.value)}
                      placeholder="e.g. x8y2z"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold ml-1">
                      PIN
                    </label>
                    <input
                      type="password"
                      maxLength={5}
                      value={personaPin}
                      onChange={(e) => setPersonaPin(e.target.value)}
                      placeholder="•••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors tracking-[0.5em]"
                    />
                  </div>

                  <button
                    onClick={handleVerifyPersona}
                    disabled={isVerifying}
                    className="w-full bg-white text-black rounded-xl py-4 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all shadow-lg group"
                  >
                    {isVerifying ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Connect Persona
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showQRDialog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-[240px] mx-auto"
              >
                {/* Close Button on Top Right */}
                <button
                  onClick={() => setShowQRDialog(false)}
                  className="absolute -top-12 right-0 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-all backdrop-blur-md border border-white/20 shadow-2xl z-[150] active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* iPhone Frame - Ultra Compact & Minimalist */}
                <div className="relative aspect-[9/19.5] bg-[#050505] rounded-[42px] p-1.5 shadow-[0_0_0_1px_#1a1a1a,0_0_0_4px_#000,0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden border-[1px] border-white/5">
                  {/* Tiny Dynamic Island */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-14 h-4 bg-black rounded-full z-50 flex items-center justify-end px-2.5">
                    <div className="w-0.5 h-0.5 rounded-full bg-blue-500/20 shadow-[0_0_2px_#3b82f6]" />
                  </div>

                  {/* iPhone Screen Content */}
                  <div
                    id="iphone-screen-preview"
                    className="w-full h-full bg-[#050505] rounded-[36px] relative overflow-hidden flex flex-col items-center p-4"
                  >
                    {/* Status Bar */}
                    <div className="status-bar-container w-full flex justify-between items-center px-6 pt-2 pb-1 z-50">
                      <span className="text-white text-[10px] font-medium">
                        {currentTime}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full border border-white/20" />
                        <div className="w-4 h-2 rounded-sm border border-white/20" />
                      </div>
                    </div>

                    <div className="flex flex-col items-center w-full space-y-4 mt-4">
                      {/* Profile Section */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative group">
                          <div className="w-16 h-16 rounded-full border-2 border-white/10 p-1 bg-white/5">
                            <img
                              src={avatarUrl}
                              alt="Avatar"
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                          <button
                            onClick={() => setShowAvatarDialog(true)}
                            className="edit-avatar-button absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg border border-black/5 hover:scale-110 transition-transform"
                          >
                            <Pencil className="w-3 h-3 text-black" />
                          </button>
                        </div>
                        <div className="text-center space-y-0.5">
                          <h5 className="text-white text-lg font-bold tracking-tight">
                            {user?.name || "Founder Name"}
                          </h5>
                          <p className="text-white/40 text-[8px] uppercase tracking-[0.2em] font-black">
                            {user?.role || "FOUNDER"}
                          </p>
                          <p className="text-white/30 text-[8px] uppercase tracking-wider line-clamp-1 px-4">
                            {user?.bio || ""}
                          </p>
                        </div>
                      </div>

                      {/* QR Code Section - More Compact */}
                      <div
                        id="qr-download-area"
                        className="p-4 bg-white rounded-[24px] shadow-2xl flex flex-col items-center"
                      >
                        <QRCodeSVG
                          value={
                            window.location.origin +
                            "/" +
                            (displaySlug ||
                              user?.uniqueSlug ||
                              window.location.pathname.split("/")[1] ||
                              "")
                          }
                          size={140}
                          level="H"
                          includeMargin={false}
                          fgColor={qrColor}
                          bgColor={qrBgColor}
                        />
                      </div>

                      <div className="text-center space-y-1">
                        <p className="text-[8px] text-white/20 uppercase tracking-[0.3em] font-black">
                          Scan to Connect
                        </p>
                        <p className="text-[10px] font-mono font-bold text-white/70 tracking-[0.2em] uppercase">
                          Code: {displaySlug || user?.uniqueSlug}
                        </p>
                      </div>
                    </div>

                    {/* Home Indicator */}
                    <div className="home-indicator absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/10 rounded-full" />

                    {/* Avatar Selection Dialog */}
                    <AnimatePresence>
                      {showAvatarDialog && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute inset-0 z-[60] flex items-center justify-center p-4"
                        >
                          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 w-full max-w-[240px]">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-white text-[10px] font-bold uppercase tracking-widest">
                                Select Avatar
                              </span>
                              <button
                                onClick={() => setShowAvatarDialog(false)}
                              >
                                <X className="w-3 h-3 text-white/40" />
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <AnimatePresence>
                                {professionalAvatars.map((url, i) => (
                                  <motion.button
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{
                                      opacity: 1,
                                      scale: 1,
                                      y: 0,
                                      transition: { delay: i * 0.05 },
                                    }}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      setAvatarUrl(url);
                                      setShowAvatarDialog(false);
                                    }}
                                    className="aspect-square rounded-full border-2 border-white/10 overflow-hidden hover:border-white/60 transition-all"
                                  >
                                    <img
                                      src={url}
                                      className="w-full h-full object-cover"
                                      alt={`Avatar ${i + 1}`}
                                    />
                                  </motion.button>
                                ))}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Tiny Controls */}
                    <div className="bottom-controls w-full flex justify-between items-center px-3 opacity-30 mt-auto">
                      <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                        <Save className="w-3 h-3 text-white" />
                      </div>
                      <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                        <QrCode className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Below iPhone - Compact */}
                <div className="mt-5 space-y-2 px-1">
                  <button
                    onClick={downloadQR}
                    className="w-full bg-white text-black rounded-xl py-3 font-bold text-[11px] flex items-center justify-center gap-2 hover:bg-white/90 transition-all shadow-lg active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showHomeDialog && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[32px] p-6 shadow-2xl text-center space-y-6 overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 opacity-50" />

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {form.getValues("name")}
                  </h3>
                  <p className="text-white/40 text-xs">
                    Your persona is live and ready.
                  </p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">
                      Persona Code
                    </p>
                    <button
                      onClick={() => {
                        setIsEditingDialogCode(!isEditingDialogCode);
                        if (!isEditingDialogCode) setCustomSlug(user?.uniqueSlug || "");
                      }}
                      className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                    >
                      <Pencil className="w-3 h-3 text-white/60" />
                    </button>
                  </div>
                  {isEditingDialogCode ? (
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                      placeholder={user?.uniqueSlug || ""}
                      maxLength={12}
                      className="w-full bg-transparent text-2xl font-mono font-black text-white tracking-[0.3em] text-center focus:outline-none border-b border-white/20 pb-1"
                      autoFocus
                    />
                  ) : (
                    <div className="text-2xl font-mono font-black text-white tracking-[0.3em]">
                      {customSlug || user?.uniqueSlug}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold ml-1">
                      Set Login PIN (5 Digits)
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="•••••"
                        value={pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (val.length <= 5) setPin(val);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[1em] text-white focus:outline-none focus:border-white/20 transition-all placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (pin.length === 5) {
                        try {
                          const updateData: Partial<InsertUser> = { pin };
                          if (customSlug && customSlug !== user?.uniqueSlug) {
                            updateData.uniqueSlug = customSlug;
                          }
                          const savedUser = await updateProfileMutation.mutateAsync(updateData);
                          // Set displaySlug directly from the server response so
                          // the QR dialog shows the correct code on its very first render,
                          // without waiting for the useEffect cycle.
                          if (savedUser?.uniqueSlug) {
                            setDisplaySlug(savedUser.uniqueSlug);
                          }
                          setIsEditingDialogCode(false);
                          setCustomSlug("");
                          setShowHomeDialog(false);
                          setShowQRDialog(true);
                          toast({
                            title: "Security Updated",
                            description:
                              "Your 5-digit PIN has been set successfully.",
                          });
                        } catch (e) {
                          toast({
                            title: "Error",
                            description: "Failed to set PIN. Please try again.",
                            variant: "destructive",
                          });
                        }
                      } else {
                        toast({
                          title: "Invalid PIN",
                          description: "Please enter a 5-digit numeric PIN.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="w-full bg-white text-black rounded-xl py-3 font-bold text-sm hover:bg-white/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Save & Continue"
                    )}
                  </button>
                </div>

                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showPersonaDialog && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPersonaDialog(false)}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl text-center space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white tracking-tight">
                    Access Persona
                  </h3>
                  <p className="text-white/40 text-sm">
                    Enter your code and PIN to continue.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold ml-1">
                      Persona Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. x1y2z"
                      value={personaCode}
                      onChange={(e) =>
                        setPersonaCode(e.target.value.toLowerCase())
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold ml-1">
                      5-Digit PIN
                    </label>
                    <input
                      type="password"
                      maxLength={5}
                      placeholder="•••••"
                      value={verifyPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 5) setVerifyPin(val);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[1em] text-white focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                  </div>

                  <button
                    onClick={async () => {
                      if (personaCode && verifyPin.length === 5) {
                        try {
                          const res = await apiRequest(
                            "POST",
                            "/api/auth/verify-persona",
                            {
                              slug: personaCode,
                              pin: verifyPin,
                            },
                          );
                          const userData = await res.json();

                          // Set user and sync form
                          localStorage.setItem("persona_user_id", userData.id);
                          localStorage.setItem(
                            "persona_user",
                            JSON.stringify(userData),
                          );
                          await queryClient.invalidateQueries({
                            queryKey: ["/api/me"],
                          });
                          setLocalUser(userData);
                          setShowPersonaDialog(false);
                          form.reset({
                            email: userData.email || "",
                            name: userData.name || "",
                            role: userData.role || "founder",
                            bio: userData.bio || "",
                            instagram: userData.instagram || "",
                            linkedin: userData.linkedin || "",
                            whatsapp: userData.whatsapp || "",
                            website: userData.website || "",
                            cards: userData.cards || [],
                          });
                          setSelectedCards(userData.cards || []);

                          if (userData.uniqueSlug) {
                            setLocation(`/${userData.uniqueSlug}`);
                          }

                          setMode("login");
                          toast({
                            title: "Welcome back!",
                            description: `Successfully loaded persona: ${userData.name}`,
                          });
                        } catch (e: any) {
                          toast({
                            title: "Access Denied",
                            description: "Invalid persona code or PIN.",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    className="w-full bg-white text-black rounded-xl py-4 font-bold text-sm hover:bg-white/90 transition-all active:scale-95"
                  >
                    Load Property Profile
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
