# V2-A Jauge de couverture de catégorisation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montrer la part de dépense non catégorisée du dernier mois complet + les plus grosses transactions non taggées, dans Réglages.

**Architecture:** Cœur pur `categorization.py` (ratio + top-N, testable) ← endpoint lecture-seule + fetcher paginé ← tuile UI dans Réglages.

**Tech Stack:** Python 3 stdlib, FastAPI, React + TS (CSS pour la barre, pas de lib chart).

## Global Constraints

- Zéro LLM ; déterministe ; cœur pur sans I/O.
- Mois = dernier mois complet (`current_month()`) sauf `?month=`.
- Réutilise `_insight_by_category`, `month_bounds`, le pattern de pagination `_all_transfers`, `pct`/`eur`, la page Réglages.
- Tests = self-checks plain-assert (style `test_forecast.py`), dans `make test-unit`.
- Commits `git commit --no-gpg-sign`, sans attribution IA.

---

### Task 1: Cœur pur `categorization.py` (TDD)

**Files:**
- Create: `web/api/categorization.py`
- Test: `web/api/test_categorization.py`
- Modify: `Makefile` (cible `test-unit`)

**Interfaces:**
- Produces: `coverage(expense_by_cat) -> {"uncategorized","total","ratio"}` ;
  `top_untagged(txs, n=5) -> list[{"date","amount","description"}]`.

- [ ] **Step 1: Écrire le test qui échoue**

```python
# web/api/test_categorization.py
import categorization as C


def test_coverage_ratio():
    cov = C.coverage({"Courses": 600.0, "(sans catégorie)": 200.0, "Loyer": 200.0})
    assert cov["uncategorized"] == 200.0
    assert cov["total"] == 1000.0
    assert cov["ratio"] == 0.2


def test_coverage_none_uncategorized():
    cov = C.coverage({"Courses": 500.0})
    assert cov["uncategorized"] == 0.0 and cov["ratio"] == 0.0


def test_coverage_zero_total_no_div():
    cov = C.coverage({})
    assert cov["total"] == 0.0 and cov["ratio"] == 0.0


def test_top_untagged_sorts_and_limits():
    txs = [
        {"date": "2026-06-02", "amount": 10.0, "description": "a", "category": ""},
        {"date": "2026-06-03", "amount": 90.0, "description": "b", "category": ""},
        {"date": "2026-06-04", "amount": 50.0, "description": "c", "category": "Courses"},
        {"date": "2026-06-05", "amount": 30.0, "description": "d", "category": None},
    ]
    top = C.top_untagged(txs, 2)
    assert [t["amount"] for t in top] == [90.0, 30.0]      # tagged 'c' exclu, trié desc, limité
    assert top[0] == {"date": "2026-06-03", "amount": 90.0, "description": "b"}


def test_top_untagged_empty():
    assert C.top_untagged([], 5) == []


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_categorization.py OK")
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `cd web/api && python3 test_categorization.py`
Expected: FAIL — `ModuleNotFoundError: categorization`.

- [ ] **Step 3: Implémenter categorization.py**

```python
# web/api/categorization.py
"""Jauge data-integrity : part de la dépense non catégorisée + plus grosses tx
non taggées. Cœur pur, aucune I/O."""

UNCATEGORIZED = "(sans catégorie)"


def coverage(expense_by_cat):
    total = round(sum(expense_by_cat.values()), 2)
    uncategorized = round(expense_by_cat.get(UNCATEGORIZED, 0.0), 2)
    ratio = round(uncategorized / total, 4) if total > 0 else 0.0
    return {"uncategorized": uncategorized, "total": total, "ratio": ratio}


def top_untagged(txs, n=5):
    untagged = [t for t in txs if not (t.get("category") or "")]
    untagged.sort(key=lambda t: t["amount"], reverse=True)
    return [{"date": t["date"], "amount": t["amount"], "description": t["description"]}
            for t in untagged[:n]]
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `cd web/api && python3 test_categorization.py`
Expected: `test_categorization.py OK`.

- [ ] **Step 5: Wire dans test-unit**

Dans `Makefile`, cible `test-unit`, après `python3 test_snapshots.py` (ou la dernière ligne `web/api` présente) :
```makefile
	cd web/api && python3 test_categorization.py
```

- [ ] **Step 6: `make test-unit`** → tout vert.

- [ ] **Step 7: Commit**

```bash
git add web/api/categorization.py web/api/test_categorization.py Makefile
git commit --no-gpg-sign -m "feat(api): pure categorization-coverage core (ratio + top untagged)"
```

---

### Task 2: Fetcher untagged + endpoint `/api/categorization`

**Files:**
- Modify: `web/api/firefly_client.py` (`untagged_withdrawals`)
- Modify: `web/api/main.py` (endpoint)

**Interfaces:**
- Consumes: `categorization.coverage/top_untagged` (Task 1), `fc._insight_by_category`, `fc.month_bounds`.
- Produces: `fc.untagged_withdrawals(month) -> list[{"date","amount","description","category"}]` ; `GET /api/categorization?month=`.

- [ ] **Step 1: Ajouter le fetcher dans firefly_client.py**

