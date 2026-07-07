import ReactECharts from "echarts-for-react";
import type { Flow, Portfolio } from "@/lib/api";
import { eur } from "@/lib/utils";

// Curated categorical palette (color-blind-friendly-ish); swap freely.
const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];
const BUCKET_COLORS: Record<string, string> = { low: "#10b981", mid: "#3b82f6", high: "#ef4444" };

export function SankeyChart({ flow }: { flow: Flow }) {
  const option = {
    tooltip: { trigger: "item", formatter: (p: any) => p.dataType === "edge"
      ? `${p.data.source} → ${p.data.target}<br/>${eur(p.data.value)}` : p.name },
    series: [{
      type: "sankey",
      emphasis: { focus: "adjacency" },
      nodeAlign: "left",
      lineStyle: { color: "gradient", opacity: 0.4 },
      label: { color: "inherit", fontSize: 12 },
      data: flow.nodes.map((n) => ({ name: n.name })),
      links: flow.links,
    }],
    color: PALETTE,
  };
  return <ReactECharts option={option} style={{ height: 380 }} notMerge />;
}

export function AllocationChart({ pf }: { pf: Portfolio }) {
  const data = pf.instruments.map((i) => ({ name: i.name, value: i.cost, bucket: i.bucket }));
  const option = {
    tooltip: { trigger: "item", formatter: (p: any) => `${p.name}<br/>${eur(p.value)} (${p.percent}%)` },
    series: [{
      type: "treemap",
      roam: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: "{b}", fontSize: 11 },
      levels: [{ itemStyle: { borderColor: "transparent", borderWidth: 2, gapWidth: 2 } }],
      data: data.map((d) => ({ ...d, itemStyle: { color: BUCKET_COLORS[d.bucket] ?? "#64748b" } })),
    }],
  };
  return <ReactECharts option={option} style={{ height: 320 }} notMerge />;
}

export function BucketBars({ pf, target }: { pf: Portfolio; target: Record<string, number> }) {
  const buckets = ["low", "mid", "high"];
  const option = {
    tooltip: { trigger: "axis", valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%` },
    legend: { data: ["Actuel", "Cible"], textStyle: { color: "inherit" } },
    grid: { left: 40, right: 12, top: 30, bottom: 24 },
    xAxis: { type: "category", data: buckets, axisLabel: { color: "inherit" } },
    yAxis: { type: "value", axisLabel: { color: "inherit", formatter: (v: number) => `${v * 100}%` } },
    series: [
      { name: "Actuel", type: "bar", data: buckets.map((b) => pf.bucket_weights[b] ?? 0),
        itemStyle: { color: "#3b82f6" } },
      { name: "Cible", type: "bar", data: buckets.map((b) => target[b] ?? 0),
        itemStyle: { color: "#94a3b8" } },
    ],
  };
  return <ReactECharts option={option} style={{ height: 260 }} notMerge />;
}
