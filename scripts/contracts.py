# © 2026 Lai Long Charts. Bảo lưu mọi quyền.
"""Which futures contract a Yahoo continuous ticker (GC=F, CL=F, ...) is quoting right now.

Yahoo names it in two places: a display name ("Gold Dec 26", in the chart metadata or the quote
summary) and the quote summary's underlyingSymbol ("GCZ26.CMX"). Near a roll the two can disagree:
the code moves to the next contract days before the price series does (seen on 24 Oct 2026 with
natural gas, soybeans and Brent). So when they disagree, or only the code is known, the candidate
contracts are fetched by their own symbol and the one whose close matches the continuous series wins.

We keep the month and year so the site can label the chart (GCZ26 · DEC 2026). The browser falls
back to the exchange calendar in js/contracts.js when this is missing.
"""
import re

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
MONTH_CODES = "FGHJKMNQUVXZ"
CODE = re.compile(r"^([A-Z0-9]{1,3}?)([FGHJKMNQUVXZ])(\d{2})(\.[A-Z]+)?$")
NAME = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s-]+'?(\d{4}|\d{2})\b", re.I)
MATCH = 0.0005  # closes within 0.05% are the same contract; calendar spreads are wider


def parse_contract(meta):
    """Yahoo metadata with a display name -> {"name", "month", "year", "exchange"} or None."""
    if not isinstance(meta, dict):
        return None
    name = (meta.get("shortName") or meta.get("longName") or "").strip()
    m = NAME.search(name)
    if not m:
        return None
    year = int(m.group(2))
    if year < 100:
        year += 2000
    return {"name": name, "month": MONTHS[m.group(1).lower()], "year": year,
            "exchange": meta.get("fullExchangeName") or meta.get("exchangeName") or ""}


def parse_code(symbol, name="", exchange=""):
    """Exchange contract code ("GCZ26.CMX") -> same dict as parse_contract plus root/suffix, or None."""
    m = CODE.match((symbol or "").strip().upper())
    if not m:
        return None
    return {"name": name or m.group(0), "month": MONTH_CODES.index(m.group(2)) + 1,
            "year": 2000 + int(m.group(3)), "exchange": exchange, "root": m.group(1), "suffix": m.group(4) or ""}


def code_symbol(root, month, year, suffix=""):
    return f"{root}{MONTH_CODES[month - 1]}{year % 100:02d}{suffix}"


def _closes(df):
    """Last closes of a price frame as {timestamp: close}."""
    if df is None or len(df.index) == 0:
        return {}
    return dict(zip(list(df.index)[-60:], list(df["Close"])[-60:]))


def gap(cont, other):
    """Relative close difference at the latest bar both frames have, or None."""
    a, b = _closes(cont), _closes(other)
    common = [t for t in a if t in b]
    if not common:
        return None
    t = max(common)
    return abs(b[t] / a[t] - 1) if a[t] else None


def _same(a, b):
    return a and b and (a["month"], a["year"]) == (b["month"], b["year"])


def confirm(cont_bars, code, named, history):
    """Pick the candidate contract whose own price matches the continuous bars; None when unsure.

    history(symbol) -> price frame for one contract. Candidates: the code, the named month, and
    when there is no name the three months before the code."""
    picks = [code] + ([named] if named else [])
    if not named:
        y, m = code["year"], code["month"]
        for _ in range(3):
            y, m = (y, m - 1) if m > 1 else (y - 1, 12)
            picks.append({**code, "month": m, "year": y, "name": ""})
    best, best_gap = None, None
    for c in picks:
        sym = code_symbol(code["root"], c["month"], c["year"], code["suffix"])
        try:
            g = gap(cont_bars, history(sym))
        except Exception as e:
            print(f"  {sym}: {e}")
            continue
        print(f"  {sym}: gap {g if g is None else round(g, 5)}")
        if g is not None and (best_gap is None or g < best_gap):
            best, best_gap = {**c, "name": c["name"] or sym}, g
    return best if best_gap is not None and best_gap < MATCH else None


def contract_of(ticker_obj, bars=None, history=None):
    """Contract a yfinance Ticker is quoting, after .history() returned `bars`; never raises.

    history(symbol) fetches one contract's prices to settle a disagreement (see the module note).
    The contract is a nice-to-have, so every lookup failure is printed and skipped."""
    meta, named, code = {}, None, None
    try:
        meta = ticker_obj.history_metadata or {}
        named = parse_contract(meta)
    except Exception as e:
        print(f"no chart metadata: {e}")
    try:
        info = ticker_obj.info or {}
        exch = info.get("fullExchangeName") or info.get("exchange") or ""
        named = named or parse_contract(info)
        code = parse_code(info.get("underlyingSymbol"), info.get("shortName") or "", exch)
    except Exception as e:
        print(f"no quote summary for {meta.get('symbol')}: {e}")
    if not code:
        if not named:
            print(f"no contract named for {meta.get('symbol')}: shortName={meta.get('shortName')!r}")
        return named
    if _same(code, named):
        found = {**code, "name": named["name"]}
    else:
        print(f"{meta.get('symbol')}: name {named and named['name']!r} vs code "
              f"{code_symbol(code['root'], code['month'], code['year'], code['suffix'])}, checking prices")
        found = confirm(bars, code, named, history) if bars is not None and history else None
        # unconfirmed: the display name follows the price series, the code runs ahead near a roll
        found = found or named or code
    return {k: found[k] for k in ("name", "month", "year", "exchange")}
