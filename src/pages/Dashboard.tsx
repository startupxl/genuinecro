import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Globe, TrendingUp, TrendingDown, AlertTriangle, X, FileText, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { getRecentAnalyses, groupAnalysesByDomain, type AnalysisRecord } from "@/lib/firebase/analyses";
import { getAllActionItems, type ActionItem } from "@/lib/firebase/actionItems";
import { getLiveBenchmarks, type LiveBenchmarkStats } from "@/lib/firebase/benchmarks";
import {
  buildScoreTrendData,
  buildSeverityBreakdown,
  buildPageBreakdown,
  buildHeroScoreSummary,
  buildCategoryScoreBreakdown,
  buildIssueMomentum,
  getDomain,
} from "@/lib/dashboardMetrics";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import CategoryBreakdownChart from "@/components/CategoryBreakdownChart";
import CategoryDeltaBar from "@/components/CategoryDeltaBar";
import HeroScoreCard from "@/components/HeroScoreCard";
import TopIssuesList from "@/components/TopIssuesList";
import PageBreakdownTable from "@/components/PageBreakdownTable";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [liveBenchmarks, setLiveBenchmarks] = useState<Record<string, LiveBenchmarkStats>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);

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

  const sites = groupAnalysesByDomain(records);
  const criticalCount = sites.filter((s) => s.latestScore < 50).length;
  const displayedSites = criticalOnly ? sites.filter((s) => s.latestScore < 50) : sites;

  const scoreTrendData = buildScoreTrendData(records, selectedDomain);
  const categoryScoreData = buildCategoryScoreBreakdown(records, selectedDomain, liveBenchmarks);
  const severityData = buildSeverityBreakdown(actionItems, selectedDomain);
  const issueMomentum = buildIssueMomentum(actionItems, records, selectedDomain);
  const heroSummary = buildHeroScoreSummary(sites, records);
  const pageData = buildPageBreakdown(records, actionItems).filter(
    (p) => !selectedDomain || p.domain === selectedDomain
  );
  const topIssues = actionItems
    .filter((i) => i.status === "open")
    .filter((i) => !selectedDomain || getDomain(i.url) === selectedDomain)
    .filter((i) => !selectedCategory || i.category === selectedCategory)
    .slice()
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5);

  const handleRescan = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    navigate("/", { state: { prefillUrl: `https://${url}` } });
  };

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view your dashboard.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground font-display">Dashboard</h1>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Audit
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your audits…</p>
      ) : sites.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No audits yet — run your first analysis to see it here.</p>
        </div>
      ) : (
        <>
          <HeroScoreCard summary={heroSummary} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sites Tracked</p>
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground">{sites.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pages Audited</p>
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-foreground">{heroSummary.pagesAudited}</p>
            </div>
            <button
              type="button"
              onClick={() => setCriticalOnly((v) => !v)}
              className={`text-left bg-surface border rounded-lg p-4 transition-colors ${
                criticalOnly ? "border-destructive ring-1 ring-destructive/30" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical (Score &lt; 50)</p>
                <div className="h-7 w-7 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-destructive">{criticalCount}</p>
            </button>
          </div>

          <div className="bg-surface border border-border rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Client Sites</span>
              {criticalOnly && (
                <button
                  onClick={() => setCriticalOnly(false)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" /> Showing critical only
                </button>
              )}
            </div>
            {displayedSites.map((site) => {
              const worstCategory = buildCategoryScoreBreakdown(records, site.domain, liveBenchmarks)[0];
              return (
                <div
                  key={site.domain}
                  data-testid="site-row"
                  onClick={() => setSelectedDomain((d) => (d === site.domain ? null : site.domain))}
                  className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 cursor-pointer transition-colors hover:bg-secondary/50 ${
                    selectedDomain === site.domain ? "bg-secondary" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{site.domain}</p>
                    <p className="text-xs text-muted-foreground">
                      {site.analysisCount} audit{site.analysisCount === 1 ? "" : "s"}
                      {worstCategory && <> · Worst: {worstCategory.label}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">{site.latestScore}</span>
                      {site.scoreDelta !== null && (
                        <span className={`flex items-center gap-0.5 text-xs ${site.scoreDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                          {site.scoreDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {site.scoreDelta >= 0 ? "+" : ""}{site.scoreDelta}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleRescan(e, site.domain)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
                    >
                      <RefreshCw className="h-3 w-3" /> Re-scan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {(selectedDomain || selectedCategory) && (
            <div className="flex items-center gap-3 mb-4 -mt-3">
              {selectedDomain && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Filtered to {selectedDomain}</span>
                  <button
                    onClick={() => setSelectedDomain(null)}
                    className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                </div>
              )}
              {selectedCategory && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Category: {categoryScoreData.find((c) => c.category === selectedCategory)?.label ?? selectedCategory}
                  </span>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                Score Trend
              </div>
              <div className="p-4">
                <ScoreTrendChart data={scoreTrendData} />
              </div>
            </div>
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                Category Scores
              </div>
              <div className="p-4">
                <CategoryDeltaBar
                  data={categoryScoreData}
                  selectedCategory={selectedCategory}
                  onCategoryClick={(cat) => setSelectedCategory((c) => (c === cat ? null : cat))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3 mb-6">
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                Issues by Severity
              </div>
              <div className="p-4">
                <CategoryBreakdownChart data={severityData} />
                {(issueMomentum.newSinceLastScan > 0 || issueMomentum.resolvedSinceLastScan > 0) && (
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                    <span className="text-destructive font-medium">+{issueMomentum.newSinceLastScan} new</span>
                    {" · "}
                    <span className="text-primary font-medium">−{issueMomentum.resolvedSinceLastScan} resolved</span>
                    {" since last scan"}
                  </p>
                )}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                Top Issues
              </div>
              <div className="p-4">
                <TopIssuesList items={topIssues} />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              Page Breakdown
            </div>
            <div className="p-4 overflow-x-auto">
              <PageBreakdownTable data={pageData} />
            </div>
          </div>
        </>
      )}
      </div>
    </AppShell>
  );
};

export default Dashboard;
