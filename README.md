# XV-AIsle

[xvaisle.com](https://xvaisle.com) is a dropshipping marketplace. Companies with extra inventory list it. People resell that stock for extra income and never hold the box. A neighborhood shop or a national floor ships the order. You keep the sale, the supplier keeps the fulfillment, and XV-AIsle keeps the market.

An account is required for the seller desk. The first 30 days are free. After that, membership is $10 a month through Stripe. Shoppers can browse the public store without an account.

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
- Profit payouts are recorded as a mask. Nothing sends money to a card, bank, or wallet.
- Small shops are names you type in.

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
| `STRIPE_SECRET_KEY` | Membership and store checkout. A test key is enough until you charge for real. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `https://xvaisle.com/api/billing/webhook` and `checkout.session.completed`. |
| `SUPPLIER_API_URL` | Where a paid order is posted, once a shipper exists. |
| `SUPPLIER_API_KEY` | Bearer token for that post. |
| `STORE_RETURNS` | Return line shown before someone saves one at `/shop/safety`. |
| `STORE_OPERATOR_EMAIL` | Account that receives the two starter products. |

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
