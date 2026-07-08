# V2-A (feature 2) — Store de snapshots mensuels — Design

**Date:** 2026-07-08
**Milestone:** V2-A (fiabiliser les chiffres) — 2ᵉ des 3 features
**Statut:** validé, prêt pour plan d'implémentation

## Contexte

V1 ne fait que rétro-remplir la tendance d'épargne depuis `/summary` ; les poids
cash-basis (buckets/crypto) ne sont fiables qu'**en avant** depuis le 1er run. Ce
store append-only capture, mois par mois, une photo des métriques clés → vraies
tendances dans la durée, et fondation des alertes de dérive V2-B.

Invariants : zéro LLM, déterministe, `data/` gitignoré (PII).

## Composant 1 — cœur pur `web/api/snapshots.py`

Aucune I/O réseau ; seulement lecture/écriture d'un fichier JSON local.

- `build_snapshot(month, nw, summ, pf, dormant_score, invested_score) -> dict` —
  assemble depuis des valeurs déjà calculées (injectées), champs :
  `{"month","net_worth"(nw net de dette),"net_worth_gross"(actifs),"debt",
    "dormant_cash","invested_cost","savings_rate","dormant_score",
    "invested_score"(nullable),"bucket_weights","crypto_weight",
    "captured_at","backfilled":False}`.
- `backfill_snapshot(month, net_worth, savings_rate) -> dict` — version réduite :
  seuls `net_worth` + `savings_rate` fiables en arrière ; `dormant_score`,
  `invested_score`, `bucket_weights`, `crypto_weight` = `None` ; `backfilled:True`.
- `upsert(store, snap) -> store` — `store` = dict `{month: snap}` ; remplace ou
  ajoute par `snap["month"]`.
- `load(path) -> dict` (fichier absent → `{}`) ; `dump(path, store)` (écrit le
  fichier entier, JSON indenté).
- `to_series(store) -> list` — snapshots triés par mois croissant.
- `captured_at` : passé en argument (déterministe/testable), pas `datetime.now()`
  interne.

Self-check `web/api/test_snapshots.py` (plain-assert, `make test-unit`).

## Composant 2 — script de capture `scripts/capture-snapshot.py`

Headless (ne dépend pas du web API tournant). Réutilise la couche données.

- Ajoute `web/api` au `sys.path`, importe `firefly_client as fc`, `scores`,
  `snapshots as S` ; charge `config/strategy.yaml` (yaml).
- **Mois capturé = dernier mois complet** : `fc._shift_month(fc._now_month(), 1)`
  (le mois en cours a des données partielles — même raison que `current_month`
  côté API).
- Calcule via `fc.networth(cfg)`, `fc.summary(month, cfg)`, `fc.portfolio(cfg)`,
  `scores.dormant_health(...)`, `scores.invested_health(...)` (mêmes appels que
  l'endpoint `/api/scores`) → `S.build_snapshot(...)` → `S.upsert` →
  `S.dump(DATA_DIR/"snapshots.json", store)`.
- **Limite du backfill (connue) :** `networth(on_date=…)` prend les soldes
  d'actifs à la date, mais la **dette** vient du ledger `remaining_balance`
  (sans dimension temporelle) → elle est soustraite au niveau *actuel* pour tous
  les mois passés. Pendant qu'un prêt se rembourse, les points de valeur nette
  rétro-remplis sont donc légèrement surévalués (trop peu de dette retranchée).
  Acceptable pour la *forme* de la tendance ; les points en avant sont exacts.
- Option `--backfill N` : pour chacun des N derniers mois complets, calcule
  `net_worth = fc.networth(cfg, on_date=<fin de mois>)["net_of_debt"]` et
  `savings_rate = fc.summary(month, cfg)["savings_rate"]` → `S.backfill_snapshot`
  → upsert (n'écrase pas un mois déjà capturé en avant : ne backfill que les mois
  absents du store).
- Idempotent (upsert par mois). Chemin `data/` = `REPO_ROOT/data`.

## Composant 3 — timer systemd (mensuel)

- `scripts/systemd/nora-snapshot.service` : `ExecStart=__PROJECT_DIR__/.venv/bin/python __PROJECT_DIR__/scripts/capture-snapshot.py`
  (substitution `__PROJECT_DIR__` à l'install, comme `firefly-autosync.service`).
- `scripts/systemd/nora-snapshot.timer` : `OnCalendar=*-*-01 06:00:00`,
  `Persistent=true`, `WantedBy=timers.target`.
- Doc d'install ajoutée à `scripts/systemd/README.md` (dont un premier run manuel
  `--backfill 12` documenté).

## Composant 4 — endpoint + UI

- **Endpoint** `GET /api/snapshots` (`main.py`) : `S.to_series(S.load(DATA_DIR/"snapshots.json"))`
  → `{"snapshots": [...]}`. Lecture pure. `DATA_DIR` existe déjà dans `main.py`.
- **api.ts** : type `Snapshot` + hook `useSnapshots()`.
- **charts.tsx** : `NetWorthChart({ snapshots })` — `LineChart` (déjà enregistré),
  trace `net_worth` par mois. Modèle = `SavingsTrendChart`. < 2 points →
  la page affiche « pas encore d'historique ».
- **Dashboard (Aujourd'hui)** : carte « Valeur nette dans le temps » sous le
  `RunwayChart`. Les points `backfilled` sont tracés normalement (net worth
  fiable en arrière).

## Tests (plain-assert, `make test-unit`)

`test_snapshots.py` :
- `build_snapshot` : champs corrects ; `invested_score=None` accepté.
- `backfill_snapshot` : seuls net_worth+savings_rate remplis, le reste `None`,
  `backfilled=True`.
- `upsert` : remplace le même mois (pas de doublon), ajoute un mois nouveau.
- `to_series` : tri par mois croissant.
- `load` fichier absent → `{}`.

Capture script + endpoint : vérif manuelle contre le stack (dans le plan).

## Hors scope

- Alertes de dérive / cash-drag (V2-B) — le store les alimentera.
- Courbes des scores / poids buckets dans le temps (capturés, mais on ne trace
  que la VN maintenant).
- Migration/versionning du format snapshot (YAGNI ; champ ajouté = null pour les
  anciens).

## Invariants

- Zéro LLM ; déterministe ; `captured_at` injecté (pas d'horloge interne au cœur pur).
- `data/snapshots.json` gitignoré (déjà couvert par `data/` dans `.gitignore`).
- Réutilise `firefly_client`, `scores`, `LineChart`, le pattern systemd existant.
- Commits `--no-gpg-sign`, sans attribution IA.
