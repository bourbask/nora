# Règles de gestion financière — référentiel NORA

Ce document est le **référentiel de conseil** qui pilote l'outil : les seuils de
`config/strategy.yaml` et les *health scores* de l'interface découlent de ces règles.
Contenu **générique** (conseil général) — les chiffres personnels et objectifs
vivent dans `docs-local/diagnostic.md` (non publié).

> Ce n'est pas du conseil en investissement réglementé. C'est un cadre de bon sens
> pour un particulier qui gère lui-même son épargne.

Deux poches distinctes, deux logiques :
- **Argent dormant** — sécurité et court terme (comptes courants + livrets).
- **Argent investi** — préparation de l'avenir, rendement long terme (Bourse/ETF/crypto).

---

## A. Fondations (l'ordre des priorités)

1. **Matelas de sécurité AVANT tout risque.** 3 à 6 mois de dépenses courantes sur
   support liquide et garanti (Livret A). Revenu unique → viser le haut (**6 mois**).
   Tant que le matelas n'est pas plein, ne pas augmenter la poche risquée.
2. **Poids du logement = premier diagnostic.** Si loyer + charges > **33 % du revenu
   net**, c'est le levier n°1. Aucune optimisation d'épargne ne compense un logement
   trop lourd — les vrais leviers sont : renégociation, colocation, aides (APL),
   déménagement, ou hausse de revenu.
3. **Se payer soi-même d'abord.** Virement automatique vers épargne/investissement
   le jour de la paie ; on vit sur le reste, pas l'inverse.
4. **Taux d'épargne cible : 20 %** du revenu net. On mesure le taux réel et on le
   compare à la cible.

## B. Argent dormant (sécurité + court terme)

5. **Hiérarchie de liquidité.** Compte courant ≈ 1 mois de charges (buffer), pas plus.
   Le surplus part sur des livrets rémunérés. L'argent qui dort sur le courant est une
   perte silencieuse face à l'inflation = *cash-drag*.
6. **Remplir les enveloppes garanties.** Livret A, puis LEP si éligible (taux
   supérieur), puis fonds euros d'assurance-vie pour l'horizon moyen. Respecter les
   plafonds réglementaires.
7. **Objectif à moins de 2-3 ans = jamais en Bourse.** Un achat prévu à court terme
   reste en liquide/monétaire, pas exposé à la volatilité.

## C. Argent investi (long terme)

8. **Horizon = niveau de risque.** Argent inutile avant 8-10 ans → actions/ETF.
   Sinon → dormant.
9. **Cœur diversifié.** Un ETF World (MSCI World / All-World) comme socle. Éviter la
   sur-concentration sur quelques titres vifs.
10. **DCA plutôt que market timing.** Investissement programmé régulier > tenter de
    deviner le marché.
11. **Enveloppes fiscales dans le bon ordre.** PEA en priorité pour les actions/ETF
    éligibles UE (exonération après 5 ans) ; assurance-vie pour fonds euros et
    transmission ; CTO pour le reste (US, ETF non éligibles PEA).
12. **Allocation Core-Satellite par buckets de risque.** *Core* ETF large cap = low
    risk (70-80 %) ; *Satellite* titres/thématiques = mid ; *poche spéculative* =
    high risk (5-10 % max, « argent qu'on accepte de perdre »).
13. **Plafonner la crypto** à 5-10 % de la poche investie. Volatilité extrême ; jamais
    dans le matelas de sécurité.
14. **Minimiser les frais.** ETF à faible TER, courtage réduit. Les frais composent
    contre soi sur 20 ans.
15. **Rééquilibrer sobrement.** Revenir aux cibles d'allocation 1-2×/an, ou sur seuil
    de dérive — pas à chaque soubresaut du marché.
16. **Buy & hold, pas de vente panique.** Dividendes réinvestis.

## D. Discipline

17. Ne pas consulter tous les jours ; automatiser.
18. Rembourser toute dette plus chère que le rendement attendu avant d'investir.
19. Éviter levier et produits qu'on ne comprend pas — **pour l'instant**. L'objectif à
    terme est que l'outil *éduque* : un advisor IA expliquera chaque produit/stratégie
    pour élargir le champ en connaissance de cause. Passer de « éviter ce qu'on ne
    comprend pas » à « comprendre pour décider ».
20. Revue mensuelle légère + revue annuelle stratégique.

---

## Traçabilité règle → score (ce que l'interface mesure)

| Score | Règles | Mesure |
|---|---|---|
| **Cushion coverage** | R1, R6 | mois de dépenses couverts par le dormant / cible |
| **Cash-drag** | R5 | pénalité sur le cash oisif au-delà du matelas + buffer |
| **Savings rate** | R4 | taux d'épargne réel / cible |
| **Diversification (HHI)** | R9, R12 | nombre effectif de lignes (1/HHI) / cible |
| **Class alignment** | R12, R15 | écart allocation réelle vs buckets cibles (high/mid/low) |
| **Crypto cap** | R13 | dépassement du plafond crypto |

Les cibles chiffrées (nombre de mois de matelas, taux cible, buckets, plafond crypto)
sont paramétrées dans `config/strategy.yaml` et éditables depuis l'onglet Stratégies.
