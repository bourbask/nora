import * as echarts from "echarts/core";
import { SankeyChart, TreemapChart, BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import ReactECharts from "echarts-for-react/lib/core";
import type { Flow, Portfolio } from "@/lib/api";
import { eur } from "@/lib/utils";
import { useViz } from "@/lib/viz";

// Tree-shaken ECharts: register only the pieces used (keeps the bundle down).
echarts.use([SankeyChart, TreemapChart, BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

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

export { SankeyChart_ as SankeyChart };
