import { StatTile } from "@/components/StatTile";
import { ScoreCard } from "@/components/ScoreCard";
import { GuardrailBanner } from "@/components/GuardrailBanner";
import { RunwayChart, NetWorthChart } from "@/components/charts";
import {
  useNetWorth, useSummary, useExpenseCategories, useScores,
  useGuardrail, useRunway, useRemaining, useHousing, useSnapshots,
} from "@/lib/api";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { eur, pct } from "@/lib/utils";

export function Dashboard() {
  const nw = useNetWorth();
  const sum = useSummary();
  const exp = useExpenseCategories();
  const scores = useScores();
  const guardrail = useGuardrail();
  const runway = useRunway();
  const remaining = useRemaining();
  const housing = useHousing();
  const snaps = useSnapshots();

  if (nw.isLoading || sum.isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (nw.error) return <p className="text-danger">Erreur API : {String(nw.error)}</p>;

  const s = sum.data;
  const capacityTone = (s?.savings_capacity ?? 0) >= 0 ? "positive" : "negative";

  return (
    <div className="space-y-6">
      {guardrail.data && <GuardrailBanner g={guardrail.data} />}

      {runway.data && (
        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_260px]">
            <div>
              <CardTitle>Trésorerie projetée — 12 mois</CardTitle>
              <RunwayChart runway={runway.data} />
            </div>
            <div className="space-y-3">
              <StatTile label="Solde actuel" value={eur(runway.data.months[0]?.balance)} />
              <StatTile label="Mois-creux" value={eur(runway.data.trough.balance)}
                sub={runway.data.trough.month} tone="negative" />
              <StatTile label="Repasse au +" value={runway.data.positive_month ?? "—"} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <CardTitle>Valeur nette dans le temps</CardTitle>
          {snaps.data && snaps.data.snapshots.length >= 2 ? (
            <NetWorthChart snapshots={snaps.data.snapshots} />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Pas encore d'historique (premier snapshot au prochain run mensuel).</p>
          )}
        </CardContent>
      </Card>

      {remaining.data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile label="Reste à vivre / mois" value={eur(remaining.data.reste_a_vivre)}
            sub="salaire − obligations − dépenses courantes"
            tone={remaining.data.reste_a_vivre >= 0 ? "positive" : "negative"} />
          <StatTile label="Reste à investir / mois" value={eur(remaining.data.reste_a_investir)}
            sub={guardrail.data && !guardrail.data.invest_ok ? "en pause (matelas/runway)" : "au-delà du buffer, plafonné au taux cible"} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Patrimoine net" value={eur(nw.data!.net_of_debt)} sub="actifs − dette" />
        <StatTile label="Argent dormant" value={eur(nw.data!.dormant)} sub="comptes + livrets" />
        <StatTile label="Argent investi" value={eur(nw.data!.invested)} sub="au coût d'acquisition" />
        <StatTile label="Dette restante" value={eur(nw.data!.debt)}
          sub={nw.data!.loans.length ? `${nw.data!.loans.length} prêt(s)` : "aucun prêt suivi"}
          tone={nw.data!.debt > 0 ? "negative" : "neutral"} />
      </div>

      {housing.data?.over_33 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-danger">
              ⚠ Poids du logement à {pct(housing.data.ratio)} du revenu (&gt; 33 %) — levier n°1 (R2).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {scores.data && (
          <ScoreCard
            title="Santé — argent dormant"
            score={scores.data.dormant}
            footer={
              scores.data.dormant.coverage_months != null
                ? `Matelas : ${scores.data.dormant.coverage_months} mois de dépenses couverts (dépense typique ${eur(scores.data.typical_monthly_expense)}/mois)`
                : undefined
            }
          />
        )}
        {scores.data?.invested && (
          <ScoreCard
            title="Santé — argent investi"
            score={scores.data.invested}
            footer={`${scores.data.invested.effective_holdings ?? "—"} lignes effectives · détail dans l'onglet Flux & Portefeuille`}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatTile
          label="Capacité d'épargne (mois)"
          value={eur(s?.savings_capacity)}
          sub={s ? `taux ${pct(s.savings_rate)} · ${s.month}` : undefined}
          tone={capacityTone}
        />
        <Card>
          <CardContent className="pt-6">
            <CardTitle>Top centres de coûts {exp.data ? `· ${exp.data.month}` : ""}</CardTitle>
            <ul className="mt-3 space-y-2">
              {exp.data?.categories.slice(0, 8).map((c) => (
                <li key={c.category} className="flex justify-between text-sm">
                  <span>{c.category}</span>
                  <span className="tabular-nums font-medium">{eur(c.amount)}</span>
                </li>
              ))}
              {exp.data && exp.data.categories.length === 0 && (
                <li className="text-sm text-muted-foreground">Aucune dépense catégorisée ce mois.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
