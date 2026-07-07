import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { getRecentAnalyses, type AnalysisRecord } from "@/lib/firebase/analyses";
import { getAllActionItems, type ActionItem } from "@/lib/firebase/actionItems";
import { buildAuditsList } from "@/lib/dashboardMetrics";
import AuditsTable from "@/components/AuditsTable";
import NewAuditModal from "@/components/NewAuditModal";

const Audits = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewAuditOpen, setIsNewAuditOpen] = useState(false);

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

  const audits = buildAuditsList(records, actionItems, null);

  const handleRescan = (url: string) => {
    navigate("/", { state: { prefillUrl: url } });
  };

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view your audits.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground font-display">Audits</h1>
          <button
            onClick={() => setIsNewAuditOpen(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Audit
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading audits…</p>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="p-4 overflow-x-auto">
              <AuditsTable
                data={audits}
                onSelect={(id) => navigate(`/audits/${id}`)}
                onRescan={handleRescan}
              />
            </div>
          </div>
        )}
      </div>
      <NewAuditModal open={isNewAuditOpen} onOpenChange={setIsNewAuditOpen} />
    </AppShell>
  );
};

export default Audits;
