import { useState, useEffect, useRef } from "react";
import { BarChart3, Trophy, AlertCircle } from "lucide-react";
import type { AnalysisResults } from "@/App";
import type * as Plotly from "plotly.js";

type Props = { results: AnalysisResults };

const MODEL_COLORS: Record<string, string> = {
  kmeans: "#22d3ee",
  dbscan: "#a78bfa",
  gmm: "#34d399",
};

const CLUSTER_PALETTE = [
  "#22d3ee", "#a78bfa", "#34d399", "#fb923c", "#f472b6",
  "#facc15", "#60a5fa", "#f87171", "#4ade80", "#e879f9",
];

function getClusterColor(label: number) {
  if (label === -1) return "#374151";
  return CLUSTER_PALETTE[label % CLUSTER_PALETTE.length];
}

function fmt(v: number | null | undefined, digits = 3) {
  if (v == null) return "—";
  return v.toFixed(digits);
}

function MetricBadge({ value, good, label }: { value: number | null; good: "high" | "low"; label: string }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-col items-end">
      <span className={`text-sm font-mono font-semibold ${good === "high" ? "text-primary" : "text-amber-400"}`}>{value.toFixed(3)}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function PlotlyChart({ data, layout, config }: { data: Plotly.Data[]; layout: Partial<Plotly.Layout>; config?: Partial<Plotly.Config> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    import("plotly.js-dist-min").then((Plotly) => {
      if (!mounted || !ref.current) return;
      const darkLayout: Partial<Plotly.Layout> = {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: "#94a3b8", family: "Inter, sans-serif", size: 11 },
        margin: { t: 30, r: 20, b: 50, l: 55 },
        xaxis: { gridcolor: "rgba(148,163,184,0.08)", zerolinecolor: "rgba(148,163,184,0.15)", linecolor: "rgba(148,163,184,0.2)", tickfont: { size: 10 } },
        yaxis: { gridcolor: "rgba(148,163,184,0.08)", zerolinecolor: "rgba(148,163,184,0.15)", linecolor: "rgba(148,163,184,0.2)", tickfont: { size: 10 } },
        legend: { bgcolor: "rgba(0,0,0,0)", bordercolor: "rgba(148,163,184,0.15)" },
        ...layout,
      };
      Plotly.react(ref.current!, data, darkLayout, { responsive: true, displaylogo: false, displayModeBar: false, ...config });
    });
    return () => { mounted = false; };
  }, [data, layout, config]);

  return <div ref={ref} className="w-full h-64" />;
}

function ElbowChart({ kmeans }: { kmeans: NonNullable<AnalysisResults["kmeans"]> }) {
  const data: Plotly.Data[] = [
    {
      x: kmeans.k_values,
      y: kmeans.wcss,
      type: "scatter",
      mode: "lines+markers",
      line: { color: "#22d3ee", width: 2 },
      marker: { color: kmeans.k_values.map(k => k === kmeans.optimal_k ? "#f472b6" : "#22d3ee"), size: kmeans.k_values.map(k => k === kmeans.optimal_k ? 10 : 6) },
      name: "WCSS",
    },
    {
      x: [kmeans.optimal_k],
      y: [kmeans.wcss[kmeans.optimal_k - 1]],
      type: "scatter",
      mode: "text+markers",
      marker: { color: "#f472b6", size: 12, symbol: "star" },
      text: [`K=${kmeans.optimal_k}`],
      textposition: "top center",
      textfont: { color: "#f472b6", size: 10 },
      name: `Optimal K=${kmeans.optimal_k}`,
    },
  ];
  return <PlotlyChart data={data} layout={{ title: { text: "Elbow Method — WCSS vs K", font: { size: 12, color: "#cbd5e1" } }, xaxis: { title: { text: "Number of Clusters (K)" } }, yaxis: { title: { text: "WCSS (Inertia)" } } }} />;
}

