# © 2026 Lai Long Charts. Bảo lưu mọi quyền.
"""Which futures contract a Yahoo continuous ticker (GC=F, CL=F, ...) is quoting right now.

Looked up in the chart metadata first (a name like "Gold Dec 26"), then in the quote summary
(underlyingSymbol "GCZ26.CMX" or the same kind of name). We keep the month and year so the site can
label the chart (GCZ26 · DEC 2026). The browser falls back to the exchange calendar in js/contracts.js
when this is missing.
"""
import re

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
MONTH_CODES = "FGHJKMNQUVXZ"
CODE = re.compile(r"^([A-Z0-9]{1,3}?)([FGHJKMNQUVXZ])(\d{2})(?:\.[A-Z]+)?$")
NAME = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s-]+'?(\d{4}|\d{2})\b", re.I)


def parse_contract(meta):
    """Yahoo chart metadata -> {"name", "month", "year", "exchange"} or None when it names no contract."""
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
    """Exchange contract code ("GCZ26.CMX") -> same dict as parse_contract, or None."""
    m = CODE.match((symbol or "").strip().upper())
    if not m:
        return None
    return {"name": name or m.group(0), "month": MONTH_CODES.index(m.group(2)) + 1,
            "year": 2000 + int(m.group(3)), "exchange": exchange}


def contract_of(ticker_obj):
    """Contract of a yfinance Ticker after .history() was called; never raises.

    The contract is a nice-to-have, so every lookup failure is printed and skipped."""
    meta = {}
    try:
        meta = ticker_obj.history_metadata or {}
        found = parse_contract(meta)
        if found:
            return found
    except Exception as e:
        print(f"no chart metadata: {e}")
    try:
        info = ticker_obj.info or {}
        exch = info.get("fullExchangeName") or info.get("exchange") or ""
        found = parse_code(info.get("underlyingSymbol"), info.get("shortName") or "", exch) or parse_contract(info)
        if found:
            return found
        print(f"no contract named for {meta.get('symbol')}: chart shortName={meta.get('shortName')!r} "
              f"longName={meta.get('longName')!r}; quote underlyingSymbol={info.get('underlyingSymbol')!r} "
              f"shortName={info.get('shortName')!r}")
    except Exception as e:
        print(f"no quote summary for {meta.get('symbol')}: {e}")
    return None
