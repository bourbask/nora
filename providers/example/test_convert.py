#!/usr/bin/env python3
"""Self-check for the provider convert contract. Run: python test_convert.py

Covers the money-critical bits every provider's convert() must get right:
amount parsing, date normalization, dedup (identical rows must not collide),
BOM/encoding, and the standard output schema. Plain asserts, no framework.
"""

import csv
import tempfile
from pathlib import Path

import convert as C


def test_parse_amount():
    assert C.parse_amount("1 234,56") == 1234.56      # spaces + comma decimals
    assert C.parse_amount("-12,00") == -12.0           # negative
    assert C.parse_amount(" 0,00 ") == 0.0             # padding


def test_parse_date():
    assert C.parse_date("07/03/2026") == "2026-03-07"  # dd/mm/yyyy -> ISO


def _write(inbox, name, body):
    (inbox / name).write_text(body, encoding="utf-8-sig")  # BOM on purpose


def test_convert_end_to_end():
    with tempfile.TemporaryDirectory() as d:
        inbox = Path(d) / "inbox"
        inbox.mkdir()
        out = Path(d) / "out.csv"
        # two IDENTICAL rows + one empty-date row that must be skipped
        _write(inbox, "a.csv",
               "Date;Label;Amount\n"
               "07/03/2026;Coffee;-3,50\n"
               "07/03/2026;Coffee;-3,50\n"
               ";Bogus;-9,99\n")
        C.convert(str(inbox), str(out))

        rows = list(csv.DictReader(open(out, encoding="utf-8")))
        assert len(rows) == 2, rows                     # empty-date row skipped
        r = rows[0]
        assert list(r.keys()) == ["date", "amount", "description", "account_name",
                                  "opposing_name", "category", "external_id"]
        assert r["date"] == "2026-03-07"
        assert r["amount"] == "-3.50"                    # 2-decimal, dot
        assert r["opposing_name"] == "Coffee"
        # identical rows must get DISTINCT external_ids (dedup counter), else the
        # Firefly importer would drop the second as a duplicate.
        assert rows[0]["external_id"] != rows[1]["external_id"], rows


if __name__ == "__main__":
    test_parse_amount()
    test_parse_date()
    test_convert_end_to_end()
    print("test_convert.py OK")
