import { CatalogPhoto } from "@/components/catalog-photo";

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
        <CatalogPhoto src={src} alt={alt} sizes={sizes} priority={priority} zoom={zoom} />
      ) : (
        <div className="product-placeholder" aria-hidden>
          <span>XV</span>
        </div>
      )}
    </div>
  );
}
