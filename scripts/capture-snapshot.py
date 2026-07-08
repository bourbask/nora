#!/usr/bin/env python3
"""Capture le snapshot du dernier mois complet dans data/snapshots.json.
Headless : réutilise firefly_client + scores, ne dépend pas du web API tournant.

  python3 scripts/capture-snapshot.py              # dernier mois complet
  python3 scripts/capture-snapshot.py --backfill 12  # + 12 mois passés (champs fiables)
"""
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "web" / "api"))

import yaml
import firefly_client as fc
import scores
import snapshots as S

DATA_DIR = REPO_ROOT / "data"
SNAP_FILE = DATA_DIR / "snapshots.json"
CONFIG = REPO_ROOT / "config" / "strategy.yaml"


def _cfg():
    return yaml.safe_load(CONFIG.read_text())


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _last_complete_month():
    return fc._shift_month(fc._now_month(), 1)


def capture(cfg, month, captured_at):
    nw = fc.networth(cfg)
    summ = fc.summary(month, cfg)
    pf = fc.portfolio(cfg)
    typical = fc.typical_monthly_expense(month, months=6)
    dormant = scores.dormant_health(dormant_cash=nw["dormant"], avg_monthly_expense=typical,
                                     savings_rate=summ["savings_rate"], cfg=cfg)
    invested = scores.invested_health(instrument_cost=pf["instrument_cost"],
                                      bucket_weights_actual=pf["bucket_weights"],
                                      crypto_weight=pf["crypto_weight"], cfg=cfg)
    return S.build_snapshot(month, nw, summ, pf, dormant["score"],
                            invested["score"] if invested else None, captured_at)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", type=int, default=0, metavar="N")
    args = ap.parse_args()

    cfg = _cfg()
    now = _now_iso()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    store = S.load(SNAP_FILE)

    month = _last_complete_month()
    S.upsert(store, capture(cfg, month, now))
    print(f"→ snapshot {month} capturé")

    for k in range(1, args.backfill + 1):
        m = fc._shift_month(month, k)
        if m in store:
            continue  # ne pas écraser un mois déjà capturé en avant
        _, last_day, _ = fc.month_bounds(m)
        nw = fc.networth(cfg, on_date=last_day)["net_of_debt"]
        sr = fc.summary(m, cfg)["savings_rate"]
        S.upsert(store, S.backfill_snapshot(m, nw, sr, now))
        print(f"→ backfill {m}")

    S.dump(SNAP_FILE, store)
    print(f"→ {len(store)} mois dans {SNAP_FILE}")


if __name__ == "__main__":
    main()
