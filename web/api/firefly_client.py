"""
Shared Firefly III transport + aggregate helpers.

Extracted from mcp/firefly/server.py so auth/token resolution lives in one place.
Pure httpx (no FastAPI) so it is importable and testable on its own against a
live Firefly instance.

Env:
  FIREFLY_BASE_URL   (default http://localhost:8066 ; http://firefly-iii:8080 in container)
  FIREFLY_TOKEN or FIREFLY_III_ACCESS_TOKEN  (Personal Access Token)
"""

import os
import re
import calendar
from datetime import date, timedelta
from pathlib import Path

import httpx

FIREFLY_BASE_URL = os.environ.get("FIREFLY_BASE_URL", "http://localhost:8066")


def _resolve_token():
    tok = os.environ.get("FIREFLY_TOKEN") or os.environ.get("FIREFLY_III_ACCESS_TOKEN")
    if tok:
        return tok
    # Fallback: scrape repo-root .env (web/api/firefly_client.py -> parents[2] = repo root)
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if env_path.exists():
        m = re.search(r"^FIREFLY_III_ACCESS_TOKEN=(.+)$", env_path.read_text(), re.MULTILINE)
        if m:
            return m.group(1).strip()
    raise RuntimeError("FIREFLY_TOKEN not set and not found in .env")


FIREFLY_TOKEN = _resolve_token()


def _headers():
    return {"Authorization": f"Bearer {FIREFLY_TOKEN}", "Accept": "application/json"}


def api_get(path, params=None):
    url = f"{FIREFLY_BASE_URL}/api/v1{path}"
    with httpx.Client() as c:
        r = c.get(url, headers=_headers(), params=params, timeout=30)
        r.raise_for_status()
        return r.json()


def api_post(path, data):
    url = f"{FIREFLY_BASE_URL}/api/v1{path}"
    with httpx.Client() as c:
        r = c.post(url, headers=_headers(), json=data, timeout=30)
        r.raise_for_status()
        return r.json()


def api_put(path, data):
    url = f"{FIREFLY_BASE_URL}/api/v1{path}"
    with httpx.Client() as c:
        r = c.put(url, headers=_headers(), json=data, timeout=30)
        r.raise_for_status()
        return r.json()


# ── date helpers ──────────────────────────────────────────────────────────────

def month_bounds(month):
    """'YYYY-MM' -> (first_day, last_day, last_day_prev_month) as date objects."""
    y, m = (int(x) for x in month.split("-"))
    last = calendar.monthrange(y, m)[1]
    first_day = date(y, m, 1)
    last_day = date(y, m, last)
    last_day_prev = first_day - timedelta(days=1)
    return first_day, last_day, last_day_prev


# ── aggregate helpers ───────────────────────────────────────────────────────

def asset_accounts(on_date=None):
    """List of {name, balance} for asset accounts, optionally as-of a date."""
    params = {"type": "asset", "limit": 100}
    if on_date is not None:
        params["date"] = on_date.isoformat()
    data = api_get("/accounts", params)
    out = []
    for a in data.get("data", []):
        attr = a["attributes"]
        out.append({"name": attr["name"], "balance": float(attr.get("current_balance") or 0)})
    return out


def _classify(name, cfg):
    if name in cfg["dormant"]["accounts"]:
        return "dormant"
    if name in cfg["invested"]["accounts"]:
        return "invested"
    return "unclassified"


def networth(cfg, on_date=None):
    """Total net worth split dormant/invested, plus per-account detail."""
    accts = asset_accounts(on_date)
    dormant = invested = other = 0.0
    detail = []
    for a in accts:
        cls = _classify(a["name"], cfg)
        if cls == "dormant":
            dormant += a["balance"]
        elif cls == "invested":
            invested += a["balance"]
        else:
            other += a["balance"]
        detail.append({**a, "cls": cls})
    return {
        "total": round(dormant + invested + other, 2),
        "dormant": round(dormant, 2),
        "invested": round(invested, 2),
        "unclassified": round(other, 2),
        "accounts": detail,
    }


