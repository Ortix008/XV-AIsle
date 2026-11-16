# Affiliate page map

Spots render nothing while their hrefs are empty. None of these spots are mounted on a page. An href is a link pasted from that program's link builder. Partner ids stay in config and are not turned into URLs here.

The disclosure beside each link defaults to: We may earn a commission when you buy through these links, at no extra cost to you.

A program can set its own line. The shorter line, when a program uses it, is: We may earn a commission when you buy through these links.

Zazzle is the Gifts partner only. It does not render on a Personalized item or that item's tile.

| Spot | Route | Section | Component | [WORDY] labels |
| --- | --- | --- | --- | --- |
| Books | Unmounted. No Books route exists. Bookshop partner id is pending. | Books | `AffiliateSpot` `spot="books"` in `src/components/affiliate-spot.tsx` | [WORDY: Books heading], [WORDY: Bookshop link] |
| Experiences | Unmounted. `/aisles/tickets-and-events` has no items and is not a live page, so it is not linked. Viator partner P00330828. GetYourGuide partner YEH3QKQ. | Experiences | `AffiliateSpot` `spot="experiences"` in `src/components/affiliate-spot.tsx` | [WORDY: Experiences heading], [WORDY: Viator link], [WORDY: GetYourGuide link] |
| Gifts | Unmounted. Planned on `/shop?aisle=home-and-gifts`, which returns 200. Never on a Personalized item or its tile. Zazzle Ambassador ID 238672294015858667. | Gifts | `AffiliateSpot` `spot="gifts"` in `src/components/affiliate-spot.tsx` | [WORDY: Gifts heading], [WORDY: Zazzle link] |

Partners: Bookshop is Books. Viator and GetYourGuide are Experiences. Zazzle is Gifts.
