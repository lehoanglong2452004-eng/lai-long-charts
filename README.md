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

### What each chart shows

The chart header names the instrument behind the price, so a perpetual is never mistaken for a futures contract:

| Label | Meaning |
|---|---|
| `PERPETUAL` + `LIVE · BINANCE` | USDT perpetual on the exchange shown; never expires, can trade slightly away from the exchange futures price |
| `SPOT` | Spot market (crypto on Binance/OKX/Bybit, FX rates from Yahoo) |
| `COMEX DEC 2026` + `DELAYED 12m` | Front-month futures from CME Group (COMEX, NYMEX, CBOT, CME) or ICE US, via Yahoo's continuous ticker |
| `≈ COMEX DEC 2026` | Same, but the month is estimated from the exchange calendar because Yahoo did not name the contract |

The contract month comes from Yahoo's chart metadata (e.g. "Gold Dec 26"), saved by the fetch scripts in `data/intraday/meta.json` and `data/prices/index.json`. When it is missing, `js/contracts.js` works out the front month from each exchange's listing cycle and last-trade rule (holidays ignored). Hover the label for the contract code, roll date and notes. A paid direct feed can later fill the same `contract` fields without changing the site.

FX pairs: EURUSD, USDJPY, GBPUSD, AUDUSD, USDCAD, USDCHF, NZDUSD, EURJPY, GBPJPY, EURGBP, USDCNY and DXY; CME currency futures (6E, 6J, 6B, 6C, 6A, 6S, 6N) back the COT price overlay.

Deployed by `.github/workflows/deploy.yml` (on push, every 15 minutes, and after each data update).

Run manually: **Actions → Update COT / Update Prices → Run workflow**.

## Tests

`node --test tests/*.test.js` and `python -m pytest -q tests` (run on every push by `.github/workflows/test.yml`).