function ScatterChart({ points, algo, featureNames }: {
  points: NonNullable<AnalysisResults["points"]>;
  algo: string;
  featureNames: string[];
}) {
  const labelKey = `${algo}_label` as keyof (typeof points)[0];
  const labels = points.map(p => p[labelKey] as number);
  const uniqueLabels = [...new Set(labels)].sort((a, b) => a - b);

  const data: Plotly.Data[] = uniqueLabels.map(label => ({
    x: points.filter((_, i) => labels[i] === label).map(p => p.features[0]),
    y: points.filter((_, i) => labels[i] === label).map(p => p.features[1] ?? p.features[0]),
    type: "scatter",
    mode: "markers",
    marker: { color: getClusterColor(label), size: 5, opacity: 0.8 },
    name: label === -1 ? "Noise" : `Cluster ${label}`,
  }));

  return (
    <PlotlyChart
      data={data}
      layout={{
        title: { text: `${algo.toUpperCase()} Cluster Scatter`, font: { size: 12, color: "#cbd5e1" } },
        xaxis: { title: { text: featureNames[0] || "Feature 1" } },
        yaxis: { title: { text: featureNames[1] || "Feature 2" } },
        showlegend: true,
      }}
    />
  );
}

function ClusterSizeChart({ clusterSizes, algo }: { clusterSizes: Record<string, number>; algo: string }) {
  const entries = Object.entries(clusterSizes).sort(([a], [b]) => parseInt(a) - parseInt(b));
  const data: Plotly.Data[] = [{
    x: entries.map(([k]) => k === "-1" ? "Noise" : `C${k}`),
    y: entries.map(([, v]) => v),
    type: "bar",
    marker: { color: entries.map(([k]) => getClusterColor(parseInt(k))) },
    name: "Points",
  }];
  return <PlotlyChart data={data} layout={{ title: { text: `${algo.toUpperCase()} Cluster Sizes`, font: { size: 12, color: "#cbd5e1" } }, xaxis: { title: { text: "Cluster" } }, yaxis: { title: { text: "Points" } } }} />;
}

