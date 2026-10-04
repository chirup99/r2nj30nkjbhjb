import { UAE_DIRHAM_SIGN } from "@/lib/currency";
import dirhamSymbolMaskUrl from "./uae-dirham-symbol-mask.png";

export function UaeDirhamSymbol({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-[0.9em] w-[0.95em] align-[-0.08em] ${className ?? ""}`}
      style={{
        backgroundColor: "currentColor",
        WebkitMaskImage: `url("${dirhamSymbolMaskUrl}")`,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskImage: `url("${dirhamSymbolMaskUrl}")`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
      }}
    />
  );
}

export function FormattedCurrencyText({ value }: { value: string }) {
  const parts = value.split(UAE_DIRHAM_SIGN);
  if (parts.length === 1) return value;
  const renderedParts = parts.flatMap((part, index) =>
    index === 0
      ? [part]
      : [<UaeDirhamSymbol key={`dirham-sign-${index}`} />, part],
  );

  return (
    <span aria-label={value.replaceAll(UAE_DIRHAM_SIGN, " UAE dirham ")}>
      {renderedParts}
    </span>
  );
}