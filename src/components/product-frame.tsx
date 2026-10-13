import Image from "next/image";

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
  return (
    <div className="product-frame">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={zoom ? "media-zoom object-cover object-center" : "object-cover object-center"}
        />
      ) : (
        <div className="product-placeholder" aria-hidden>
          <span>XV</span>
        </div>
      )}
    </div>
  );
}
