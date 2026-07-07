import { StatTile } from "@/components/StatTile";
import { ScoreCard } from "@/components/ScoreCard";
import { useNetWorth, useSummary, useExpenseCategories, useScores } from "@/lib/api";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { eur, pct } from "@/lib/utils";

export function Dashboard() {
  const nw = useNetWorth();
  const sum = useSummary();
  const exp = useExpenseCategories();
  const scores = useScores();

  if (nw.isLoading || sum.isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (nw.error) return <p className="text-danger">Erreur API : {String(nw.error)}</p>;

  const s = sum.data;
  const capacityTone = (s?.savings_capacity ?? 0) >= 0 ? "positive" : "negative";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Patrimoine net" value={eur(nw.data!.total)} />
        <StatTile label="Argent dormant" value={eur(nw.data!.dormant)} sub="comptes + livrets" />
        <StatTile label="Argent investi" value={eur(nw.data!.invested)} sub="au coût d'acquisition" />
        <StatTile
          label="Capacité d'épargne (mois)"
          value={eur(s?.savings_capacity)}
          sub={s ? `taux ${pct(s.savings_rate)} · ${s.month}` : undefined}
          tone={capacityTone}
        />
      </div>

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
        <Card>
          <CardContent className="pt-6">
            <CardTitle>Santé — argent investi</CardTitle>
            <p className="mt-3 text-sm text-muted-foreground">
              Score de diversification / allocation à venir (Phase 2, dérivé du coût d'acquisition).
            </p>
          </CardContent>
        </Card>
      </div>

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
  );
}
