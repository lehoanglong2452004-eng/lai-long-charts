"""Download daily OHLCV history from Yahoo Finance and write one JSON per symbol.

Output: data/prices/{SYMBOL}.json (columnar arrays, oldest first)
Used for Seasonal comparison and as daily history behind the charts.
"""
import json, os, sys
import yfinance as yf

START = "2000-01-01"

# symbol: (Yahoo ticker, group)
TICKERS = {
    "GOLD": ("GC=F", "metals"), "SILVER": ("SI=F", "metals"),
    "PLATINUM": ("PL=F", "metals"), "PALLADIUM": ("PA=F", "metals"),
    "COPPER": ("HG=F", "metals"), "ALUMINUM": ("ALI=F", "metals"),
    "STEEL_HRC": ("HRC=F", "metals"),
    "WHEAT": ("ZW=F", "grains"), "CORN": ("ZC=F", "grains"),
    "SOYBEANS": ("ZS=F", "grains"), "SOY_OIL": ("ZL=F", "grains"),
    "SOY_MEAL": ("ZM=F", "grains"),
    "COFFEE_ARABICA": ("KC=F", "softs"),  # Robusta (ICE London) has no free Yahoo feed
    "WTI": ("CL=F", "energy"), "BRENT": ("BZ=F", "energy"),
    "NATGAS": ("NG=F", "energy"), "RBOB": ("RB=F", "energy"),
    "HEATING_OIL": ("HO=F", "energy"),
    "USDJPY": ("JPY=X", "fx"), "USDCAD": ("CAD=X", "fx"), "EURUSD": ("EURUSD=X", "fx"),
    "GBPUSD": ("GBPUSD=X", "fx"), "AUDUSD": ("AUDUSD=X", "fx"), "USDCHF": ("CHF=X", "fx"),
    "USDCNY": ("CNY=X", "fx"), "DXY": ("DX-Y.NYB", "fx"),
    "BTC": ("BTC-USD", "crypto"), "ETH": ("ETH-USD", "crypto"),
}


def main():
    os.makedirs("data/prices", exist_ok=True)
    index, missing = {}, []
    for sym, (tk, group) in TICKERS.items():
        try:
            df = yf.Ticker(tk).history(start=START, interval="1d", auto_adjust=False)
            df = df.dropna(subset=["Close"])
        except Exception as e:
            print(f"ERROR {sym} ({tk}): {e}")
            df = None
        if df is None or df.empty:
            print(f"MISSING {sym} ({tk})")
            missing.append(sym)
            continue
        out = {
            "symbol": sym, "ticker": tk, "group": group,
            "t": [d.strftime("%Y-%m-%d") for d in df.index],
            "o": df["Open"].round(6).tolist(), "h": df["High"].round(6).tolist(),
            "l": df["Low"].round(6).tolist(), "c": df["Close"].round(6).tolist(),
            "v": df["Volume"].fillna(0).astype("int64").tolist(),
        }
        with open(f"data/prices/{sym}.json", "w") as f:
            json.dump(out, f, separators=(",", ":"))
        index[sym] = {"ticker": tk, "group": group, "first": out["t"][0], "last": out["t"][-1]}
        print(f"OK {sym}: {len(df)} days, {out['t'][0]} -> {out['t'][-1]}")

    with open("data/prices/index.json", "w") as f:
        json.dump(index, f, indent=1)
    # Fail only if most symbols are missing (likely a Yahoo outage), not for one bad ticker.
    if len(missing) > len(TICKERS) // 2:
        sys.exit(1)


if __name__ == "__main__":
    main()
