import { useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn, eur } from "@/lib/utils";
import { useHealth } from "@/lib/api";
import { THEMES, loadSettings, applySettings, type Accent, type Mode, type Settings as S } from "@/lib/theme";

const MODES: { value: Mode; label: string }[] = [
  { value: "auto", label: "Auto (système)" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

export function Settings() {
  const [s, setS] = useState<S>(loadSettings);
  const health = useHealth();
  const update = (patch: Partial<S>) => { const n = { ...s, ...patch }; setS(n); applySettings(n); };

  return (
    <div className="max-w-2xl space-y-6">
      {health.data && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <CardTitle>Cohérence des données</CardTitle>
            <p className="text-xs text-muted-foreground">
              Écart entre (revenus − dépenses) et la variation de patrimoine, par mois. Tolérance macro.
            </p>
            {health.data.reconcile.months.map((m) => (
              <div key={m.month} className="flex justify-between text-sm">
                <span>{m.month}</span>
                <span className={m.ok ? "text-success" : "text-danger"}>
                  {m.ok ? "✓" : `écart ${eur(m.gap)}`}
                </span>
              </div>
            ))}
            {health.data.reconcile.unclassified_accounts.length > 0 && (
              <p className="text-sm text-danger">
                Comptes non classés : {health.data.reconcile.unclassified_accounts.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <CardTitle>Thème de couleur</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(THEMES) as Accent[]).map((a) => (
              <button key={a} onClick={() => update({ accent: a })}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                  s.accent === a ? "border-primary ring-2 ring-ring" : "border-border hover:bg-muted",
                )}>
                <span className="h-8 w-8 rounded-full" style={{ backgroundColor: THEMES[a].swatch }} />
                <span className="text-sm font-medium">{THEMES[a].label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <CardTitle>Apparence</CardTitle>
          <div className="inline-flex rounded-lg bg-muted p-1">
            {MODES.map((m) => (
              <button key={m.value} onClick={() => update({ mode: m.value })}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  s.mode === m.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            « Auto » suit le thème clair/sombre de ton système.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
