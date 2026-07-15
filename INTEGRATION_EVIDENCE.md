# TxLINE integration evidence

SharpSignal uses an activated TxLINE World Cup free-tier account on Solana Devnet.

## Public activation proof

- Network: Solana Devnet
- Subscription wallet: `ALMpoj9rW5Tsfv61rQMmTr1PLVraaNgdgbsRn9b7LiU5`
- TxLINE program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- Successful subscription transaction: `31reS5HQNCMPvC3npDATxHoZkx84FGfVzcLNhhmJ5QTCpdj1nqqpGoKuEKVTBncajtKigLNnQCVPU5baofZusvES`

Transaction explorer:

https://explorer.solana.com/tx/31reS5HQNCMPvC3npDATxHoZkx84FGfVzcLNhhmJ5QTCpdj1nqqpGoKuEKVTBncajtKigLNnQCVPU5baofZusvES?cluster=devnet

## Runtime validation

On July 16, 2026, the deployed `/api/scan` endpoint returned HTTP 200 with six fixture snapshots and a priced `1X2_PARTICIPANT_RESULT` market for England vs Argentina. The public browser loaded the live fixture, normalized outcome percentages, and reported 100% scan integrity.

Live credentials are stored only as deployment environment variables. They are not included in the repository, browser bundle, screenshots, or this document.
