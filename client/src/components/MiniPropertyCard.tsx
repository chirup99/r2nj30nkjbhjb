import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toCanvas } from "html-to-image";
import {
  ArrowDownToLine,
  Check,
  MapPin,
  Share2,
  X,
} from "lucide-react";

export type MiniPropertyCardData = {
  market: string;
  name: string;
  location: string;
  developer: string;
  price?: string;
  facts: { label: string; value: string }[];
  mapImage: string;
  mapAttribution: string;
  accent: string;
};

type CanvasSize = "poster" | "square" | "story";
type ImageFormat = "png" | "jpeg";

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
  const [imageFormat, setImageFormat] = useState<ImageFormat>("png");
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error" | "neutral";
    message: string;
  } | null>(null);
  const selectedSize =
    CANVAS_SIZES.find((size) => size.id === canvasSize) ?? CANVAS_SIZES[0];
  const cardWidth = Math.min(
    390,
    window.innerHeight * 0.47 * selectedSize.ratio,
    window.innerWidth * 0.86,
  );
  const extension = imageFormat === "jpeg" ? "jpg" : "png";
  const filename = `${fileSlug(data.name) || "property-card"}-${canvasSize}.${extension}`;

  const createImageBlob = async () => {
    if (!cardRef.current) {
      throw new Error("The property card is not ready to export.");
    }
    await document.fonts.ready;
    const canvas = await toCanvas(cardRef.current, {
      pixelRatio: Math.min(4, Math.max(2, 1080 / cardWidth)),
      backgroundColor: "#f4f0e7",
    });
    const mimeType = imageFormat === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(
        resolve,
        mimeType,
        imageFormat === "jpeg" ? 0.96 : undefined,
      ),
    );
    if (!blob) {
      throw new Error("The image could not be created. Please try again.");
    }
    return blob;
  };

  const saveImage = async () => {
    setIsExporting(true);
    setNotice(null);
    try {
      const blob = await createImageBlob();
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

  const shareImage = async () => {
    setIsExporting(true);
    setNotice(null);
    try {
      const blob = await createImageBlob();
      const mimeType = imageFormat === "jpeg" ? "image/jpeg" : "image/png";
      const file = new File([blob], filename, { type: mimeType });
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: data.name,
          text: `${data.name} · ${data.location}`,
        });
        setNotice({ kind: "success", message: "Property card shared." });
      } else {
        triggerDownload(blob, filename);
        setNotice({
          kind: "neutral",
          message: "File sharing is not available here, so the image was saved instead.",
        });
      }
    } catch (error) {
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
    } finally {
      setIsExporting(false);
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
                  RCiQ-AI · {data.market}
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
              className="relative isolate overflow-hidden border border-[#d9d0bc] bg-[#f4f0e7] text-[#171813] shadow-[0_20px_70px_rgba(0,0,0,0.42)]"
              style={{
                width: `${cardWidth}px`,
                maxWidth: "100%",
                aspectRatio: selectedSize.ratio,
              }}
            >
              <div className="flex h-full flex-col gap-[3.2%] p-[4.5%]">
                <div className="flex shrink-0 items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#cfc4ac] text-[10px] font-extrabold tracking-[-0.08em] text-[#342f25]">
                      RQ
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#504b3f]">
                      RCiQ-AI · PROPERTY ATLAS
                    </span>
                  </div>
                  <span className="text-[8px] font-semibold uppercase tracking-[0.17em] text-[#89816f]">
                    {data.market}
                  </span>
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden border border-[#d6cebf] bg-[#ded9ce]">
                  <img
                    src={data.mapImage}
                    alt={`Live map centered on ${data.name}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute inset-0 bg-[#30291c]/[0.06]" />
                  <div
                    className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[78%] flex-col items-center"
                    aria-hidden="true"
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#f7f2e7] text-white shadow-[0_3px_12px_rgba(24,25,20,0.35)]"
                      style={{ backgroundColor: data.accent }}
                    >
                      <MapPin className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
                    </span>
                    <span
                      className="mt-1 rounded-sm px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white shadow-sm"
                      style={{ backgroundColor: data.accent }}
                    >
                      Mapped point
                    </span>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                    <span className="rounded-sm bg-[#f4f0e7]/90 px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-[#514b3e] backdrop-blur-sm">
                      {data.location}
                    </span>
                    <span className="rounded-sm bg-[#f4f0e7]/90 px-2 py-1 text-[6px] font-medium text-[#6b6558] backdrop-blur-sm">
                      {data.mapAttribution}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-[#8d7950]">
                    {data.developer}
                  </p>
                  <h2 className="line-clamp-2 font-[var(--font-display)] text-[clamp(22px,5vw,36px)] font-medium leading-[0.98] tracking-[-0.055em] text-[#1d1e19]">
                    {data.name}
                  </h2>
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-[#716b5e]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="line-clamp-1">{data.location}</span>
                  </p>
                  {data.price && (
                    <p className="mt-3 inline-flex rounded-sm bg-[#e8dfca] px-2.5 py-1.5 text-[10px] font-bold text-[#383326]">
                      {data.price}
                    </p>
                  )}
                  {data.facts.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#d7cfbf] pt-2.5">
                      {data.facts.slice(0, 4).map((fact) => (
                        <div className="min-w-0" key={`${fact.label}-${fact.value}`}>
                          <p className="text-[6px] font-bold uppercase tracking-[0.15em] text-[#928977]">
                            {fact.label}
                          </p>
                          <p className="mt-0.5 truncate text-[9px] font-semibold text-[#3c3b33]">
                            {fact.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-[#d7cfbf] pt-2">
                    <span className="text-[7px] font-semibold uppercase tracking-[0.16em] text-[#89816f]">
                      DISCOVERED ON RCIQ-AI
                    </span>
                    <span className="font-mono text-[7px] text-[#89816f]">
                      {data.market.toUpperCase()}
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

            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/45">
                Image format
              </p>
              <div className="mt-2 flex rounded-xl border border-white/10 bg-[#111310] p-1">
                {(["png", "jpeg"] as const).map((format) => (
                  <button
                    type="button"
                    key={format}
                    onClick={() => {
                      setImageFormat(format);
                      setNotice(null);
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      imageFormat === format
                        ? "bg-[#34342c] text-[#f3d994]"
                        : "text-white/50 hover:text-white/80"
                    }`}
                    aria-pressed={imageFormat === format}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-5">
              <button
                type="button"
                onClick={() => void shareImage()}
                disabled={isExporting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d7ba79] px-4 py-3 text-sm font-bold text-[#28251d] transition hover:bg-[#e6cb8d] disabled:cursor-wait disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                {isExporting ? "Preparing image…" : "Share image"}
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
