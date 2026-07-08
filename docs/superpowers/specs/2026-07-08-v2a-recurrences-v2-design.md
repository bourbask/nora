# V2-A (feature 1, itération 2) — Récurrences : refuse + actualité + tri/annuel — Design

**Date:** 2026-07-08
**Milestone:** V2-A — enrichit l'auto-détection livrée (merge 2dfd797)
**Statut:** validé, prêt pour plan d'implémentation

## Contexte

L'auto-détection des récurrences (mensuel only, propose-à-confirmer) est livrée.
Trois évolutions demandées :
1. **Bouton « Refuser »** — écarter durablement un candidat reconnu comme faux ou
   plus d'actualité.
2. **Filtre d'actualité** — ne proposer que les récurrences encore vivantes, en
   comparant la date des occurrences à aujourd'hui.
3. **Étendre aux schémas trimestriel et annuel** — détection + prise en compte
   réelle dans le runway.

Invariants maintenus : zéro LLM, détection déterministe, confidentialité.

## Composant 1 — détection étendue (`web/api/recurrences.py`, pur)

**Signature :** `detect_recurrences(withdrawals, existing_names, today, dismissed=())`
- `today`: `datetime.date` — date de référence (injectée → testable ; l'endpoint
  passe `date.today()`).
- `dismissed`: itérable de noms refusés, exclus exactement comme `existing_names`.

**Classification par médiane des écarts (jours) entre jours d'occurrence distincts :**

| freq | médiane ∈ | bande d'un écart | part min en bande | min occ. |
|---|---|---|---|---|
| `monthly`   | 26–35   | 20–40   | 60 % | 3 |
| `quarterly` | 80–100  | 75–105  | 60 % | 3 |
| `yearly`    | 330–400 | 320–410 | 60 % | 2 |
| sinon | — | — | — | rejeté |

**Filtre d'actualité (après classification) — `latest` = dernière occurrence :**
- **monthly** : `months_between(latest, today) <= 2`. Sinon → périmée, écartée.
- **quarterly** : `months_between(latest, today) <= 4`. Sinon écartée.
- **yearly** : (a) **toutes** les occurrences tombent le même mois calendaire
  (`{d.month for d in days}` de cardinalité 1) — sinon dépense ponctuelle éparse,
  rejetée ; (b) `months_between(latest, today) <= 14`. Sinon écartée.

`months_between(a, b) = (b.year-a.year)*12 + (b.month-a.month)`.

**Sortie (par candidat)** — inchangée sauf `freq` désormais
`monthly|quarterly|yearly` :
`{"name","amount"(médiane),"freq","start"(YYYY-MM 1ʳᵉ occ),"end":None,"kind":"other","count","confidence"}`.
Montant jamais un critère de rejet ; `confidence` = high si écart max/médian ≤ 15 %.
Tri : confidence high d'abord, puis amount desc.

## Composant 2 — refuse durable (persistance + endpoint + exclusion)

- **Champ config :** `dormant.dismissed_recurrences: [name, …]` dans `strategy.yaml`.
- **Endpoint :** `POST /api/recurrences/dismiss` body `{"name": str}` → `load_cfg`,
  append le nom à `dormant.dismissed_recurrences` (dédup), réécrit `strategy.yaml`
  (même mécanisme d'écriture que `PUT /api/strategy`), renvoie `{"ok": true}`.
  Écriture ciblée, déterministe, déclenchée par une action explicite. Zéro LLM.
- **Exclusion :** `/api/recurrences/detected` passe `existing_names`,
  `today=date.today()`, et `dismissed=dormant.dismissed_recurrences` à
  `detect_recurrences` (qui exclut un nom présent dans l'un OU l'autre).
- **Préservation :** `PUT /api/strategy` ne touche pas `dismissed_recurrences`
  (il ne réécrit que les clés de son modèle) → le champ survit aux sauvegardes du
  ledger. À vérifier explicitement (test/inspection).

## Composant 3 — forecast non-mensuel (`web/api/forecast.py`, pur)

**`_active(charge, month)`** impute le montant **plein** uniquement sur les mois
d'échéance, phase calée sur `start` :
- `monthly` → tout mois de `[start, end]` (comportement actuel).
- `quarterly` → mois où `(idx(month) - idx(start)) % 3 == 0`.
- `yearly` → mois où `(idx(month) - idx(start)) % 12 == 0`.
- freq non-mensuel **sans `start`** → inactif (phase inconnue).
- borne `[start, end]` respectée pour tous.

`idx("YYYY-MM") = y*12 + (m-1)` (même arithmétique que `month_add`).
→ le runway montre le pic trimestriel/annuel au bon mois, 0 sinon.

**Approximation acceptée :** `variable_typical` soustrait les obligations actives
du mois de réf ; hors mois d'échéance, une charge tri/annuelle peut être légèrement
lissée dans la dépense médiane. Le module se déclare déjà macro ±tolérance — pas
de sur-conception.

## Composant 4 — validation + UI

- **Modèle :** `RecurringCharge.freq` → `Literal["monthly","quarterly","yearly"]`
  (défaut `"monthly"`) dans `web/api/main.py`. Rejette tout autre freq.
- **Ledger UI (`web/ui/src/pages/Strategy.tsx`) — correctif nécessaire :** le
  formulaire force `freq:"monthly"` au save → un candidat tri/annuel « Ajouté »
  serait rétrogradé. Fix :
  - ajouter `freq` à l'état `Charge` du formulaire (défaut `"monthly"`) ;
  - une colonne **freq** (select `monthly|quarterly|yearly`) par ligne de charge ;
  - `toForm` lit `c.freq`, `toPayload` renvoie `c.freq` (au lieu du littéral) ;
  - `addDetected` renseigne `freq: candidate.freq`.
- **Bouton « Refuser » :** à côté de « Ajouter » dans la section « Récurrences
  détectées ». Type `DetectedRecurrence` gagne rien (freq déjà là). Hook
  `useDismissRecurrence()` (mutation POST) → `onSuccess` invalide
  `["recurrences-detected"]` → le candidat disparaît. La ligne affiche aussi la
  cadence (monthly/quarterly/yearly).

## Tests (self-checks plain-assert, `make test-unit`)

`test_recurrences.py` (étendre) :
- monthly récent (latest = mois précédent) → gardé ; monthly dont latest > 2 mois → écarté.
- quarterly (~90 j, 3+ occ, latest récent) → `quarterly` ; latest > 4 mois → écarté.
- yearly même mois sur 2 ans → `yearly` ; occurrences de mois différents → rejeté ;
  yearly latest > 14 mois → écarté.
- `dismissed` exclut un nom comme `existing_names`.

`test_forecast.py` (étendre) :
- charge quarterly active seulement aux mois `start, start+3, …` (0 sinon).
- charge yearly active seulement au mois anniversaire.
- charge non-monthly sans `start` → inactive.
- monthly inchangé (régression).

## Hors scope

- UI d'annulation d'un refus (éditer le yaml suffit — YAGNI).
- Devinette de `kind` (loan/tax) — l'utilisateur choisit.
- Normalisation floue des libellés marchands (fragmentation) — knob futur.
- Détection semestrielle ou cadences exotiques — non demandées.

## Invariants

- Zéro LLM ; tout déterministe.
- Détection pure (I/O seulement dans le fetcher/endpoint).
- Réutiliser l'écriture yaml existante, le ledger form existant.
- Commits `--no-gpg-sign`, sans attribution IA.
