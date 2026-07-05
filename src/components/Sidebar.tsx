import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Monitor, Smartphone, ZoomIn, TrendingUp, AlertTriangle } from "lucide-react";
import type { AnalysisResult, FrictionSeverity } from "@/lib/mockData";
import { categoryLabels } from "@/lib/mockData";


interface SidebarProps {
  result: AnalysisResult;
  onEditRevenueSettings?: () => void;
  hasSiteSettings?: boolean;
}

const gradeColor: Record<string, string> = {
  "Elite": "text-primary",
  "Strong": "text-primary",
  "Needs Optimization": "text-friction-med",
  "High Friction": "text-friction-high",
  "Broken Experience": "text-destructive",
};

const Sidebar = ({ result, onEditRevenueSettings, hasSiteSettings }: SidebarProps) => {
  const counts: Record<FrictionSeverity, number> = { high: 0, med: 0, low: 0 };
  result.frictionPoints.forEach((p) => counts[p.severity]++);
  const { benchmark } = result;
  const [screenshotExpanded, setScreenshotExpanded] = useState(false);
  const DeviceIcon = result.device === "mobile" ? Smartphone : Monitor;

  const score = result.conversionScore ?? benchmark.overallScore;
  const grade = result.grade || "Needs Optimization";

  // Get category scores from benchmark (supports both old and new format)
  const catScores = benchmark.categoryScores || {};
  const catEntries = Object.entries(catScores);

  // Insight summary clusters
  const insights = result.insightSummary;
  const insightEntries = insights
    ? Object.entries(insights).filter(([, v]) => v && !v.includes("appear") && !v.includes("adequate") && !v.includes("acceptable") && !v.includes("reasonable") && !v.includes("present"))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full flex flex-col bg-surface"
    >
      {/* Device badge */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary rounded-md px-2 py-1 w-fit">
          <DeviceIcon className="h-3 w-3" />
          <span className="capitalize">{result.device}</span>
        </div>
      </div>

      {/* Conversion Score */}
      <div className="px-4 py-4 border-b border-border/50">
        <h2 className="text-label text-muted-foreground mb-3" style={{ fontSize: "10px" }}>
          Conversion Score
        </h2>
        <div className="flex items-end gap-3 mb-1">
          <span className="text-3xl font-bold text-foreground font-mono leading-none">
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground mb-1">/100</span>
        </div>
        <p className={`text-xs font-medium mb-3 ${gradeColor[grade] || "text-muted-foreground"}`}>
          {grade}
        </p>
        {/* Score bar with markers */}
        <div className="relative mb-2">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className={`h-full rounded-full ${
                score >= 75 ? "bg-primary" : score >= 50 ? "bg-friction-med" : "bg-friction-high"
              }`}
            />
          </div>
          <div
            className="absolute top-0 h-2 w-px bg-muted-foreground/60"
            style={{ left: `${benchmark.industryAvg}%` }}
          />
          <div
            className="absolute top-0 h-2 w-px bg-primary/60"
            style={{ left: `${benchmark.topQuartile}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            <span className="text-muted-foreground">Avg: {benchmark.industryAvg}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            <span className="text-muted-foreground">Top 25%: {benchmark.topQuartile}</span>
          </div>
        </div>
      </div>

      {/* Revenue impact settings entry point */}
      {onEditRevenueSettings && (
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
            Revenue Impact
          </h2>
          <button
            onClick={onEditRevenueSettings}
            className="text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            {hasSiteSettings ? "Edit" : "Set up"}
          </button>
        </div>
      )}

      {/* Top Issues */}
      {result.topIssues && result.topIssues.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50">
          <h2 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
            Top Issues (Revenue Impact)
          </h2>
          <div className="space-y-1.5">
            {result.topIssues.slice(0, 3).map((issue, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className={`h-3 w-3 mt-0.5 flex-shrink-0 ${i === 0 ? "text-friction-high" : "text-friction-med"}`} />
                <span className="text-[11px] text-foreground leading-tight">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight Gaps */}
      {insightEntries.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50">
          <h2 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
            Insight Clusters
          </h2>
          <div className="space-y-2">
            {insightEntries.map(([key, value]) => (
              <div key={key} className="text-[11px]">
                <span className="font-medium text-foreground capitalize">
                  {key.replace(/Gap$/, " Gap").replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-muted-foreground ml-1">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {catEntries.length > 0 && (
        <div className="px-4 py-4 border-b border-border/50">
          <h2 className="text-label text-muted-foreground mb-3" style={{ fontSize: "10px" }}>
            Category Scores
          </h2>
          <div className="space-y-2.5">
            {catEntries.map(([cat, catScore]) => {
              if (!catScore) return null;
              const { score: s, industryAvg: avg } = catScore;
              const delta = s - avg;
              const label = categoryLabels[cat] || cat;
              const passed = (catScore as any).passed;
              const total = (catScore as any).total;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      {passed !== undefined && total !== undefined && (
                        <span className="text-[9px] text-muted-foreground font-mono">{passed}/{total}</span>
                      )}
                      <span className="text-[10px] font-mono text-foreground">{s}</span>
                      <span
                        className={`text-[10px] font-mono ${
                          delta < 0 ? "text-friction-high" : "text-primary"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="absolute h-full rounded-full bg-foreground/15"
                      style={{ width: `${avg}%` }}
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className={`absolute h-full rounded-full ${
                        delta < 0 ? "bg-friction-high/70" : "bg-primary/70"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Issue Breakdown */}
      <div className="px-4 py-4 border-b border-border/50">
        <h2 className="text-label text-muted-foreground mb-3" style={{ fontSize: "10px" }}>
          Issue Breakdown
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Issues</span>
            <span className="text-xs font-mono font-medium text-foreground">
              {result.frictionPoints.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-friction-high" />
              <span className="text-xs text-muted-foreground">Critical</span>
            </div>
            <span className="text-xs font-mono font-medium text-foreground">{counts.high}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-friction-med" />
              <span className="text-xs text-muted-foreground">Warning</span>
            </div>
            <span className="text-xs font-mono font-medium text-foreground">{counts.med}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-friction-low" />
              <span className="text-xs text-muted-foreground">Info</span>
            </div>
            <span className="text-xs font-mono font-medium text-foreground">{counts.low}</span>
          </div>
        </div>
      </div>

      {/* Page Screenshot */}
      {result.screenshotUrl && (
        <div className="px-4 py-4 border-b border-border/50">
          <h2 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
            Page Screenshot ({result.device})
          </h2>
          <div
            className="relative group cursor-pointer rounded-md overflow-hidden border border-border/50"
            onClick={() => setScreenshotExpanded(!screenshotExpanded)}
          >
            <img
              src={result.screenshotUrl}
              alt={`${result.device} screenshot of ${result.url}`}
              className={`w-full object-cover object-top transition-all duration-300 ${
                screenshotExpanded ? "max-h-[500px]" : "max-h-[160px]"
              }`}
            />
            {!screenshotExpanded && (
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="flex items-center gap-1 text-[10px] text-foreground/70">
                  <ZoomIn className="h-3 w-3" /> Click to expand
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      <div className="px-4 py-4 flex-1">
        <h2 className="text-label text-muted-foreground mb-3" style={{ fontSize: "10px" }}>
          History
        </h2>
        <div className="space-y-2">
          <div className="p-2 rounded-md bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
            <div className="flex items-center gap-1.5 mb-1">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-foreground truncate">
                {result.url.replace(/^https?:\/\//, "").slice(0, 30)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Just now</span>
              <span className="text-[10px] text-muted-foreground">
                {result.frictionPoints.length} issues
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Sidebar;
