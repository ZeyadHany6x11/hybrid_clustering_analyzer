import { useState } from "react";
import { Settings, Play, AlertCircle } from "lucide-react";
import type { DatasetSummary, AnalysisConfig } from "@/App";

type Props = {
  summary: DatasetSummary;
  onAnalyze: (config: AnalysisConfig) => void;
  isAnalyzing: boolean;
};

const ALGORITHMS = [
  { id: "kmeans", label: "KMeans", desc: "Partition-based, finds compact spherical clusters" },
  { id: "dbscan", label: "DBSCAN", desc: "Density-based, handles noise and arbitrary shapes" },
  { id: "gmm", label: "GMM", desc: "Probabilistic, soft cluster assignments" },
];

function Slider({ label, value, min, max, step = 1, onChange, unit = "", disabled }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground font-medium">{label}</label>
        <span className="text-xs text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer disabled:opacity-50 accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground/50">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function ConfigSection({ summary, onAnalyze, isAnalyzing }: Props) {
  const [selectedAlgos, setSelectedAlgos] = useState<string[]>(["kmeans", "dbscan", "gmm"]);
  const [scalingMethod, setScalingMethod] = useState("standard");
  const [handleMissing, setHandleMissing] = useState("mean");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [kmeansNClusters, setKmeansNClusters] = useState(0);
  const [kmeansMaxK, setKmeansMaxK] = useState(10);
  const [dbscanEps, setDbscanEps] = useState(0.5);
  const [dbscanMinSamples, setDbscanMinSamples] = useState(5);
  const [gmmComponents, setGmmComponents] = useState(0);
  const [gmmCovType, setGmmCovType] = useState("full");

  const toggleAlgo = (id: string) => {
    setSelectedAlgos(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const toggleFeature = (col: string) => {
    setSelectedFeatures(prev => prev.includes(col) ? prev.filter(f => f !== col) : [...prev, col]);
  };

  const handleRun = () => {
    if (selectedAlgos.length === 0) return;
    const config: AnalysisConfig = {
      algorithms: selectedAlgos,
      scaling_method: scalingMethod,
      handle_missing: handleMissing,
      feature_columns: selectedFeatures.length > 0 ? selectedFeatures : [],
      kmeans_params: {
        n_clusters: kmeansNClusters === 0 ? null : kmeansNClusters,
        max_k: kmeansMaxK,
      },
      dbscan_params: { eps: dbscanEps, min_samples: dbscanMinSamples },
      gmm_params: {
        n_components: gmmComponents === 0 ? null : gmmComponents,
        covariance_type: gmmCovType,
      },
    };
    onAnalyze(config);
  };

  return (
    <section data-testid="section-config">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Settings className="w-3 h-3 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">02 — Configure Analysis</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Algorithms</h3>
            <div className="space-y-2">
              {ALGORITHMS.map(algo => {
                const active = selectedAlgos.includes(algo.id);
                return (
                  <button
                    key={algo.id}
                    data-testid={`toggle-algo-${algo.id}`}
                    onClick={() => toggleAlgo(algo.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 ${active ? "border-primary/50 bg-primary/10" : "border-border hover:border-border/80 bg-background"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${active ? "border-primary bg-primary" : "border-muted-foreground/50"}`}>
                        {active && <svg className="w-2 h-2 text-primary-foreground" viewBox="0 0 8 8" fill="currentColor"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{algo.label}</p>
                        <p className="text-xs text-muted-foreground">{algo.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Preprocessing</h3>
            <SelectField
              label="Scaling Method"
              value={scalingMethod}
              onChange={setScalingMethod}
              options={[
                { value: "standard", label: "Standard (Z-score)" },
                { value: "minmax", label: "MinMax (0-1)" },
                { value: "none", label: "No Scaling" },
              ]}
            />
            <SelectField
              label="Handle Missing Values"
              value={handleMissing}
              onChange={setHandleMissing}
              options={[
                { value: "mean", label: "Fill with Mean" },
                { value: "median", label: "Fill with Median" },
                { value: "zero", label: "Fill with Zero" },
                { value: "drop", label: "Drop Rows" },
              ]}
            />
            {summary.numeric_columns.length > 2 && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Feature Columns (all if none selected)</label>
                <div className="flex flex-wrap gap-1.5">
                  {summary.numeric_columns.map(col => {
                    const sel = selectedFeatures.includes(col);
                    return (
                      <button
                        key={col}
                        data-testid={`toggle-feature-${col}`}
                        onClick={() => toggleFeature(col)}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${sel ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                      >
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedAlgos.includes("kmeans") && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">KMeans Parameters</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Slider
                    label="Number of Clusters (0 = auto)"
                    value={kmeansNClusters}
                    min={0} max={15}
                    onChange={setKmeansNClusters}
                  />
                  {kmeansNClusters === 0 && (
                    <p className="text-xs text-primary/70">Elbow method will detect optimal K automatically</p>
                  )}
                </div>
                <Slider
                  label="Max K to test"
                  value={kmeansMaxK}
                  min={2} max={15}
                  onChange={setKmeansMaxK}
                />
              </div>
            </div>
          )}

          {selectedAlgos.includes("dbscan") && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">DBSCAN Parameters</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <Slider
                  label="Epsilon (neighborhood radius)"
                  value={dbscanEps}
                  min={0.1} max={5.0} step={0.1}
                  onChange={setDbscanEps}
                />
                <Slider
                  label="Min Samples"
                  value={dbscanMinSamples}
                  min={2} max={20}
                  onChange={setDbscanMinSamples}
                />
              </div>
            </div>
          )}

          {selectedAlgos.includes("gmm") && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest">GMM Parameters</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Slider
                    label="Components (0 = auto from KMeans)"
                    value={gmmComponents}
                    min={0} max={10}
                    onChange={setGmmComponents}
                  />
                  {gmmComponents === 0 && (
                    <p className="text-xs text-emerald-400/70">Will use KMeans optimal K if available</p>
                  )}
                </div>
                <SelectField
                  label="Covariance Type"
                  value={gmmCovType}
                  onChange={setGmmCovType}
                  options={[
                    { value: "full", label: "Full (unrestricted)" },
                    { value: "tied", label: "Tied (shared)" },
                    { value: "diag", label: "Diagonal" },
                    { value: "spherical", label: "Spherical" },
                  ]}
                />
              </div>
            </div>
          )}

          {selectedAlgos.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Select at least one algorithm to proceed
            </div>
          )}

          <button
            data-testid="button-run-analysis"
            onClick={handleRun}
            disabled={isAnalyzing || selectedAlgos.length === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-primary/20"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Running scikit-learn analysis...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Clustering Analysis
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
