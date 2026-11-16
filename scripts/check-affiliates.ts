import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hrefs(markup: string) {
  return [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

async function main() {
  const affiliates = await import("../src/config/affiliates");
  const { AffiliateLink } = await import("../src/components/affiliate-link");
  const { AffiliateSpot } = await import("../src/components/affiliate-spot");
  const { DepartmentGrid } = await import("../src/components/department-grid");
  const { NightStalls } = await import("../src/components/night-stalls");

  const map = readFileSync(join(process.cwd(), "docs/affiliate-page-map.md"), "utf8");
  for (const label of Object.values(affiliates.AFFILIATE_WORDY)) {
    assert(map.includes(label), `${label} is in the page map`);
  }
  assert(map.includes(affiliates.AFFILIATE_DISCLOSURE), "the page map quotes the default disclosure");
  assert(map.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "the page map quotes the shorter disclosure");
  assert(!map.includes("[WORDY: CJ link]"), "CJ is not in the page map");
  assert(
    affiliates.AFFILIATE_OFFERS.every((offer) => offer.href === ""),
    "affiliate hrefs stay empty until a link-builder URL is pasted",
  );
  assert(
    affiliates.AFFILIATE_OFFERS.every((offer) => offer.disclosure === affiliates.AFFILIATE_DISCLOSURE),
    "each program defaults to the approved disclosure",
  );
  const byId = new Map(affiliates.AFFILIATE_OFFERS.map((offer) => [offer.id, offer]));
  assert(byId.get("viator")?.partnerId === "P00330828", "Viator keeps its public partner id");
  assert(byId.get("getyourguide")?.partnerId === "YEH3QKQ", "GetYourGuide keeps its public partner id");
  assert(byId.get("zazzle")?.partnerId === "238672294015858667", "Zazzle keeps its public ambassador id");
  assert(byId.get("bookshop")?.partnerId === "", "Bookshop's partner id stays pending");
  for (const offer of affiliates.AFFILIATE_OFFERS) {
    if (!offer.partnerId) continue;
    assert(!offer.href.includes(offer.partnerId), `${offer.id} href is not built from its partner id`);
  }
  assert(
    affiliates.AFFILIATE_PLACEMENTS.find((spot) => spot.spot === "books")?.partners.join() === "bookshop",
    "Bookshop is the Books partner",
  );
  assert(
    affiliates.AFFILIATE_PLACEMENTS.find((spot) => spot.spot === "experiences")?.partners.join() === "viator,getyourguide",
    "Viator and GetYourGuide are the Experiences partners",
  );
  assert(
    affiliates.AFFILIATE_PLACEMENTS.find((spot) => spot.spot === "gifts")?.partners.join() === "zazzle",
    "Zazzle is the Gifts partner",
  );

  for (const spot of ["books", "experiences", "gifts"] as const) {
    assert(affiliates.visibleAffiliateOffers(spot).length === 0, `${spot} is empty while its hrefs are empty`);
    assert(renderToStaticMarkup(createElement(AffiliateSpot, { spot })) === "", `${spot} spot markup is empty`);
  }

  const filled = affiliates.AFFILIATE_OFFERS.map((offer) => ({
    ...offer,
    href: `https://example.test/${offer.id}`,
  }));
  assert(
    affiliates.visibleAffiliateOffers("books", null, filled).map((offer) => offer.network).join() === "bookshop",
    "the Books spot is Bookshop",
  );
  assert(
    affiliates
      .visibleAffiliateOffers("experiences", null, filled)
      .map((offer) => offer.network)
      .join() === "viator,getyourguide",
    "the Experiences spot is Viator and GetYourGuide",
  );
  assert(
    affiliates.visibleAffiliateOffers("gifts", { title: "Beagle towel" }, filled).some((offer) => offer.network === "zazzle"),
    "a gift can show Zazzle",
  );

  const personalized = [
    { personalized: true, title: "Mug" },
    { kind: "personalized", title: "Mug" },
    { title: "Personalized mug" },
    { productId: "personalized-ornament", title: "Ornament" },
  ];
  for (const item of personalized) {
    assert(
      affiliates.visibleAffiliateOffers("gifts", item, filled).every((offer) => offer.network !== "zazzle"),
      "Zazzle stays off a personalized item and its tile",
    );
    const hidden = renderToStaticMarkup(
      createElement(AffiliateLink, {
        href: "https://example.test/zazzle",
        label: affiliates.AFFILIATE_WORDY.zazzleLink,
        network: "zazzle",
        item,
      }),
    );
    assert(hidden === "", "a personalized tile does not render a Zazzle link");
  }

  const short = renderToStaticMarkup(
    createElement(AffiliateLink, {
      href: "https://example.test/viator",
      label: affiliates.AFFILIATE_WORDY.viatorLink,
      network: "viator",
      disclosure: affiliates.AFFILIATE_DISCLOSURE_SHORT,
    }),
  );
  assert(short.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "a program can use the shorter disclosure");
  assert(!short.includes("at no extra cost to you"), "the shorter line replaces the default");

  const link = renderToStaticMarkup(
    createElement(AffiliateLink, {
      href: "https://example.test/bookshop",
      label: affiliates.AFFILIATE_WORDY.bookshopLink,
      network: "bookshop",
    }),
  );
  assert(link.includes('rel="sponsored noopener noreferrer"'), "the affiliate link is sponsored");
  assert(link.includes('target="_blank"'), "the affiliate link opens a new tab");
  assert(link.includes("affiliate-spot-icon"), "the affiliate link has an external icon");
  assert(link.includes(affiliates.AFFILIATE_DISCLOSURE), "the default disclosure sits with the link");
  assert(link.indexOf(affiliates.AFFILIATE_WORDY.bookshopLink) < link.indexOf(affiliates.AFFILIATE_DISCLOSURE), "the disclosure follows the link");
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const anchor = css.split(".affiliate-spot-anchor")[1]?.split("}")[0] ?? "";
  const note = css.split(".affiliate-spot-note")[1]?.split("}")[0] ?? "";
  assert(anchor.includes("min-height: var(--tap)"), "the affiliate link uses the tap token");
  assert(note.includes("var(--foreground)") && !note.includes("shadow") && !note.includes("glow"), "the disclosure is body text without a glow");
  assert(css.includes(".link-slide") && css.includes("min-height: var(--tap)"), "text links keep a 44px tap height");
  const scrim = css.slice(css.indexOf(".hero-text-scrim"));
  assert(scrim.includes("min-width: 768px"), "the hero text scrim starts at 768px");
  assert(scrim.includes("color-mix(in srgb, var(--background) 72%, transparent)"), "the hero text scrim uses the background token at 72%");
  assert(scrim.includes("transparent 60%"), "the hero text scrim fades out at 60% of the width");

  let grid = "";
  let stalls = "";
  try {
    grid = renderToStaticMarkup(createElement(DepartmentGrid));
    stalls = renderToStaticMarkup(createElement(NightStalls));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`homepage tiles threw without DeskProvider: ${message}`);
  }
  assert(!grid.includes("useDesk") && !stalls.includes("useDesk"), "rendered tiles do not mention the desk hook");
  assert(!grid.includes("<button") && !stalls.includes("<button"), "homepage aisle tiles are links");
  const more = hrefs(grid);
  const four = hrefs(stalls);
  assert(more.includes("/aisles/kitchen"), "Kitchen links to the live aisle");
  assert(more.includes("/shop?aisle=clothing"), "Clothing links to its shop aisle");
  assert(more.includes("/shop?aisle=home"), "Home links to its shop aisle");
  assert(more.includes("/shop?aisle=sports"), "Sports links to its shop aisle");
  assert(more.includes("/shop?aisle=health"), "Health links to its shop aisle");
  assert(more.includes("/shop?aisle=seasonal"), "Seasonal links to its shop aisle");
  assert(more.includes("/shop?aisle=garden"), "Garden links to its shop aisle");
  assert(more.includes("/shop?aisle=tech-and-desk"), "Tech and Desk links to its aisle");
  assert(four.includes("/shop?aisle=everyday-finds"), "Everyday Finds links to its aisle");
  assert(four.includes("/shop?aisle=tech-and-desk"), "the Tech and Desk stall links to its aisle");
  assert(four.includes("/shop?aisle=home-and-gifts"), "Home and Gifts links to its aisle");
  assert(!four.includes("aisle=bundles") && !stalls.includes(">Bundles<"), "the homepage hides Bundles");
  for (const href of [...more, ...four]) {
    assert(href.startsWith("/"), `${href} is an internal aisle route`);
  }

  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  assert(!layout.includes("Test mode") && !layout.includes("product-test"), "the site-wide test banner is gone");
  const checkout = readFileSync(join(process.cwd(), "src/app/api/store/checkout/route.ts"), "utf8");
  assert(
    checkout.includes("shopperCheckoutClosed") && checkout.includes("shopperCheckoutRefused"),
    "checkout keeps the 400 guard and refuses every item",
  );
  const sitemap = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf8");
  assert(!sitemap.includes("aisle=bundles"), "the sitemap does not list Bundles");
  const amazon = readFileSync(join(process.cwd(), "src/lib/amazon-aisles.ts"), "utf8");
  assert(amazon.includes("As an Amazon Associate I earn from qualifying purchases."), "the Amazon disclosure is unchanged");
  assert(amazon.includes("(paid link)"), "the Amazon paid-link label is unchanged");

  for (const page of [
    "src/app/(home)/page.tsx",
    "src/app/shop/page.tsx",
    "src/app/aisles/page.tsx",
    "src/app/aisles/[slug]/page.tsx",
  ]) {
    assert(!readFileSync(join(process.cwd(), page), "utf8").includes("AffiliateSpot"), `${page} does not mount an empty affiliate spot`);
  }

  console.log("affiliate checks ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
