import { useQuery } from "@tanstack/react-query";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export interface Account { name: string; balance: number; cls: string }
export interface NetWorth {
  total: number; dormant: number; invested: number; unclassified: number;
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
  coverage_months: number | null;
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
