# Contributing

XV-AIsle is public, and help is welcome. Bug fixes, clearer copy, and small features that fit the market are all useful.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The desk is [http://127.0.0.1:4317](http://127.0.0.1:4317). The store is [http://127.0.0.1:4317/shop](http://127.0.0.1:4317/shop). Leave the secrets in `.env` blank unless you are testing Stripe or a supplier handoff on your own machine.

Before you open a pull request:

```bash
npm run check
npm run build
```

## What to leave out of git

This repository is public. Do not commit:

- `.env` or any real key, token, webhook secret, or supplier credential
- SQLite files, the `data/` directory, or account exports
- A return address, phone number, email, or payout detail that belongs to a real person
- `node_modules` or a Next.js build

Put new configuration names in `.env.example` with empty values, and describe them in the README table.

## Pull requests

Branch from `main`, keep the change focused, and say what you tried. `npm run check` covers accounts, the desk, security, the market, and Connect payouts. Match the TypeScript and React style already in `src/`.
