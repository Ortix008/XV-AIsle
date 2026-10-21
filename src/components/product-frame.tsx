"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductFrame({
  src,
  alt,
  sizes,
  priority = false,
  zoom = false,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  zoom?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const photo = src?.trim() ?? "";
  return (
    <div className="product-frame">
      {photo && !failed ? (
        <Image
          src={photo}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={zoom ? "media-zoom object-cover object-center" : "object-cover object-center"}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="product-mark" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/xv-aisle-mark.svg" alt="" width={80} height={80} />
        </div>
      )}
    </div>
  );
}
