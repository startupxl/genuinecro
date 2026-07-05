import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, Play, Download, FileDown, Loader2, CheckCircle2, XCircle, AlertTriangle, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AppShell from "@/components/AppShell";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { usePlanCapabilities } from "@/hooks/usePlanCapabilities";
import { analyzeUrl } from "@/lib/api/analyze";
import { createActionItems } from "@/lib/firebase/actionItems";
import { createScanJob, completeScanJob } from "@/lib/firebase/scanJobs";
import { toast } from "sonner";
import type { AnalysisResult, AnalysisType } from "@/lib/mockData";
import { detectPageType, extractCategoryScores, analysisTypeLabels } from "@/lib/mockData";
import { generateTemplateCsv, parseCsvText, parseBulkRows } from "@/lib/bulkTemplate";
import { computeGoalWeightedScore, GOAL_LABELS, type ConversionGoal } from "@/lib/conversionGoals";
import ConversionGoalSelect from "@/components/ConversionGoalSelect";

interface BulkItem {
  url: string;
  pageType?: AnalysisType;
  conversionGoal?: ConversionGoal;
  status: "pending" | "running" | "done" | "error";
  result?: AnalysisResult;
  error?: string;
  score?: number;
  frictionCount?: number;
}

function isGoalComplete(goal: ConversionGoal | null): boolean {
  if (!goal) return false;
  return goal.type !== "custom" || !!goal.customLabel?.trim();
}

