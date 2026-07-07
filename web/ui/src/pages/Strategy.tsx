import { Card, CardContent, CardTitle } from "@/components/ui/card";

// Phase 3: forms (matelas, taux cible, charges, buckets de risque, plafond crypto)
// lisant/écrivant config/strategy.yaml via GET/PUT /api/strategy. Placeholder.
export function Strategy() {
  return (
    <Card>
      <CardContent className="pt-6">
        <CardTitle>Stratégies</CardTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          À venir (Phase 3) : pilotage du matelas de sécurité, des charges récurrentes et
          de l'allocation par buckets de risque (high/mid/low).
        </p>
      </CardContent>
    </Card>
  );
}
