import type { PageBreakdownEntry } from "@/lib/dashboardMetrics";

interface PageBreakdownTableProps {
  data: PageBreakdownEntry[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const PageBreakdownTable = ({ data }: PageBreakdownTableProps) => {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No pages audited yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground text-left">
          <th className="font-medium pb-2 pr-3">Page</th>
          <th className="font-medium pb-2 pr-3">Type</th>
          <th className="font-medium pb-2 pr-3">Score</th>
          <th className="font-medium pb-2 pr-3">Issues</th>
          <th className="font-medium pb-2">Last Crawled</th>
        </tr>
      </thead>
      <tbody>
        {data.map((page) => (
          <tr key={page.url} className="border-t border-border">
            <td className="py-2 pr-3 text-foreground truncate max-w-xs">{page.url}</td>
            <td className="py-2 pr-3 text-muted-foreground">{page.analysisType}</td>
            <td className="py-2 pr-3 font-mono font-medium text-foreground">{page.score}</td>
            <td className="py-2 pr-3 text-muted-foreground">{page.issueCount}</td>
            <td className="py-2 text-muted-foreground">{formatDate(page.lastCrawled)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PageBreakdownTable;
