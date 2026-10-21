import { fetchModalystProducts, modalystConfig, type ImportedProduct, type ModalystEnv, type SkippedProduct } from "@/lib/modalyst";
import { getDb } from "@/lib/server/db";
import { getListing, listPublished, publishListing } from "@/lib/server/store";

export type ImportResult = {
  imported: string[];
  skipped: SkippedProduct[];
};

type FetchLike = typeof fetch;

function rememberImages(product: ImportedProduct) {
  getDb()
    .prepare("UPDATE listings SET import_images = ?, wholesale_cost = ? WHERE product_id = ?")
    .run(JSON.stringify(product.images), product.wholesaleCostCents, product.id);
}

export function saveImportedProducts(accountId: string, products: ImportedProduct[]): ImportResult {
  const imported: string[] = [];
  const skipped: SkippedProduct[] = [];
  for (const product of products) {
    const existing = getListing(product.id);
    if (existing && existing.accountId !== accountId) {
      skipped.push({ id: product.id, reason: "belongs to another account" });
      continue;
    }
    if (existing?.published) {
      skipped.push({ id: product.id, reason: "already published" });
      continue;
    }
    const saved = publishListing(accountId, {
      productId: product.id,
      sku: product.sku,
      title: product.title,
      description: product.description,
      priceCents: product.listPriceCents,
      image: "",
      supplierName: "Modalyst",
      supplierOrigin: product.shipsFrom,
      shipDaysMin: product.shipDaysMin,
      shipDaysMax: product.shipDaysMax,
      published: false,
      supplierCostCents: product.wholesaleCostCents,
      shipsFrom: product.shipsFrom,
      supplierUsConfirmed: false,
    });
    if ("error" in saved) {
      skipped.push({ id: product.id, reason: saved.error ?? "The product was not saved." });
      continue;
    }
    rememberImages(product);
    imported.push(product.id);
  }
  return { imported, skipped };
}

export async function importModalystForAccount(
  account: { id: string; role: string } | null,
  options: { env?: ModalystEnv; fetch?: FetchLike } = {},
): Promise<{ status: number; imported?: string[]; skipped?: SkippedProduct[]; error?: string }> {
  if (!account || account.role !== "admin") {
    return { status: 403, error: "An admin has to run this import." };
  }
  const source = options.env ?? process.env;
  const config = modalystConfig({
    MODALYST_API_BASE: source.MODALYST_API_BASE,
    MODALYST_API_KEY: source.MODALYST_API_KEY,
    MODALYST_API_SECRET: source.MODALYST_API_SECRET,
  });
  if ("error" in config) return { status: 400, error: config.error };
  const pulled = await fetchModalystProducts(config, options.fetch);
  if ("error" in pulled) return { status: 502, error: pulled.error };
  const saved = saveImportedProducts(account.id, pulled.products);
  const visible = listPublished().some((listing) => saved.imported.includes(listing.productId));
  if (visible) return { status: 500, error: "An imported product was published." };
  return { status: 200, imported: saved.imported, skipped: [...pulled.skipped, ...saved.skipped] };
}
