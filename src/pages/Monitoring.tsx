import { useEffect, useState, useCallback } from "react";
import { Activity, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import AppShell from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { getRecentAnalyses, groupAnalysesByDomain, type AnalysisRecord, type SiteSummary } from "@/lib/firebase/analyses";
import { getSiteSettings, saveSiteSettings } from "@/lib/firebase/siteSettings";
import { runMergedAudit } from "@/lib/mergedAudit";
import { extractCategoryScores } from "@/lib/mockData";
import { createActionItems, getActiveActionItems } from "@/lib/firebase/actionItems";
import { createMonitoringAlert, getMonitoringAlerts, type MonitoringAlert } from "@/lib/firebase/monitoringAlerts";
import { detectMonitoringAlert } from "@/lib/monitoringCheck";
import { toast } from "sonner";

const Monitoring = () => {
  const { user } = useAuth();
  const { usage, trackAnalysis } = useUsageTracking();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [monitoringEnabled, setMonitoringEnabled] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [checkingDomain, setCheckingDomain] = useState<string | null>(null);
  const [lastResultByDomain, setLastResultByDomain] = useState<Record<string, { scoreDelta: number; newCriticalIssueTitles: string[] }>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [analysisRecords, alertRecords] = await Promise.all([
        getRecentAnalyses(user.uid),
        getMonitoringAlerts(user.uid),
      ]);
      setRecords(analysisRecords);
      setAlerts(alertRecords);

      const sites = groupAnalysesByDomain(analysisRecords);
      const settingsEntries = await Promise.all(
        sites.map(async (site) => [site.domain, (await getSiteSettings(user.uid, site.domain))?.monitoringEnabled ?? false] as const)
      );
      setMonitoringEnabled(Object.fromEntries(settingsEntries));
    } catch (err) {
      console.error("Failed to load monitoring data:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view monitoring.</p>
        </div>
      </AppShell>
    );
  }

  const sites: SiteSummary[] = groupAnalysesByDomain(records);

  const handleToggle = async (domain: string, enabled: boolean) => {
    setMonitoringEnabled((prev) => ({ ...prev, [domain]: enabled }));
    await saveSiteSettings(user.uid, domain, { monitoringEnabled: enabled });
  };

  const handleCheckNow = async (site: SiteSummary) => {
    if (!usage.canAnalyze) {
      toast.error("You've reached your plan's audit limit for this period.");
      return;
    }

    const latestRecord = [...records]
      .filter((r) => {
        try {
          return new URL(r.url).hostname.replace(/^www\./, "") === site.domain;
        } catch {
          return false;
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!latestRecord) return;

    setCheckingDomain(site.domain);
    try {
      const previousCritical = (await getActiveActionItems(user.uid))
        .filter((item) => {
          try {
            return new URL(item.url).hostname.replace(/^www\./, "") === site.domain;
          } catch {
            return false;
          }
        })
        .filter((item) => item.severity === "high")
        .map((item) => item.title);

      const result = await runMergedAudit(
        latestRecord.url,
        latestRecord.analysisType as any,
        latestRecord.device as "desktop" | "mobile",
        null,
        undefined
      );

      await trackAnalysis(
        latestRecord.url,
        latestRecord.analysisType,
        latestRecord.device,
        result.conversionScore,
        extractCategoryScores(result.benchmark),
        result.technicalScore ?? undefined
      );
      await createActionItems(user.uid, latestRecord.url, latestRecord.analysisType, result.frictionPoints);

      const alert = detectMonitoringAlert({
        previousScore: site.latestScore,
        newScore: result.conversionScore,
        previousCriticalTitles: previousCritical,
        newFrictionPoints: result.frictionPoints,
      });

      setLastResultByDomain((prev) => ({
        ...prev,
        [site.domain]: alert ?? { scoreDelta: result.conversionScore - site.latestScore, newCriticalIssueTitles: [] },
      }));

      if (alert) {
        await createMonitoringAlert({
          userId: user.uid,
          domain: site.domain,
          previousScore: site.latestScore,
          newScore: result.conversionScore,
          scoreDelta: alert.scoreDelta,
          newCriticalIssueTitles: alert.newCriticalIssueTitles,
        });
        toast.warning(`Score dropped or a new critical issue appeared for ${site.domain}`);
      } else {
        toast.success(`No significant change for ${site.domain}`);
      }

      await load();
    } catch (err) {
      toast.error("Check failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setCheckingDomain(null);
    }
  };

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">Monitoring</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Turn on monitoring for a site, then use Check now to re-scan it and see if anything has changed since the last audit.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading sites…</p>
        ) : loadError ? (
          <p className="text-sm text-friction-high">Couldn't load monitoring data. Please try refreshing the page.</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Run an audit first to start monitoring a site.</p>
        ) : (
          <div className="space-y-3 mb-8">
            {sites.map((site) => {
              const result = lastResultByDomain[site.domain];
              return (
                <div key={site.domain} className="bg-surface border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Switch
                        checked={!!monitoringEnabled[site.domain]}
                        onCheckedChange={(checked) => handleToggle(site.domain, checked)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{site.domain}</p>
                        <p className="text-xs text-muted-foreground">Last score: {site.latestScore}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCheckNow(site)}
                      disabled={checkingDomain === site.domain}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <RefreshCw className={`h-3 w-3 ${checkingDomain === site.domain ? "animate-spin" : ""}`} />
                      {checkingDomain === site.domain ? "Checking…" : "Check now"}
                    </button>
                  </div>

                  {result && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      {result.scoreDelta !== 0 || result.newCriticalIssueTitles.length > 0 ? (
                        <div className="flex items-start gap-2 text-xs text-friction-high">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>
                            Score {result.scoreDelta < 0 ? "dropped" : "changed"} by {Math.abs(result.scoreDelta)} points
                            {result.newCriticalIssueTitles.length > 0 && (
                              <> — new critical issue{result.newCriticalIssueTitles.length > 1 ? "s" : ""}: {result.newCriticalIssueTitles.join(", ")}</>
                            )}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No significant change detected.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Alert History</h2>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts yet.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="bg-surface border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{alert.domain}</p>
                    <span className={`text-xs font-medium ${alert.scoreDelta < 0 ? "text-friction-high" : "text-muted-foreground"}`}>
                      {alert.scoreDelta > 0 ? "+" : ""}{alert.scoreDelta} pts
                    </span>
                  </div>
                  {alert.newCriticalIssueTitles.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {alert.newCriticalIssueTitles.map((title) => (
                        <li key={title} className="text-xs text-muted-foreground">{title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Monitoring;
