# Approved copy

Approved by Genie, Oct 26 2026.

## Returns policy

Heading: Returns

The lines below are the returns policy, in order. `{SUPPORT_EMAIL}` is filled from the `SUPPORT_EMAIL` environment variable when the line is read.

| Exact text | Where it is used |
| --- | --- |
| Returns | `src/lib/returns-policy.ts:3`, rendered as the returns page heading at `src/app/shop/returns/page.tsx:10` |
| You can return an item within 14 days of delivery. | `src/lib/returns-policy.ts:13`, rendered at `src/app/shop/returns/page.tsx:11`, served at `src/app/api/store/settings/route.ts:14` |
| Every item ships from a US supplier or maker, and returns go straight back to them. | `src/lib/returns-policy.ts:14`, rendered at `src/app/shop/returns/page.tsx:11`, served at `src/app/api/store/settings/route.ts:14` |
| To start a return, email us at {SUPPORT_EMAIL} with your order number. We'll email you the address to send it to. | `src/lib/returns-policy.ts:15`, rendered at `src/app/shop/returns/page.tsx:11`, served at `src/app/api/store/settings/route.ts:14` |
| You pay return shipping, unless your item arrived damaged, defective or wrong. Then we cover it. | `src/lib/returns-policy.ts:16`, rendered at `src/app/shop/returns/page.tsx:11`, served at `src/app/api/store/settings/route.ts:14` |
| For a damaged or defective item, email us a photo within 3 days of delivery. | `src/lib/returns-policy.ts:6`, included in the policy at `src/lib/returns-policy.ts:17`, rendered at `src/app/shop/returns/page.tsx:11`, served at `src/app/api/store/settings/route.ts:14` |
| Refunds are issued once the supplier receives the item. | `src/lib/returns-policy.ts:9`, last policy line at `src/lib/returns-policy.ts:18`, rendered at `src/app/shop/returns/page.tsx:11`, served at `src/app/api/store/settings/route.ts:14` |

Approved by Genie, Oct 26 2026.

## Contact line

Exact text: Need a return? Email us your order number within 14 days of delivery.

Defined at `src/lib/reseller-copy.ts:3`. Chosen for the contact block at `src/components/policy-article.tsx:32` and rendered at `src/components/policy-article.tsx:45`.

Shown on:

- `src/app/shop/returns/page.tsx:10`
- `src/app/shop/contact/page.tsx:31`
- `src/app/shop/shipping/page.tsx:10`
- `src/app/shop/terms/page.tsx:12`
- `src/app/shop/privacy/page.tsx:13`
- `src/app/shop/how-we-check/page.tsx:10`
- `src/app/shop/reseller/page.tsx:11` and `src/app/shop/reseller/terms/page.tsx:10` when the viewer is not an operator

Approved by Genie, Oct 26 2026.

## Damage-photo line

Exact text: For a damaged or defective item, email us a photo within 3 days of delivery.

Defined at `src/lib/returns-policy.ts:6`. It is a returns-policy line at `src/lib/returns-policy.ts:17`. On the reseller pages it is rendered beside the contact line at `src/components/policy-article.tsx:47`, from `src/app/shop/reseller/page.tsx:11` and `src/app/shop/reseller/terms/page.tsx:10`.

Approved by Genie, Oct 26 2026.

## Refund line

Exact text: Refunds are issued once the supplier receives the item.

Defined at `src/lib/returns-policy.ts:9`. It is the last returns-policy line at `src/lib/returns-policy.ts:18`, rendered at `src/app/shop/returns/page.tsx:11` and served at `src/app/api/store/settings/route.ts:14`.

Approved by Genie, Oct 26 2026.

## Sold out

Exact text: Sold out

Sentence case, no punctuation. Defined at `src/lib/sold-out-label.ts:2`. The product button renders it at `src/components/product-buy.tsx:264` when nothing is left. The shop card renders it at `src/components/shop-grid.tsx:59`. The same card line is on aisle picks at `src/components/aisle-picks.tsx:48`. Cart and checkout return it from `src/lib/stock-caps.ts:131` when nothing is left. A quantity above a still-positive shelf is clamped to what remains and does not use this line. That module repeats the words so the production script stays free of local imports.

A sold-out size in the menu is `<Size> (Sold out)`, for example `Clay (Sold out)`. The size name comes first, then a space, then the approved words in parentheses. The option is disabled at `src/components/product-buy.tsx:232`.

Approved by Genie, Oct 27 2026.

## Stock review

Exact text: Review this order before it ships. Payment came in after the stock hold, and the shelf could not cover it.

Defined at `src/lib/order-flags.ts:4`. Shown to an admin on a store order at `src/components/orders-view.tsx:237` when the paid order could not take stock. Shoppers do not see this line.

Approved by Genie, Oct 27 2026.

## Affiliate disclosure

Card text, on all four partner cards: We may earn a commission when you buy through these links.

Longer line kept in config, not shown on the cards: We may earn a commission when you buy through these links, at no extra cost to you.

Defined at `src/config/affiliates.ts`. Each program has its own `disclosure`. The cards use the shorter sentence. It renders under the button only when that link's href is set.

The Amazon aisle line stays "As an Amazon Associate I earn from qualifying purchases." and the aisle label stays "(paid link)".

Approved by Genie, Nov 16 2026. Disclosure wording after this default is still open.

## Affiliate spot copy

| Exact text | Where |
| --- | --- |
| Gift a book | Books heading on Home & Gifts, `src/config/affiliates.ts` |
| Browse books on Bookshop.org | Bookshop link, same file |
| Tours and things to do | Experiences heading on Tickets & Events, same file |
| See things to do on Viator | Viator link, same file |
| See things to do on GetYourGuide | GetYourGuide link, same file |
| Gift ideas | Gifts heading on the Holiday aisle, same file |
| Browse gifts on Zazzle | Zazzle link, same file |

These strings render only when that program's href is set.

Approved by Genie, Nov 16 2026.

## Error boundary

Exact text: This page didn't load. Refresh to try again, or go back to the homepage.

The body line in `src/app/error.tsx` and `src/app/global-error.tsx`.

Approved by Genie, Nov 16 2026.
