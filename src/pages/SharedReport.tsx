import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PublicToolLayout from "@/components/PublicToolLayout";
import { getSharedReport, type SharedReport as SharedReportData } from "@/lib/firebase/sharedReports";
import { categoryLabels } from "@/lib/mockData";

const severityLabels: Record<string, string> = { high: "Critical", med: "Warning", low: "Info" };
const severityClass: Record<string, string> = {
  high: "border-l-friction-high",
  med: "border-l-friction-med",
  low: "border-l-friction-low",
};

const SharedReport = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [share, setShare] = useState<SharedReportData | null | undefined>(undefined);

  useEffect(() => {
    if (!shareId) return;
    getSharedReport(shareId)
      .then(setShare)
      .catch((err) => {
        console.error("Failed to load shared report:", err);
        setShare(null);
      });
  }, [shareId]);

  if (share === undefined) {
    return (
      <PublicToolLayout title="Shared Report" description="Loading report…">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PublicToolLayout>
    );
  }

  if (share === null) {
    return (
      <PublicToolLayout title="Shared Report" description="This report is no longer available.">
        <p className="text-sm text-muted-foreground">
          This share link may have been revoked, or never existed.
        </p>
      </PublicToolLayout>
    );
  }

  const { reportData } = share;

  return (
    <PublicToolLayout
      title="Conversion Audit Report"
      description="A read-only, shared conversion friction report from GenuineCRO."
    >
      <div className="bg-surface border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversion Score</span>
          <span className="text-2xl font-semibold text-foreground">
            {reportData.conversionScore}<span className="text-xs font-normal text-muted-foreground">/100</span>
          </span>
        </div>
        <p className="text-sm text-foreground">{reportData.url}</p>
        <p className="text-xs text-muted-foreground capitalize">{reportData.analysisType} · {reportData.device}</p>
      </div>

      <div className="space-y-3">
        {reportData.frictionPoints.map((point, i) => (
          <div
            key={i}
            className={`bg-surface border border-border rounded-lg p-4 border-l-4 ${severityClass[point.severity] ?? ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {categoryLabels[point.category] ?? point.category}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {severityLabels[point.severity] ?? point.severity}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">{point.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{point.description}</p>
            <p className="text-xs text-foreground mt-2">
              <span className="font-medium">Fix:</span> {point.fix}
            </p>
          </div>
        ))}
      </div>
    </PublicToolLayout>
  );
};

export default SharedReport;
