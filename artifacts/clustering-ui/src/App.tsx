import { useState, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import DatasetSection from "@/components/DatasetSection";
import ConfigSection from "@/components/ConfigSection";
import ResultsSection from "@/components/ResultsSection";
import { Activity, Database, Settings, BarChart3 } from "lucide-react";
import { readJsonResponse } from "@/lib/api";

const queryClient = new QueryClient();

export type DatasetSummary = {
  n_rows: number;
  n_cols: number;
  columns: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  missing_values: Record<string, number>;
  statistics?: Record<string, { mean: number | null; std: number | null; min: number | null; max: number | null }>;
};

export type AnalysisConfig = {
  algorithms: string[];
  scaling_method: string;
  handle_missing: string;
  feature_columns: string[];
  kmeans_params: { n_clusters: number | null; max_k: number };
  dbscan_params: { eps: number; min_samples: number };
  gmm_params: { n_components: number | null; covariance_type: string };
};

export type AnalysisResults = {
  evaluation?: Record<string, { silhouette_score: number | null; davies_bouldin_score: number | null; calinski_harabasz_score: number | null; n_clusters: number }>;
  ranking?: Array<{ model: string; composite_score: number | null; silhouette_score: number | null; davies_bouldin_score: number | null; calinski_harabasz_score: number | null; n_clusters: number }>;
  kmeans?: { labels: number[]; wcss: number[]; k_values: number[]; optimal_k: number; cluster_sizes: Record<string, number>; inertia: number; n_clusters: number };
  dbscan?: { labels: number[]; n_clusters: number; n_noise: number; eps: number; min_samples: number; cluster_sizes: Record<string, number> };
  gmm?: { labels: number[]; probabilities: number[][]; n_components: number; avg_confidence: number; bic: number; aic: number; means: number[][]; cluster_sizes: Record<string, number> };
  points?: Array<{ idx: number; features: number[]; kmeans_label?: number; dbscan_label?: number; gmm_label?: number }>;
  preprocess_info?: { n_samples: number; n_features: number; feature_names: string[]; scaling_method: string };
  errors?: Record<string, string>;
};

function App() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeSection, setActiveSection] = useState<"dataset" | "config" | "results">("dataset");
  const configRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleDatasetLoaded = useCallback((sid: string, summary: DatasetSummary) => {
    setSessionId(sid);
    setDatasetSummary(summary);
    setAnalysisResults(null);
    setActiveSection("config");
    setTimeout(() => configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    toast({ title: "Dataset loaded", description: `${summary.n_rows} rows, ${summary.numeric_columns.length} numeric features` });
  }, [toast]);

  const handleAnalyze = useCallback(async (config: AnalysisConfig) => {
    if (!sessionId) return;
    setIsAnalyzing(true);
    setAnalysisResults(null);
    try {
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, ...config }),
      });
      const analyzeData = await readJsonResponse<AnalysisResults & { error?: string }>(analyzeRes, "Analysis failed");
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "Analysis failed");

      const resultsRes = await fetch(`/api/results?session_id=${sessionId}&include_points=true`);
      const resultsData = await readJsonResponse<AnalysisResults & { error?: string }>(resultsRes, "Failed to fetch results");
      if (!resultsRes.ok) throw new Error(resultsData.error || "Failed to fetch results");

      setAnalysisResults({ ...analyzeData, ...resultsData });
      setActiveSection("results");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

      const bestModel = analyzeData.ranking?.[0];
      toast({ title: "Analysis complete", description: bestModel ? `Best model: ${bestModel.model.toUpperCase()} (score: ${bestModel.composite_score?.toFixed(3) ?? "N/A"})` : "Clustering complete" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId, toast]);

  const steps = [
    { id: "dataset", label: "Dataset", icon: Database, done: !!sessionId },
    { id: "config", label: "Configure", icon: Settings, done: !!analysisResults },
    { id: "results", label: "Results", icon: BarChart3, done: !!analysisResults },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground tracking-tight">Hybrid Clustering Analyzer</h1>
                <p className="text-xs text-muted-foreground">KMeans · DBSCAN · GMM — scikit-learn backend</p>
              </div>
            </div>
            <nav className="flex items-center gap-1">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isActive = activeSection === step.id;
                const isDone = step.done;
                return (
                  <button
                    key={step.id}
                    data-testid={`nav-${step.id}`}
                    onClick={() => setActiveSection(step.id as typeof activeSection)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isActive ? "bg-primary/15 text-primary border border-primary/30" : isDone ? "text-foreground hover:bg-muted/50" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Icon className="w-3 h-3" />
                    {step.label}
                    {i < steps.length - 1 && <span className="ml-2 text-muted-foreground/30">›</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <DatasetSection onDatasetLoaded={handleDatasetLoaded} summary={datasetSummary} />
          {datasetSummary && (
            <div ref={configRef}>
              <ConfigSection
                summary={datasetSummary}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
              />
            </div>
          )}
          {analysisResults && (
            <div ref={resultsRef}>
              <ResultsSection results={analysisResults} />
            </div>
          )}
        </main>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
