"""
Health-score formulas — pure functions, transparent (no ML), weights from config.
Every score is 0-100 and returns its sub-scores so the UI can show *why*.

Run the self-check:  python scores.py
"""


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def dormant_health(dormant_cash, avg_monthly_expense, savings_rate, cfg):
    d = cfg["dormant"]
    w = cfg["scores"]["dormant_weights"]
    target_months = d["safety_cushion_months"]
    buffer = d.get("checking_buffer_eur", 0)
    target_rate = d.get("target_savings_rate", 0.20)
    E = avg_monthly_expense

    if E <= 0:
        coverage_months = None
        cushion = 100.0 if dormant_cash > 0 else 0.0
    else:
        coverage_months = dormant_cash / E
        cushion = 100 * clamp(coverage_months / target_months)

    # Idle cash beyond (cushion + checking buffer) is penalized; within it, no drag.
    if dormant_cash > 0 and E > 0:
        excess = max(dormant_cash - target_months * E - buffer, 0)
        cash_drag = 100 * (1 - clamp(excess / dormant_cash))
    else:
        cash_drag = 100.0

    sr = savings_rate if savings_rate is not None else 0.0
    savings = 100 * clamp(sr / target_rate) if target_rate > 0 else 0.0

    score = w["cushion"] * cushion + w["cash_drag"] * cash_drag + w["savings_rate"] * savings
    return {
        "score": round(score, 1),
        "sub": {
            "cushion": round(cushion, 1),
            "cash_drag": round(cash_drag, 1),
            "savings_rate": round(savings, 1),
        },
        "coverage_months": round(coverage_months, 2) if coverage_months is not None else None,
    }


def invested_health(instrument_cost, bucket_weights_actual, crypto_weight, cfg):
    """instrument_cost: {name: cost_basis}; bucket_weights_actual: {high,mid,low}."""
    inv = cfg["invested"]
    w = cfg["scores"]["invested_weights"]
    target_holdings = inv.get("target_holdings", 15)
    target_buckets = inv["target_buckets"]
    cap = inv.get("crypto_cap", 0.10)

    total = sum(v for v in instrument_cost.values() if v > 0)
    if total <= 0:
        return {"score": 0.0, "sub": {"diversification": 0, "class_align": 0, "crypto_cap": 0},
                "effective_holdings": 0}

    weights = [v / total for v in instrument_cost.values() if v > 0]
    hhi = sum(x * x for x in weights)
    effective = 1 / hhi
    diversification = 100 * clamp(effective / target_holdings)

    tvd = 0.5 * sum(abs(bucket_weights_actual.get(b, 0) - target_buckets.get(b, 0))
                    for b in set(target_buckets) | set(bucket_weights_actual))
    class_align = 100 * (1 - clamp(tvd))

    crypto_cap = 100 * (1 - clamp((crypto_weight - cap) / (1 - cap))) if cap < 1 else 100.0

    score = (w["diversification"] * diversification + w["class_align"] * class_align
             + w["crypto_cap"] * crypto_cap)
    return {
        "score": round(score, 1),
        "sub": {
            "diversification": round(diversification, 1),
            "class_align": round(class_align, 1),
            "crypto_cap": round(crypto_cap, 1),
        },
        "effective_holdings": round(effective, 2),
    }


def demo():
    cfg = {
        "dormant": {"safety_cushion_months": 6, "checking_buffer_eur": 1500,
                    "target_savings_rate": 0.20},
        "invested": {"target_holdings": 4, "target_buckets": {"high": 0.1, "mid": 0.7, "low": 0.2},
                     "crypto_cap": 0.10},
        "scores": {"dormant_weights": {"cushion": 0.5, "cash_drag": 0.25, "savings_rate": 0.25},
                   "invested_weights": {"diversification": 0.4, "class_align": 0.4, "crypto_cap": 0.2}},
    }

    # HHI of 4 equal weights = 0.25 -> effective holdings = 4 -> diversification 100
    r = invested_health({"a": 25, "b": 25, "c": 25, "d": 25},
                        {"high": 0.1, "mid": 0.7, "low": 0.2}, 0.0, cfg)
    assert r["effective_holdings"] == 4.0, r
    assert r["sub"]["diversification"] == 100.0, r
    assert r["sub"]["class_align"] == 100.0, r          # buckets on target
    assert r["sub"]["crypto_cap"] == 100.0, r           # no crypto

    # Single instrument -> HHI 1 -> effective 1 -> diversification 25 (1/4 target)
    r1 = invested_health({"only": 100}, {"mid": 1.0}, 0.0, cfg)
    assert r1["effective_holdings"] == 1.0, r1
    assert r1["sub"]["diversification"] == 25.0, r1

    # Crypto at 2x cap -> crypto_cap sub-score drops to ~88.9 ((1-0.1/0.9)*100)
    r2 = invested_health({"a": 80, "btc": 20}, {"high": 0.2, "mid": 0.8}, 0.20, cfg)
    assert 88.0 <= r2["sub"]["crypto_cap"] <= 89.0, r2

    # Dormant: 6 months exactly covered, no excess, savings on target -> ~100
    d = dormant_health(dormant_cash=6 * 1000, avg_monthly_expense=1000, savings_rate=0.20, cfg=cfg)
    assert d["coverage_months"] == 6.0, d
    assert d["sub"]["cushion"] == 100.0, d
    assert d["sub"]["savings_rate"] == 100.0, d

    # Dormant: zero expenses edge case doesn't crash
    dz = dormant_health(5000, 0, None, cfg)
    assert dz["sub"]["cushion"] == 100.0, dz

    print("scores.py self-check OK")


if __name__ == "__main__":
    demo()
