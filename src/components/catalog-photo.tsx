import Image from "next/image";
import { cn } from "cn";
import { productPhotoSize } from "@/lib/product-photo";

export function CatalogPhoto({
  src,
  alt,
  sizes,
  priority = false,
  zoom = false,
  onError,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  zoom?: boolean;
  onError?: () => void;
}) {
  const box = productPhotoSize(src);
  const className = cn("object-cover object-center", zoom && "media-zoom");
  if (box) {
    return (
      <Image
        src={src}
        alt={alt}
        width={box.width}
        height={box.height}
        loading="lazy"
        sizes={sizes}
        onError={onError}
        className={cn("absolute inset-0 h-full w-full", className)}
        style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
      />
    );
  }
  return <Image src={src} alt={alt} fill priority={priority} sizes={sizes} onError={onError} className={className} />;
}
