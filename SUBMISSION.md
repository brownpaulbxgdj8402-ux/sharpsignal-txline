# Superteam submission

## Project title

SharpSignal - Autonomous TxLINE movement monitor

## Summary

SharpSignal scans TxLINE odds automatically, removes market overround, and records only material implied-probability movements with a fully auditable decision trace.

## Product

The monitor starts automatically and runs every 60 seconds. Each scan loads live TxLINE fixtures and 1X2 odds, validates the input, normalizes outcomes to 100%, and compares the result with the previous accepted snapshot. A movement above the configured threshold becomes a `WATCH` signal; a move above twice the threshold becomes `HIGH`. Everything else is deliberately discarded as noise.

The interface exposes the probability path, the exact rule evaluation, and an append-only signal ledger. A deterministic replay reproduces a complete monitoring session when live markets are inactive. SharpSignal observes and explains; it never places a wager or order.

## Links

- Live application: https://sharpsignal-txline.netlify.app
- Public repository: https://github.com/brownpaulbxgdj8402-ux/sharpsignal-txline
- Demo video: https://sharpsignal-txline.netlify.app/demo.webm
- Technical documentation: https://github.com/brownpaulbxgdj8402-ux/sharpsignal-txline/blob/main/README.md

## TxLINE feedback

The normalized fixture identifiers and stable odds schema make multi-match monitoring straightforward. `Pct`, `PriceNames`, and `SuperOddsType` are especially useful for a deterministic agent because the decision path can remain explicit and testable.

The largest friction remains free-tier onboarding and sparse market availability outside active match windows. A market-availability endpoint, canonical TypeScript types, and a documented heartbeat or sequence cursor would make production polling more efficient. A hackathon-scoped server token would also reduce time-to-first-scan.

## Disclaimer

SharpSignal is analysis software only. It does not execute trades, accept wagers, or custody funds.
