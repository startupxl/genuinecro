import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Globe, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { getRecentAnalyses, groupAnalysesByDomain, type SiteSummary } from "@/lib/firebase/analyses";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getRecentAnalyses(user.uid).then((records) => {
      setSites(groupAnalysesByDomain(records));
      setLoading(false);
    });
  }, [user]);

  const criticalCount = sites.filter((s) => s.latestScore < 50).length;
  const avgDelta = sites.length > 0
    ? Math.round(sites.reduce((sum, s) => sum + (s.scoreDelta ?? 0), 0) / sites.length)
    : 0;

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-primary rounded-lg p-4 text-primary-foreground">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70">Sites Tracked</p>
                <div className="h-7 w-7 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Globe className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-2xl font-semibold">{sites.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical (Score &lt; 50)</p>
                <div className="h-7 w-7 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                </div>
              </div>
              <p className="text-2xl font-semibold text-destructive">{criticalCount}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Score Trend</p>
                <div className={`h-7 w-7 rounded-full flex items-center justify-center ${avgDelta >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {avgDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-primary" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                </div>
              </div>
              <p className={`text-2xl font-semibold ${avgDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                {avgDelta >= 0 ? "+" : ""}{avgDelta}
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              Client Sites
            </div>
            {sites.map((site) => (
              <div
                key={site.domain}
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{site.domain}</p>
                  <p className="text-xs text-muted-foreground">{site.analysisCount} audit{site.analysisCount === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">{site.latestScore}</span>
                  {site.scoreDelta !== null && (
                    <span className={`flex items-center gap-0.5 text-xs ${site.scoreDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                      {site.scoreDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {site.scoreDelta >= 0 ? "+" : ""}{site.scoreDelta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
    </AppShell>
  );
};

export default Dashboard;
