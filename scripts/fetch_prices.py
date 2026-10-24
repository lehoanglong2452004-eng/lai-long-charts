# © 2026 Lai Long Charts. Bảo lưu mọi quyền.
"""Download daily OHLCV history from Yahoo Finance and write one JSON per symbol.

Output: data/prices/{SYMBOL}.json (columnar arrays, oldest first)
Used for Seasonal comparison and as daily history behind the charts.
"""
import json, os, sys
import yfinance as yf

from contracts import contract_of

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
    "NZDUSD": ("NZDUSD=X", "fx"), "EURJPY": ("EURJPY=X", "fx"), "GBPJPY": ("GBPJPY=X", "fx"),
    "EURGBP": ("EURGBP=X", "fx"),
    "USDCNY": ("CNY=X", "fx"), "DXY": ("DX-Y.NYB", "fx"),
    # CME currency futures: same direction as the COT contracts (e.g. JPY/USD)
    "EUR_FUT": ("6E=F", "fx"), "JPY_FUT": ("6J=F", "fx"), "GBP_FUT": ("6B=F", "fx"),
    "CAD_FUT": ("6C=F", "fx"), "AUD_FUT": ("6A=F", "fx"), "CHF_FUT": ("6S=F", "fx"),
    "NZD_FUT": ("6N=F", "fx"),
    "BTC": ("BTC-USD", "crypto"), "ETH": ("ETH-USD", "crypto"),
}


def main():
    os.makedirs("data/prices", exist_ok=True)
    index, missing = {}, []
    for sym, (tk, group) in TICKERS.items():
        contract = None
        try:
            obj = yf.Ticker(tk)
            df = obj.history(start=START, interval="1d", auto_adjust=False)
            df = df.dropna(subset=["Close"])
            if tk.endswith("=F"):
                contract = contract_of(obj, df, lambda s: yf.Ticker(s).history(period="1mo", interval="1d", auto_adjust=False))
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
        c = out["c"]
        index[sym] = {"ticker": tk, "group": group, "first": out["t"][0], "last": out["t"][-1],
                      "close": c[-1], "prev": c[-2] if len(c) > 1 else c[-1]}
        if contract:
            index[sym]["contract"] = contract
        print(f"OK {sym}: {len(df)} days, {out['t'][0]} -> {out['t'][-1]}")

    with open("data/prices/index.json", "w") as f:
        json.dump(index, f, indent=1)
    # Fail only if most symbols are missing (likely a Yahoo outage), not for one bad ticker.
    if len(missing) > len(TICKERS) // 2:
        sys.exit(1)


if __name__ == "__main__":
    main()
