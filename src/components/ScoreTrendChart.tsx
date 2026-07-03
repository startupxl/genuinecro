import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ScoreTrendPoint } from "@/lib/dashboardMetrics";

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const ScoreTrendChart = ({ data }: ScoreTrendChartProps) => {
  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Run a few more audits to see your trend.
      </p>
    );
  }

  const chartData = data.map((point) => ({ ...point, label: formatDate(point.date) }));

  return (
    <div data-testid="score-trend-chart" style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <YAxis domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--surface))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreTrendChart;
