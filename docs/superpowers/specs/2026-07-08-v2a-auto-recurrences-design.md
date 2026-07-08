# V2-A (feature 1) — Auto-détection des récurrences — Design

**Date:** 2026-07-08
**Milestone:** V2-A (réduire la saisie + fiabiliser les chiffres) — 1ʳᵉ des 3 features
**Statut:** validé, prêt pour plan d'implémentation

## Contexte

La friction #1 restante après V1 : `config/strategy.yaml` a des obligations non
datées → le runway ne montre pas le creux tant que l'utilisateur ne saisit pas ses
charges datées à la main. Cette feature est la **moitié « auto » du modèle
hybride** : dériver les récurrences de l'historique et les **proposer à
confirmer**, pour amorcer le ledger sans saisie intégrale.

Zéro LLM (invariant). Détection 100 % déterministe.

### Donnée réelle observée (historique importé 2026-07-08)

Deux familles de retraits :
- **Prélèvements / virements** : payee propre (`destination_name = "SFR"`,
  `description = "Prélèvement: SFR"`, `category_name = "Prélèvements"`). **Ce sont
  les vraies charges récurrentes** (abos, assurances, prêts, télécom).
- **Paiements carte** : `destination_name` = marchand + ville, très variable
  (`"SUPER U 29 GUIPAVAS"`). Dépense variable, **pas** une obligation → bruit.

Décision de conception directe : détecter **uniquement parmi les
prélèvements/virements**. Haute précision, et `destination_name` y est déjà propre
→ pas de normalisation de libellé marchand à écrire.

## Composant 1 — cœur pur `detect_recurrences`

**Fichier :** nouveau `web/api/recurrences.py` (pur, aucune I/O réseau).

**Signature :**
```python
def detect_recurrences(withdrawals, existing_names, ref_month, window_months=12):
    # withdrawals: list[dict] déjà filtrés/fetchés par l'appelant, chaque item =
    #   {"date": "YYYY-MM-DD", "amount": float>0, "payee": str}
    # existing_names: set[str] — noms déjà dans recurring_charges (à exclure)
    # ref_month: "YYYY-MM" (mois de référence, borne haute de la fenêtre)
    # -> list[dict] candidats triés par confidence desc puis amount desc :
    #   {"name","amount","freq","start","end","kind","count","confidence"}
```

**Règles de détection :**
1. Grouper par `payee`.
2. Un groupe est candidat si **≥ 3 occurrences** dans la fenêtre.
3. Montant : `amount` = médiane des montants du groupe ; rejeter si l'écart
   max au médian > **10 %** (montant instable = pas une charge fixe).
4. Cadence depuis les écarts (jours) médians entre occurrences consécutives :
   - 26–35 j → `freq = "monthly"` (garder)
   - sinon → **rejeter**. `forecast.py` V1 ne consomme QUE `freq == "monthly"`
     (ligne 17 : `active_obligations` skippe tout le reste) ; proposer du
     trimestriel/annuel amorcerait des charges que le runway ignore en silence.
     Non-mensuel = déféré avec le support non-mensuel du forecast (V2+).
5. `start` = mois (`YYYY-MM`) de la 1ʳᵉ occurrence ; `end = null` ;
   `kind = "other"` (l'utilisateur choisit à la confirmation).
6. Exclure tout candidat dont `name` ∈ `existing_names`.
7. `confidence` : `"high"` si écart montant ≤ 5 % ; sinon `"medium"`.
   (Tous les candidats sont mensuels — cf. règle 4.)

**Valeurs sorties compatibles** avec le modèle `RecurringCharge`
(`main.py`) : `name:str`, `amount:float≥0`, `freq:str`, `start:YYYY-MM`,
`end:null`, `kind∈{loan,tax,insurance,rent,subscription,other}`.

## Composant 2 — endpoint `GET /api/recurrences/detected`

**Fichier :** `web/api/main.py` (nouvel endpoint) + fetcher dans
`web/api/firefly_client.py`.

- Fetcher `recurring_withdrawals(window_months=12)` dans `firefly_client.py` :
  withdrawals paginés (réutilise le pattern de `_all_transfers` :
  `/transactions?type=withdrawal&limit=200&page=`), gardés seulement si
  `category_name == "Prélèvements"` OU `description` commence par `Prélèvement:`
  / `Virement:`. Retourne `[{"date","amount"(float>0),"payee"(destination_name)}]`.
- Endpoint : lit `recurring_charges` du config (→ `existing_names`), fetch, appelle
  `recurrences.detect_recurrences(...)`, renvoie `{"candidates": [...]}`.
- **Lecture pure. Aucune écriture** dans strategy.yaml.

## Composant 3 — UI (Stratégies)

**Fichiers :** `web/ui/src/lib/api.ts` (type + hook), page Stratégies (section).

- `useDetectedRecurrences()` → `GET /api/recurrences/detected`.
- Section « Récurrences détectées » sous le ledger existant. Une ligne par
  candidat : payee · montant · cadence · « vu N× depuis {start} » · pastille
  confidence · bouton **« Ajouter »**.
- Clic « Ajouter » → **pré-remplit une nouvelle ligne dans le ledger éditable
  existant** (name/amount/freq/start remplis ; kind par défaut `other` à ajuster ;
  end/remaining_balance vides). L'utilisateur ajuste puis **sauvegarde via le
  `PUT /api/strategy` existant**.
- **Rien n'est écrit sans le clic + la sauvegarde.** Un candidat déjà présent
  dans le ledger (par name) n'apparaît pas (exclu côté backend).

**Réutilisation :** le formulaire d'édition de charge du ledger V1 existe déjà —
le bouton ne fait que le pré-remplir, aucun nouveau form.

## Tests (self-checks plain-assert, `make test-unit`)

`web/api/test_recurrences.py` :
- groupe mensuel régulier stable → 1 candidat `monthly`, `high`.
- montant instable (> 10 %) → rejeté.
- < 3 occurrences → rejeté.
- cadence irrégulière (écarts hors 26–35 j) → rejetée.
- cadence trimestrielle (~90 j) → rejetée (non-mensuel non consommé par le runway V1).
- `name` ∈ existing_names → exclu.

Pas de framework. Style `test_forecast.py`.

## Hors scope (explicite)

- Détection sur paiements carte / dépense variable — bruit, exclu.
- Devinette de `kind` par mots-clés — l'utilisateur choisit.
- Devinette de `end` / `remaining_balance` — saisie manuelle (prêts bornés).
- Écriture auto dans strategy.yaml — le modèle est *proposer à confirmer*.
- Détection des revenus récurrents (salaire) — hors périmètre (ledger = charges).
- Store de snapshots, jauge de catégorisation — autres features V2-A, specs à part.

## Invariants

- Zéro LLM ; détection déterministe.
- Confidentialité : payees/montants restent locaux (data), rien dans le repo.
- Réutiliser avant d'écrire (`_all_transfers` pattern, ledger form, `PUT /strategy`).
- Commits `--no-gpg-sign`, sans attribution IA.