export default function ResultsSection({ results }: Props) {
  const [activeTab, setActiveTab] = useState<string>("");

  const algos = ["kmeans", "dbscan", "gmm"].filter(a => results[a as keyof AnalysisResults] != null);

  useEffect(() => {
    if (algos.length > 0 && !activeTab) setActiveTab(algos[0]);
  }, [algos, activeTab]);

  const featureNames = results.preprocess_info?.feature_names || [];
  const ranking = results.ranking || [];
  const evaluation = results.evaluation || {};
  const errors = results.errors || {};

  return (
    <section data-testid="section-results">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
          <BarChart3 className="w-3 h-3 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">03 — Results</h2>
        {results.preprocess_info && (
          <span className="ml-auto text-xs text-muted-foreground">
            {results.preprocess_info.n_samples} samples · {results.preprocess_info.n_features} features · {results.preprocess_info.scaling_method} scaling
          </span>
        )}
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(errors).map(([algo, msg]) => (
            <div key={algo} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold uppercase">{algo}</span>: {msg}
            </div>
          ))}
        </div>
      )}

      {ranking.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">Model Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium">Rank</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Model</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Clusters</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Silhouette ↑</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Davies-Bouldin ↓</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Calinski-Harabasz ↑</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Composite</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const isTop = i === 0;
                  return (
                    <tr key={r.model} data-testid={`row-model-${r.model}`} className={`border-b border-border/50 transition-colors ${isTop ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                      <td className="px-5 py-3">
                        {isTop ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 text-xs font-semibold border border-amber-400/25">Best</span> : <span className="text-muted-foreground">#{i + 1}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[r.model] || "#64748b" }} />
                          <span className="font-semibold text-foreground uppercase">{r.model}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{r.n_clusters}</td>
                      <td className="px-4 py-3 text-right"><MetricBadge value={r.silhouette_score} good="high" label="" /></td>
                      <td className="px-4 py-3 text-right"><MetricBadge value={r.davies_bouldin_score} good="low" label="" /></td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(r.calinski_harabasz_score, 1)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-primary">{fmt(r.composite_score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex border-b border-border">
          {algos.map(algo => (
            <button
              key={algo}
              data-testid={`tab-${algo}`}
              onClick={() => setActiveTab(algo)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === algo ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[algo] }} />
              {algo}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "kmeans" && results.kmeans && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Clusters", value: results.kmeans.n_clusters, color: "primary" },
                  { label: "Optimal K", value: results.kmeans.optimal_k, color: "primary" },
                  { label: "Inertia", value: results.kmeans.inertia.toFixed(2), color: "muted" },
                  { label: "Silhouette", value: fmt(evaluation.kmeans?.silhouette_score), color: "primary" },
                ].map(m => (
                  <div key={m.label} className="px-4 py-3 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className={`text-lg font-mono font-semibold mt-0.5 ${m.color === "primary" ? "text-primary" : "text-foreground"}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg bg-background border border-border p-2">
                  <ElbowChart kmeans={results.kmeans} />
                </div>
                {results.points && featureNames.length >= 1 && (
                  <div className="rounded-lg bg-background border border-border p-2">
                    <ScatterChart points={results.points} algo="kmeans" featureNames={featureNames} />
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-background border border-border p-2">
                <ClusterSizeChart clusterSizes={results.kmeans.cluster_sizes} algo="kmeans" />
              </div>
            </div>
          )}

          {activeTab === "dbscan" && results.dbscan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Clusters Found", value: results.dbscan.n_clusters },
                  { label: "Noise Points", value: results.dbscan.n_noise },
                  { label: "Epsilon", value: results.dbscan.eps },
                  { label: "Silhouette", value: fmt(evaluation.dbscan?.silhouette_score) },
                ].map(m => (
                  <div key={m.label} className="px-4 py-3 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className={`text-lg font-mono font-semibold mt-0.5 ${m.label === "Noise Points" && results.dbscan!.n_noise > 0 ? "text-amber-400" : "text-primary"}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {results.points && featureNames.length >= 1 && (
                  <div className="rounded-lg bg-background border border-border p-2">
                    <ScatterChart points={results.points} algo="dbscan" featureNames={featureNames} />
                  </div>
                )}
                <div className="rounded-lg bg-background border border-border p-2">
                  <ClusterSizeChart clusterSizes={results.dbscan.cluster_sizes} algo="dbscan" />
                </div>
              </div>
              {results.dbscan.n_clusters === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  DBSCAN found 0 clusters — all points classified as noise. Try increasing epsilon or decreasing min_samples.
                </div>
              )}
            </div>
          )}

          {activeTab === "gmm" && results.gmm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Components", value: results.gmm.n_components },
                  { label: "Avg Confidence", value: `${(results.gmm.avg_confidence * 100).toFixed(1)}%` },
                  { label: "BIC", value: results.gmm.bic.toFixed(1) },
                  { label: "AIC", value: results.gmm.aic.toFixed(1) },
                ].map(m => (
                  <div key={m.label} className="px-4 py-3 rounded-lg bg-background border border-border">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-lg font-mono font-semibold mt-0.5 text-emerald-400">{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {results.points && featureNames.length >= 1 && (
                  <div className="rounded-lg bg-background border border-border p-2">
                    <ScatterChart points={results.points} algo="gmm" featureNames={featureNames} />
                  </div>
                )}
                <div className="rounded-lg bg-background border border-border p-2">
                  <ClusterSizeChart clusterSizes={results.gmm.cluster_sizes} algo="gmm" />
                </div>
              </div>
              <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground">
                Silhouette: <span className="text-foreground font-mono">{fmt(evaluation.gmm?.silhouette_score)}</span>
                {" "}· Davies-Bouldin: <span className="text-foreground font-mono">{fmt(evaluation.gmm?.davies_bouldin_score)}</span>
                {" "}· Average confidence reflects how decisively GMM assigns each point to its cluster.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
