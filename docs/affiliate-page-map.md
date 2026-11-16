# Affiliate page map

Empty hrefs render nothing: no markup, no heading, and no partner name. Spots are mounted in the server tree and stay blank until a link-builder URL is pasted into `href`. Partner ids are not used to build those URLs.

Each card's disclosure is the config value. All four currently use: We may earn a commission when you buy through these links.

The longer line remains in config and is not on the cards: We may earn a commission when you buy through these links, at no extra cost to you.

Zazzle does not render on a Personalized item or that item's tile.

| Spot | Route | Section | Component | Copy |
| --- | --- | --- | --- | --- |
| Books | `/shop?aisle=home-and-gifts`, next to the Gifts spot. No separate Books route. Bookshop partner id is pending. | Gift a book | `AffiliateSpot` `spot="books"` in `src/components/affiliate-spot.tsx` | Heading “Gift a book”. Link “Browse books on Bookshop.org”. |
| Experiences | `/aisles/tickets-and-events`. The homepage tile and the Aisles index link render only when this aisle has at least one configured experiences link or a real item. Viator partner P00330828. GetYourGuide partner YEH3QKQ. | Tours and things to do | `AffiliateSpot` `spot="experiences"` in `src/components/affiliate-spot.tsx` | Heading “Tours and things to do”. Links “See things to do on Viator” and “See things to do on GetYourGuide”. |
| Gifts | `/shop?aisle=home-and-gifts`, next to the Books spot. Never on a Personalized item or its tile. Zazzle Ambassador ID 238672294015858667. | Gift ideas | `AffiliateSpot` `spot="gifts"` in `src/components/affiliate-spot.tsx` | Heading “Gift ideas”. Link “Browse gifts on Zazzle”. |

Partners: Bookshop is Books. Viator and GetYourGuide are Experiences. Zazzle is Gifts.
