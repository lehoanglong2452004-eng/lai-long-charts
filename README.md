# Lai Long Charts

COT (Commitments of Traders), Seasonal and multi-chart dashboard for commodities, FX, energy and crypto.

## Data (auto-updated by GitHub Actions)

| Data | Source | Schedule | Output |
|---|---|---|---|
| COT Legacy / Disaggregated / TFF | CFTC annual files | Fri 21:00 UTC (+ Sat 03:00 backup) | `data/cot/{legacy,disagg,tff}/*.json` |
| Daily OHLCV | Yahoo Finance | Daily 22:30 UTC | `data/prices/*.json` |
| Intraday 5m / 1h (futures, FX) | Yahoo Finance | Every ~15 min with each deploy | `data/intraday/*.json` (published, not committed) |
| Realtime (BTC, ETH, gold, silver, platinum, palladium, copper, WTI, Brent, natgas) | Binance · OKX · Bybit · Hyperliquid (auto failover, `js/exchanges.js`) | Live in browser | — |

## Site

- **COT** — Legacy / Disaggregated / TFF positioning, COT Index, all-markets overview
- **Seasonal** — year overlays + averages, monthly/quarterly heatmaps, multi-product comparison, overview grid
- **Charts** — 1–9 chart layouts, candles/line, volume, volume profile, bar countdown, dark/light, EN/VI

Deployed by `.github/workflows/deploy.yml` (on push, every 15 minutes, and after each data update).

Run manually: **Actions → Update COT / Update Prices → Run workflow**.
