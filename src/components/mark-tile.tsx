"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { cn } from "cn";

export function MarkUnderlay({
  src,
  alt = "",
  sizes,
  zoom = false,
  className,
  imageClassName,
  width,
  height,
  children,
}: {
  src?: string | null;
  alt?: string;
  sizes: string;
  zoom?: boolean;
  className?: string;
  imageClassName?: string;
  width?: number;
  height?: number;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const photo = src?.trim() ?? "";
  const sized = width != null && height != null;
  return (
    <div className={cn("mark-underlay relative overflow-hidden", className)}>
      {photo && !failed ? (
        <Image
          src={photo}
          alt={alt}
          {...(sized ? { width, height } : { fill: true as const })}
          sizes={sizes}
          className={cn(
            zoom ? "media-zoom object-cover object-center" : "object-cover object-center",
            sized && "absolute inset-0 h-full w-full max-w-none",
            imageClassName,
          )}
          onError={() => setFailed(true)}
        />
      ) : null}
      {children}
    </div>
  );
}

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
  return <MarkUnderlay src={src} alt={alt} sizes={sizes} zoom={zoom} className="mark-tile" />;
}
