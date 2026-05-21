import { useState, useRef, useCallback } from "react";
import { Upload, Database, FileText, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { DatasetSummary } from "@/App";
import { readJsonResponse } from "@/lib/api";

type SampleDataset = { name: string; description: string; rows: number; features: number };

type Props = {
  onDatasetLoaded: (sessionId: string, summary: DatasetSummary) => void;
  summary: DatasetSummary | null;
};

const SAMPLE_COLORS: Record<string, string> = {
  iris: "border-primary/40 hover:border-primary/70 hover:bg-primary/5",
  blobs: "border-purple-500/40 hover:border-purple-500/70 hover:bg-purple-500/5",
  moons: "border-emerald-500/40 hover:border-emerald-500/70 hover:bg-emerald-500/5",
  circles: "border-orange-500/40 hover:border-orange-500/70 hover:bg-orange-500/5",
  aniso: "border-rose-500/40 hover:border-rose-500/70 hover:bg-rose-500/5",
};

export default function DatasetSection({ onDatasetLoaded, summary }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleDataset[]>([]);
  const [samplesLoaded, setSamplesLoaded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSamples = useCallback(async () => {
    if (samplesLoaded) return;
    try {
      const res = await fetch("/api/samples");
      const data = await readJsonResponse<{ samples?: SampleDataset[] }>(res, "Failed to load samples");
      setSamples(data.samples || []);
      setSamplesLoaded(true);
    } catch {
      setSamples([]);
    }
  }, [samplesLoaded]);

  const uploadFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await readJsonResponse<{ error?: string; session_id: string; summary: DatasetSummary }>(res, "Upload failed");
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onDatasetLoaded(data.session_id, data.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSample = async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_sample: true, sample_name: name }),
      });
      const data = await readJsonResponse<{ error?: string; session_id: string; summary: DatasetSummary }>(res, "Failed to load sample");
      if (!res.ok) throw new Error(data.error || "Failed to load sample");
      onDatasetLoaded(data.session_id, data.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load sample");
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <section data-testid="section-dataset">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Database className="w-3 h-3 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest">01 — Dataset</h2>
        {summary && <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          data-testid="upload-dropzone"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 transition-all duration-200 ${isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-card"} ${isLoading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt" className="hidden" onChange={onFileChange} data-testid="input-file" />
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors ${isDragging ? "border-primary bg-primary/20" : "border-border bg-muted/30"}`}>
            <Upload className={`w-5 h-5 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          {isLoading ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Loading dataset...</span>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Drop a file here</p>
                <p className="text-xs text-muted-foreground mt-1">CSV, TSV, or JSON · Max 50 MB</p>
              </div>
              <span className="text-xs text-primary/70 border border-primary/30 rounded px-2 py-0.5">Browse files</span>
            </>
          )}
        </div>

        <div className="space-y-3">
          <button
            data-testid="button-load-samples"
            onClick={fetchSamples}
            className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors flex items-center justify-between"
          >
            <span className="text-sm font-medium text-foreground">Sample Datasets</span>
            <span className="text-xs text-primary">Load samples</span>
          </button>
          {samplesLoaded && samples.map((s) => (
            <button
              key={s.name}
              data-testid={`button-sample-${s.name}`}
              onClick={() => loadSample(s.name)}
              disabled={isLoading}
              className={`w-full text-left px-4 py-3 rounded-xl border bg-card transition-all duration-150 disabled:opacity-40 ${SAMPLE_COLORS[s.name] || "border-border/40 hover:border-border"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground capitalize">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{s.rows} rows</p>
                  <p className="text-xs text-muted-foreground">{s.features} features</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div data-testid="error-upload" className="mt-3 flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {summary && (
        <div data-testid="dataset-summary" className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Dataset Summary</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span data-testid="text-rows"><span className="text-foreground font-semibold">{summary.n_rows.toLocaleString()}</span> rows</span>
                <span data-testid="text-cols"><span className="text-foreground font-semibold">{summary.n_cols}</span> columns</span>
                <span data-testid="text-numeric"><span className="text-foreground font-semibold">{summary.numeric_columns.length}</span> numeric</span>
              </div>
              <button
                onClick={() => setStatsExpanded(v => !v)}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                {statsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {statsExpanded ? "Hide" : "Stats"}
              </button>
            </div>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {summary.numeric_columns.map(col => (
              <span key={col} data-testid={`badge-col-${col}`} className="px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary border border-primary/20">{col}</span>
            ))}
            {summary.categorical_columns.map(col => (
              <span key={col} className="px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground border border-border">{col}</span>
            ))}
          </div>
          {statsExpanded && summary.statistics && (
            <div className="px-5 pb-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Feature</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Mean</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Std</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Min</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Max</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Missing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.numeric_columns.map((col, i) => {
                      const stat = summary.statistics?.[col];
                      const missing = summary.missing_values[col] || 0;
                      return (
                        <tr key={col} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                          <td className="px-3 py-2 text-foreground font-medium">{col}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{stat?.mean != null ? stat.mean.toFixed(3) : "—"}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{stat?.std != null ? stat.std.toFixed(3) : "—"}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{stat?.min != null ? stat.min.toFixed(3) : "—"}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{stat?.max != null ? stat.max.toFixed(3) : "—"}</td>
                          <td className={`px-3 py-2 text-right ${missing > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{missing}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