const BulkAnalysis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { usage, trackAnalysis } = useUsageTracking();
  const capabilities = usePlanCapabilities();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BulkItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("homepage");
  const [autoDetectType, setAutoDetectType] = useState(true);
  const [defaultGoal, setDefaultGoal] = useState<ConversionGoal | null>(null);

  const maxUrls = capabilities.auditLimit > 0 ? Math.min(capabilities.auditLimit, usage.limit - usage.used) : 0;

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Please upload a .csv or .xlsx file");
      return;
    }

    try {
      let rows: string[][];
      if (ext === "csv") {
        const text = await file.text();
        rows = parseCsvText(text);
      } else {
        // XLSX parsing using SheetJS from CDN
        const arrayBuffer = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      }

      const parsed = parseBulkRows(rows);
      if (parsed.length === 0) {
        toast.error("No valid URLs found in file");
        return;
      }
      const capped = parsed.slice(0, maxUrls);
      if (parsed.length > maxUrls) {
        toast.info(`Loaded ${capped.length} of ${parsed.length} URLs (limited by remaining audits)`);
      }
      setItems(capped.map((row) => ({ url: row.url, pageType: row.pageType, conversionGoal: row.conversionGoal, status: "pending" })));
    } catch (err) {
      console.error("File parse error:", err);
      toast.error("Failed to parse file");
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [maxUrls]);

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([generateTemplateCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "genuinecro-bulk-audit-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (items.length === 0) return;
    setIsRunning(true);

    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") continue;
      setCurrentIndex(i);
      setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, status: "running" } : item));

      const url = items[i].url;
      const type = items[i].pageType ?? (autoDetectType ? detectPageType(url) : analysisType);
      const goal = items[i].conversionGoal ?? defaultGoal ?? undefined;
      const jobId = user ? await createScanJob(user.uid, url, type, "desktop") : null;

      try {
        const result = await analyzeUrl(url, type, "desktop");
        const categoryScores = extractCategoryScores(result.benchmark);
        const conversionScore = goal && Object.keys(categoryScores).length > 0
          ? computeGoalWeightedScore(categoryScores, goal)
          : (result.conversionScore ?? result.benchmark.overallScore);
        await trackAnalysis(url, type, "desktop", conversionScore, categoryScores, undefined, goal);
        if (user) await createActionItems(user.uid, url, type, result.frictionPoints);
        const avgScore = result.frictionPoints.length > 0
          ? Math.round(result.frictionPoints.reduce((s, p) => s + p.impactScore, 0) / result.frictionPoints.length)
          : 0;

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "done", result, score: avgScore, frictionCount: result.frictionPoints.length }
              : item
          )
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "error", error: err instanceof Error ? err.message : "Analysis failed" }
              : item
          )
        );
      }

      await completeScanJob(jobId);
    }

    setIsRunning(false);
    setCurrentIndex(-1);
    toast.success("Bulk analysis complete");
  }, [items, autoDetectType, analysisType, defaultGoal, trackAnalysis, user]);

  const downloadResults = useCallback(() => {
    const completed = items.filter((i) => i.status === "done" && i.result);
    if (completed.length === 0) {
      toast.error("No completed results to download");
      return;
    }

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["URL", "Page Type", "Friction Points", "Avg Impact", "High Severity", "Med Severity", "Low Severity", "Top Issues"].join(","),
      ...completed.map((item) => {
        const r = item.result!;
        const high = r.frictionPoints.filter((p) => p.severity === "high").length;
        const med = r.frictionPoints.filter((p) => p.severity === "med").length;
        const low = r.frictionPoints.filter((p) => p.severity === "low").length;
        const topIssues = r.frictionPoints.slice(0, 3).map((p) => p.title).join("; ");
        return [
          escape(r.url),
          escape(r.analysisType),
          r.frictionPoints.length,
          item.score ?? 0,
          high,
          med,
          low,
          escape(topIssues),
        ].join(",");
      }),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `genuinecro-bulk-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  }, [items]);

  const removeItem = (idx: number) => {
    if (isRunning) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const completedCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const progressPercent = items.length > 0 ? Math.round(((completedCount + errorCount) / items.length) * 100) : 0;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto w-full px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Bulk Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV or Excel file with URLs to analyze them sequentially.
            You have <span className="font-medium text-foreground">{Math.max(0, usage.limit - usage.used)}</span> audits remaining.
          </p>
        </div>

        {/* Upload card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload URLs</CardTitle>
            <CardDescription>
              Download the template, fill in a URL per row (and optionally its Page Type), then upload it back.
              Max {maxUrls > 0 ? maxUrls : 0} URLs based on your remaining audits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <FileDown className="h-4 w-4 mr-1" />
                Download Template
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isRunning}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning || maxUrls <= 0}
              >
                <Upload className="h-4 w-4 mr-1" />
                Choose File
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDetectType}
                    onChange={(e) => setAutoDetectType(e.target.checked)}
                    className="rounded border-border"
                    disabled={isRunning}
                  />
                  Auto-detect page type when not specified in the file
                </label>
              </div>

              {!autoDetectType && (
                <select
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
                  className="h-8 text-xs bg-secondary text-foreground rounded-md px-2 border-none"
                  disabled={isRunning}
                >
                  {(Object.entries(analysisTypeLabels) as [AnalysisType, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Default conversion goal (used for any row that doesn't specify its own)
              </label>
              <div className="max-w-sm">
                <ConversionGoalSelect value={defaultGoal} onChange={setDefaultGoal} disabled={isRunning} />
              </div>
            </div>

            {maxUrls <= 0 && (
              <p className="text-xs text-destructive">
                You've reached your audit limit.{" "}
                <button onClick={() => navigate("/subscription")} className="underline text-primary">
                  Upgrade your plan
                </button>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Items list */}
        {items.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  {items.length} URLs loaded
                </CardTitle>
                <div className="flex items-center gap-2">
                  {completedCount > 0 && (
                    <Button variant="outline" size="sm" onClick={downloadResults} disabled={isRunning}>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download Report
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={runAnalysis}
                    disabled={isRunning || items.every((i) => i.status === "done") || !isGoalComplete(defaultGoal)}
                  >
                    {isRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1" />
                    )}
                    {isRunning ? `Analyzing ${currentIndex + 1}/${items.length}…` : "Start Analysis"}
                  </Button>
                </div>
              </div>
              {isRunning && (
                <Progress value={progressPercent} className="h-1.5 mt-2" />
              )}
              {!isRunning && completedCount > 0 && (
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" />{completedCount} completed</span>
                  {errorCount > 0 && <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" />{errorCount} failed</span>}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="w-36">Page Type</TableHead>
                      <TableHead className="w-40">Goal</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-20 text-center">Issues</TableHead>
                      <TableHead className="w-24 text-center">Avg Impact</TableHead>
                      <TableHead className="w-32">Severity</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow
                        key={idx}
                        className={cn(
                          item.status === "running" && "bg-primary/5",
                          item.status === "done" && item.result && "cursor-pointer hover:bg-muted"
                        )}
                        onClick={() => {
                          if (item.status === "done" && item.result) {
                            navigate("/", { state: { analysisResult: item.result } });
                          }
                        }}
                      >
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-mono max-w-[300px] truncate">{item.url}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.pageType ? analysisTypeLabels[item.pageType] : <span className="italic">Auto-detect</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.conversionGoal
                            ? GOAL_LABELS[item.conversionGoal.type]
                            : <span className="italic">Default</span>}
                        </TableCell>
                        <TableCell>
                          {item.status === "pending" && <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                          {item.status === "running" && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />Running
                            </Badge>
                          )}
                          {item.status === "done" && (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Done
                            </Badge>
                          )}
                          {item.status === "error" && (
                            <Badge variant="destructive" className="text-[10px]">
                              <XCircle className="h-2.5 w-2.5 mr-1" />Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium">
                          {item.frictionCount ?? "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium">
                          {item.score != null ? `${item.score}/10` : "—"}
                        </TableCell>
                        <TableCell>
                          {item.result ? (
                            <div className="flex items-center gap-1">
                              {item.result.frictionPoints.filter((p) => p.severity === "high").length > 0 && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                  {item.result.frictionPoints.filter((p) => p.severity === "high").length} high
                                </Badge>
                              )}
                              {item.result.frictionPoints.filter((p) => p.severity === "med").length > 0 && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/50 text-amber-600">
                                  {item.result.frictionPoints.filter((p) => p.severity === "med").length} med
                                </Badge>
                              )}
                            </div>
                          ) : item.error ? (
                            <span className="text-[10px] text-destructive">{item.error.slice(0, 40)}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {!isRunning && item.status !== "running" && (
                            <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-foreground">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Upload a CSV or Excel file to get started</p>
            <p className="text-xs mt-1">Each row should contain a URL to analyze</p>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default BulkAnalysis;
