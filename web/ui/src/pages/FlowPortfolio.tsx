import { Card, CardContent, CardTitle } from "@/components/ui/card";

// Phase 2: Sankey (flux revenu→dépenses/épargne) + allocation portefeuille au coût
// + score investi. Placeholder pour l'instant.
export function FlowPortfolio() {
  return (
    <Card>
      <CardContent className="pt-6">
        <CardTitle>Flux & Portefeuille</CardTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          À venir (Phase 2) : diagramme de Sankey des flux mensuels et répartition du
          portefeuille d'investissement par classe d'actifs, avec score de santé investi.
        </p>
      </CardContent>
    </Card>
  );
}
