import Image from "next/image";
import { cn } from "cn";

export function BrandMark({
  wordmark = true,
  className,
}: {
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src="/brand/logo-official-xo.png"
        alt=""
        width={32}
        height={32}
        unoptimized
        loading="eager"
        className="size-8 shrink-0 object-contain"
      />
      <span className="sr-only">XV-AIsle</span>
      {wordmark ? (
        <span aria-hidden className="hidden truncate text-sm font-semibold tracking-[0.18em] sm:inline">
          XV-AISLE
        </span>
      ) : null}
    </span>
  );
}
