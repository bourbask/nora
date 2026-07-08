"""Détection déterministe de charges mensuelles récurrentes depuis l'historique
des retraits, par régularité de cadence (zéro LLM, aucune I/O réseau).

Discriminant = cadence, pas montant ni type de paiement : une charge récurrente
tombe ~1×/mois à ~30 j d'écart ; la dépense variable tombe plusieurs fois/mois à
écarts courts irréguliers. Le montant dérive (hausses, forfaits) → jamais un
critère de rejet, seulement la confidence."""
from datetime import date
from statistics import median

GAP_MED_LO, GAP_MED_HI = 26, 35      # médiane des écarts (jours) pour "mensuel"
GAP_BAND_LO, GAP_BAND_HI = 20, 40    # bande d'un écart "mensuel-ish"
BAND_FRAC_MIN = 0.60                 # part min des écarts dans la bande
DRIFT_HIGH = 0.15                    # écart montant max/médian pour confidence high


def _distinct_days(items):
    return sorted({date.fromisoformat(t["date"][:10]) for t in items})


def detect_recurrences(withdrawals, existing_names):
    groups = {}
    for t in withdrawals:
        groups.setdefault(t["payee"], []).append(t)

    out = []
    for payee, items in groups.items():
        if payee in existing_names or payee == "?":
            continue  # "?" = destination-less outflows lumped together; not a real payee
        days = _distinct_days(items)
        if len(days) < 3:
            continue
        gaps = [(days[i + 1] - days[i]).days for i in range(len(days) - 1)]
        if not (GAP_MED_LO <= median(gaps) <= GAP_MED_HI):
            continue
        in_band = sum(1 for g in gaps if GAP_BAND_LO <= g <= GAP_BAND_HI)
        if in_band / len(gaps) < BAND_FRAC_MIN:
            continue

        amounts = [t["amount"] for t in items]
        amt = round(median(amounts), 2)
        drift = max(abs(a - amt) for a in amounts) / amt if amt else 1.0
        out.append({
            "name": payee, "amount": amt, "freq": "monthly",
            "start": days[0].strftime("%Y-%m"), "end": None, "kind": "other",
            "count": len(days),
            "confidence": "high" if drift <= DRIFT_HIGH else "medium",
        })

    out.sort(key=lambda c: (c["confidence"] != "high", -c["amount"]))
    return out
