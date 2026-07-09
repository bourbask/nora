# V2-B Amortissement des prêts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Calculer, par prêt, la date de payoff + split capital/intérêt en close-form (solde + mensualité + taux), ajouter le champ taux au ledger, et afficher une carte Prêts.

**Architecture:** Cœur pur `amortization.py` (testable) ← champ `rate` + endpoint `/api/loans` ← UI (colonne taux + carte Prêts).

**Tech Stack:** Python 3 stdlib, FastAPI, React + TS.

## Global Constraints

- Zéro LLM ; déterministe ; cœur pur sans I/O ; garde-fou anti-boucle infinie (`max_months`, `never_amortizes`).
- `rate` = taux annuel fraction (0.045 = 4,5 %), nullable.
- Réutilise l'arithmétique mois de `forecast` (`month_add`), le ledger + `PUT /api/strategy`.
- Tests plain-assert dans `make test-unit`. Commits `--no-gpg-sign`, sans attribution IA.

---

### Task 1: Cœur pur `amortization.py` (TDD)

**Files:** Create `web/api/amortization.py`, `web/api/test_amortization.py` ; Modify `Makefile`.

**Interfaces:** `schedule(balance, monthly_payment, annual_rate, max_months=600) -> dict` ; `payoff_month(start_month, payoff_months) -> str|None`.

- [ ] **Step 1: Test (échoue)**

```python
# web/api/test_amortization.py
import amortization as A

def test_standard_loan_pays_off():
    r = A.schedule(10000.0, 200.0, 0.05)
    assert r["never_amortizes"] is False
    assert r["payoff_months"] is not None and 55 <= r["payoff_months"] <= 60
    assert r["total_interest"] > 0
    assert abs(r["schedule"][-1]["balance"]) < 0.01           # soldé

def test_zero_rate():
    r = A.schedule(1000.0, 100.0, 0.0)
    assert r["payoff_months"] == 10 and r["total_interest"] == 0.0

def test_payment_too_low_never_amortizes():
    r = A.schedule(10000.0, 10.0, 0.05)                        # 10 < intérêt initial (~41.67)
    assert r["never_amortizes"] is True and r["payoff_months"] is None
    assert len(r["schedule"]) == 0

def test_payoff_month():
    assert A.payoff_month("2026-01", 5) == "2026-06"
    assert A.payoff_month("2026-01", None) is None

if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_amortization.py OK")
```

- [ ] **Step 2: Lancer → FAIL** (`cd web/api && python3 test_amortization.py`).

- [ ] **Step 3: Implémenter**

```python
# web/api/amortization.py
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
```

- [ ] **Step 4: Lancer → OK.**

- [ ] **Step 5: Wire `Makefile` `test-unit`** (après la dernière ligne `web/api`) : `\tcd web/api && python3 test_amortization.py`.

- [ ] **Step 6: `make test-unit` vert.**

- [ ] **Step 7: Commit** `feat(api): pure fixed-rate loan amortization (payoff + interest split)`.

---

### Task 2: Champ `rate` + endpoint `/api/loans`

**Files:** Modify `web/api/main.py`.

**Interfaces:** `RecurringCharge.rate` (nullable) ; `GET /api/loans`.

- [ ] **Step 1: Ajouter `rate` au modèle `RecurringCharge`** (après `remaining_balance`) :
```python
    rate: Optional[float] = Field(default=None, ge=0, le=1)
```

- [ ] **Step 2: Endpoint** (après `/api/categorization` ou près des autres GET ; `import amortization` en tête près de `import scores`) :
```python
@app.get("/api/loans")
def api_loans():
    cfg = load_cfg()
    out = []
    for c in cfg.get("dormant", {}).get("recurring_charges", []):
        if c.get("kind") != "loan" or not c.get("remaining_balance"):
            continue
        bal = c["remaining_balance"]
        pay = c.get("amount") or 0
        rate = c.get("rate")
        if rate is not None and pay > 0:
            s = amortization.schedule(bal, pay, rate)
            out.append({"name": c["name"], "balance": bal, "payment": pay, "rate": rate,
                        "payoff_month": amortization.payoff_month(c.get("start"), s["payoff_months"]),
                        "total_interest": s["total_interest"],
                        "never_amortizes": s["never_amortizes"], "needs_rate": False})
        else:
            out.append({"name": c["name"], "balance": bal, "payment": pay, "rate": rate,
                        "payoff_month": None, "total_interest": None,
                        "never_amortizes": False, "needs_rate": rate is None})
    return {"loans": out}
```

