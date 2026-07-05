import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { getRecentAnalyses, type AnalysisRecord } from "@/lib/firebase/analyses";
import { getAllActionItems, type ActionItem } from "@/lib/firebase/actionItems";
import { getDomain } from "@/lib/dashboardMetrics";
import { buildSiteFrictionSummary } from "@/lib/siteAggregation";
import { getCategoryTab } from "@/lib/mergedAudit";
import AggregatedFrictionRow from "@/components/AggregatedFrictionRow";

const TABS = ["All", "Technical", "Content", "Conversion", "Navigation", "Accessibility", "Performance"];

const SiteDetail = () => {
  const { domain: rawDomain } = useParams<{ domain: string }>();
  const domain = decodeURIComponent(rawDomain ?? "");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("All");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([getRecentAnalyses(user.uid), getAllActionItems(user.uid)]).then(([analysisRecords, items]) => {
      setRecords(analysisRecords);
      setActionItems(items);
      setLoading(false);
    });
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

  const domainPages = new Set(records.filter((r) => getDomain(r.url) === domain).map((r) => r.url));

  if (domainPages.size === 0) {
    return (
      <AppShell>
        <div className="p-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Dashboard
          </button>
          <p className="text-sm text-muted-foreground">No audits found for {domain}.</p>
        </div>
      </AppShell>
    );
  }

  const summary = buildSiteFrictionSummary(actionItems, domain);
  const filtered = selectedTab === "All" ? summary : summary.filter((p) => getCategoryTab(p.category) === selectedTab);

  return (
    <AppShell>
      <div className="p-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Dashboard
        </button>
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">{domain}</h1>
        <p className="text-xs text-muted-foreground mb-6">
          {domainPages.size} page{domainPages.size === 1 ? "" : "s"} audited · {summary.length} open issue{summary.length === 1 ? "" : "s"}
        </p>

        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                selectedTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {summary.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No open issues across {domain} — you're all caught up.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No issues in this category.</p>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((point) => (
              <AggregatedFrictionRow key={point.key} point={point} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default SiteDetail;
