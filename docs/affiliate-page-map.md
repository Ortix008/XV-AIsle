# Affiliate page map

Empty hrefs render nothing: no markup, no heading, and no partner name. Spots are mounted in the server tree and stay blank until a link-builder URL is pasted into `href`. Partner ids are not used to build those URLs.

Committed hrefs, pasted as approved: Bookshop `https://bookshop.org/a/131173` (public id 131173), Viator `https://www.viator.com/?pid=P00330828&mcid=42383&medium=link`, GetYourGuide `https://www.getyourguide.com/?partner_id=YEH3QKQ`, Zazzle `https://www.zazzle.com/?rf=238672294015858667`. Bookshop is unhidden and lists four books. GetYourGuide lists the Kennedy Space Center tour. Viator lists three Florida tours, including the Everglades card pointed at 5467OHEP. The Viator and GetYourGuide homepage links stay in config so the aisle can be listed, but they are not rendered as cards. Zazzle keeps its shop link and lists three custom gift cards on the Holiday aisle. No eBay links.

Each card's disclosure is the config value. All four currently use: We may earn a commission when you buy through these links.

The longer line remains in config and is not on the cards: We may earn a commission when you buy through these links, at no extra cost to you.

Zazzle does not render on a Personalized item or that item's tile.

| Spot | Route | Section | Component | Copy |
| --- | --- | --- | --- | --- |
| Books | `/shop?aisle=home-and-gifts`. No separate Books route. The homepage tile, shop tab, and this URL appear only when the aisle has shop items or a Bookshop link. Otherwise the URL redirects to `/shop`. Bookshop partner id is 131173. | Gift a book | `AffiliateSpot` `spot="books"` in `src/components/affiliate-spot.tsx` | Heading “Gift a book”. Link “Browse books on Bookshop.org”, plus four book cards. |
| Experiences | `/aisles/tickets-and-events`. The homepage tile and the Aisles index link render only when this aisle has at least one configured experiences link or a real item. Viator partner P00330828, plus three Florida tour cards. GetYourGuide partner YEH3QKQ, plus the Kennedy Space Center tour. The partner homepage URLs are not shown as cards. | Tours and things to do | `AffiliateSpot` `spot="experiences"` in `src/components/affiliate-spot.tsx` | Heading “Tours and things to do”. The four tour cards, each using “See things to do on Viator” or the Kennedy GetYourGuide line. |
| Gifts | `/aisles/holiday`, below the aisle hero and above the Amazon picks. Never on a Personalized item or its tile. Zazzle Ambassador ID 238672294015858667. | Gift ideas | `AffiliateSpot` `spot="gifts"` in `src/components/affiliate-spot.tsx` | Heading “Gift ideas”. Link “Browse gifts on Zazzle”, plus three custom gift cards. |

Partners: Bookshop is Books. Viator and GetYourGuide are Experiences. Zazzle is Gifts.

The Home & Gifts shop aisle (`/shop?aisle=home-and-gifts`) also shows six Amazon picks under the Bookshop spot, using the same card pattern and Associates disclosure as the other aisles, with tag `xvaisle-20`. An empty Amazon list still renders nothing. Bookshop’s four book cards are unchanged. The three Zazzle cards are not on this aisle.
