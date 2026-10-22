"""Download CFTC Commitments of Traders (futures only) and write one JSON per market.

Source: CFTC annual files at https://www.cftc.gov/files/dea/history/
Output: data/cot/{legacy|disagg|tff}/{SYMBOL}.json (columnar arrays, oldest first)
"""
import csv, io, json, os, sys, zipfile
from datetime import date
import requests

START_YEAR = 2010
URL = "https://www.cftc.gov/files/dea/history/{}.zip"
HEADERS = {"User-Agent": "Mozilla/5.0 (lai-long-charts data bot)"}

# symbol: (CFTC contract market code, group)
MARKETS = {
    "GOLD": ("088691", "metals"), "SILVER": ("084691", "metals"),
    "PLATINUM": ("076651", "metals"), "PALLADIUM": ("075651", "metals"),
    "COPPER": ("085692", "metals"), "ALUMINUM": ("191693", "metals"),
    "STEEL_HRC": ("192651", "metals"),
    "WHEAT": ("001602", "grains"), "CORN": ("002602", "grains"),
    "SOYBEANS": ("005602", "grains"), "SOY_OIL": ("007601", "grains"),
    "SOY_MEAL": ("026603", "grains"), "COFFEE_ARABICA": ("083731", "softs"),
    "WTI": ("067651", "energy"), "BRENT": ("06765T", "energy"),
    "NATGAS": ("023651", "energy"), "RBOB": ("111659", "energy"),
    "HEATING_OIL": ("022651", "energy"),
    "JPY": ("097741", "fx"), "CAD": ("090741", "fx"), "EUR": ("099741", "fx"),
    "GBP": ("096742", "fx"), "AUD": ("232741", "fx"), "CHF": ("092741", "fx"),
    "USD_INDEX": ("098662", "fx"),
    "BTC": ("133741", "crypto"), "ETH": ("146021", "crypto"),
}

# report: (file name pattern, {output key: source column})
REPORTS = {
    "legacy": ("deacot{}", {
        "oi": "Open Interest (All)",
        "nc_l": "Noncommercial Positions-Long (All)",
        "nc_s": "Noncommercial Positions-Short (All)",
        "nc_sp": "Noncommercial Positions-Spreading (All)",
        "c_l": "Commercial Positions-Long (All)",
        "c_s": "Commercial Positions-Short (All)",
        "nr_l": "Nonreportable Positions-Long (All)",
        "nr_s": "Nonreportable Positions-Short (All)",
    }),
    "disagg": ("fut_disagg_txt_{}", {
        "oi": "Open_Interest_All",
        "pm_l": "Prod_Merc_Positions_Long_All", "pm_s": "Prod_Merc_Positions_Short_All",
        "sw_l": "Swap_Positions_Long_All", "sw_s": "Swap__Positions_Short_All",
        "sw_sp": "Swap__Positions_Spread_All",
        "mm_l": "M_Money_Positions_Long_All", "mm_s": "M_Money_Positions_Short_All",
        "mm_sp": "M_Money_Positions_Spread_All",
        "or_l": "Other_Rept_Positions_Long_All", "or_s": "Other_Rept_Positions_Short_All",
        "nr_l": "NonRept_Positions_Long_All", "nr_s": "NonRept_Positions_Short_All",
    }),
    "tff": ("fut_fin_txt_{}", {
        "oi": "Open_Interest_All",
        "d_l": "Dealer_Positions_Long_All", "d_s": "Dealer_Positions_Short_All",
        "am_l": "Asset_Mgr_Positions_Long_All", "am_s": "Asset_Mgr_Positions_Short_All",
        "lm_l": "Lev_Money_Positions_Long_All", "lm_s": "Lev_Money_Positions_Short_All",
        "or_l": "Other_Rept_Positions_Long_All", "or_s": "Other_Rept_Positions_Short_All",
        "nr_l": "NonRept_Positions_Long_All", "nr_s": "NonRept_Positions_Short_All",
    }),
}

CODES = {code: sym for sym, (code, _) in MARKETS.items()}


def read_year(pattern, year):
    r = requests.get(URL.format(pattern.format(year)), headers=HEADERS, timeout=120)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(r.content))
    with z.open(z.namelist()[0]) as f:
        reader = csv.reader(io.TextIOWrapper(f, encoding="latin-1"))
        header = [h.strip() for h in next(reader)]
        return header, list(reader)


def main():
    failed = False
    found = set()
    for report, (pattern, cols) in REPORTS.items():
        series = {}  # symbol -> {date: row}
        names = {}
        for year in range(START_YEAR, date.today().year + 1):
            data = read_year(pattern, year)
            if data is None:
                print(f"skip {report} {year}: not published")
                continue
            header, rows = data
            idx = {k: header.index(v) for k, v in cols.items()}
            for r in rows:
                sym = CODES.get(r[3].strip())
                if not sym:
                    continue
                d = r[2].strip()[:10]
                series.setdefault(sym, {})[d] = {k: float(r[i] or 0) for k, i in idx.items()}
                names[sym] = r[0].strip()
        os.makedirs(f"data/cot/{report}", exist_ok=True)
        for sym, by_date in series.items():
            dates = sorted(by_date)
            out = {"symbol": sym, "group": MARKETS[sym][1], "market": names[sym],
                   "report": report, "date": dates}
            for k in cols:
                out[k] = [by_date[d][k] for d in dates]
            with open(f"data/cot/{report}/{sym}.json", "w") as f:
                json.dump(out, f, separators=(",", ":"))
            found.add(sym)
            print(f"OK {report}/{sym}: {len(dates)} weeks, last {dates[-1]}")

    for sym in MARKETS:
        if sym not in found:
            print(f"MISSING {sym} ({MARKETS[sym][0]})")
            failed = True

    index = {sym: {"group": g, "reports": [rp for rp in REPORTS
                                          if os.path.exists(f"data/cot/{rp}/{sym}.json")]}
             for sym, (_, g) in MARKETS.items()}
    with open("data/cot/index.json", "w") as f:
        json.dump(index, f, indent=1)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
