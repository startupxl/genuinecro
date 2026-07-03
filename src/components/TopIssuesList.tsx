import type { ActionItem } from "@/lib/firebase/actionItems";
import { categoryLabels } from "@/lib/mockData";

interface TopIssuesListProps {
  items: ActionItem[];
}

const severityBorderClass: Record<ActionItem["severity"], string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const TopIssuesList = ({ items }: TopIssuesListProps) => {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No issues found yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className={`bg-background rounded-md p-3 ${severityBorderClass[item.severity]}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {categoryLabels[item.category] ?? item.category}
            </span>
            <span className="text-xs font-mono font-medium text-foreground">{item.impactScore}</span>
          </div>
          <p className="text-sm font-medium text-foreground mb-1">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.fix}</p>
        </div>
      ))}
    </div>
  );
};

export default TopIssuesList;
