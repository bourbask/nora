"""Pure V1 forecast math — data in, dict out, zero I/O so it is unit-testable
offline. All money numbers deterministic; no LLM anywhere. freq: monthly only
in V1 (non-monthly obligations deferred). ponytail: variable_typical is a macro
approximation (subtracts already-active obligations from the median expense);
exact per-line history attribution is a V2 concern, ±tolerance covers it."""


def month_add(month, n):
    y, m = (int(x) for x in month.split("-"))
    idx = y * 12 + (m - 1) + n
    return f"{idx // 12}-{idx % 12 + 1:02d}"


def _active(charge, month):
    if charge.get("freq", "monthly") != "monthly":
        return False
    if month < charge["start"]:
        return False
    end = charge.get("end")
    return end is None or month <= end


def active_obligations(charges, month):
    return round(sum(c["amount"] for c in charges if _active(c, month)), 2)


def variable_typical(typical_expense, charges, ref_month):
    """Living cost that is NOT an already-active recurring obligation, so the
    runway does not double-count obligations already present in history."""
    return round(max(typical_expense - active_obligations(charges, ref_month), 0.0), 2)


def expected_salary(income_series, override):
    if override is not None:
        return round(float(override), 2)
    xs = sorted(x for x in income_series if x is not None)
    if not xs:
        return 0.0
    n = len(xs)
    mid = n // 2
    med = xs[mid] if n % 2 else (xs[mid - 1] + xs[mid]) / 2
    return round(med, 2)


def guardrail(dormant_cash, monthly_cost, cushion_months, runway):
    coverage = round(dormant_cash / monthly_cost, 2) if monthly_cost > 0 else None
    cushion_ok = coverage is not None and coverage >= cushion_months
    runway_ok = all(m["net"] >= 0 for m in runway["months"])
    invest_ok = bool(cushion_ok and runway_ok)
    if invest_ok:
        reason = "Matelas plein et runway positif : investissement débloqué."
    elif not cushion_ok:
        reason = f"Matelas à {coverage}/{cushion_months} mois : on sécurise d'abord (R1)."
    else:
        reason = "Runway négatif à venir : on protège la liquidité (R7)."
    return {"invest_ok": invest_ok, "coverage_months": coverage,
            "reason": reason, "rule_refs": ["R1", "R7"]}


def remaining(salary, charges, variable, month, buffer, savings_rate, invest_ok):
    reste_a_vivre = round(salary - active_obligations(charges, month) - variable, 2)
    if invest_ok:
        surplus = max(reste_a_vivre - buffer, 0.0)
        reste_a_investir = round(min(surplus, salary * savings_rate), 2)
    else:
        reste_a_investir = 0.0
    return {"reste_a_vivre": reste_a_vivre, "reste_a_investir": reste_a_investir}


def build_runway(salary, charges, variable, one_offs, dormant_cash, start_month, horizon=12):
    oneoff_by_month = {}
    for o in one_offs:
        oneoff_by_month[o["date"]] = oneoff_by_month.get(o["date"], 0.0) + o["amount"]
    months = []
    balance = round(dormant_cash, 2)
    trough = None
    positive_month = None
    for i in range(horizon):
        m = month_add(start_month, i)
        net = round(salary - active_obligations(charges, m) - variable - oneoff_by_month.get(m, 0.0), 2)
        balance = round(balance + net, 2)
        months.append({"month": m, "net": net, "balance": balance})
        if trough is None or balance < trough["balance"]:
            trough = {"month": m, "balance": balance}
        if positive_month is None and i > 0 and net >= 0:
            positive_month = m
    return {"months": months, "trough": trough, "positive_month": positive_month}
