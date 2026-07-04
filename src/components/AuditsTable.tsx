import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import type { AuditListEntry } from "@/lib/dashboardMetrics";

interface AuditsTableProps {
  data: AuditListEntry[];
  onSelect: (id: string) => void;
  onRescan: (url: string) => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const AuditsTable = ({ data, onSelect, onRescan }: AuditsTableProps) => {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No audits yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground text-left">
          <th className="font-medium pb-2 pr-3">URL</th>
          <th className="font-medium pb-2 pr-3">Score</th>
          <th className="font-medium pb-2 pr-3">Issues</th>
          <th className="font-medium pb-2 pr-3">Last Scanned</th>
          <th className="font-medium pb-2" />
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr
            key={entry.id ?? `${entry.url}-${entry.createdAt}`}
            onClick={() => entry.id && onSelect(entry.id)}
            className="border-t border-border cursor-pointer hover:bg-secondary/50 transition-colors"
          >
            <td className="py-2 pr-3 text-foreground truncate max-w-xs">
              {entry.url}
              {entry.isCritical && (
                <span className="ml-2 inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                  Critical
                </span>
              )}
            </td>
            <td className="py-2 pr-3">
              <span className="font-mono font-medium text-foreground">{entry.score}</span>
              {entry.scoreDelta !== null && (
                <span className={`ml-1.5 inline-flex items-center gap-0.5 text-xs ${entry.scoreDelta >= 0 ? "text-primary" : "text-destructive"}`}>
                  {entry.scoreDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {entry.scoreDelta >= 0 ? "+" : ""}{entry.scoreDelta}
                </span>
              )}
            </td>
            <td className="py-2 pr-3 text-muted-foreground">{entry.issueCount}</td>
            <td className="py-2 pr-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
            <td className="py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRescan(entry.url);
                }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
              >
                <RefreshCw className="h-3 w-3" /> Re-scan
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AuditsTable;
