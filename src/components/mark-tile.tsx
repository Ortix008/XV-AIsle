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
  const [failed, setFailed] = useState(false);
  const photo = src?.trim() ?? "";
  return (
    <div className="mark-tile mark-underlay">
      {photo && !failed ? (
        <Image
          src={photo}
          alt={alt}
          fill
          sizes={sizes}
          className={zoom ? "media-zoom object-cover object-center" : "object-cover object-center"}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
