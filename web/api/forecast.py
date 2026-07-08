"""Pure V1 forecast math — data in, dict out, zero I/O so it is unit-testable
offline. All money numbers deterministic; no LLM anywhere. freq supports
monthly/quarterly/yearly, imputed on due months only. ponytail: variable_typical is a macro
approximation (subtracts already-active obligations from the median expense);
exact per-line history attribution is a V2 concern, ±tolerance covers it."""


def month_add(month, n):
    y, m = (int(x) for x in month.split("-"))
    idx = y * 12 + (m - 1) + n
    return f"{idx // 12}-{idx % 12 + 1:02d}"


def _month_idx(month):
    y, m = (int(x) for x in month.split("-"))
    return y * 12 + (m - 1)


def _active(charge, month):
    # Legacy/partial config peut omettre start (charge déjà en historique) → un
    # start absent = "démarré depuis toujours" pour le mensuel ; les cadences
    # non-mensuelles ont besoin du start pour connaître leur phase.
    start = charge.get("start")
    end = charge.get("end")
    if start is not None and month < start:
        return False
    if end is not None and month > end:
        return False
    freq = charge.get("freq", "monthly")
    if freq == "monthly":
        return True
    if start is None:
        return False
    step = {"quarterly": 3, "yearly": 12}.get(freq)
    if step is None:
        return False
    return (_month_idx(month) - _month_idx(start)) % step == 0


def active_obligations(charges, month):
    return round(sum(c["amount"] for c in charges if _active(c, month)), 2)


def variable_typical(typical_expense, charges, ref_month):
    """Living cost that is NOT an already-active recurring obligation, so the
    runway does not double-count. Only monthly obligations are stripped here —
    they sit in every month's median expense; cadenced (quarterly/yearly) charges
    are NOT reliably in the median, so build_runway imputes them per due month."""
    monthly = [c for c in charges if c.get("freq", "monthly") == "monthly"]
    return round(max(typical_expense - active_obligations(monthly, ref_month), 0.0), 2)


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


def savings_trend(series, target_rate, band_pts):
    band = band_pts / 100.0
    points = []
    for s in series:
        rate = round(s["capacity"] / s["income"], 4) if s["income"] > 0 else 0.0
        points.append({"month": s["month"], "rate": rate})
    direction = "flat"
    if len(points) >= 2:
        d = points[-1]["rate"] - points[0]["rate"]
        direction = "up" if d > 0.005 else "down" if d < -0.005 else "flat"
    last = points[-1]["rate"] if points else 0.0
    verdict = ("above" if last >= target_rate + band
               else "below" if last <= target_rate - band else "within")
    return {"points": points, "target": target_rate, "band": band,
            "verdict": verdict, "direction": direction}


def reconcile(months, tolerance):
    out = []
    for m in months:
        gap = round(abs((m["income"] - m["expense"]) - m["dnw"]), 2)
        out.append({"month": m["month"], "gap": gap, "ok": gap <= tolerance})
    return {"months": out, "all_ok": all(x["ok"] for x in out)}


def debt_total(charges):
    return round(sum(c["remaining_balance"] for c in charges
                     if c.get("remaining_balance")), 2)


def housing_ratio(charges, salary, ref_month):
    rent = round(sum(c["amount"] for c in charges
                     if c.get("kind") == "rent" and _active(c, ref_month)), 2)
    ratio = round(rent / salary, 4) if salary > 0 else 0.0
    return {"ratio": ratio, "over_33": ratio > 0.33}


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
