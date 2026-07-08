import { useEffect, useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input, Label, Button } from "@/components/ui/input";
import { useStrategy, useUpdateStrategy, useSavingsTrend, useDetectedRecurrences, useDismissRecurrence, type StrategyEdit } from "@/lib/api";
import { SavingsTrendChart } from "@/components/charts";

const KINDS = ["loan", "tax", "insurance", "rent", "subscription", "other"];
const THIS_MONTH = new Date().toISOString().slice(0, 7);

interface Charge { name: string; amount: number; freq: string; start: string; end: string | null; kind: string; remaining_balance: number | null }
interface OneOffForm { name: string; amount: number; date: string; kind: string }

interface FormState {
  cushionMonths: number;
  buffer: number;
  savingsRatePct: number;
  salaryOverride: number | null;
  reconcileTol: number;
  savingsBand: number;
  targetHoldings: number;
  cryptoCapPct: number;
  high: number;
  mid: number;
  low: number;
  charges: Charge[];
  oneOffs: OneOffForm[];
}

function toForm(s: StrategyEdit): FormState {
  const d = s.dormant;
  return {
    cushionMonths: d.safety_cushion_months,
    buffer: d.checking_buffer_eur,
    savingsRatePct: Math.round(d.target_savings_rate * 100),
    salaryOverride: d.salary_override ?? null,
    reconcileTol: d.reconcile_tolerance_eur ?? 100,
    savingsBand: d.savings_band_pts ?? 5,
    targetHoldings: s.invested.target_holdings,
    cryptoCapPct: Math.round(s.invested.crypto_cap * 100),
    high: Math.round((s.invested.target_buckets.high ?? 0) * 100),
    mid: Math.round((s.invested.target_buckets.mid ?? 0) * 100),
    low: Math.round((s.invested.target_buckets.low ?? 0) * 100),
    charges: (d.recurring_charges ?? []).map((c) => ({
      name: c.name, amount: c.amount, freq: c.freq ?? "monthly",
      start: c.start ?? THIS_MONTH, end: c.end ?? null,
      kind: c.kind ?? "other", remaining_balance: c.remaining_balance ?? null,
    })),
    oneOffs: (d.one_offs ?? []).map((o) => ({
      name: o.name, amount: o.amount, date: o.date ?? THIS_MONTH, kind: o.kind ?? "other",
    })),
  };
}

