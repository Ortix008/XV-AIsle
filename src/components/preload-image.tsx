"use client";

export function PreloadImage({
  href,
  imageSrcSet,
  imageSizes,
  type,
  media,
}: {
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
  type?: string;
  media?: string;
}) {
  return (
    <link
      rel="preload"
      as="image"
      href={href}
      imageSrcSet={imageSrcSet}
      imageSizes={imageSizes}
      type={type}
      media={media}
      fetchPriority="high"
    />
  );
}
