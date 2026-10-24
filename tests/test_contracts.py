# © 2026 Lai Long Charts. Bảo lưu mọi quyền.
# Run: python -m pytest -q tests
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from contracts import code_symbol, contract_of, parse_code, parse_contract  # noqa: E402


def test_reads_month_and_year_from_yahoo_names():
    c = parse_contract({"shortName": "Gold Dec 26", "fullExchangeName": "COMEX"})
    assert (c["month"], c["year"], c["exchange"], c["name"]) == (12, 2026, "COMEX", "Gold Dec 26")
    assert parse_contract({"shortName": "Crude Oil Jan 27"})["month"] == 1
    assert parse_contract({"longName": "Brent Crude Oil Last Day Financ,Feb-2027"})["month"] == 2
    assert parse_contract({"shortName": "Coffee Mar '27"})["year"] == 2027
    assert parse_contract({"shortName": "Euro FX Sept 2026"})["month"] == 9


def test_no_contract_in_the_name():
    assert parse_contract({"shortName": "EUR/USD"}) is None
    assert parse_contract({}) is None
    assert parse_contract(None) is None


def test_contract_of_never_raises():
    class Broken:
        @property
        def history_metadata(self):
            raise RuntimeError("no metadata")

    class Ok:
        history_metadata = {"shortName": "Silver Dec 26"}

    assert contract_of(Broken()) is None
    assert contract_of(Ok())["month"] == 12


def test_reads_exchange_contract_codes():
    c = parse_code("GCZ26.CMX", "Gold Dec 26", "COMEX")
    assert (c["month"], c["year"], c["name"], c["exchange"], c["root"], c["suffix"]) == (12, 2026, "Gold Dec 26", "COMEX", "GC", ".CMX")
    assert parse_code("CLF27.NYM")["month"] == 1
    assert parse_code("6EZ26.CME")["root"] == "6E"
    assert parse_code("ALIX26")["root"] == "ALI"
    assert parse_code("GC=F") is None
    assert parse_code(None) is None
    assert code_symbol("NG", 11, 2026, ".NYM") == "NGX26.NYM"


class Frame:
    """Minimal stand-in for a yfinance price frame."""
    def __init__(self, closes):
        self.index = list(range(len(closes)))
        self.closes = closes

    def __getitem__(self, col):
        return self.closes


def ticker(name=None, code=None):
    class T:
        history_metadata = {"symbol": "X=F"}
        info = {"shortName": name, "underlyingSymbol": code, "fullExchangeName": "NY Mercantile"}
    return T()


def test_name_and_code_agree():
    c = contract_of(ticker("Gold Dec 26", "GCZ26.CMX"))
    assert (c["month"], c["year"], c["name"]) == (12, 2026, "Gold Dec 26")
    assert set(c) == {"name", "month", "year", "exchange"}


def test_disagreement_is_settled_by_price():
    cont = Frame([2.70, 2.64])  # continuous series still on November
    prices = {"NGX26.NYM": Frame([2.70, 2.64]), "NGZ26.NYM": Frame([3.05, 2.99])}
    c = contract_of(ticker("Natural Gas Nov 26", "NGZ26.NYM"), cont, prices.get)
    assert (c["month"], c["year"]) == (11, 2026)
    # the series already rolled: the code wins
    c = contract_of(ticker("Natural Gas Nov 26", "NGZ26.NYM"), Frame([3.05, 2.99]), prices.get)
    assert (c["month"], c["year"]) == (12, 2026)


def test_code_only_checks_earlier_months():
    prices = {"BZF27.NYM": Frame([115.9]), "BZZ26.NYM": Frame([116.72]), "BZX26.NYM": Frame([])}
    c = contract_of(ticker("Brent Crude Oil Last Day Financ", "BZF27.NYM"), Frame([116.72]), prices.get)
    assert (c["month"], c["year"], c["name"]) == (12, 2026, "BZZ26.NYM")


def test_unconfirmed_prefers_the_name():
    c = contract_of(ticker("Soybean Futures,Nov-2026", "ZSF27.CBT"))  # no prices to compare
    assert (c["month"], c["year"]) == (11, 2026)
    c = contract_of(ticker("Soybean Futures,Nov-2026", "ZSF27.CBT"), Frame([1256.5]), lambda s: Frame([1270.0]))
    assert (c["month"], c["year"]) == (11, 2026)


def test_lookup_failures_never_raise():
    class InfoFails:
        history_metadata = {"symbol": "GC=F"}

        @property
        def info(self):
            raise RuntimeError("401 crumb")

    def boom(sym):
        raise RuntimeError("rate limited")

    assert contract_of(InfoFails()) is None
    c = contract_of(ticker("Natural Gas Nov 26", "NGZ26.NYM"), Frame([2.64]), boom)
    assert (c["month"], c["year"]) == (11, 2026)
