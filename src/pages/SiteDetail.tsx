import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import AnalysisView from "@/components/AnalysisView";
import { getRecentAnalyses, type AnalysisRecord } from "@/lib/firebase/analyses";
import { getAllActionItems, type ActionItem } from "@/lib/firebase/actionItems";
import { getLiveBenchmarks, type LiveBenchmarkStats } from "@/lib/firebase/benchmarks";
import { getDomain } from "@/lib/dashboardMetrics";
import { buildAnalysisResultFromSite } from "@/lib/reconstructAnalysisResult";

const SiteDetail = () => {
  const { domain: rawDomain } = useParams<{ domain: string }>();
  const domain = decodeURIComponent(rawDomain ?? "");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [liveBenchmarks, setLiveBenchmarks] = useState<Record<string, LiveBenchmarkStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([getRecentAnalyses(user.uid), getAllActionItems(user.uid), getLiveBenchmarks()]).then(
      ([analysisRecords, items, benchmarks]) => {
        setRecords(analysisRecords);
        setActionItems(items);
        setLiveBenchmarks(benchmarks);
        setLoading(false);
      }
    );
  }, [user]);

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view this site.</p>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Loading site…</p>
        </div>
      </AppShell>
    );
  }

  const domainRecords = records.filter((r) => getDomain(r.url) === domain);

  if (domainRecords.length === 0) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">No audits found for {domain}.</p>
        </div>
      </AppShell>
    );
  }

  const result = buildAnalysisResultFromSite(domain, domainRecords, actionItems, liveBenchmarks);

  return (
    <AnalysisView
      result={result}
      onNewAnalysis={() => navigate("/")}
      onGoHome={() => navigate("/dashboard")}
    />
  );
};

export default SiteDetail;
