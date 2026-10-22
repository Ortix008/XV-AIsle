"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { CatalogPhoto } from "@/components/catalog-photo";

export function MarkUnderlay({
  src,
  alt = "",
  sizes,
  zoom = false,
  className,
  children,
}: {
  src?: string | null;
  alt?: string;
  sizes: string;
  zoom?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const photo = src?.trim() ?? "";
  return (
    <div className={cn("mark-underlay relative overflow-hidden", className)}>
      {photo && !failed ? (
        <CatalogPhoto src={photo} alt={alt} sizes={sizes} zoom={zoom} onError={() => setFailed(true)} />
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
