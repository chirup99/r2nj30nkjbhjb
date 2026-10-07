import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toCanvas } from "html-to-image";
import {
  ArrowDownToLine,
  Check,
  MapPin,
  Moon,
  Share,
  Sun,
  X,
  Waves,
} from "lucide-react";

export type MiniPropertyCardData = {
  market: string;
  name: string;
  location: string;
  developer: string;
  price?: string;
  facts: { label: string; value: string; icon?: "lake" }[];
  showLakeFact?: boolean;
  mapImage: string;
  accent: string;
};

type CanvasSize = "poster" | "square" | "story";
type CardTheme = "light" | "dark" | "rainbow";

function RainbowThemeIcon({ className }: { className?: string }) {
  const gradientId = `share-card-rainbow-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="22%" stopColor="#f97316" />
          <stop offset="42%" stopColor="#facc15" />
          <stop offset="62%" stopColor="#22c55e" />
          <stop offset="81%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <path d="M22 17a10 10 0 0 0-20 0" stroke={`url(#${gradientId})`} />
      <path d="M6 17a6 6 0 0 1 12 0" stroke={`url(#${gradientId})`} />
      <path d="M10 17a2 2 0 0 1 4 0" stroke={`url(#${gradientId})`} />
    </svg>
  );
}

const CARD_THEME_STYLES: Record<
  CardTheme,
  {
    background: string;
    border: string;
    developer: string;
    title: string;
    price: string;
    mapFrame: string;
    mapTint: string;
    location: string;
    factsDivider: string;
    factLabel: string;
    factValue: string;
    lakeIcon: string;
    disclaimer: string;
    footerBorder: string;
    footer: string;
  }
> = {
  light: {
    background: "#f4f0e7",
    border: "border-[#d9d0bc]",
    developer: "text-[#8d7950]",
    title: "text-[#1d1e19]",
    price: "bg-[#e8dfca] text-[#383326]",
    mapFrame: "border-[#d6cebf] bg-[#ded9ce]",
    mapTint: "bg-[#30291c]/[0.06]",
    location: "text-[#716b5e]",
    factsDivider: "border-[#d7cfbf]",
    factLabel: "text-[#928977]",
    factValue: "text-[#3c3b33]",
    lakeIcon: "text-cyan-700",
    disclaimer: "text-[#7a756a]",
    footerBorder: "border-[#d7cfbf]",
    footer: "text-[#89816f]",
  },
  dark: {
    background: "#111827",
    border: "border-slate-700",
    developer: "text-amber-200/75",
    title: "text-slate-50",
    price: "bg-white/10 text-slate-100",
    mapFrame: "border-slate-700 bg-slate-800",
    mapTint: "bg-black/20",
    location: "text-slate-300",
    factsDivider: "border-slate-700",
    factLabel: "text-slate-400",
    factValue: "text-slate-100",
    lakeIcon: "text-cyan-300",
    disclaimer: "text-slate-400",
    footerBorder: "border-slate-700",
    footer: "text-slate-400",
  },
  rainbow: {
    background: "linear-gradient(135deg, #33204a 0%, #111827 100%)",
    border: "border-white/25",
    developer: "text-white/75",
    title: "text-white",
    price: "bg-white/90 text-slate-950",
    mapFrame: "border-white/35 bg-slate-950/50",
    mapTint: "bg-transparent",
    location: "text-white/80",
    factsDivider: "border-white/30",
    factLabel: "text-white/65",
    factValue: "text-white",
    lakeIcon: "text-cyan-200",
    disclaimer: "text-white/65",
    footerBorder: "border-white/25",
    footer: "text-white/65",
  },
};

const CARD_THEME_OPTIONS = [
  {
    id: "dark",
    label: "Dark",
    icon: Moon,
    selectedClass: "border-slate-400 bg-slate-700/80 text-white",
  },
  {
    id: "light",
    label: "Light",
    icon: Sun,
    selectedClass: "border-amber-300 bg-amber-200 text-amber-950",
  },
  {
    id: "rainbow",
    label: "Rainbow",
    icon: RainbowThemeIcon,
    selectedClass:
      "border-white/50 bg-gradient-to-r from-rose-500/45 via-fuchsia-500/45 to-cyan-400/45 text-white shadow-[0_0_18px_rgba(217,70,239,0.22)]",
  },
] as const;

const CANVAS_SIZES: {
  id: CanvasSize;
  label: string;
  ratio: number;
  dimensions: string;
}[] = [
  { id: "poster", label: "Poster", ratio: 2 / 3, dimensions: "2:3" },
  { id: "square", label: "Square", ratio: 1, dimensions: "1:1" },
  { id: "story", label: "Story", ratio: 9 / 16, dimensions: "9:16" },
];

function fileSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function MiniPropertyCard({
  data,
  onClose,
}: {
  data: MiniPropertyCardData;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>("poster");
  const [cardTheme, setCardTheme] = useState<CardTheme>("light");
  const [isExporting, setIsExporting] = useState(false);
  const [preparedShareImage, setPreparedShareImage] = useState<{
    data: MiniPropertyCardData;
    canvasSize: CanvasSize;
    cardTheme: CardTheme;
    blob: Blob;
  } | null>(null);
  const [shareImageError, setShareImageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error" | "neutral";
    message: string;
  } | null>(null);
  const selectedSize =
    CANVAS_SIZES.find((size) => size.id === canvasSize) ?? CANVAS_SIZES[0];
  const theme = CARD_THEME_STYLES[cardTheme];
  const cardAccent = data.accent || "#8b5cf6";
  const cardBackground =
    cardTheme === "rainbow"
      ? `linear-gradient(135deg, color-mix(in srgb, ${cardAccent} 34%, #101827) 0%, color-mix(in srgb, ${cardAccent} 18%, #111827) 54%, #10120f 100%)`
      : theme.background;
  const cardMapTintStyle =
    cardTheme === "rainbow"
      ? {
          background: `linear-gradient(135deg, color-mix(in srgb, ${cardAccent} 26%, transparent), transparent 55%, color-mix(in srgb, ${cardAccent} 30%, transparent))`,
          mixBlendMode: "soft-light" as const,
        }
      : undefined;
  const exportBackgroundColor =
    cardTheme === "dark"
      ? "#111827"
      : cardTheme === "rainbow"
        ? "#10120f"
        : "#f4f0e7";
  const visibleFacts = data.facts
    .filter((fact) => fact.icon !== "lake" || data.showLakeFact === true)
    .slice(0, 4);
  const cardWidth = Math.min(
    390,
    window.innerHeight * 0.47 * selectedSize.ratio,
    window.innerWidth * 0.86,
  );
  const extension = "jpg";
  const filename = `${fileSlug(data.name) || "property-card"}-${canvasSize}.${extension}`;

  const isShareImageReady =
    preparedShareImage?.data === data &&
    preparedShareImage.canvasSize === canvasSize &&
    preparedShareImage.cardTheme === cardTheme;

  const createImageBlob = useCallback(async () => {
    if (!cardRef.current) {
      throw new Error("The property card is not ready to export.");
    }
    await Promise.all(
      Array.from(cardRef.current.querySelectorAll("img")).map(async (image) => {
        if (typeof image.decode === "function") {
          await image.decode();
        } else if (!image.complete) {
          await new Promise<void>((resolve, reject) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener(
              "error",
              () => reject(new Error("The map image could not be loaded. Please try again.")),
              { once: true },
            );
          });
        }
        if (image.naturalWidth === 0 || image.naturalHeight === 0) {
          throw new Error("The map image could not be loaded. Please try again.");
        }
      }),
    );
    await document.fonts.ready;
    const canvas = await toCanvas(cardRef.current, {
      pixelRatio: Math.min(4, Math.max(2, 1080 / cardWidth)),
      backgroundColor: exportBackgroundColor,
    });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.96),
    );
    if (!blob) {
      throw new Error("The image could not be created. Please try again.");
    }
    return blob;
  }, [cardWidth, exportBackgroundColor]);

  useEffect(() => {
    let cancelled = false;
    setPreparedShareImage(null);
    setShareImageError(null);

    void createImageBlob()
      .then((blob) => {
        if (!cancelled) {
          setPreparedShareImage({ data, canvasSize, cardTheme, blob });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "The image could not be prepared for sharing.";
          setShareImageError(message);
          setNotice({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [createImageBlob, data, canvasSize, cardTheme]);

  const saveImage = async () => {
    setIsExporting(true);
    setNotice(null);
    try {
      const blob =
        isShareImageReady && preparedShareImage
          ? preparedShareImage.blob
          : await createImageBlob();
      triggerDownload(blob, filename);
      setNotice({ kind: "success", message: `${extension.toUpperCase()} saved to your device.` });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The image could not be saved. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareImage = () => {
    if (!isShareImageReady || !preparedShareImage) return;

    setIsExporting(true);
    setNotice(null);
    let shareStarted = false;
    try {
      const file = new File([preparedShareImage.blob], filename, { type: "image/jpeg" });
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        const shareRequest = navigator.share({
          files: [file],
          title: data.name,
          text: `${data.name} · ${data.location}`,
        });
        shareStarted = true;
        void shareRequest
          .then(() => setNotice({ kind: "success", message: "Property card shared." }))
          .catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError") {
              setNotice({
                kind: "neutral",
                message: "Sharing was cancelled. Nothing was shared.",
              });
            } else {
              setNotice({
                kind: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "The image could not be shared. Try saving it instead.",
              });
            }
          })
          .finally(() => setIsExporting(false));
        return;
      } else {
        triggerDownload(preparedShareImage.blob, filename);
        setNotice({
          kind: "neutral",
          message: "File sharing is not available here, so the image was saved instead.",
        });
      }
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The image could not be shared. Try saving it instead.",
      });
    } finally {
      if (!shareStarted) setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[190] flex items-center justify-center overflow-y-auto bg-[#10120f]/75 p-3 backdrop-blur-md sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${data.name} property card`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.section
          initial={{ y: 22, opacity: 0.8, scale: 0.985 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 18, opacity: 0, scale: 0.985 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="my-auto flex w-full max-w-[900px] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#191b18] text-[#f5f1e9] shadow-[0_28px_100px_rgba(0,0,0,0.48)] md:grid md:grid-cols-[minmax(0,1fr)_290px]"
        >
          <div className="relative flex min-h-[52vh] flex-col items-center justify-center bg-[#10120f] px-4 pb-5 pt-14 sm:px-8 md:min-h-[680px] md:py-10">
            <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-white/10 px-5 py-3.5 sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#d7ba79]">
                  {data.market} · SHARE CARD
                </p>
                <p className="mt-1 text-xs text-white/55">A place worth knowing</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/65 transition hover:border-white/30 hover:text-white md:hidden"
                aria-label="Close property card editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={cardRef}
              className={`relative isolate overflow-hidden border shadow-[0_20px_70px_rgba(0,0,0,0.42)] ${theme.border}`}
              style={{
                width: `${cardWidth}px`,
                maxWidth: "100%",
                aspectRatio: selectedSize.ratio,
                background: cardBackground,
                ...(cardTheme === "rainbow"
                  ? {
                      borderColor: `color-mix(in srgb, ${cardAccent} 70%, white 30%)`,
                    }
                  : {}),
              }}
            >
              <div className="flex h-full flex-col p-[3.5%]">
                <div
                  className={`relative min-h-0 flex-[6_0_0%] overflow-hidden border ${theme.mapFrame}`}
                >
                  <img
                    src={data.mapImage}
                    alt={`Live map centered on ${data.name}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    crossOrigin="anonymous"
                  />
                  <div
                    className={`absolute inset-0 ${theme.mapTint}`}
                    style={cardMapTintStyle}
                  />
                  <div
                    className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
                    aria-hidden="true"
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f7f2e7] text-white shadow-[0_2px_8px_rgba(24,25,20,0.35)]"
                      style={{ backgroundColor: data.accent }}
                    >
                      <MapPin className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1.5} />
                    </span>
                  </div>
                </div>

                <div className="flex min-h-0 flex-[4_0_0%] flex-col overflow-hidden pt-[2.5%]">
                  <div className="flex min-h-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[6px] font-bold uppercase tracking-[0.15em] ${theme.developer}`}
                      >
                        {data.developer}
                      </p>
                      <h2
                        className={`mt-0.5 line-clamp-2 font-[var(--font-display)] text-[clamp(16px,4vw,24px)] font-medium leading-[0.96] tracking-[-0.05em] ${theme.title}`}
                      >
                        {data.name}
                      </h2>
                    </div>
                    {data.price && (
                      <p
                        className={`max-w-[38%] shrink-0 rounded-sm px-2 py-1 text-right text-[clamp(6px,1.7vw,8px)] font-bold leading-tight ${theme.price}`}
                      >
                        {data.price}
                      </p>
                    )}
                  </div>
                  <p
                    className={`mt-[1.5%] flex shrink-0 items-center gap-1 text-[7px] font-medium ${theme.location}`}
                  >
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="line-clamp-1">{data.location}</span>
                  </p>
                  {visibleFacts.length > 0 && (
                    <div
                      className={`mt-[1.5%] grid shrink-0 grid-cols-2 gap-x-2 border-t pt-[1.5%] ${theme.factsDivider}`}
                    >
                      {visibleFacts.map((fact) => (
                        <div className="min-w-0" key={`${fact.label}-${fact.value}`}>
                          <p
                            className={`flex items-center gap-0.5 text-[5px] font-bold uppercase tracking-[0.12em] ${theme.factLabel}`}
                          >
                            {fact.icon === "lake" && (
                              <Waves className={`h-2 w-2 shrink-0 ${theme.lakeIcon}`} />
                            )}
                            {fact.label}
                          </p>
                          <p
                            className={`mt-0.5 line-clamp-2 break-words text-[7px] font-semibold leading-tight ${theme.factValue}`}
                          >
                            {fact.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {visibleFacts.some((fact) => fact.icon === "lake") && (
                    <p
                      className={`mt-[1%] shrink-0 text-[4px] leading-tight ${theme.disclaimer}`}
                    >
                      Map overlay only · verify official FTL and buffer boundaries
                    </p>
                  )}
                  <div
                    className={`mt-auto flex shrink-0 items-center justify-between gap-2 border-t pt-[1.5%] ${theme.footerBorder}`}
                  >
                    <span
                      className={`text-[6px] font-semibold uppercase tracking-[0.13em] ${theme.footer}`}
                    >
                      DISCOVERED ON TRYYAM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="flex flex-col border-t border-white/10 bg-[#1b1d1a] p-5 sm:p-6 md:border-l md:border-t-0">
            <div className="hidden items-start justify-between md:flex">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d7ba79]">
                  Share card
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#f5f1e9]">
                  Ready to send.
                </h2>
                <p className="mt-1 text-xs leading-5 text-white/50">
                  A real map crop, centered on this development.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
                aria-label="Close property card editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 md:mt-8">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/45">
                  Card theme
                </p>
                <p className="text-[9px] text-white/35">
                  Included in the image
                </p>
              </div>
              <div
                role="group"
                aria-label="Choose a card theme"
                className="mt-2 grid grid-cols-3 gap-2"
              >
                {CARD_THEME_OPTIONS.map((option) => {
                  const isSelected = cardTheme === option.id;
                  const Icon = option.icon;

                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => {
                        setCardTheme(option.id);
                        setNotice(null);
                      }}
                      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                        isSelected
                          ? option.selectedClass
                          : "border-white/10 bg-white/[0.025] text-white/60 hover:border-white/25 hover:text-white/85"
                      }`}
                      aria-label={`Use ${option.label} theme`}
                      aria-pressed={isSelected}
                      title={`${option.label} theme`}
                    >
                      <Icon
                        className={`shrink-0 ${option.id === "rainbow" ? "h-5 w-5" : "h-4 w-4"}`}
                      />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/45">
                Canvas size
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {CANVAS_SIZES.map((size) => {
                  const isSelected = canvasSize === size.id;
                  return (
                    <button
                      type="button"
                      key={size.id}
                      onClick={() => {
                        setCanvasSize(size.id);
                        setNotice(null);
                      }}
                      className={`rounded-xl border px-2 py-2.5 text-left transition ${
                        isSelected
                          ? "border-[#d7ba79] bg-[#d7ba79]/10 text-[#f3d994]"
                          : "border-white/10 bg-white/[0.025] text-white/65 hover:border-white/25"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span className="block text-[11px] font-semibold">{size.label}</span>
                      <span className="mt-0.5 block font-mono text-[9px] opacity-60">
                        {size.dimensions}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto pt-5">
              <button
                type="button"
                onClick={shareImage}
                disabled={isExporting || !isShareImageReady}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d7ba79] px-4 py-3 text-sm font-bold text-[#28251d] transition hover:bg-[#e6cb8d] disabled:cursor-wait disabled:opacity-60"
              >
                <Share className="h-4 w-4" />
                {isExporting
                  ? "Sharing image…"
                  : isShareImageReady
                    ? "Share image"
                    : shareImageError
                      ? "Image unavailable"
                      : "Preparing image…"}
              </button>
              <button
                type="button"
                onClick={() => void saveImage()}
                disabled={isExporting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60"
              >
                <ArrowDownToLine className="h-4 w-4" />
                Save {extension.toUpperCase()}
              </button>
              <AnimatePresence mode="wait">
                {notice && (
                  <motion.p
                    key={`${notice.kind}-${notice.message}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    role={notice.kind === "error" ? "alert" : "status"}
                    className={`mt-3 flex items-start gap-2 text-xs leading-5 ${
                      notice.kind === "error"
                        ? "text-[#f1a39b]"
                        : notice.kind === "neutral"
                          ? "text-white/65"
                          : "text-[#c8d3b4]"
                    }`}
                  >
                    {notice.kind === "success" && (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{notice.message}</span>
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="mt-4 text-[10px] leading-4 text-white/35">
                Listing facts reflect the map catalog. Confirm details with the
                developer before making a purchase.
              </p>
            </div>
          </aside>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
