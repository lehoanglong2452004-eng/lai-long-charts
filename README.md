# Lai Long Charts

COT (Commitments of Traders), Seasonal and multi-chart dashboard for commodities, FX, energy and crypto.

## Data (auto-updated by GitHub Actions)

| Data | Source | Schedule | Output |
|---|---|---|---|
| COT Legacy / Disaggregated / TFF | CFTC annual files | Fri 21:00 UTC (+ Sat 03:00 backup) | `data/cot/{legacy,disagg,tff}/*.json` |
| Daily OHLCV | Yahoo Finance | Daily 22:30 UTC | `data/prices/*.json` |
| Crypto realtime | Binance WebSocket | Live in browser | — |

Run manually: **Actions → Update COT / Update Prices → Run workflow**.
