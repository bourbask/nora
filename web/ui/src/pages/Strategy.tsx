import { useEffect, useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input, Label, Button } from "@/components/ui/input";
import { useStrategy, useUpdateStrategy, type StrategyEdit } from "@/lib/api";

interface FormState {
  cushionMonths: number;
  buffer: number;
  savingsRatePct: number;
  targetHoldings: number;
  cryptoCapPct: number;
  high: number;
  mid: number;
  low: number;
  charges: { name: string; amount: number }[];
}

function toForm(s: StrategyEdit): FormState {
  return {
    cushionMonths: s.dormant.safety_cushion_months,
    buffer: s.dormant.checking_buffer_eur,
    savingsRatePct: Math.round(s.dormant.target_savings_rate * 100),
    targetHoldings: s.invested.target_holdings,
    cryptoCapPct: Math.round(s.invested.crypto_cap * 100),
    high: Math.round((s.invested.target_buckets.high ?? 0) * 100),
    mid: Math.round((s.invested.target_buckets.mid ?? 0) * 100),
    low: Math.round((s.invested.target_buckets.low ?? 0) * 100),
    charges: (s.dormant.recurring_charges ?? []).map((c) => ({ name: c.name, amount: c.amount })),
  };
}

function toPayload(f: FormState): StrategyEdit {
  return {
    dormant: {
      safety_cushion_months: f.cushionMonths,
      checking_buffer_eur: f.buffer,
      target_savings_rate: f.savingsRatePct / 100,
      recurring_charges: f.charges.filter((c) => c.name).map((c) => ({ ...c, freq: "monthly" })),
    },
    invested: {
      target_buckets: { high: f.high / 100, mid: f.mid / 100, low: f.low / 100 },
      target_holdings: f.targetHoldings,
      crypto_cap: f.cryptoCapPct / 100,
    },
  };
}

function Field({ label, value, onChange, suffix }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string;
}) {
  return (
    <div>
      <Label>{label}{suffix ? ` (${suffix})` : ""}</Label>
      <Input type="number" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="mt-1" />
    </div>
  );
}

export function Strategy() {
  const { data } = useStrategy();
  const update = useUpdateStrategy();
  const [f, setF] = useState<FormState | null>(null);

  useEffect(() => { if (data) setF(toForm(data)); }, [data]);
  if (!f) return <p className="text-muted-foreground">Chargement…</p>;

  const set = (patch: Partial<FormState>) => setF({ ...f, ...patch });
  const bucketSum = f.high + f.mid + f.low;
  const bucketsOk = Math.abs(bucketSum - 100) < 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <CardTitle>Argent dormant</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matelas de sécurité" suffix="mois" value={f.cushionMonths}
              onChange={(n) => set({ cushionMonths: n })} />
            <Field label="Buffer compte courant" suffix="€" value={f.buffer}
              onChange={(n) => set({ buffer: n })} />
            <Field label="Taux d'épargne cible" suffix="%" value={f.savingsRatePct}
              onChange={(n) => set({ savingsRatePct: n })} />
          </div>
          <div>
            <Label>Charges récurrentes</Label>
            <div className="mt-2 space-y-2">
              {f.charges.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Nom" value={c.name}
                    onChange={(e) => { const ch = [...f.charges]; ch[i] = { ...c, name: e.target.value }; set({ charges: ch }); }} />
                  <Input type="number" placeholder="€/mois" value={c.amount} className="w-32"
                    onChange={(e) => { const ch = [...f.charges]; ch[i] = { ...c, amount: parseFloat(e.target.value) || 0 }; set({ charges: ch }); }} />
                  <Button className="bg-secondary text-secondary-foreground"
                    onClick={() => set({ charges: f.charges.filter((_, j) => j !== i) })}>✕</Button>
                </div>
              ))}
              <Button className="bg-secondary text-secondary-foreground"
                onClick={() => set({ charges: [...f.charges, { name: "", amount: 0 }] })}>
                + Ajouter une charge
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <CardTitle>Argent investi</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nb de lignes cible (diversification)" value={f.targetHoldings}
              onChange={(n) => set({ targetHoldings: n })} />
            <Field label="Plafond crypto" suffix="%" value={f.cryptoCapPct}
              onChange={(n) => set({ cryptoCapPct: n })} />
          </div>
          <div>
            <Label>Allocation cible par risque (%)</Label>
            <div className="mt-1 grid grid-cols-3 gap-4">
              <Field label="Élevé" value={f.high} onChange={(n) => set({ high: n })} />
              <Field label="Moyen" value={f.mid} onChange={(n) => set({ mid: n })} />
              <Field label="Faible" value={f.low} onChange={(n) => set({ low: n })} />
            </div>
            <p className={`mt-1 text-xs ${bucketsOk ? "text-muted-foreground" : "text-danger"}`}>
              Somme : {bucketSum}% {bucketsOk ? "✓" : "(doit faire 100%)"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={!bucketsOk || update.isPending}
          onClick={() => update.mutate(toPayload(f))}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {update.isSuccess && <span className="text-sm text-success">Enregistré ✓</span>}
        {update.isError && <span className="text-sm text-danger">Erreur : {String(update.error)}</span>}
      </div>
    </div>
  );
}