function toPayload(f: FormState): StrategyEdit {
  return {
    dormant: {
      safety_cushion_months: f.cushionMonths,
      checking_buffer_eur: f.buffer,
      target_savings_rate: f.savingsRatePct / 100,
      salary_override: f.salaryOverride,
      reconcile_tolerance_eur: f.reconcileTol,
      savings_band_pts: f.savingsBand,
      recurring_charges: f.charges.filter((c) => c.name).map((c) => ({
        name: c.name, amount: c.amount, freq: c.freq || "monthly",
        start: c.start || THIS_MONTH, end: c.end || null,
        kind: c.kind || "other", remaining_balance: c.remaining_balance,
      })),
      one_offs: f.oneOffs.filter((o) => o.name).map((o) => ({
        name: o.name, amount: o.amount, date: o.date || THIS_MONTH, kind: o.kind || "other",
      })),
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
  const trend = useSavingsTrend();
  const update = useUpdateStrategy();
  const detected = useDetectedRecurrences();
  const dismiss = useDismissRecurrence();
  const [f, setF] = useState<FormState | null>(null);

  useEffect(() => { if (data) setF(toForm(data)); }, [data]);
  if (!f) return <p className="text-muted-foreground">Chargement…</p>;

  const set = (patch: Partial<FormState>) => setF({ ...f, ...patch });
  const addDetected = (c: { name: string; amount: number; start: string; freq: string }) =>
    set({ charges: [...f.charges, {
      name: c.name, amount: c.amount, freq: c.freq, start: c.start,
      end: null, kind: "other", remaining_balance: null,
    }] });
  const updCharge = (i: number, patch: Partial<Charge>) => {
    const ch = [...f.charges]; ch[i] = { ...ch[i], ...patch }; set({ charges: ch });
  };
  const updOneOff = (i: number, patch: Partial<OneOffForm>) => {
    const oo = [...f.oneOffs]; oo[i] = { ...oo[i], ...patch }; set({ oneOffs: oo });
  };
  const bucketSum = f.high + f.mid + f.low;
  const bucketsOk = Math.abs(bucketSum - 100) < 1;

  return (
    <div className="space-y-6">
      {trend.data && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <CardTitle>Tendance — capacité d'épargne vs cible</CardTitle>
            <SavingsTrendChart trend={trend.data} />
            <p className="text-sm text-muted-foreground">
              {trend.data.verdict === "above" ? "Au-dessus de la cible"
                : trend.data.verdict === "below" ? "Sous la cible" : "Dans la bande cible"}
              {" · "}
              {trend.data.direction === "up" ? "en amélioration ▲"
                : trend.data.direction === "down" ? "en baisse ▼" : "stable ▬"}
            </p>
          </CardContent>
        </Card>
      )}

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
            <div>
              <Label>Salaire de référence (€, vide = médiane auto)</Label>
              <Input type="number" className="mt-1" value={f.salaryOverride ?? ""}
                onChange={(e) => set({ salaryOverride: e.target.value === "" ? null : (parseFloat(e.target.value) || 0) })} />
            </div>
          </div>

          <div>
            <Label>Obligations récurrentes (montant/mois, période, type, solde restant si prêt)</Label>
            <div className="mt-2 space-y-2">
              {f.charges.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_110px_110px_100px_100px_90px_36px] gap-2 items-center">
                  <Input placeholder="Nom" value={c.name} onChange={(e) => updCharge(i, { name: e.target.value })} />
                  <Input type="number" placeholder="€/mois" value={c.amount} onChange={(e) => updCharge(i, { amount: parseFloat(e.target.value) || 0 })} />
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={c.kind}
                    onChange={(e) => updCharge(i, { kind: e.target.value })}>
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={c.freq}
                    onChange={(e) => updCharge(i, { freq: e.target.value })}>
                    {["monthly", "quarterly", "yearly"].map((fr) => <option key={fr} value={fr}>{fr}</option>)}
                  </select>
                  <Input type="month" value={c.start} onChange={(e) => updCharge(i, { start: e.target.value })} />
                  <Input type="month" value={c.end ?? ""} onChange={(e) => updCharge(i, { end: e.target.value || null })} />
                  <Input type="number" placeholder="solde" value={c.remaining_balance ?? ""}
                    onChange={(e) => updCharge(i, { remaining_balance: e.target.value === "" ? null : (parseFloat(e.target.value) || 0) })} />
                  <Button className="bg-secondary text-secondary-foreground"
                    onClick={() => set({ charges: f.charges.filter((_, j) => j !== i) })}>✕</Button>
                </div>
              ))}
              <Button className="bg-secondary text-secondary-foreground"
                onClick={() => set({ charges: [...f.charges, { name: "", amount: 0, freq: "monthly", start: THIS_MONTH, end: null, kind: "other", remaining_balance: null }] })}>
                + Ajouter une obligation
              </Button>
              {detected.data && detected.data.candidates
                .filter((c) => !f.charges.some((ch) => ch.name === c.name)).length > 0 && (
                <div className="mt-4 space-y-1">
                  <Label>Récurrences détectées (à confirmer)</Label>
                  {detected.data.candidates
                    .filter((c) => !f.charges.some((ch) => ch.name === c.name))
                    .map((c) => (
                      <div key={c.name} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                        <span className="flex items-center gap-2">
                          <span className={c.confidence === "high" ? "text-success" : "text-muted-foreground"}>●</span>
                          {c.name}
                        </span>
                        <span className="flex items-center gap-3 text-muted-foreground">
                          <span>{c.amount} € · {c.freq} · vu {c.count}× depuis {c.start}</span>
                          <Button type="button" onClick={() => addDetected(c)}>Ajouter</Button>
                          <Button type="button" className="bg-secondary text-secondary-foreground"
                            onClick={() => dismiss.mutate(c.name)}>Refuser</Button>
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Dépenses ponctuelles (one-shot daté)</Label>
            <div className="mt-2 space-y-2">
              {f.oneOffs.map((o, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_110px_100px_36px] gap-2 items-center">
                  <Input placeholder="Nom" value={o.name} onChange={(e) => updOneOff(i, { name: e.target.value })} />
                  <Input type="number" placeholder="€" value={o.amount} onChange={(e) => updOneOff(i, { amount: parseFloat(e.target.value) || 0 })} />
                  <select className="h-9 rounded-md border bg-background px-2 text-sm" value={o.kind}
                    onChange={(e) => updOneOff(i, { kind: e.target.value })}>
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <Input type="month" value={o.date} onChange={(e) => updOneOff(i, { date: e.target.value })} />
                  <Button className="bg-secondary text-secondary-foreground"
                    onClick={() => set({ oneOffs: f.oneOffs.filter((_, j) => j !== i) })}>✕</Button>
                </div>
              ))}
              <Button className="bg-secondary text-secondary-foreground"
                onClick={() => set({ oneOffs: [...f.oneOffs, { name: "", amount: 0, date: THIS_MONTH, kind: "other" }] })}>
                + Ajouter une dépense ponctuelle
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
