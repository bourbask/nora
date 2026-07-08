import { Card, CardContent } from "@/components/ui/card";
import type { Guardrail } from "@/lib/api";

export function GuardrailBanner({ g }: { g: Guardrail }) {
  const tone = g.invest_ok ? "border-success text-success" : "border-danger text-danger";
  return (
    <Card className={`border-l-4 ${tone}`}>
      <CardContent className="flex items-start gap-3 pt-6">
        <span className="text-xl">{g.invest_ok ? "✅" : "⚠"}</span>
        <div>
          <p className="font-medium">{g.invest_ok ? "Investissement débloqué" : "Investissement en pause"}</p>
          <p className="text-sm text-muted-foreground">
            {g.reason} <span className="opacity-60">[{g.rule_refs.join(", ")}]</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
