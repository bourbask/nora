"""Amortissement close-form d'un prêt à taux fixe (zéro LLM, aucune I/O).
interest_mois = solde * taux_annuel/12 ; principal = mensualité - interest."""
import math


def payoff_month(start_month, payoff_months):
    if payoff_months is None:
        return None
    y, m = (int(x) for x in start_month.split("-"))
    idx = y * 12 + (m - 1) + payoff_months
    return f"{idx // 12}-{idx % 12 + 1:02d}"


def schedule(balance, monthly_payment, annual_rate, max_months=600):
    r = annual_rate / 12.0
    first_interest = balance * r
    if monthly_payment <= first_interest and r > 0:
        return {"payoff_months": None, "total_interest": 0.0,
                "total_principal": 0.0, "never_amortizes": True, "schedule": []}
    if annual_rate == 0:
        n = math.ceil(balance / monthly_payment)
        sched, bal = [], balance
        for i in range(1, n + 1):
            principal = min(monthly_payment, bal)
            bal = round(bal - principal, 2)
            sched.append({"m": i, "interest": 0.0, "principal": round(principal, 2), "balance": bal})
        return {"payoff_months": n, "total_interest": 0.0,
                "total_principal": round(balance, 2), "never_amortizes": False, "schedule": sched}
    sched, bal, tot_int = [], balance, 0.0
    for i in range(1, max_months + 1):
        interest = round(bal * r, 2)
        principal = round(monthly_payment - interest, 2)
        if principal >= bal:                     # dernier paiement tronqué
            principal = bal
        bal = round(bal - principal, 2)
        tot_int = round(tot_int + interest, 2)
        sched.append({"m": i, "interest": interest, "principal": principal, "balance": bal})
        if bal <= 0:
            return {"payoff_months": i, "total_interest": tot_int,
                    "total_principal": round(balance, 2), "never_amortizes": False, "schedule": sched}
    return {"payoff_months": None, "total_interest": tot_int,
            "total_principal": round(balance - bal, 2), "never_amortizes": True, "schedule": sched}
