import { createElement, type ReactElement } from "react";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
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
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-affiliate-")), "shop.sqlite");
  const affiliates = await import("../src/config/affiliates");
  const { AffiliateLink } = await import("../src/components/affiliate-link");
  const { AffiliateSpot, HomeGiftSpots } = await import("../src/components/affiliate-spot");
  const { AmazonPickGrid } = await import("../src/components/amazon-aisles");
  const amazonAisles = await import("../src/lib/amazon-aisles");
  const { DepartmentGrid } = await import("../src/components/department-grid");
  const { NightStalls } = await import("../src/components/night-stalls");
  const { homeGiftsListed, homepageMoreAisles, homepageNightSlugs, shopStallTabs, showHomeAisles, visibleItemCount } = await import("../src/lib/home-aisles");
  const { ShopScreen, default: ShopPage } = await import("../src/app/shop/page");

  for (const root of ["src", "docs"]) {
    for (const file of walk(join(process.cwd(), root))) {
      assert(!readFileSync(file, "utf8").includes("[WORDY"), `${file} still has a [WORDY marker`);
    }
  }

  const map = readFileSync(join(process.cwd(), "docs/affiliate-page-map.md"), "utf8");
  assert(map.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "the page map quotes the card disclosure");
  assert(map.includes("Gift a book") && map.includes("Gift ideas") && map.includes("Tours and things to do"), "the page map uses the approved headings");
  const approvedHrefs: Record<string, string> = {
    bookshop: "https://bookshop.org/a/131173",
    viator: "https://www.viator.com/?pid=P00330828&mcid=42383&medium=link",
    getyourguide: "https://www.getyourguide.com/?partner_id=YEH3QKQ",
    zazzle: "https://www.zazzle.com/?rf=238672294015858667",
  };
  assert(
    affiliates.AFFILIATE_OFFERS.every((offer) => offer.href === approvedHrefs[offer.id]),
    "affiliate hrefs are the approved URLs",
  );
  assert(
    affiliates.AFFILIATE_OFFERS.every((offer) => offer.disclosure === affiliates.AFFILIATE_DISCLOSURE_SHORT),
    "each partner card uses the shorter disclosure",
  );
  const byId = new Map(affiliates.AFFILIATE_OFFERS.map((offer) => [offer.id, offer]));
  assert(byId.get("viator")?.partnerId === "P00330828", "Viator keeps its public partner id");
  assert(byId.get("getyourguide")?.partnerId === "YEH3QKQ", "GetYourGuide keeps its public partner id");
  assert(byId.get("zazzle")?.partnerId === "238672294015858667", "Zazzle keeps its public ambassador id");
  assert(byId.get("bookshop")?.partnerId === "131173", "Bookshop keeps its public partner id");
  const closed = affiliates.AFFILIATE_OFFERS.map((offer) => ({ ...offer, href: "" }));
  assert(affiliates.experiencesSpotHasLinks(), "the committed experiences hrefs count as content");
  assert(!affiliates.experiencesSpotHasLinks(closed), "empty experiences hrefs do not count as content");
  assert(affiliates.ticketsAisleListed(0), "Tickets & Events is listed from the committed experiences links");
  assert(!affiliates.ticketsAisleListed(0, closed), "Tickets & Events stays unlisted with no items and no links");
  assert(affiliates.giftSpotsHaveLinks(), "the committed Zazzle href opens the gift spots");
  assert(!affiliates.giftSpotsHaveLinks(closed), "empty gift hrefs do not count as content");

  function renderedHrefs(markup: string) {
    return [...markup.matchAll(/href="([^"]*)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  }

  function decodeHtml(markup: string) {
    return markup.replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&apos;", "'").replaceAll("&quot;", '"');
  }

  for (const spot of ["books", "experiences", "gifts"] as const) {
    const markup = renderToStaticMarkup(createElement(AffiliateSpot, { spot, offers: closed }));
    assert(markup === "", `${spot} spot markup is empty when its hrefs are blank`);
  }
  const quiet = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(AffiliateSpot, { spot: "books", offers: closed }),
      createElement(AffiliateSpot, { spot: "gifts", offers: closed }),
      createElement(AffiliateSpot, { spot: "experiences", offers: closed }),
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
  const liveExperiences = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "experiences" }));
  const liveHrefs = renderedHrefs(liveExperiences);
  assert(liveHrefs.includes(approvedHrefs.viator) && liveHrefs.includes(approvedHrefs.getyourguide), "experiences renders the approved URLs exactly");
  assert(liveExperiences.includes('rel="sponsored noopener noreferrer"') && liveExperiences.includes('target="_blank"'), "the committed experiences links are sponsored and open a new tab");
  assert(
    liveExperiences.includes(`>${affiliates.AFFILIATE_DISCLOSURE_SHORT}<`) &&
      liveExperiences.indexOf("partner-card-disclosure") > liveExperiences.indexOf("partner-card-cta"),
    "the short disclosure sits next to each experiences link",
  );
  const liveGifts = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "gifts" }));
  assert(renderedHrefs(liveGifts).includes(approvedHrefs.zazzle), "Zazzle renders the approved URL exactly");
  assert(liveGifts.includes('rel="sponsored noopener noreferrer"'), "the Zazzle link is sponsored");
  assert(
    liveGifts.includes(`>${affiliates.AFFILIATE_DISCLOSURE_SHORT}<`) &&
      liveGifts.indexOf("partner-card-disclosure") > liveGifts.indexOf("partner-card-cta"),
    "the short disclosure sits next to the Zazzle link",
  );
  assert(!liveGifts.includes("$") && !/price/i.test(liveGifts), "the committed Zazzle card shows no price");
  const liveBooks = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "books" }));
  assert(renderedHrefs(liveBooks).includes(approvedHrefs.bookshop), "Bookshop renders the approved URL exactly");
  for (const pick of byId.get("bookshop")?.picks ?? []) {
    assert(renderedHrefs(liveBooks).includes(pick.href), `Bookshop renders ${pick.id}`);
  }
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

  assert(visibleItemCount("/aisles/kitchen", []) === 11, "Kitchen shows eleven Amazon picks");
  for (const slug of ["clothing", "home", "sports", "health", "seasonal", "garden", "tech-and-desk", "everyday-finds", "home-and-gifts"]) {
    assert(visibleItemCount(`/shop?aisle=${slug}`, []) === 0, `${slug} shows no shopper-visible items in an empty prod-like shelf`);
  }
  const more = homepageMoreAisles([]);
  const closedMore = homepageMoreAisles([], closed);
  assert(closedMore.map((tile) => tile.href).join() === "/aisles/kitchen", "More aisles keeps only Kitchen when the other targets are empty");
  assert(!closedMore.some((tile) => tile.href.includes("tickets")), "Tickets & Events is hidden while its links are empty");
  assert(more.some((tile) => tile.href === "/aisles/kitchen") && more.some((tile) => tile.href === "/aisles/tickets-and-events"), "committed experiences links add the Tickets tile");
  assert(homepageNightSlugs([], closed).length === 0, "empty night aisles are not linked when partner hrefs are blank");
  assert(homepageNightSlugs([]).includes("home-and-gifts"), "the Bookshop link shows the Home & Gifts tile");
  assert(!homeGiftsListed([], closed), "Home & Gifts is closed with no items and no partner links");
  assert(homeGiftsListed([]), "Home & Gifts stays open from the Bookshop link alone");
  assert(!shopStallTabs([], closed).some((tab) => tab.slug === "home-and-gifts"), "the shop tab hides Home & Gifts when it is closed");
  assert(shopStallTabs([]).some((tab) => tab.slug === "home-and-gifts"), "the shop tab shows Home & Gifts when Bookshop is linked");
  let giftsPage: unknown = null;
  let redirected = false;
  try {
    giftsPage = await ShopPage({ searchParams: Promise.resolve({ aisle: "home-and-gifts" }) });
  } catch (error) {
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
    redirected = digest.includes("NEXT_REDIRECT");
  }
  assert(!redirected && giftsPage, "Home & Gifts renders when Bookshop has a link");
  const giftsPageHtml = renderToStaticMarkup(giftsPage as ReactElement);
  assert(!renderedHrefs(giftsPageHtml).includes(approvedHrefs.zazzle), "the Home & Gifts page does not render the Zazzle shop URL");
  for (const pick of affiliates.ZAZZLE_GIFT_PICKS) {
    assert(!giftsPageHtml.includes(pick.name) && !renderedHrefs(giftsPageHtml).includes(pick.href), `Home & Gifts does not render Zazzle ${pick.id}`);
  }
  assert(giftsPageHtml.includes("bookshop.org") && giftsPageHtml.includes(">Bookshop.org<"), "Home & Gifts renders the Bookshop card");
  assert(giftsPageHtml.includes("Gift a book") && !giftsPageHtml.includes("Gift ideas"), "Home & Gifts keeps Gift a book and drops the Gift ideas spot");
  const bookshopOnly = filled.filter((offer) => offer.network === "bookshop");
  assert(homeGiftsListed([], bookshopOnly), "one Bookshop link opens Home & Gifts");
  assert(homepageNightSlugs([], bookshopOnly).includes("home-and-gifts"), "one Bookshop link shows the Home & Gifts tile");
  assert(shopStallTabs([], bookshopOnly).some((tab) => tab.slug === "home-and-gifts"), "one Bookshop link shows the shop tab");
  const zazzleOnly = filled.filter((offer) => offer.network === "zazzle");
  assert(!homeGiftsListed([], zazzleOnly), "a Zazzle link alone does not open Home & Gifts");
  const openGifts = renderToStaticMarkup(
    createElement(ShopScreen, { slug: "home-and-gifts", listings: [], giftOffers: bookshopOnly }),
  );
  assert(openGifts.includes("partner-card") && openGifts.includes("Bookshop.org"), "Home & Gifts renders the Bookshop card");
  assert(!openGifts.includes(">Zazzle<"), "a Bookshop-only config does not render a Zazzle card");
  const withLink = homepageMoreAisles([], filled);
  assert(withLink.some((tile) => tile.href === "/aisles/tickets-and-events"), "a configured experiences link shows the Tickets tile");

  const { JoinScreen } = await import("../src/components/home-screen");
  const homeEmpty = renderToStaticMarkup(
    createElement(JoinScreen, {
      checkoutLine: "Cards are checked on this site.",
      listings: [],
      nightSlugs: [],
    }),
  );
  assert(homeEmpty.includes("Browse the aisles") && homeEmpty.includes('href="/aisles"'), "an empty shop points the hero at the aisles");
  assert(homeEmpty.includes("Each pick links to the store where you buy it."), "the hero subhead is the approved line");
  assert(homeEmpty.includes("Step into an aisle."), "the single-aisle heading is the approved line");
  assert(!homeEmpty.includes("Four aisles") && !homeEmpty.includes("Our aisles"), "the night-aisle block stays hidden with no stalls");
  assert(!homeEmpty.includes("close look") && !homeEmpty.toLowerCase().includes("reviewed"), "the homepage makes no review claim");
  assert(homeEmpty.includes("home-aisles") && homeEmpty.includes("See all aisles"), "the home aisle set uses the aisle tiles");
  const homeStocked = renderToStaticMarkup(
    createElement(JoinScreen, {
      checkoutLine: "Cards are checked on this site.",
      listings: [{ productId: "pan", title: "Pan", image: "/art/mock-sheet-pan-1.png" }],
      nightSlugs: ["everyday-finds"],
    }),
  );
  assert(homeStocked.includes("Our aisles") && homeStocked.includes('href="/shop"'), "a stocked shop restores Our aisles and the shop links");
  assert(!showHomeAisles(), "the homepage night-aisle block is off unless SHOW_HOME_AISLES is set");
  const homeLive = renderToStaticMarkup(
    createElement(JoinScreen, {
      checkoutLine: "Cards are checked on this site.",
      listings: [],
      nightSlugs: [],
    }),
  );
  assert(!homeLive.includes(">Our aisles<") && !homeLive.includes("aisle-stall"), "the launch homepage hides the night-aisle block");
  assert(
    homeLive.includes('href="/shop?aisle=home-and-gifts"') &&
      homeLive.includes('href="/aisles/kitchen"') &&
      homeLive.includes('href="/aisles/home-and-cozy"') &&
      homeLive.includes('href="/aisles/holiday"') &&
      homeLive.includes('href="/aisles/on-the-go"') &&
      homeLive.includes('href="/aisles/tickets-and-events"'),
    "the homepage aisle set is Home & Gifts, Kitchen, Home & Cozy, Holiday, On the Go, and Tickets",
  );
  const previousAisles = process.env.SHOW_HOME_AISLES;
  process.env.SHOW_HOME_AISLES = "1";
  assert(showHomeAisles(), "SHOW_HOME_AISLES=1 turns the night-aisle block back on");
  if (previousAisles == null) delete process.env.SHOW_HOME_AISLES;
  else process.env.SHOW_HOME_AISLES = previousAisles;
  const emptyShop = renderToStaticMarkup(createElement(ShopScreen, { slug: "", listings: [] }));
  const shopGridSource = readFileSync(join(process.cwd(), "src/components/shop-grid.tsx"), "utf8");
  assert(shopGridSource.includes("Our current picks live in the aisles."), "the empty-aisle panel copy stays in the source");
  assert(shopGridSource.includes("New finds landing soon"), "the empty-aisle heading stays in the source");
  for (const phrase of ["Our current picks live in the aisles.", "New finds landing soon", "This aisle is quiet for now", "Browse the aisles"]) {
    assert(!emptyShop.includes(phrase) && !giftsPageHtml.includes(phrase), `the empty-aisle panel is hidden (${phrase})`);
  }
  assert(
    !/href="\/shop\?aisle=home-and-gifts"[^>]*stall-tab|stall-tab[^>]*href="\/shop\?aisle=home-and-gifts"/.test(giftsPageHtml),
    "Home & Gifts does not show a tile linking to itself",
  );
  assert(giftsPageHtml.includes('href="/shop?aisle=home-and-gifts"'), "the footer nav still opens Home & Gifts");
  const soloGifts = renderToStaticMarkup(createElement(HomeGiftSpots));
  assert(soloGifts.includes("partner-spot-solo") && soloGifts.includes("Gift a book") && !soloGifts.includes("Gift ideas"), "Bookshop sits alone on Home & Gifts");
  const bothGifts = renderToStaticMarkup(createElement(HomeGiftSpots, { offers: filled }));
  assert(bothGifts.includes("partner-spot-solo") && bothGifts.includes("Gift a book") && !bothGifts.includes("Gift ideas"), "a filled Zazzle offer does not reopen Gift ideas on Home & Gifts");
  assert(!giftsPageHtml.includes("Our mission") && !giftsPageHtml.includes("Buyers pay on xvaisle.com"), "Home & Gifts hides the mission block and the buyers-pay line");
  const neighbor = renderToStaticMarkup(
    createElement(ShopScreen, {
      slug: "home-and-gifts",
      listings: [{ productId: "wheel", title: "Wheel", image: "/art/products/6-inch-yoga-wheel.jpg", aisle: "everyday-finds" }],
    }),
  );
  assert(
    neighbor.includes('href="/shop?aisle=everyday-finds"') &&
      !/href="\/shop\?aisle=home-and-gifts"[^>]*stall-tab|stall-tab[^>]*href="\/shop\?aisle=home-and-gifts"/.test(neighbor),
    "an aisle keeps other tiles and drops its own",
  );
  assert(!emptyShop.includes("All aisles"), "an empty shop does not link All aisles back to itself");
  let shopRedirect = false;
  try {
    await ShopPage({ searchParams: Promise.resolve({}) });
  } catch (error) {
    const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
    shopRedirect = digest.includes("NEXT_REDIRECT") && digest.includes("/aisles");
  }
  assert(shopRedirect, "an empty /shop redirects to /aisles");
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

  assert(amazonAisles.HOME_AND_GIFTS_AMAZON_PICKS.length === 6, "Home & Gifts lists six Amazon picks");
  assert(amazonAisles.homeGiftsAmazonPicksVisible(), "the Home & Gifts Amazon list is visible");
  assert(affiliates.VIATOR_TOUR_PICKS.length === 3, "Viator lists three tour cards");
  assert(affiliates.ZAZZLE_GIFT_PICKS.length === 3, "Zazzle lists three product cards");
  assert(affiliates.visibleAffiliatePicks(affiliates.VIATOR_TOUR_PICKS).length === 3, "all Viator tour hrefs are present");
  assert(affiliates.visibleAffiliatePicks(affiliates.ZAZZLE_GIFT_PICKS).length === 3, "all Zazzle product hrefs are present");
  assert(affiliates.visibleAffiliatePicks([{ id: "blank", name: "Blank", why: "Why", href: "  ", label: "Label" }]).length === 0, "a pick with a blank href is hidden");
  assert(affiliates.visibleAffiliatePicks(byId.get("bookshop")?.picks).length === 4, "Bookshop still lists four books");
  const liveViator = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "experiences" }));
  assert(liveViator.includes(affiliates.AFFILIATE_COPY.viatorLink), "the Viator shop link stays on Experiences");
  const viatorLiveHrefs = renderedHrefs(liveViator);
  for (const pick of affiliates.VIATOR_TOUR_PICKS) {
    assert(decodeHtml(liveViator).includes(pick.name) && decodeHtml(liveViator).includes(pick.why) && viatorLiveHrefs.includes(pick.href), `Viator renders ${pick.id}`);
  }
  assert(viatorLiveHrefs.some((href) => href.includes("5467OHEP") && href.includes("pid=P00330828")), "the Everglades card points at the 5467OHEP Viator link");
  assert(
    affiliates.VIATOR_TOUR_PICKS.every((pick) => !pick.href.includes("t20590") && !pick.href.includes("getyourguide.com")),
    "Viator tour cards do not use GetYourGuide hrefs",
  );
  assert(!/best|discount|deal|\$|★|stars?|ratings?/i.test(liveViator), "Viator cards show no stars, ratings, prices or deal claims");
  const liveZazzle = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "gifts" }));
  assert(liveZazzle.includes(affiliates.AFFILIATE_COPY.zazzleLink), "the Zazzle shop link stays on the Gift ideas spot");
  assert(affiliates.AFFILIATE_PLACEMENTS.find((row) => row.spot === "gifts")?.route === "/aisles/holiday", "the Gift ideas spot is mounted on the Holiday aisle");
  const zazzleLiveHrefs = renderedHrefs(liveZazzle);
  for (const pick of affiliates.ZAZZLE_GIFT_PICKS) {
    assert(liveZazzle.includes(pick.name) && liveZazzle.includes(pick.why) && zazzleLiveHrefs.includes(pick.href), `Zazzle renders ${pick.id}`);
    assert(new URL(pick.href).searchParams.get("rf") === "238672294015858667", `Zazzle ${pick.id} keeps the ambassador id`);
  }
  assert(!liveZazzle.includes("$") && !/sale|price|best|discount|deal|★|stars?|ratings?/i.test(liveZazzle), "Zazzle cards show no stars, ratings, prices or deal claims");
  const emptyAmazon = renderToStaticMarkup(createElement(AmazonPickGrid, { items: [] }));
  assert(emptyAmazon === "", "an empty Amazon pick list renders nothing");
  assert(giftsPageHtml.includes(amazonAisles.AMAZON_ASSOCIATE_DISCLOSURE), "Home & Gifts shows the Associates disclosure next to Amazon picks");
  assert(giftsPageHtml.includes(amazonAisles.AMAZON_PICK_BUTTON_LABEL), "Home & Gifts shows the Amazon pick buttons");
  for (const item of amazonAisles.HOME_AND_GIFTS_AMAZON_PICKS) {
    assert(giftsPageHtml.includes(item.name) && giftsPageHtml.includes(item.blurb), `Home & Gifts renders ${item.asin}`);
    assert(giftsPageHtml.includes(`https://www.amazon.com/dp/${item.asin}/?tag=xvaisle-20`), `${item.asin} uses tag xvaisle-20`);
  }
  const liveAmazon = renderToStaticMarkup(createElement(AmazonPickGrid, { items: amazonAisles.HOME_AND_GIFTS_AMAZON_PICKS }));
  assert(!/best|discount|deal|\$|★|\bstars?\b|\bratings?\b/i.test(liveAmazon.replaceAll(amazonAisles.AMAZON_PICK_BUTTON_LABEL, "")), "Home & Gifts Amazon cards show no stars, ratings, prices or deal claims");

  const sampleAmazon = {
    asin: "B00004OCIU",
    name: "OXO Good Grips Y-Peeler, Black",
    blurb: "A Y-peeler from OXO Good Grips, a little stocking stuffer for every cook on your list.",
  };
  const filledAmazon = renderToStaticMarkup(createElement(AmazonPickGrid, { items: [sampleAmazon] }));
  assert(filledAmazon.includes(amazonAisles.AMAZON_ASSOCIATE_DISCLOSURE), "a filled Amazon grid shows the Associates disclosure");
  assert(filledAmazon.includes(amazonAisles.AMAZON_PICK_BUTTON_LABEL) && filledAmazon.includes(amazonAisles.AMAZON_PAID_LINK_LABEL), "a filled Amazon grid uses the approved button and paid-link labels");
  assert(filledAmazon.includes(`https://www.amazon.com/dp/${sampleAmazon.asin}?tag=xvaisle-20`), "a filled Amazon grid uses tag xvaisle-20");
  assert(filledAmazon.includes('rel="sponsored noopener noreferrer"') && filledAmazon.includes('target="_blank"'), "Amazon pick links are sponsored and open a new tab");
  assert(filledAmazon.includes(sampleAmazon.name) && filledAmazon.includes(sampleAmazon.blurb), "a filled Amazon grid shows the sourced name and blurb");
  assert(!/best|discount|deal/i.test(filledAmazon), "Amazon pick cards make no deal, discount or best claims");
  const giftsWithAmazon = renderToStaticMarkup(
    createElement(ShopScreen, { slug: "home-and-gifts", listings: [], amazonPicks: [sampleAmazon] }),
  );
  assert(giftsWithAmazon.includes(amazonAisles.AMAZON_ASSOCIATE_DISCLOSURE), "Home & Gifts shows the Associates disclosure once Amazon picks are present");
  assert(giftsWithAmazon.includes(`tag=xvaisle-20`) && giftsWithAmazon.includes(sampleAmazon.name), "Home & Gifts renders a sourced Amazon pick");
  assert(giftsWithAmazon.includes("Gift a book") && !giftsWithAmazon.includes("Gift ideas"), "Bookshop stays on Home & Gifts when Amazon picks are present");

  const viatorPick = {
    id: "tampa",
    name: "Tampa",
    why: "Things to do in Tampa.",
    href: "https://www.viator.com/Tampa/d666?pid=P00330828&mcid=42383&medium=link",
    label: "See things to do in Tampa on Viator",
  };
  const zazzlePick = {
    id: "sample",
    name: "Sample gift",
    why: "A gift on Zazzle.",
    href: "https://www.zazzle.com/sample?rf=238672294015858667",
    label: "See this gift on Zazzle",
  };
  const viatorOffer = { ...byId.get("viator")!, picks: [viatorPick, { ...viatorPick, id: "blank", href: "" }] };
  const zazzleOffer = { ...byId.get("zazzle")!, picks: [zazzlePick] };
  const viatorCards = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "experiences", offers: [viatorOffer] }));
  const viatorHrefs = renderedHrefs(viatorCards);
  assert(viatorHrefs.includes(viatorPick.href) && viatorCards.includes(viatorPick.name) && viatorCards.includes(viatorPick.why), "a sourced Viator pick renders as a card");
  assert(viatorCards.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "a Viator tour card shows the short disclosure");
  assert(viatorHrefs.filter((href) => href === viatorPick.href).length === 1, "a Viator pick with a blank href is left out");
  assert(!viatorHrefs.includes(""), "a blank Viator href does not render a link");
  assert(!/best|discount|deal|\$/i.test(viatorCards), "Viator tour cards make no deal, discount, price or best claims");
  const zazzleCards = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "gifts", offers: [zazzleOffer] }));
  assert(renderedHrefs(zazzleCards).includes(zazzlePick.href) && zazzleCards.includes(zazzlePick.name) && zazzleCards.includes(zazzlePick.why), "a sourced Zazzle pick renders as a card");
  assert(zazzleCards.includes(affiliates.AFFILIATE_DISCLOSURE_SHORT), "a Zazzle product card shows the short disclosure");
  assert(!zazzleCards.includes("$") && !/price|best|discount|deal/i.test(zazzleCards), "Zazzle product cards make no deal, discount, price or best claims");

  console.log("affiliate checks ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
