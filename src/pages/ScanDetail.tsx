import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { getAnalysisById, getRecentAnalyses, type AnalysisRecord } from "@/lib/firebase/analyses";
import { getAllActionItems, type ActionItem } from "@/lib/firebase/actionItems";
import { getLiveBenchmarks, type LiveBenchmarkStats } from "@/lib/firebase/benchmarks";
import { buildSingleScanCategoryScores, getNextAnalysisCreatedAt, filterActionItemsForScan } from "@/lib/dashboardMetrics";
import CategoryDeltaBar from "@/components/CategoryDeltaBar";
import TopIssuesList from "@/components/TopIssuesList";

const ScanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scan, setScan] = useState<AnalysisRecord | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [liveBenchmarks, setLiveBenchmarks] = useState<Record<string, LiveBenchmarkStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) {
      setLoading(false);
      return;
    }
    Promise.all([
      getAnalysisById(id),
      getRecentAnalyses(user.uid),
      getAllActionItems(user.uid),
      getLiveBenchmarks(),
    ]).then(([scanRecord, analysisRecords, items, benchmarks]) => {
      setScan(scanRecord);
      setAnalyses(analysisRecords);
      setActionItems(items);
      setLiveBenchmarks(benchmarks);
      setLoading(false);
    });
  }, [user, id]);

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view scan detail.</p>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading scan…</p>
        </div>
      </AppShell>
    );
  }

  if (!scan) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Scan not found.</p>
        </div>
      </AppShell>
    );
  }

  const categoryData = buildSingleScanCategoryScores(scan.categoryScores ?? {}, liveBenchmarks);
  const nextCreatedAt = getNextAnalysisCreatedAt(analyses, scan.url, scan.createdAt);
  const matchedIssues = filterActionItemsForScan(actionItems, scan.url, scan.createdAt, nextCreatedAt);

  return (
    <AppShell>
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">{scan.url}</h1>
        <p className="text-xs text-muted-foreground mb-6">
          {scan.analysisType} · {scan.device} · {new Date(scan.createdAt).toLocaleString()}
        </p>

        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Score</p>
          <p className="text-3xl font-semibold text-foreground">{scan.conversionScore}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              Category Scores
            </div>
            <div className="p-4">
              <CategoryDeltaBar data={categoryData} />
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              Issues Found in This Scan
            </div>
            <div className="p-4">
              <TopIssuesList items={matchedIssues} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default ScanDetail;