- [ ] **Step 3: Vérifier contre le stack** :
```bash
cd web/api && set -a && source ../../.env && set +a && ../../.venv/bin/python -c "import main; print(main.api_loans())"
```
Expected: `{'loans': []}` (aucun prêt saisi — attendu) ou une liste si des prêts existent. Pas d'exception. Coller dans le rapport.

- [ ] **Step 4: Test synthétique de l'endpoint** (prouver la branche non vide sans prêt réel) :
```bash
cd web/api && ../../.venv/bin/python -c "
import amortization as A
s=A.schedule(10000,200,0.05)
print('synthetic payoff_months', s['payoff_months'], 'interest', s['total_interest'])
assert s['payoff_months']
print('OK')"
```

- [ ] **Step 5: Commit** `feat(api): /api/loans amortization endpoint + rate field`.

---

### Task 3: UI — colonne taux + carte Prêts

**Files:** Modify `web/ui/src/lib/api.ts`, `web/ui/src/pages/Strategy.tsx`, `web/ui/src/pages/Dashboard.tsx`.

- [ ] **Step 1: api.ts — type + hook** (après les autres) :
```typescript
export interface LoanAmort {
  name: string; balance: number; payment: number; rate: number | null;
  payoff_month: string | null; total_interest: number | null;
  never_amortizes: boolean; needs_rate: boolean;
}
export const useLoans = () =>
  useQuery({ queryKey: ["loans"], queryFn: () => get<{ loans: LoanAmort[] }>("/api/loans") });
```

- [ ] **Step 2: Strategy.tsx — champ `rate` dans le ledger**
  - `Charge` interface : ajouter `rate: number | null`.
  - `toForm` charges map : `rate: c.rate ?? null,`.
  - `toPayload` charges map : `rate: c.rate,`.
  - bouton « + Ajouter » empty charge : `rate: null,`.
  - Grille : élargir le template d'une colonne ; ajouter après le champ `remaining_balance` :
```tsx
<Input type="number" step="0.001" placeholder="taux (0.045)" value={c.rate ?? ""}
  onChange={(e) => updCharge(i, { rate: e.target.value === "" ? null : (parseFloat(e.target.value) || 0) })} />
```
  (ajuster le `grid-cols-[...]` : +1 colonne ~90px.)

- [ ] **Step 3: Dashboard.tsx — carte « Prêts »**
  - `import { useLoans } from "@/lib/api";` + `const loans = useLoans();`.
  - Sous les cartes existantes :
```tsx
{loans.data && loans.data.loans.length > 0 && (
  <Card>
    <CardContent className="space-y-2 pt-6">
      <CardTitle>Prêts</CardTitle>
      {loans.data.loans.map((l) => (
        <div key={l.name} className="flex items-center justify-between text-sm">
          <span>{l.name}</span>
          <span className="text-muted-foreground">
            {eur(l.balance)}
            {l.needs_rate ? " · ajoute le taux dans Stratégies"
              : l.never_amortizes ? " · mensualité insuffisante"
              : ` · soldé ${l.payoff_month} · intérêts ${eur(l.total_interest ?? 0)}`}
          </span>
        </div>
      ))}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 4: `cd web/ui && npx tsc --noEmit` → clean.**

- [ ] **Step 5: Commit** `feat(ui): loan rate field + amortization Prêts card`.

---

## Notes

- Ordre 1→2→3. Task 1 offline/TDD. Task 2 stack. Task 3 tsc (visuel = humain).
- Aucun prêt réel saisi → sortie live vide ; capability + UI prêtes. À signaler dans le rapport (l'utilisateur doit saisir prêts kind=loan + remaining_balance + rate).
