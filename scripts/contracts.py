# © 2026 Lai Long Charts. Bảo lưu mọi quyền.
"""Which futures contract a Yahoo continuous ticker (GC=F, CL=F, ...) is quoting right now.

Yahoo's chart metadata names the contract ("Gold Dec 26"); we keep the month and year so the site can
label the chart (GCZ26 · DEC 2026). The browser falls back to the exchange calendar in js/contracts.js
when this is missing.
"""
import re

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
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


def contract_of(ticker_obj):
    """Contract of a yfinance Ticker after .history() was called; never raises."""
    try:
        return parse_contract(ticker_obj.history_metadata)
    except Exception as e:  # metadata is a nice-to-have: never break a data run for it
        print(f"no contract metadata: {e}")
        return None
