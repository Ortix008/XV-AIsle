"use client";

import Image from "next/image";
import { useState } from "react";

export function MarkTile({
  src,
  alt,
  sizes,
  zoom = false,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  zoom?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const ready = Boolean(src?.trim()) && !broken;
  return (
    <div className="mark-tile">
      {ready ? (
        <Image
          src={src ?? ""}
          alt={alt}
          fill
          sizes={sizes}
          className={zoom ? "media-zoom object-cover object-center" : "object-cover object-center"}
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="mark-tile-fallback" aria-hidden>
          {/* The mark is a fixed 32px asset. A plain img keeps that size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/xv-aisle-mark.svg" width={32} height={32} alt="" />
        </div>
      )}
    </div>
  );
}
