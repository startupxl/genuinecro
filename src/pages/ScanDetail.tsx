import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import AnalysisView from "@/components/AnalysisView";
import { getAnalysisById, getRecentAnalyses, type AnalysisRecord } from "@/lib/firebase/analyses";
import { getAllActionItems, type ActionItem } from "@/lib/firebase/actionItems";
import { getLiveBenchmarks, type LiveBenchmarkStats } from "@/lib/firebase/benchmarks";
import { getNextAnalysisCreatedAt, filterActionItemsForScan } from "@/lib/dashboardMetrics";
import { buildAnalysisResultFromScan } from "@/lib/reconstructAnalysisResult";

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

  const nextCreatedAt = getNextAnalysisCreatedAt(analyses, scan.url, scan.createdAt);
  const matchedItems = filterActionItemsForScan(actionItems, scan.url, scan.createdAt, nextCreatedAt);
  const result = buildAnalysisResultFromScan(scan, matchedItems, liveBenchmarks);

  return (
    <AnalysisView
      result={result}
      analysisId={scan.id}
      onNewAnalysis={(url) => navigate("/", { state: { prefillUrl: url } })}
      onGoHome={() => navigate("/audits")}
    />
  );
};

export default ScanDetail;
