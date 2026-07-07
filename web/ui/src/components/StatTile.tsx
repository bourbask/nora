import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "positive" | "negative";
}

export function StatTile({ label, value, sub, tone = "neutral" }: Props) {
  return (
    <Card>
      <CardContent className="pt-6">
        <CardTitle>{label}</CardTitle>
        <div
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            tone === "positive" && "text-success",
            tone === "negative" && "text-danger",
          )}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
