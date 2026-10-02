# XV-AIsle

Our mission: [MISSION.md](MISSION.md)

[xvaisle.com](https://xvaisle.com) is a dropshipping marketplace. Companies with extra inventory list it. People resell that stock for extra income and never hold the box. A neighborhood shop or a national floor ships the order. You keep the sale, the supplier keeps the fulfillment, and XV-AIsle keeps the market.

An account is required for the seller desk. The first 30 days are free. After that, membership is $10 a month through Stripe, billed to the platform account. Shoppers can browse the public store without an account. Publishing a listing takes an active membership and a finished Stripe payout setup.

Signup never creates an admin. The business has two co-owner admins. Each one is promoted by running the seed command once. A new account is a buyer until they choose reseller or supplier. Admin actions require a verified admin. `ADMIN_EMAILS` does not grant admin on signup. An admin must turn on an authenticator app before they can approve a supplier product or release a payout. Sign-in is limited by IP, and five wrong passwords lock that account for 15 minutes.

Helpers in the app can find a product, write a page, watch an order, and draft a post. You still say yes before anything goes out. They do not log into a social network, a supplier site, or an ad account. Saying yes copies text. You paste it yourself.

| SI Team | Job |
| --- | --- |
| Signal | Finds the product and a US supplier. |
| Draft | Writes the product page after you say yes. |
| Harbor | Watches orders and writes the reply if something is late or broken. |
| Cast | Writes the posts that send people to the store. |

Resellers share their shop link anywhere. Buyers pay on xvaisle.com.

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
- `/api/store/catalog` A platform-neutral product feed
- `/shop/contact` Note to the seller
- `/shop/safety` How buying works: payment, shipping, returns, and the return address
- `/shop/return` Stripe return landing

## What works, and what is still a stub

With the keys in `.env.example` left blank, you can install, sign up, and browse. Checkout stays closed until `STRIPE_SECRET_KEY` is set, and it does not pretend a payment happened. A paid order is posted to `SUPPLIER_API_URL` only when that URL and `SUPPLIER_API_KEY` are both set. Otherwise the order stays queued.

Still manual or sample data:

- Posts and retailer notes are copied by hand. Nothing is sent to a social network or to a retailer.
- The product book is a fixed catalog with fictional warehouses. It is not a live feed.
- Sample products (the sheet pan and bench scraper) publish only when `DEMO_SEED=1`. Leave that unset in production.
- Small shops are names you type in.

## How money moves

Shoppers pay the platform Stripe account. Membership is the same account, $10 a month, with a 30-day Stripe trial. Buyers pay only on xvaisle.com.

A product sale is one charge. The buyer pays the listed price and no added fee. The platform keeps 8–12% (`PLATFORM_FEE_BPS`, default 10%, clamped to that range). The supplier is owed the catalog unit cost times quantity, plus shipping once. Estimated card processing (`STRIPE_FEE_BPS` and `STRIPE_FEE_FIXED_CENTS`, default 2.9% + 30¢) comes out of the reseller's share. When the charge's balance transaction reports a fee, that actual fee replaces the estimate and the reseller's pending payout is recomputed. The server does this from the stored price, the approved catalog cost, and these settings. A client cannot send a fee, a net, or a split.

```
gross = price × qty
platform_fee = round(gross × PLATFORM_FEE_BPS / 10000)
stripe_fee = round(gross × STRIPE_FEE_BPS / 10000) + STRIPE_FEE_FIXED_CENTS
supplier_amount = catalog cost × qty + catalog shipping
reseller_net = gross - platform_fee - supplier_amount - stripe_fee
```

A price below `MIN_RETAIL_CENTS` (default $5) or a reseller payout below `MIN_RESELLER_NET_CENTS` (default 50¢) is rejected at publish and again at checkout. If a supplier cost or a fee setting moves a live listing under that line, checkout pauses it. The publish screen shows the server's breakdown: price, supplier cost, platform fee, estimated Stripe fee, and the reseller's estimated payout.

Each reseller payout holds back `RESELLER_RESERVE_BPS` (default 10%) on the platform balance, up to `RESELLER_RESERVE_CAP_CENTS` (default $100) per reseller. Once the cap is full, later payouts transfer in full. The hourly sweep releases each hold `RESELLER_RESERVE_DAYS` after the later of the hold and the refund or dispute close (default 120, clamped to 700 so it stays inside Stripe's 730-day US hold). It waits only while a dispute is still open. The release is an idempotent transfer logged as `reserve_release`. If the Connect account cannot receive that transfer, the order is flagged for an admin. The payout screen shows the held balance and the release dates.

Nothing is transferred when the card payment succeeds. The app writes a pending ledger row for the reseller and a pending ledger row for the supplier. The supplier marks the order shipped with their own callback secret, a carrier, and a tracking number. Funds move only after the buyer confirms receipt, or 7 days after delivery with no buyer dispute. A buyer dispute in that window freezes the transfer until a verified admin reviews it. Each transfer uses the original charge as `source_transaction`. The platform does not add `application_fee_amount`. Stripe still collects its processing fee from the platform account (`fees_collector` stays `application`). That fee is not left in the platform's cut: it reduces the reseller's transfer. The platform's net on a sale is its fee.

Resellers and suppliers add a bank account in Stripe’s hosted Express onboarding. This app does not collect card numbers, bank numbers, or crypto addresses. Connected accounts are Accounts v2 recipients: Express dashboard, the platform collects fees, and the platform is liable for losses. Publishing checks that `stripe_transfers` is active. That is the current replacement for the old `payouts_enabled` flag. Recipient accounts are not card merchants, so `charges_enabled` stays off and is not required.

Stripe does not offer escrow. A US platform may hold funds before transfer for up to 2 years. Orders inside the last 14 days of that window show an admin alert on the desk. After the window, the order is flagged for a refund and the app will not transfer. Other countries use a shorter limit; this store ships in the US, and that difference is left as a TODO in the fee code.

Default Radar rules stay in place. The charge outcome’s risk level is stored. Transfers do not run while a review or dispute is open, or when risk is elevated or highest, until an admin approves. Stripe does not return the original processing fee on a refund. The supplier's share is still reversed in proportion to the refund. A refund, dispute, fee shortfall, or older debt is covered from the reseller's reserve first, then from pending or future payouts, then from a `reseller_debt` row. If Stripe refuses a reversal, the uncovered amount is booked as debt and the webhook still completes. Fee shortfall, refund, and dispute debts on the same order add together. Replaying the webhook does not add them again. If a later payout was reduced to pay older debt and that payout is then refunded, the older debt is reopened. Publishing stays closed while debt is open. A won dispute credits the dispute fee back to the reseller. Reversals and debt entries are stored on the ledger with a reason (`refund_fee`, `dispute_fee`, `dispute_amount`, `debt_offset`, `reserve_hold`, `reserve_release`). Cash left on the platform is reported separately from debt still owed. Stripe transfer and reversal calls use an idempotency key that includes the amount.

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
| `STRIPE_FEE_BPS` | Estimated Stripe percentage, in basis points, taken from the reseller. Default `290`, clamped to `0`–`1000`. |
| `STRIPE_FEE_FIXED_CENTS` | Estimated Stripe fixed fee, in cents, taken from the reseller. Default `30`, clamped to `0`–`100`. |
| `STRIPE_DISPUTE_FEE_CENTS` | Dispute fee, in cents, debited from the reseller. Default `1500`, clamped to `0`–`3500`. |
| `MIN_RETAIL_CENTS` | Lowest price that can be published or checked out, in cents. Default `500`, clamped to `100`–`100000`. |
| `MIN_RESELLER_NET_CENTS` | Lowest reseller payout after cost and fees, in cents. Default `50`, clamped to `0`–`5000`. |
| `RESELLER_RESERVE_BPS` | Share of each reseller payout held on the platform, in basis points. Default `1000`, clamped to `0`–`10000`. |
| `RESELLER_RESERVE_DAYS` | Days after the hold, or after a refund or dispute closes, before release. Default `120`, clamped to `1`–`700`. |
| `RESELLER_RESERVE_CAP_CENTS` | Most reserve held for one reseller, in cents. Default `10000`, clamped to `0`–`100000000`. |
| `STRIPE_ALLOW_LIVE` | Set to `1` only to permit a live key. |
| `STRIPE_CARD_CHECKOUT_ONLY` | Set to `1` to disable Link and US bank on the platform payment configuration at boot. |
| `SUPPLIER_API_URL` | Where a paid order is posted, once a shipper exists. |
| `SUPPLIER_API_KEY` | Bearer token for that post. |
| `SMTP_HOST` | SMTP server for verification email. Empty means the link is written to the server log. |
| `SMTP_PORT` | SMTP port. `587` starts TLS. `465` is implicit TLS. |
| `SMTP_USER` | SMTP username. Optional when the server does not require auth. |
| `SMTP_PASS` | SMTP password. |
| `MAIL_FROM` | From address. Required when `SMTP_HOST` is set. |
| `STORE_RETURNS` | Return line shown before the operator saves one at `/shop/safety`. |
| `STORE_OPERATOR_EMAIL` | Account that receives the two starter products. Empty means nobody does. |
| `ADMIN_EMAIL` | Email for one run of `admin:create`, `admin:reset-password`, or `admin:status`. Signup ignores it. |
| `ADMIN_PASSWORD` | Password for a new admin. Leave empty to type it, or omit it when promoting an account that already exists. The reset command never reads this. |
| `ADMIN_NAME` | Optional name when the seed script creates a new admin. Ignored when that email already has an account. |
| `ADMIN_EMAILS` | Optional comma-separated allowlist for the seed script only. Signup ignores it. |

`/api/billing/webhook` is platform events only: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `review.opened`, and `review.closed`. Do not send connected-account charges here.

`/api/connect/webhook` listens to events on connected accounts and only accepts `account.updated`, `v2.core.account.updated`, and `account.application.deauthorized`. `v2.core.account.updated` is read from `related_object.id`. Do not add charge, refund, or dispute events to this endpoint.

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

Promote both owners inside the `store` container. Run the command once per person. The first example creates a new verified admin. The second promotes an account that already signed up. Promotion sets the role and marks the email verified. It leaves the name, password, membership, Stripe ids, listings, and orders in place. Starting the app does not demote existing roles. The command does not print the password.

```bash
docker compose exec -e ADMIN_EMAIL=first-owner@example.com -e ADMIN_PASSWORD='choose-a-long-password' store node scripts/admin-create.mjs
docker compose exec -e ADMIN_EMAIL=second-owner@example.com store node scripts/admin-create.mjs
```

To limit which emails that command will accept, set `ADMIN_EMAILS=first-owner@example.com,second-owner@example.com` in the server environment before those runs. The list is not an automatic grant. An address on the list stays a buyer until `admin:create` is run for it.

Five wrong passwords lock sign-in for 15 minutes. While the lock is active, sign-in says how many minutes are left and does not check the password. When the lock expires, the failed-try count goes back to zero.

Reset a password inside the container. The command reads `ADMIN_EMAIL` from the environment, then asks for the new password twice without showing what you type. It does not take the password from the environment or from arguments. It clears the lock and signs that account out.

```bash
docker compose exec -e ADMIN_EMAIL=owner@example.com store npm run admin:reset-password
```

See whether that account exists, its role, how many failed sign-ins it has, and whether it is locked. This command only reads. It does not print a password or a hash.

```bash
docker compose exec -e ADMIN_EMAIL=owner@example.com store npm run admin:status
```

## Import a catalog (test mode)

Copy both JSON files onto the droplet. Keep them out of git. `STORE_OPERATOR_EMAIL` is the existing account that will own the listings. `IMPORT_SUPPLIER_EMAIL` is a different existing account. A buyer is marked as a supplier. An admin or a reseller is refused. The command prints each slug and does not print cost, shipping, or source URLs.

```bash
docker compose cp catalog-import.json store:/data/
docker compose cp catalog-private.json store:/data/
docker compose exec store npm run catalog:import -- --dry-run /data/catalog-import.json /data/catalog-private.json
docker compose exec store npm run catalog:import -- /data/catalog-import.json /data/catalog-private.json
docker compose exec store rm /data/catalog-private.json
```

Pictures live at `public/art/products/<slug>.jpg` and are baked in when the image is built. A path with no file is imported with an empty picture.

After the certificate is up, sign in as that admin, open `/shop/safety`, and save the return address there. Suppliers rotate a delivery secret from the membership page. Each secret is stored hashed.

## Collaborating

Public help is welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.
