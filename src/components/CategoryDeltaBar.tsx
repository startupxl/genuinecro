import type { CategoryScoreEntry } from "@/lib/dashboardMetrics";

interface CategoryDeltaBarProps {
  data: CategoryScoreEntry[];
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
}

const CategoryDeltaBar = ({ data, onCategoryClick, selectedCategory }: CategoryDeltaBarProps) => {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No category scores yet.</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((entry) => (
        <div
          key={entry.category}
          data-testid="category-delta-row"
          onClick={() => onCategoryClick?.(entry.category)}
          className={`rounded-md p-1.5 -m-1.5 transition-colors ${onCategoryClick ? "cursor-pointer hover:bg-secondary/50" : ""} ${
            selectedCategory === entry.category ? "bg-secondary" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-foreground">{entry.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-medium text-foreground">{entry.score}</span>
              <span className={`text-xs font-mono ${entry.deltaVsBenchmark >= 0 ? "text-primary" : "text-destructive"}`}>
                {entry.deltaVsBenchmark >= 0 ? "+" : ""}{entry.deltaVsBenchmark}
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${entry.score}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategoryDeltaBar;
