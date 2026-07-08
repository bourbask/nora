import * as echarts from "echarts/core";
import { SankeyChart, TreemapChart, BarChart, LineChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import ReactECharts from "echarts-for-react/lib/core";
import type { Flow, Portfolio, Runway } from "@/lib/api";
import { eur } from "@/lib/utils";
import { useViz } from "@/lib/viz";

// Tree-shaken ECharts: register only the pieces used (keeps the bundle down).
echarts.use([SankeyChart, TreemapChart, BarChart, LineChart, TooltipComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent, CanvasRenderer]);

export function SankeyChart_({ flow }: { flow: Flow }) {
  const v = useViz();
  const option = {
    textStyle: { color: v.ink.secondary },
    tooltip: {
      trigger: "item",
      formatter: (p: any) =>
        p.dataType === "edge" ? `${p.data.source} → ${p.data.target}<br/><b>${eur(p.data.value)}</b>` : p.name,
    },
    series: [{
      type: "sankey",
      right: 90,
      emphasis: { focus: "adjacency" },
      nodeGap: 10,
      nodeWidth: 14,
      // 2px surface gap between marks; rounded ends read as the 4px data-end.
      itemStyle: { borderWidth: 2, borderColor: v.ink.surface, borderRadius: 3 },
      lineStyle: { color: "gradient", opacity: 0.35, curveness: 0.5 },
      label: { color: v.ink.primary, fontSize: 12 },
      data: flow.nodes.map((n) => ({ name: n.name })),
      links: flow.links,
    }],
    color: v.categorical,
  };
  return <ReactECharts echarts={echarts} option={option} style={{ height: 380 }} notMerge />;
}

export function AllocationChart({ pf }: { pf: Portfolio }) {
  const v = useViz();
  const option = {
    tooltip: {
      trigger: "item",
      formatter: (p: any) => `${p.name}<br/><b>${eur(p.value)}</b> (${p.percent}%)`,
    },
    series: [{
      type: "treemap",
      roam: false,
      breadcrumb: { show: false },
      // 2px surface gaps between tiles + a surface ring, per the mark spec.
      itemStyle: { borderColor: v.ink.surface, borderWidth: 2, gapWidth: 2, borderRadius: 3 },
      label: { show: true, formatter: "{b}", fontSize: 11, color: "#ffffff" },
      data: pf.instruments.map((i) => ({
        name: i.name, value: i.cost,
        itemStyle: { color: v.bucket[i.bucket] ?? v.ink.muted },
      })),
    }],
  };
  return <ReactECharts echarts={echarts} option={option} style={{ height: 320 }} notMerge />;
}

export function BucketBars({ pf, target }: { pf: Portfolio; target: Record<string, number> }) {
  const v = useViz();
  const buckets = ["low", "mid", "high"];
  const labels: Record<string, string> = { low: "Faible", mid: "Moyen", high: "Élevé" };
  const option = {
    textStyle: { color: v.ink.secondary },
    tooltip: { trigger: "axis", valueFormatter: (x: number) => `${(x * 100).toFixed(1)}%` },
    legend: { data: ["Actuel", "Cible"], textStyle: { color: v.ink.secondary }, top: 0 },
    grid: { left: 44, right: 12, top: 32, bottom: 24 },
    xAxis: {
      type: "category", data: buckets.map((b) => labels[b]),
      axisLabel: { color: v.ink.muted }, axisLine: { lineStyle: { color: v.ink.axis } },
    },
    yAxis: {
      type: "value", splitLine: { lineStyle: { color: v.ink.grid } },
      axisLabel: { color: v.ink.muted, formatter: (x: number) => `${x * 100}%` },
    },
    series: [
      { name: "Actuel", type: "bar", data: buckets.map((b) => pf.bucket_weights[b] ?? 0),
        itemStyle: { color: v.categorical[0], borderRadius: [3, 3, 0, 0] } },
      { name: "Cible", type: "bar", data: buckets.map((b) => target[b] ?? 0),
        itemStyle: { color: v.ink.axis, borderRadius: [3, 3, 0, 0] } },
    ],
  };
  return <ReactECharts echarts={echarts} option={option} style={{ height: 260 }} notMerge />;
}

export function RunwayChart({ runway }: { runway: Runway }) {
  const v = useViz();
  const months = runway.months.map((m) => m.month.slice(2));   // "26-07"
  const balances = runway.months.map((m) => m.balance);
  const option = {
    textStyle: { color: v.ink.secondary },
    tooltip: { trigger: "axis", valueFormatter: (x: number) => eur(x) },
    grid: { left: 56, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "category", data: months, axisLabel: { color: v.ink.muted }, axisLine: { lineStyle: { color: v.ink.axis } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: v.ink.grid } }, axisLabel: { color: v.ink.muted, formatter: (x: number) => eur(x) } },
    series: [{
      type: "line", data: balances, smooth: true, symbol: "circle",
      areaStyle: { opacity: 0.15 }, itemStyle: { color: v.categorical[0] }, lineStyle: { color: v.categorical[0] },
      markLine: { silent: true, symbol: "none", data: [{ yAxis: 0, lineStyle: { color: v.ink.axis, type: "dashed" } }] },
      markPoint: { symbolSize: 46, data: [{ name: "creux", coord: [runway.trough.month.slice(2), runway.trough.balance], itemStyle: { color: v.categorical[3] ?? v.ink.muted } }] },
    }],
    color: v.categorical,
  };
  return <ReactECharts echarts={echarts} option={option} style={{ height: 300 }} notMerge />;
}

export function SavingsTrendChart({ trend }: {
  trend: { points: { month: string; rate: number }[]; target: number; band: number };
}) {
  const v = useViz();
  const option = {
    textStyle: { color: v.ink.secondary },
    tooltip: { trigger: "axis", valueFormatter: (x: number) => `${(x * 100).toFixed(1)}%` },
    grid: { left: 44, right: 12, top: 24, bottom: 24 },
    xAxis: { type: "category", data: trend.points.map((p) => p.month.slice(2)), axisLabel: { color: v.ink.muted }, axisLine: { lineStyle: { color: v.ink.axis } } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: v.ink.grid } }, axisLabel: { color: v.ink.muted, formatter: (x: number) => `${(x * 100).toFixed(0)}%` } },
    series: [{
      type: "line", smooth: true, data: trend.points.map((p) => p.rate), itemStyle: { color: v.categorical[0] },
      markLine: { silent: true, symbol: "none", data: [{ yAxis: trend.target, lineStyle: { color: v.ink.axis } }] },
      markArea: { silent: true, itemStyle: { color: v.categorical[0], opacity: 0.08 },
        data: [[{ yAxis: trend.target - trend.band }, { yAxis: trend.target + trend.band }]] },
    }],
    color: v.categorical,
  };
  return <ReactECharts echarts={echarts} option={option} style={{ height: 220 }} notMerge />;
}

export { SankeyChart_ as SankeyChart };
