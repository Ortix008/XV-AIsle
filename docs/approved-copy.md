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

Sentence case, no punctuation. Defined at `src/lib/sold-out-label.ts:2`. The product button renders it at `src/components/product-buy.tsx:261`. The shop card renders it at `src/components/shop-grid.tsx:59`. The same card line is on aisle picks at `src/components/aisle-picks.tsx:48`. Cart and checkout return it from `src/lib/stock-caps.ts:135` when nothing is left or the quantity is above the remaining stock. That module repeats the words so the production script stays free of local imports.

Approved by Genie, Oct 27 2026.
