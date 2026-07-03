import type { ScanHistoryEntry } from "@/lib/dashboardMetrics";

interface SiteHistoryTableProps {
  data: ScanHistoryEntry[];
  onSelect: (id: string) => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const SiteHistoryTable = ({ data, onSelect }: SiteHistoryTableProps) => {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No scan history yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground text-left">
          <th className="font-medium pb-2 pr-3">Date</th>
          <th className="font-medium pb-2 pr-3">Page</th>
          <th className="font-medium pb-2 pr-3">Type</th>
          <th className="font-medium pb-2">Score</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr
            key={entry.id}
            onClick={() => entry.id && onSelect(entry.id)}
            className="border-t border-border cursor-pointer hover:bg-secondary/50 transition-colors"
          >
            <td className="py-2 pr-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
            <td className="py-2 pr-3 text-foreground truncate max-w-xs">{entry.url}</td>
            <td className="py-2 pr-3 text-muted-foreground">{entry.analysisType}</td>
            <td className="py-2 font-mono font-medium text-foreground">{entry.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default SiteHistoryTable;
