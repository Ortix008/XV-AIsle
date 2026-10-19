import { cn } from "cn";

export function BrandMark({
  wordmark = true,
  className,
}: {
  wordmark?: boolean;
  className?: string;
}) {
  if (!wordmark) {
    return (
      <span className={cn("inline-flex", className)}>
        {/* The mark is a fixed 32px asset. A plain img keeps that size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/xv-aisle-mark.svg" height={32} width={32} alt="" className="brand-mark" />
        <span className="sr-only">XV-AIsle</span>
      </span>
    );
  }

  return (
    // The outlined logo is a fixed 115×32 asset. A plain img keeps those dimensions.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/xv-aisle-logo.svg" height={32} width={115} alt="XV-AIsle" className={cn("brand-logo", className)} />
  );
}
