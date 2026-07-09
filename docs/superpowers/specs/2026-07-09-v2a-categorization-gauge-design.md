# V2-A (feature 3) — Jauge de couverture de catégorisation — Design

**Date:** 2026-07-09
**Milestone:** V2-A (fiabiliser les chiffres) — 3ᵉ et dernière feature
**Statut:** validé, prêt pour plan d'implémentation

## Contexte

Data-integrity : montrer quelle part de la dépense n'est pas catégorisée dans
Firefly, et les plus grosses transactions non taggées à traiter. Chiffre unique
sur le **dernier mois complet** (le mois en cours a des données partielles, comme
partout dans le dashboard). La correction se fait dans Firefly ; Nora ne fait que
signaler.

Invariants : zéro LLM, déterministe.

## Composant 1 — cœur pur `web/api/categorization.py`

Aucune I/O réseau.

- `coverage(expense_by_cat) -> {"uncategorized", "total", "ratio"}`
  - `expense_by_cat` = `{category_name: montant}` (sortie de `_insight_by_category`).
  - `uncategorized` = `expense_by_cat.get("(sans catégorie)", 0)`.
  - `total` = somme de toutes les valeurs.
  - `ratio` = `uncategorized / total` si `total > 0`, sinon `0.0`. Arrondi 4 déc.
- `top_untagged(txs, n=5) -> list`
  - `txs` = `[{"date","amount","description","category"}]` (category = "" si non taggé).
  - garde ceux dont `category` est vide/None, trie par `amount` desc, renvoie les `n` premiers `{date, amount, description}`.

Self-check `web/api/test_categorization.py` (plain-assert, `make test-unit`).

## Composant 2 — endpoint `GET /api/categorization`

Lecture pure. `main.py`.

- Mois = `current_month()` (dernier complet) sauf `?month=` fourni.
- `expense_by_cat = fc._insight_by_category("expense", first_day, last_day)` — via
  `fc.month_bounds(month)`.
- `cov = categorization.coverage(expense_by_cat)`.
- Top untagged : nouveau fetcher `fc.untagged_withdrawals(month)` — retraits du mois
  (pagination, pattern `_all_transfers`/`withdrawals_since`) dont `category_name`
  est vide/None → `[{"date","amount","description","category":""}]` →
  `categorization.top_untagged(..., 5)`.
- Renvoie `{"month", "uncategorized": cov["uncategorized"], "total": cov["total"],
  "ratio": cov["ratio"], "top_untagged": [...]}`.

## Composant 3 — UI (Réglages)

- **api.ts** : type `Categorization` + hook `useCategorization()`.
- **Réglages** (`Settings.tsx`) : carte « Couverture de catégorisation » sous le
  panneau « Cohérence des données » (même famille data-integrity) :
  - ratio en évidence (`{pct(ratio)} non catégorisé` — `pct` existe déjà) + le
    montant (`{eur(uncategorized)} / {eur(total)}`).
  - petite barre de proportion (div CSS, largeur = ratio) — pas de lib chart pour
    une simple barre (native/CSS suffit).
  - liste des plus grosses tx non taggées : `date · description · montant`, ou
    « tout est catégorisé » si vide.
  - gère `ratio = 0` (barre vide + message positif).

## Tests (plain-assert, `make test-unit`)

`test_categorization.py` :
- `coverage` : ratio correct (uncat/total) ; `"(sans catégorie)"` absent → uncat 0 ;
  total 0 → ratio 0 (pas de division par zéro).
- `top_untagged` : ne garde que les non taggés, trie desc, respecte `n`, liste vide OK.

Endpoint + fetcher : vérif manuelle contre le stack (dans le plan).

## Hors scope

- Catégorisation/édition depuis Nora (se fait dans Firefly).
- Tendance multi-mois (single mois suffit pour une jauge d'intégrité).
- Suggestions automatiques de catégorie (hors périmètre, pas de LLM).

## Invariants

- Zéro LLM ; déterministe ; cœur pur sans I/O.
- Réutilise `_insight_by_category`, `month_bounds`, le pattern de pagination,
  `pct`/`eur`, la page Réglages existante.
- Commits `--no-gpg-sign`, sans attribution IA.
