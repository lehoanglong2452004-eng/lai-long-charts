# © 2026 Lai Long Charts. Bảo lưu mọi quyền.
# Run: python -m pytest -q tests
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from contracts import contract_of, parse_contract  # noqa: E402


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
