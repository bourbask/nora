"""Store append-only de snapshots mensuels (métriques clés), persisté en JSON
local. Cœur pur : aucune I/O réseau, aucune horloge interne (captured_at injecté)."""
import json
from pathlib import Path


def build_snapshot(month, nw, summ, pf, dormant_score, invested_score, captured_at):
    return {
        "month": month,
        "net_worth": nw["net_of_debt"],
        "net_worth_gross": nw["total"],
        "debt": nw["debt"],
        "dormant_cash": nw["dormant"],
        "invested_cost": pf["total_cost"],
        "savings_rate": summ["savings_rate"],
        "dormant_score": dormant_score,
        "invested_score": invested_score,
        "bucket_weights": pf["bucket_weights"],
        "crypto_weight": pf["crypto_weight"],
        "captured_at": captured_at,
        "backfilled": False,
    }


def backfill_snapshot(month, net_worth, savings_rate, captured_at):
    return {
        "month": month, "net_worth": net_worth, "net_worth_gross": None,
        "debt": None, "dormant_cash": None, "invested_cost": None,
        "savings_rate": savings_rate, "dormant_score": None, "invested_score": None,
        "bucket_weights": None, "crypto_weight": None,
        "captured_at": captured_at, "backfilled": True,
    }


def upsert(store, snap):
    store[snap["month"]] = snap
    return store


def load(path):
    p = Path(path)
    return json.loads(p.read_text()) if p.exists() else {}


def dump(path, store):
    Path(path).write_text(json.dumps(store, indent=2, ensure_ascii=False))


def to_series(store):
    return [store[m] for m in sorted(store)]
