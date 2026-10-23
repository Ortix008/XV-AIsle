# Release checklist

Confirm these before a production release.

- X login is set in production. The sign-in code reads `X_CLIENT_ID`, `X_CLIENT_SECRET`, and `X_REDIRECT_URI`. Confirm each name is set. Never print the values.
- The live smoke test covers all of these:
  - A receipt email arrives after a 4242 test checkout.
  - A full Continue with X login completes.
  - Stripe is confirmed in TEST mode. Check the key prefix type only. Do not print the key.
  - A fresh parse of banned-words.md is run against the live pages.
