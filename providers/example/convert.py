#!/usr/bin/env python3
"""
Example provider — a minimal, fictional bank ("DemoBank").

Reads any CSV in the inbox with columns  Date;Label;Amount  (';'-separated,
dd/mm/yyyy, comma decimals) and writes the standard Firefly CSV. Copy this
directory to providers/<yourbank>/ and adapt convert().

Usage:  python convert.py <inbox_dir> <out_csv>
"""

import csv
import hashlib
import sys
from pathlib import Path

ACCOUNT = "DemoBank - Checking"  # replace with your real Firefly asset account


def parse_amount(s):
    return float(s.strip().replace(" ", "").replace(",", "."))


def parse_date(s):
    d, m, y = s.strip().split("/")
    return f"{y}-{m}-{d}"


def convert(inbox_dir, out_csv):
    rows = []
    seen = {}
    for path in sorted(Path(inbox_dir).glob("*.csv")):
        with open(path, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if not r.get("Date"):
                    continue
                date = parse_date(r["Date"])
                amount = parse_amount(r["Amount"])
                label = (r.get("Label") or "").strip()
                key = f"{ACCOUNT}|{date}|{label}|{amount:.2f}"
                seen[key] = seen.get(key, 0) + 1
                ext = "demo-" + hashlib.sha1(f"{key}|{seen[key]}".encode()).hexdigest()[:16]
                rows.append({
                    "date": date, "amount": f"{amount:.2f}", "description": label,
                    "account_name": ACCOUNT, "opposing_name": label or "Unknown",
                    "category": "Uncategorized", "external_id": ext,
                })

    fields = ["date", "amount", "description", "account_name",
              "opposing_name", "category", "external_id"]
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows -> {out_csv}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: convert.py <inbox_dir> <out_csv>")
    convert(sys.argv[1], sys.argv[2])
