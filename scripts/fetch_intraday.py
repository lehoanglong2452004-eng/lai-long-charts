# © 2026 Lai Long Charts. Bảo lưu mọi quyền.
"""Download intraday OHLCV (5m and 1h) from Yahoo Finance for the chart tab.

Runs on every deploy (about every 15 minutes). Output is NOT committed; it is
published straight to GitHub Pages: data/intraday/{SYMBOL}_{5m|1h}.json
Crypto is skipped because the browser streams it live from Binance.
"""
import json, os, sys, time
from datetime import datetime, timedelta, timezone
import yfinance as yf

from fetch_prices import TICKERS
from contracts import contract_of

INTERVALS = {"5m": "15d", "1h": "1y"}  # interval: lookback period
SKIP = {"BTC", "ETH"}


def recent_gap(df):
    """True if the last 48h contain a hole > 6h that is not a weekend (Yahoo sometimes drops a session)."""
    idx = df.index.tz_convert("UTC")
    cutoff = idx[-1] - timedelta(hours=48)
    for a, b in zip(idx[:-1], idx[1:]):
        if b < cutoff or (b - a) <= timedelta(hours=6):
            continue
        if not any((a + timedelta(days=k)).weekday() == 5 for k in range((b - a).days + 2)):
            return True
    return False


def fetch(tk, iv, period):
    """(bars, the yfinance Ticker that returned them)."""
    best = None
    for attempt in range(3):
        obj = yf.Ticker(tk)
        df = obj.history(period=period, interval=iv, auto_adjust=False).dropna(subset=["Close"])
        if best is None or len(df) > len(best[0]):
            best = (df, obj)
        if df.empty or not recent_gap(df):
            return df, obj
        time.sleep(2)
    return best


def main():
    os.makedirs("data/intraday", exist_ok=True)
    meta, ok = {}, 0
    for sym, (tk, _) in TICKERS.items():
        if sym in SKIP or sym.endswith("_FUT"):
            continue
        meta[sym] = {}
        for iv, period in INTERVALS.items():
            try:
                df, obj = fetch(tk, iv, period)
            except Exception as e:
                print(f"ERROR {sym} {iv}: {e}")
                continue
            if df.empty:
                print(f"MISSING {sym} {iv}")
                continue
            out = {
                "t": [int(ts.timestamp()) for ts in df.index],
                "o": df["Open"].round(6).tolist(), "h": df["High"].round(6).tolist(),
                "l": df["Low"].round(6).tolist(), "c": df["Close"].round(6).tolist(),
                "v": df["Volume"].fillna(0).astype("int64").tolist(),
            }
            with open(f"data/intraday/{sym}_{iv}.json", "w") as f:
                json.dump(out, f, separators=(",", ":"))
            meta[sym][iv] = out["t"][-1]
            if tk.endswith("=F") and "contract" not in meta[sym]:  # once per symbol
                contract = contract_of(obj, df, lambda s, iv=iv: yf.Ticker(s).history(period="5d", interval=iv, auto_adjust=False),
                                       complete_only=True)
                if contract:
                    meta[sym]["contract"] = contract
            ok += 1
        time.sleep(0.3)
    meta["_updated"] = int(datetime.now(timezone.utc).timestamp())
    with open("data/intraday/meta.json", "w") as f:
        json.dump(meta, f)
    print(f"{ok} intraday files written")
    if ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