Modèle = `withdrawals_since` / `_all_transfers`. Ajouter :
```python
def untagged_withdrawals(month):
    """Retraits du mois SANS catégorie (paginés). category vide → non taggé."""
    first, last, _ = month_bounds(month)
    out, page = [], 1
    while True:
        data = api_get("/transactions", {
            "type": "withdrawal", "limit": 200, "page": page,
            "start": first.isoformat(), "end": last.isoformat(),
        })
        for g in data.get("data", []):
            for t in g["attributes"]["transactions"]:
                if (t.get("category_name") or ""):
                    continue  # déjà taggé
                amt = abs(float(t["amount"]))
                if amt == 0:
                    continue
                out.append({"date": t["date"][:10], "amount": amt,
                            "description": t.get("description") or "", "category": ""})
        pag = data.get("meta", {}).get("pagination", {})
        if page >= pag.get("total_pages", page):
            break
        page += 1
    return out
```

- [ ] **Step 2: Vérifier le fetcher contre le stack**

```bash
cd web/api && set -a && source ../../.env && set +a && \
../../.venv/bin/python -c "import firefly_client as fc; import main; m=main.current_month(); w=fc.untagged_withdrawals(m); print(m, len(w), 'untagged'); print(w[:2])"
```
Expected: le mois + un nombre + des dicts `{date,amount,description,category:""}`. Pas d'exception. Coller dans le rapport.

- [ ] **Step 3: Ajouter l'endpoint dans main.py**

Import en tête (près de `import scores`) : `import categorization`.
Après l'endpoint `/api/recurrences/detected` :
```python
@app.get("/api/categorization")
def api_categorization(month: str | None = None):
    month = month or current_month()
    first, last, _ = fc.month_bounds(month)
    cov = categorization.coverage(fc._insight_by_category("expense", first, last))
    top = categorization.top_untagged(fc.untagged_withdrawals(month), 5)
    return {"month": month, **cov, "top_untagged": top}
```

- [ ] **Step 4: Vérifier l'endpoint contre le stack**

```bash
cd web/api && set -a && source ../../.env && set +a && \
../../.venv/bin/python -c "import main; import json; print(json.dumps(main.api_categorization(), ensure_ascii=False, indent=2)[:600])"
```
Expected: `{month, uncategorized, total, ratio, top_untagged:[...]}`, ratio ∈ [0,1]. Pas d'exception. Coller dans le rapport.

- [ ] **Step 5: Commit**

```bash
git add web/api/firefly_client.py web/api/main.py
git commit --no-gpg-sign -m "feat(api): /api/categorization (coverage ratio + top untagged withdrawals)"
```

---

### Task 3: Tuile UI dans Réglages

**Files:**
- Modify: `web/ui/src/lib/api.ts` (type + hook)
- Modify: `web/ui/src/pages/Settings.tsx` (carte)

**Interfaces:**
- Consumes: `GET /api/categorization` (Task 2).
- Produces: `useCategorization()` ; type `Categorization`.

- [ ] **Step 1: Type + hook dans api.ts**

Après `useImportStatus` (ou près des autres hooks) :
```typescript
export interface UntaggedTx { date: string; amount: number; description: string }
export interface Categorization {
  month: string; uncategorized: number; total: number; ratio: number;
  top_untagged: UntaggedTx[];
}
export const useCategorization = () =>
  useQuery({ queryKey: ["categorization"], queryFn: () => get<Categorization>("/api/categorization") });
```

- [ ] **Step 2: Câbler + carte dans Settings.tsx**

Imports : ajouter `useCategorization` à l'import `@/lib/api` ; s'assurer que `pct` est importé de `@/lib/utils` (ajouter si absent — `eur` l'est déjà).
Dans le composant, près de `const health = useHealth();` : `const cat = useCategorization();`.
Insérer cette carte après la carte « Cohérence des données » :
```tsx
{cat.data && (
  <Card>
    <CardContent className="space-y-3 pt-6">
      <CardTitle>Couverture de catégorisation</CardTitle>
      <p className="text-xs text-muted-foreground">
        Part de la dépense sans catégorie sur {cat.data.month}. À corriger dans Firefly.
      </p>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold">{pct(cat.data.ratio)}</span>
        <span className="text-sm text-muted-foreground">
          {eur(cat.data.uncategorized)} / {eur(cat.data.total)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className="h-2 rounded-full bg-danger" style={{ width: `${Math.min(cat.data.ratio * 100, 100)}%` }} />
      </div>
      {cat.data.top_untagged.length === 0 ? (
        <p className="text-sm text-success">Tout est catégorisé ✓</p>
      ) : (
        <div className="space-y-1">
          {cat.data.top_untagged.map((t, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="truncate text-muted-foreground">{t.date} · {t.description}</span>
              <span>{eur(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Vérifier le build TS**

Run: `cd web/ui && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Vérifier visuellement (humain)**

Run: `make dev` → Réglages. Expected : carte « Couverture de catégorisation » avec ratio, barre, top tx non taggées (ou « Tout est catégorisé »).

- [ ] **Step 5: Commit**

```bash
git add web/ui/src/lib/api.ts web/ui/src/pages/Settings.tsx
git commit --no-gpg-sign -m "feat(ui): categorization-coverage gauge in Réglages"
```

---

## Notes d'exécution

- Ordre : 1 → 2 → 3. Task 1 offline/TDD. Task 2 vérif stack + `.venv`. Task 3 tsc (clic visuel = humain).
- Après tout : `make test` vert.
- Feature indépendante des snapshots (fichiers disjoints) → merge sans conflit quelle que soit l'ordre des PRs.
