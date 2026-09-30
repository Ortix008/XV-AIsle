# XV-AIsle

[xvaisle.com](https://xvaisle.com) is a dropshipping marketplace. Companies with extra inventory list it. People resell that stock for extra income and never hold the box. A neighborhood shop or a national floor ships the order. You keep the sale, the supplier keeps the fulfillment, and XV-AIsle keeps the market.

An account is required for the seller desk. The first 30 days are free. After that, membership is $10 a month through Stripe, billed to the platform account. Shoppers can browse the public store without an account. Publishing a listing takes an active membership and a finished Stripe payout setup.

The operator is the account named by `ADMIN_EMAIL`. That is the only admin. A new account is a buyer until they choose reseller or supplier.

The SI Team finds a product, writes the page, watches the order, and drafts the post. You still say yes before anything goes out. The team runs on the catalog in this app. It does not log into X, TikTok, Instagram, a supplier site, or an ad account. Saying yes copies text. You paste it yourself.

| SI Team | Job |
| --- | --- |
| Signal | Finds the product and a US supplier. |
| Draft | Writes the product page after you say yes. |
| Harbor | Watches orders and writes the reply if something is late or broken. |
| Cast | Writes the posts that send people to the store. |

X is how people arrive. The store is where they pay.

## Stack

Next.js 16 (App Router) and React 19, TypeScript, Tailwind 4. One Node process. Accounts, orders, listings, and settings sit in a SQLite file (`node:sqlite`) at `DATABASE_PATH` (default `data/xvaisle.sqlite`). Passwords are hashed with scrypt. Sessions are random tokens stored only as a SHA-256 hash, in an HttpOnly cookie.

The public package is `docker-compose.yml`: the app container plus Caddy for HTTPS on `xvaisle.com`.

## What you can open

Seller desk (sign-in required):

- `/` Market floor
- `/scout` Signal
- `/listings` Draft
- `/orders` Harbor
- `/marketing` Cast
- `/membership` Membership
- `/floors` National retailers and small shops

Public store:

- `/shop` Published products
- `/shop/[productId]` Product page and card checkout
- `/shop/usa` Made in the USA
- `/shop/small` Small-business shelf
- `/shop/x` Catalog link and a post you can paste on X
- `/shop/contact` Note to the seller
- `/shop/safety` Shipping, returns, and the return address
- `/shop/return` Stripe return landing

## What works, and what is still a stub

With the keys in `.env.example` left blank, you can install, sign up, and browse. Checkout stays closed until `STRIPE_SECRET_KEY` is set, and it does not pretend a payment happened. A paid order is posted to `SUPPLIER_API_URL` only when that URL and `SUPPLIER_API_KEY` are both set. Otherwise the order stays queued.

Still manual or sample data:

- Posts and retailer notes are copied by hand. Nothing is sent to X or to Walmart, Amazon, Target, or the other floors.
- The product book is a fixed catalog with fictional warehouses. It is not a live feed.
- The starter store is two pages, a quarter sheet pan and a stainless bench scraper.
- Small shops are names you type in.

## How money moves

Shoppers pay the platform Stripe account. Membership is the same account, $10 a month.

A product sale is one charge. The platform keeps 8–12% (`PLATFORM_FEE_BPS`, default 10%, clamped to that range, with an optional per-listing rate inside the range). The supplier is owed their unit cost times quantity, plus shipping once if the listing sets it. The reseller is owed whatever is left. A listing that would pay the reseller less than zero cannot be published or checked out.

Nothing is transferred when the card payment succeeds. The app writes a pending ledger row for the reseller and a pending ledger row for the supplier. When an admin marks the order delivered, or the supplier posts a signed callback to `/api/supplier/delivered`, the app creates one Stripe transfer per party. Each transfer uses the original charge as `source_transaction`, so it waits until those funds are available. The platform does not add `application_fee_amount`. Stripe’s processing fee is paid by the platform out of the retained cut. If the cut is smaller than Stripe’s fee, the platform balance covers the difference.

Resellers and suppliers add a bank account in Stripe’s hosted Express onboarding. This app does not collect card numbers, bank numbers, or crypto addresses. Connected accounts are Accounts v2 recipients: Express dashboard, the platform collects fees, and the platform is liable for losses. Publishing checks that `stripe_transfers` is active. That is the current replacement for the old `payouts_enabled` flag. Recipient accounts are not card merchants, so `charges_enabled` stays off and is not required.

Stripe does not offer escrow. A US platform may hold funds before transfer for up to 2 years (other countries are shorter; this store ships in the US). Orders still waiting on a transfer inside the last 14 days of that window are flagged. After the window, the app will not transfer; refund the charge instead.

Default Radar rules stay in place. The charge outcome’s risk level is stored. Transfers do not run while a review or dispute is open, or when risk is elevated or highest, until an admin approves. A refund reverses transfers in proportion, or cancels a share that has not been sent yet. A lost dispute cancels what is still pending. A won dispute sends the reversed share back.

Use a test key. Live keys are refused unless `STRIPE_ALLOW_LIVE=1`.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317) for the desk and [http://127.0.0.1:4317/shop](http://127.0.0.1:4317/shop) for the store.

```bash
npm run check
npm run build
npm start
```

Do not commit `.env`, the SQLite file, or a return address. `.gitignore` already ignores `.env*` except `.env.example`, and it ignores `data/`.

## Environment

| Name | Purpose |
| --- | --- |
| `APP_URL` | Stripe success and cancel URLs. Compose sets `https://xvaisle.com`. |
| `TRUST_PROXY` | Set to `1` behind Caddy so rate limits use the visitor address. |
| `DATABASE_PATH` | SQLite file. Compose sets `/data/xvaisle.sqlite`. |
| `STRIPE_SECRET_KEY` | Platform secret or restricted key. Test mode unless `STRIPE_ALLOW_LIVE=1`. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `https://xvaisle.com/api/billing/webhook`. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret for `https://xvaisle.com/api/connect/webhook`. |
| `STRIPE_API_VERSION` | Optional `Stripe-Version` header. Default `2026-07-29.dahlia`. |
| `STRIPE_MEMBERSHIP_PRICE_ID` | Optional $10/month price. Otherwise Checkout uses `price_data`. |
| `PLATFORM_FEE_BPS` | Platform cut in basis points. Default `1000`, clamped to `800`–`1200`. |
| `STRIPE_ALLOW_LIVE` | Set to `1` only to permit a live key. |
| `STRIPE_CARD_CHECKOUT_ONLY` | Set to `1` to disable Link and US bank on the platform payment configuration at boot. |
| `SUPPLIER_API_URL` | Where a paid order is posted, once a shipper exists. |
| `SUPPLIER_API_KEY` | Bearer token for that post. |
| `SUPPLIER_CALLBACK_SECRET` | HMAC secret for `POST /api/supplier/delivered`. |
| `STORE_RETURNS` | Return line shown before the operator saves one at `/shop/safety`. |
| `STORE_OPERATOR_EMAIL` | Account that receives the two starter products. Empty means nobody does. |
| `ADMIN_EMAIL` | The only admin. Return address, buyer notes, and delivery live here. |

`/api/billing/webhook` needs `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `review.opened`, and `review.closed`.

`/api/connect/webhook` needs `account.updated` and `account.application.deauthorized`. Listen to events on connected accounts.

A restricted test key is a better fit than a secret key. It needs Checkout, subscriptions, charges, payment intents, transfers and reversals, Accounts v2, account links, and Express login links.

`npx tsx scripts/deploy-ready.ts` lists what is still empty. It does not print secret values.

## Deploy

Use a Linux host with Docker, a disk that persists, and ports 80 and 443 open. This app is one long-running Node server and a SQLite file, so a host that wipes the disk or sleeps the process is a poor fit. A small virtual machine is enough. A 2 GB machine is more comfortable while `docker compose` builds the image.

The domain is at Porkbun. Point the A record for `xvaisle.com` and `www` at that host. Remove any URL forward so Caddy can answer on port 80 and get a certificate.

```bash
cp .env.example .env
# fill the file on the server only, then:
docker compose up -d --build
```

After the certificate is up, sign in, open `/shop/safety`, and save the return address there.

## Collaborating

Public help is welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.
