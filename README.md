# SharpSignal

SharpSignal is an autonomous TxLINE movement monitor built for the TxODDS World Cup Hackathon Trading Tools and Agents track. It scans fixtures and odds on a fixed schedule, normalizes each 1X2 market to true implied probability, and logs only movements that cross a deterministic threshold.

## Strategy

For every accepted snapshot:

1. Select the canonical `1X2_PARTICIPANT_RESULT` market.
2. Validate positive prices and outcome alignment.
3. Normalize percentages so all outcomes sum to 100%, removing bookmaker overround.
4. Compare each outcome with the prior accepted snapshot.
5. Emit `WATCH` when `abs(delta) >= threshold` and `HIGH` when `abs(delta) >= 2 * threshold`.
6. Append the decision to the local audit ledger. The tool never places wagers or orders.

The default live interval is 60 seconds. A deterministic five-second replay is included so judges can inspect threshold crossings when no match is active.

## TxLINE integration

- `GET /api/fixtures/snapshot`
- `GET /api/odds/snapshot/{fixtureId}`

`netlify/functions/scan.js` is the credential boundary. The guest JWT and activated API token are server environment variables and never reach the browser.

## Local use

Open `index.html` for replay mode. Live mode requires the Netlify function or an equivalent server adapter with the variables in `.env.example`.

## Production characteristics

- Automatic scans after page load with no required operator action.
- Deterministic, documented rule engine.
- Input validation and overround normalization.
- Bounded in-browser history and append-only JSON export.
- Live and deterministic replay paths.
- Responsive operational interface.

## Commercial path

SharpSignal can be embedded into sportsbook risk desks, publisher intelligence products, market-operator surveillance, or paid sports-data terminals. Webhooks and durable storage are the natural production extensions.

## Disclaimer

SharpSignal is an analysis and observability tool. It does not execute trades, accept wagers, custody funds, or provide financial advice.
