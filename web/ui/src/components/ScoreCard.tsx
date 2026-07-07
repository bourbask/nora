import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { HealthScore } from "@/lib/api";
import { scoreColor } from "@/lib/viz";

const SUB_LABELS: Record<string, string> = {
  cushion: "Matelas de sécurité",
  cash_drag: "Cash non oisif",
  savings_rate: "Taux d'épargne",
  diversification: "Diversification",
  class_align: "Alignement allocation",
  crypto_cap: "Plafond crypto",
};

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: scoreColor(value) }}
      />
    </div>
  );
}

export function ScoreCard({ title, score, footer }: { title: string; score: HealthScore; footer?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <CardTitle>{title}</CardTitle>
        <div className="mt-1 text-3xl font-bold tabular-nums" style={{ color: scoreColor(score.score) }}>
          {score.score.toFixed(0)}
          <span className="text-base font-normal text-muted-foreground"> / 100</span>
        </div>
        <div className="mt-4 space-y-3">
          {Object.entries(score.sub).map(([k, v]) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{SUB_LABELS[k] ?? k}</span>
                <span className="tabular-nums">{v.toFixed(0)}</span>
              </div>
              <Bar value={v} />
            </div>
          ))}
        </div>
        {footer && <p className="mt-4 text-xs text-muted-foreground">{footer}</p>}
      </CardContent>
    </Card>
  );
}
