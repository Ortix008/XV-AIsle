import { createElement } from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function walk(dir: string) {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(ts|tsx|md|css|json|yml)$/.test(name)) files.push(path);
  }
  return files;
}

async function main() {
  const affiliates = await import("../src/config/affiliates");
  const { AffiliateLink } = await import("../src/components/affiliate-link");
  const { AffiliateSpot } = await import("../src/components/affiliate-spot");
  const { DepartmentGrid } = await import("../src/components/department-grid");
  const { NightStalls } = await import("../src/components/night-stalls");
  const { homeGiftsListed, homepageMoreAisles, homepageNightSlugs, shopStallTabs, visibleItemCount } = await import("../src/lib/home-aisles");
  const { ShopScreen, default: ShopPage } = await import("../src/app/shop/page");

  for (const root of ["src", "docs"]) {
    for (const file of walk(join(process.cwd(), root))) {
      assert(!readFileSync(file, "utf8").includes("[WORDY"), `${file} still has a [WORDY marker`);
    }
  }

  const map = readFileSync(join(process.cwd(), "docs/affiliate-page-map.md"), "utf8");
  assert(map.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "the page map quotes the card disclosure");
  assert(map.includes("Gift a book") && map.includes("Gift ideas") && map.includes("Tours and things to do"), "the page map uses the approved headings");
  assert(affiliates.AFFILIATE_OFFERS.every((offer) => offer.href === ""), "affiliate hrefs stay empty until a link-builder URL is pasted");
  assert(
    affiliates.AFFILIATE_OFFERS.every((offer) => offer.disclosure === affiliates.AFFILIATE_DISCLOSURE_SHORT),
    "each partner card uses the shorter disclosure",
  );
  const byId = new Map(affiliates.AFFILIATE_OFFERS.map((offer) => [offer.id, offer]));
  assert(byId.get("viator")?.partnerId === "P00330828", "Viator keeps its public partner id");
  assert(byId.get("getyourguide")?.partnerId === "YEH3QKQ", "GetYourGuide keeps its public partner id");
  assert(byId.get("zazzle")?.partnerId === "238672294015858667", "Zazzle keeps its public ambassador id");
  assert(byId.get("bookshop")?.partnerId === "", "Bookshop's partner id stays pending");
  assert(!affiliates.experiencesSpotHasLinks(), "empty experiences hrefs do not count as content");
  assert(!affiliates.ticketsAisleListed(0), "Tickets & Events stays unlisted with no items and no links");

  for (const spot of ["books", "experiences", "gifts"] as const) {
    const markup = renderToStaticMarkup(createElement(AffiliateSpot, { spot }));
    assert(markup === "", `${spot} spot markup is empty`);
  }
  const quiet = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(AffiliateSpot, { spot: "books" }),
      createElement(AffiliateSpot, { spot: "gifts" }),
      createElement(AffiliateSpot, { spot: "experiences" }),
    ),
  );
  for (const word of ["Viator", "GetYourGuide", "Zazzle", "Bookshop", "[WORDY"]) {
    assert(!quiet.includes(word), `an empty spot renders ${word}`);
  }

  const filled = affiliates.AFFILIATE_OFFERS.map((offer) => ({
    ...offer,
    href: offer.partnerId
      ? `https://links.example/${offer.network}?pid=${offer.partnerId}`
      : "https://links.example/bookshop",
  }));
  assert(affiliates.experiencesSpotHasLinks(filled), "a pasted experiences href counts as content");
  assert(affiliates.ticketsAisleListed(0, filled), "Tickets & Events is listed once an experiences link is set");
  const shown = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "experiences", offers: filled }));
  assert(shown.includes("P00330828") && shown.includes("YEH3QKQ"), "experiences links include the partner ids");
  assert(shown.includes('rel="sponsored noopener noreferrer"') && shown.includes('target="_blank"'), "experiences links are sponsored and open a new tab");
  assert(shown.includes(affiliates.AFFILIATE_COPY.experiencesHeading), "the experiences heading is the approved line");
  const gifts = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "gifts", offers: filled }));
  assert(gifts.includes("238672294015858667") && gifts.includes('rel="sponsored noopener noreferrer"'), "the Zazzle link includes its ambassador id");
  assert(gifts.includes(affiliates.AFFILIATE_COPY.giftsHeading), "the gifts heading is the approved line");
  const books = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "books", offers: filled }));
  assert(books.includes(affiliates.AFFILIATE_COPY.bookshopLink) && books.includes('target="_blank"'), "the Bookshop link uses the approved label");
  assert(books.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "a filled link shows the card disclosure");
  assert(books.includes("partner-card-name") && books.includes("Bookshop.org"), "the Bookshop card names the partner in plain text");
  assert(books.includes("partner-card-cta") && books.includes('target="_blank"'), "the card call to action is the only link");
  assert(!books.includes("partner-card-price") && !books.includes("$"), "a partner card does not show a price");
  assert(!gifts.includes("$") && !/price/i.test(gifts), "a Zazzle card shows no price");
  for (const word of ["official", "authorized", "endorsed"]) {
    assert(!books.toLowerCase().includes(word) && !gifts.toLowerCase().includes(word) && !shown.toLowerCase().includes(word), `partner cards do not say ${word}`);
  }

  for (const item of [
    { personalized: true, title: "Mug" },
    { kind: "personalized", title: "Mug" },
    { title: "Personalized mug" },
    { productId: "personalized-ornament", title: "Ornament" },
  ]) {
    assert(
      affiliates.visibleAffiliateOffers("gifts", item, filled).every((offer) => offer.network !== "zazzle"),
      "Zazzle stays off a personalized item and its tile",
    );
    assert(
      renderToStaticMarkup(
        createElement(AffiliateLink, {
          href: filled.find((offer) => offer.network === "zazzle")!.href,
          label: affiliates.AFFILIATE_COPY.zazzleLink,
          network: "zazzle",
          item,
        }),
      ) === "",
      "a personalized tile does not render a Zazzle link",
    );
  }

  const short = renderToStaticMarkup(
    createElement(AffiliateLink, {
      href: "https://links.example/viator?pid=P00330828",
      label: affiliates.AFFILIATE_COPY.viatorLink,
      network: "viator",
      disclosure: affiliates.AFFILIATE_DISCLOSURE_SHORT,
    }),
  );
  assert(short.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "a program can use the shorter disclosure");
  assert(!short.includes("at no extra cost to you"), "the shorter line replaces the default");

  assert(visibleItemCount("/aisles/kitchen", []) === 10, "Kitchen shows ten Amazon picks");
  for (const slug of ["clothing", "home", "sports", "health", "seasonal", "garden", "tech-and-desk", "everyday-finds", "home-and-gifts"]) {
    assert(visibleItemCount(`/shop?aisle=${slug}`, []) === 0, `${slug} shows no shopper-visible items in an empty prod-like shelf`);
  }
  const more = homepageMoreAisles([]);
  assert(more.map((tile) => tile.href).join() === "/aisles/kitchen", "More aisles keeps only Kitchen when the other targets are empty");
  assert(!more.some((tile) => tile.href.includes("tickets")), "Tickets & Events is hidden while its links are empty");
  assert(homepageNightSlugs([]).length === 0, "empty night aisles are not linked from the homepage");
  assert(!homeGiftsListed([]), "Home & Gifts is closed with no items and no partner links");
  assert(!shopStallTabs([]).some((tab) => tab.slug === "home-and-gifts"), "the shop tab hides Home & Gifts when it is closed");
  let redirected = false;
  try {
    await ShopPage({ searchParams: Promise.resolve({ aisle: "home-and-gifts" }) });
  } catch (error) {
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
    redirected = digest.includes("NEXT_REDIRECT") && digest.includes("/shop");
  }
  assert(redirected, "an empty Home & Gifts aisle redirects to /shop");
  const bookshopOnly = filled.filter((offer) => offer.network === "bookshop");
  assert(homeGiftsListed([], bookshopOnly), "one Bookshop link opens Home & Gifts");
  assert(homepageNightSlugs([], bookshopOnly).includes("home-and-gifts"), "one Bookshop link shows the Home & Gifts tile");
  assert(shopStallTabs([], bookshopOnly).some((tab) => tab.slug === "home-and-gifts"), "one Bookshop link shows the shop tab");
  const openGifts = renderToStaticMarkup(
    createElement(ShopScreen, { slug: "home-and-gifts", listings: [], giftOffers: bookshopOnly }),
  );
  assert(openGifts.includes("partner-card") && openGifts.includes("Bookshop.org"), "Home & Gifts renders the Bookshop card");
  assert(!openGifts.includes(">Zazzle<"), "a Bookshop-only config does not render a Zazzle card");
  const withLink = homepageMoreAisles([], filled);
  assert(withLink.some((tile) => tile.href === "/aisles/tickets-and-events"), "a configured experiences link shows the Tickets tile");

  const grid = renderToStaticMarkup(createElement(DepartmentGrid, { tiles: more }));
  const stalls = renderToStaticMarkup(createElement(NightStalls, { slugs: [] }));
  assert(grid.includes('href="/aisles/kitchen"') && !grid.includes("<button"), "the Kitchen tile is a link");
  assert(!grid.includes("aisle=clothing") && !grid.includes("aisle=garden"), "empty department tiles are gone");
  assert(stalls === "", "an empty night-aisle list renders nothing");
  for (const word of ["Viator", "GetYourGuide", "Zazzle", "Bookshop", "[WORDY"]) {
    assert(!grid.includes(word) && !stalls.includes(word), `homepage tiles render ${word}`);
  }

  const errorPage = readFileSync(join(process.cwd(), "src/app/error.tsx"), "utf8");
  const globalError = readFileSync(join(process.cwd(), "src/app/global-error.tsx"), "utf8");
  const errorLine = "This page didn't load. Refresh to try again, or go back to the homepage.";
  assert(errorPage.includes(errorLine) && globalError.includes(errorLine), "the error boundary uses the approved line");

  console.log("affiliate checks ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
