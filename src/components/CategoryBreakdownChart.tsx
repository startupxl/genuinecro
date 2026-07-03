import type { CategoryBreakdownEntry } from "@/lib/dashboardMetrics";

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownEntry[];
}

const CategoryBreakdownChart = ({ data }: CategoryBreakdownChartProps) => {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">No friction found yet.</p>
    );
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-3">
      {data.map((entry) => (
        <div key={entry.category}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-foreground">{entry.label}</span>
            <span className="text-xs font-mono font-medium text-foreground">{entry.count}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              data-testid="category-bar-fill"
              className="h-full rounded-full bg-primary"
              style={{ width: `${(entry.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategoryBreakdownChart;
