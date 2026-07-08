"""Détection déterministe de charges récurrentes (mensuel / trimestriel / annuel)
depuis l'historique des retraits, par régularité de cadence + filtre d'actualité
(zéro LLM, aucune I/O réseau).

Discriminant = cadence, pas montant ni type de paiement. Le montant dérive
(hausses, forfaits) → jamais un critère de rejet, seulement la confidence. Le
filtre d'actualité compare la dernière occurrence à `today` : une récurrence dont
la dernière échéance est trop ancienne n'est plus proposée."""
from statistics import median

# freq -> médiane d'écart (jours), bande d'un écart, occ. min, ancienneté max (mois)
BANDS = {
    "monthly":   {"med": (26, 35),   "band": (20, 40),   "min_occ": 3, "stale": 2},
    "quarterly": {"med": (80, 100),  "band": (75, 105),  "min_occ": 3, "stale": 4},
    "yearly":    {"med": (330, 400), "band": (320, 410), "min_occ": 2, "stale": 14},
}
BAND_FRAC_MIN = 0.60
DRIFT_HIGH = 0.15


def _distinct_days(items):
    from datetime import date
    return sorted({date.fromisoformat(t["date"][:10]) for t in items})


def _months_between(a, b):
    return (b.year - a.year) * 12 + (b.month - a.month)


def _eligible_freq(days, today):
    """freq ('monthly'|'quarterly'|'yearly') si le groupe est une récurrence
    encore d'actualité, sinon None."""
    if len(days) < 2:
        return None
    gaps = [(days[i + 1] - days[i]).days for i in range(len(days) - 1)]
    med = median(gaps)
    for freq, spec in BANDS.items():
        lo, hi = spec["med"]
        if lo <= med <= hi:
            blo, bhi = spec["band"]
            if sum(1 for g in gaps if blo <= g <= bhi) / len(gaps) < BAND_FRAC_MIN:
                return None
            if len(days) < spec["min_occ"]:
                return None
            if _months_between(days[-1], today) > spec["stale"]:
                return None
            if freq == "yearly" and len({d.month for d in days}) != 1:
                return None
            return freq
    return None


def detect_recurrences(withdrawals, existing_names, today, dismissed=()):
    excluded = set(existing_names) | set(dismissed)
    groups = {}
    for t in withdrawals:
        groups.setdefault(t["payee"], []).append(t)

    out = []
    for payee, items in groups.items():
        if payee in excluded or payee == "?":
            continue
        days = _distinct_days(items)
        freq = _eligible_freq(days, today)
        if freq is None:
            continue
        amounts = [t["amount"] for t in items]
        amt = round(median(amounts), 2)
        drift = max(abs(a - amt) for a in amounts) / amt if amt else 1.0
        out.append({
            "name": payee, "amount": amt, "freq": freq,
            "start": days[0].strftime("%Y-%m"), "end": None, "kind": "other",
            "count": len(days),
            "confidence": "high" if drift <= DRIFT_HIGH else "medium",
        })

    out.sort(key=lambda c: (c["confidence"] != "high", -c["amount"]))
    return out
