import { useEffect, useState } from "react";
import { Copy, Trash2, FileBarChart } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { getSharedReportsForUser, revokeSharedReport, type SharedReport } from "@/lib/firebase/sharedReports";
import { toast } from "sonner";

const Reports = () => {
  const { user } = useAuth();
  const [shares, setShares] = useState<SharedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    getSharedReportsForUser(user.uid)
      .then((result) => {
        setShares(result);
      })
      .catch((err) => {
        console.error("Failed to load shared reports:", err);
        setLoadError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to view reports.</p>
        </div>
      </AppShell>
    );
  }

  const handleCopyLink = (shareId: string) => {
    const link = `${window.location.origin}/reports/shared/${shareId}`;
    navigator.clipboard.writeText(link);
    toast.success("Share link copied to clipboard");
  };

  const handleRevoke = async (shareId: string) => {
    await revokeSharedReport(shareId);
    setShares((prev) => prev.filter((s) => s.id !== shareId));
    toast.success("Share link revoked");
  };

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">Reports</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Manage the read-only report links you've shared. Open any audit and use its Share button to create a new one.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-friction-high">Couldn't load your reports. Please try refreshing the page.</p>
        ) : shares.length === 0 ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <FileBarChart className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>You haven't shared any reports yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => (
              <div key={share.id} className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{share.reportData.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {share.reportData.conversionScore}/100 · Shared {new Date(share.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleCopyLink(share.id)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleRevoke(share.id)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-medium text-friction-high hover:bg-secondary transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Reports;
