import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`${path} → ${r.status}: ${detail}`);
  }
  return r.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export interface Account { name: string; balance: number; cls: string }
export interface Loan { name: string; remaining_balance: number }
export interface NetWorth {
  total: number; net_of_debt: number; debt: number; loans: Loan[];
  dormant: number; invested: number; unclassified: number;
  accounts: Account[];
}
export interface Summary {
  month: string; real_income: number; real_expense: number;
  savings_capacity: number; savings_rate: number | null;
  networth_start: number; networth_end: number;
}
export interface ExpenseCat { category: string; amount: number }

export const useNetWorth = () =>
  useQuery({ queryKey: ["networth"], queryFn: () => get<NetWorth>("/api/networth") });

export const useSummary = (month?: string) =>
  useQuery({
    queryKey: ["summary", month ?? "current"],
    queryFn: () => get<Summary>(`/api/summary${month ? `?month=${month}` : ""}`),
  });

export interface HealthScore {
  score: number;
  sub: Record<string, number>;
  coverage_months?: number | null;
  effective_holdings?: number;
}
export interface Scores {
  month: string;
  typical_monthly_expense: number;
  dormant: HealthScore;
  invested: HealthScore | null;
}

export const useScores = (month?: string) =>
  useQuery({
    queryKey: ["scores", month ?? "current"],
    queryFn: () => get<Scores>(`/api/scores${month ? `?month=${month}` : ""}`),
  });

export const useExpenseCategories = (month?: string) =>
  useQuery({
    queryKey: ["expense", month ?? "current"],
    queryFn: () =>
      get<{ month: string; categories: ExpenseCat[] }>(
        `/api/categories/expense${month ? `?month=${month}` : ""}`,
      ),
  });

export interface Instrument {
  name: string; cost: number; bucket: string; class: string; weight: number;
}
export interface Portfolio {
  total_cost: number;
  instruments: Instrument[];
  by_bucket: Record<string, number>;
  by_class: Record<string, number>;
  bucket_weights: Record<string, number>;
  crypto_weight: number;
}
export interface SankeyNode { name: string }
export interface SankeyLink { source: string; target: string; value: number }
export interface Flow {
  month: string; nodes: SankeyNode[]; links: SankeyLink[]; savings_capacity: number;
}

export const usePortfolio = () =>
  useQuery({ queryKey: ["portfolio"], queryFn: () => get<Portfolio>("/api/portfolio") });

export const useFlow = (month?: string) =>
  useQuery({
    queryKey: ["flow", month ?? "current"],
    queryFn: () => get<Flow>(`/api/flow${month ? `?month=${month}` : ""}`),
  });

// ── forecast (V1 runway) ──
export interface RunwayMonth { month: string; net: number; balance: number }
export interface Runway {
  ref_month: string; salary: number; variable_typical: number;
  months: RunwayMonth[]; trough: { month: string; balance: number };
  positive_month: string | null;
}
export interface Guardrail { invest_ok: boolean; coverage_months: number | null; reason: string; rule_refs: string[] }
export interface Remaining { ref_month: string; reste_a_vivre: number; reste_a_investir: number }
export interface Housing { ratio: number; over_33: boolean }
export interface Reconcile { months: { month: string; gap: number; ok: boolean }[]; all_ok: boolean; unclassified_accounts: string[] }
export interface SavingsTrend { points: { month: string; rate: number }[]; target: number; band: number; verdict: string; direction: string }

export const useRunway = () => useQuery({ queryKey: ["runway"], queryFn: () => get<Runway>("/api/runway") });
export const useGuardrail = () => useQuery({ queryKey: ["guardrail"], queryFn: () => get<Guardrail>("/api/guardrail") });
export const useRemaining = () => useQuery({ queryKey: ["remaining"], queryFn: () => get<Remaining>("/api/remaining") });
export const useHousing = () => useQuery({ queryKey: ["housing"], queryFn: () => get<Housing>("/api/housing") });
export const useHealth = () => useQuery({ queryKey: ["health"], queryFn: () => get<{ reconcile: Reconcile }>("/api/health") });
export const useSavingsTrend = () => useQuery({ queryKey: ["savings-trend"], queryFn: () => get<SavingsTrend>("/api/savings-trend") });

export interface ImportEvent { timestamp: string | null; event: string | null; transactions: number | null }
export interface ImportStatus { sources: Record<string, ImportEvent> }
export const useImportStatus = () =>
  useQuery({ queryKey: ["import-status"], queryFn: () => get<ImportStatus>("/api/import-status") });

// Strategy config — editable knobs (server preserves accounts/rules/weights).
export interface RecurringCharge {
  name: string; amount: number; freq: string;
  start: string; end: string | null; kind: string; remaining_balance: number | null;
  rate: number | null;
}
export interface OneOff { name: string; amount: number; date: string; kind: string }
export interface StrategyEdit {
  dormant: {
    safety_cushion_months: number;
    checking_buffer_eur: number;
    target_savings_rate: number;
    recurring_charges: RecurringCharge[];
    one_offs: OneOff[];
    salary_override: number | null;
    reconcile_tolerance_eur: number;
    savings_band_pts: number;
  };
  invested: {
    target_buckets: Record<string, number>;
    target_holdings: number;
    crypto_cap: number;
  };
}
export const useStrategy = () =>
  useQuery({ queryKey: ["strategy"], queryFn: () => get<StrategyEdit>("/api/strategy") });

export const useUpdateStrategy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: StrategyEdit) => put<StrategyEdit>("/api/strategy", s),
    onSuccess: () => {
      // strategy drives the scores → recompute everything downstream
      qc.invalidateQueries({ queryKey: ["strategy"] });
      qc.invalidateQueries({ queryKey: ["scores"] });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["runway"] });
      qc.invalidateQueries({ queryKey: ["guardrail"] });
      qc.invalidateQueries({ queryKey: ["remaining"] });
      qc.invalidateQueries({ queryKey: ["housing"] });
      qc.invalidateQueries({ queryKey: ["networth"] });
      qc.invalidateQueries({ queryKey: ["health"] });
      qc.invalidateQueries({ queryKey: ["savings-trend"] });
    },
  });
};

export interface DetectedRecurrence {
  name: string; amount: number; freq: string; start: string;
  end: string | null; kind: string; count: number; confidence: "high" | "medium";
}
export const useDetectedRecurrences = () =>
  useQuery({
    queryKey: ["recurrences-detected"],
    queryFn: () => get<{ candidates: DetectedRecurrence[] }>("/api/recurrences/detected"),
  });

export const useDismissRecurrence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => post<{ ok: boolean }>("/api/recurrences/dismiss", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurrences-detected"] }),
  });
};

export interface Snapshot {
  month: string; net_worth: number; net_worth_gross: number | null;
  debt: number | null; dormant_cash: number | null; invested_cost: number | null;
  savings_rate: number | null; dormant_score: number | null; invested_score: number | null;
  bucket_weights: Record<string, number> | null; crypto_weight: number | null;
  captured_at: string; backfilled: boolean;
}
export const useSnapshots = () =>
  useQuery({ queryKey: ["snapshots"], queryFn: () => get<{ snapshots: Snapshot[] }>("/api/snapshots") });

export interface LoanAmort {
  name: string; balance: number; payment: number; rate: number | null;
  payoff_month: string | null; total_interest: number | null;
  never_amortizes: boolean; needs_rate: boolean;
}
export const useLoans = () =>
  useQuery({ queryKey: ["loans"], queryFn: () => get<{ loans: LoanAmort[] }>("/api/loans") });
