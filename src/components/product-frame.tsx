"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductFrame({
  src,
  alt,
  sizes,
  priority = false,
  zoom = false,
  packshot = false,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  zoom?: boolean;
  packshot?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const photo = src?.trim() ?? "";
  return (
    <div className={packshot ? "product-frame is-packshot" : "product-frame"}>
      <div className="product-plate">
        {photo && !failed ? (
          <Image
            src={photo}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className={zoom ? "media-zoom object-contain object-center" : "object-contain object-center"}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="product-mark" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/xv-aisle-mark.svg" alt="" width={80} height={80} />
          </div>
        )}
      </div>
    </div>
  );
}
