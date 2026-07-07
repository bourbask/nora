import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ScoreCard } from "@/components/ScoreCard";
import { SankeyChart, AllocationChart, BucketBars } from "@/components/charts";
import { useFlow, usePortfolio, useScores, useStrategy } from "@/lib/api";
import { eur } from "@/lib/utils";

export function FlowPortfolio() {
  const flow = useFlow();
  const pf = usePortfolio();
  const scores = useScores();
  const strat = useStrategy();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <CardTitle>Flux du mois {flow.data ? `· ${flow.data.month}` : ""}</CardTitle>
          {flow.isLoading && <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>}
          {flow.data && <SankeyChart flow={flow.data} />}
          {flow.data && (
            <p className="mt-2 text-xs text-muted-foreground">
              Où est allé l'argent : dépenses par catégorie + épargne nette
              (capacité {eur(flow.data.savings_capacity)}).
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <CardTitle>Répartition du portefeuille (coût d'acquisition)</CardTitle>
            {pf.data && <AllocationChart pf={pf.data} />}
            {pf.data && (
              <p className="mt-2 text-xs text-muted-foreground">
                Total investi {eur(pf.data.total_cost)} · couleur = niveau de risque
                (vert faible, bleu moyen, rouge élevé).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <CardTitle>Allocation par risque — actuel vs cible</CardTitle>
            {pf.data && strat.data && (
              <BucketBars pf={pf.data} target={strat.data.invested.target_buckets} />
            )}
          </CardContent>
        </Card>
      </div>

      {scores.data?.invested && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ScoreCard
            title="Santé — argent investi"
            score={scores.data.invested}
            footer={`${scores.data.invested.effective_holdings ?? "—"} lignes effectives (diversification)`}
          />
        </div>
      )}
    </div>
  );
}