def _networth_total(cfg, on_date):
    return networth(cfg, on_date)["total"]


def _insight_by_category(kind, first_day, last_day):
    """kind in {'income','expense'} -> {category_name: abs_amount}."""
    data = api_get(f"/insight/{kind}/category", {
        "start": first_day.isoformat(), "end": last_day.isoformat(),
    })
    out = {}
    for row in data:
        name = row.get("name") or "(sans catégorie)"
        out[name] = abs(float(row.get("difference_float") or row.get("difference") or 0))
    return out


def _sum_excluding(cat_map, exclude):
    ex = {e.lower() for e in exclude}
    return round(sum(v for k, v in cat_map.items() if k.lower() not in ex), 2)


def _insight_total(kind, first_day, last_day):
    """Type-based external flow total (deposits for income, withdrawals for
    expense). Internal transfers are excluded by construction — this is the
    correct income/expense source (category-based sums leak the salary into the
    'Virements' bucket). Verified: income - expense == ΔNW."""
    data = api_get(f"/insight/{kind}/total", {
        "start": first_day.isoformat(), "end": last_day.isoformat(),
    })
    return round(abs(sum(float(r.get("difference_float") or 0) for r in data)), 2)


def summary(month, cfg):
    """Monthly external income/expense (type-based), savings capacity (ΔNW),
    savings rate.

    savings_capacity (ΔNW) is the robust headline metric. savings_rate uses gross
    external income and can be distorted by lumpy one-off inflows (e.g. an
    investment round-trip); treat it as indicative. TODO(phase1): approximate
    recurring salary via a trailing median for a stabler rate."""
    first_day, last_day, last_day_prev = month_bounds(month)

    real_income = _insight_total("income", first_day, last_day)
    real_expense = _insight_total("expense", first_day, last_day)

    nw_end = _networth_total(cfg, last_day)
    nw_start = _networth_total(cfg, last_day_prev)
    capacity = round(nw_end - nw_start, 2)

    rate = round(capacity / real_income, 4) if real_income > 0 else None
    return {
        "month": month,
        "real_income": real_income,
        "real_expense": real_expense,
        "savings_capacity": capacity,
        "savings_rate": rate,
        "networth_start": nw_start,
        "networth_end": nw_end,
    }


def _shift_month(month, back):
    """'YYYY-MM' shifted `back` months earlier."""
    y, m = (int(x) for x in month.split("-"))
    idx = y * 12 + (m - 1) - back
    return f"{idx // 12}-{idx % 12 + 1:02d}"


def typical_monthly_expense(ref_month, months=6):
    """Median type-based expense over the last `months` months ending at ref_month.
    Median (not mean) so lumpy one-off outflows — big purchases, investment
    round-trips booked as withdrawals — don't inflate the 'typical' figure that
    the safety-cushion coverage is measured against."""
    totals = []
    for i in range(months):
        m = _shift_month(ref_month, i)
        fd, ld, _ = month_bounds(m)
        totals.append(_insight_total("expense", fd, ld))
    totals.sort()
    n = len(totals)
    if n == 0:
        return 0.0
    mid = n // 2
    med = totals[mid] if n % 2 else (totals[mid - 1] + totals[mid]) / 2
    return round(med, 2)


def expense_by_category(month, cfg, top=None):
    """Top cost centers for the month, transfer categories excluded, desc."""
    first_day, last_day, _ = month_bounds(month)
    exclude = {e.lower() for e in cfg.get("transfer_categories", [])}
    cats = _insight_by_category("expense", first_day, last_day)
    rows = [{"category": k, "amount": round(v, 2)}
            for k, v in cats.items() if k.lower() not in exclude and v > 0]
    rows.sort(key=lambda r: r["amount"], reverse=True)
    return rows[:top] if top else rows
