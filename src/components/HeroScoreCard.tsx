import { TrendingUp, TrendingDown } from "lucide-react";
import type { HeroScoreSummary } from "@/lib/dashboardMetrics";

interface HeroScoreCardProps {
  summary: HeroScoreSummary;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const HeroScoreCard = ({ summary }: HeroScoreCardProps) => {
  const { overallScore, trendDelta, band, pagesAudited, lastAuditAt } = summary;

  return (
    <div className="bg-primary rounded-lg p-5 text-primary-foreground mb-6">
      <p className="text-[10px] uppercase tracking-wider text-primary-foreground/70 mb-2">Overall CRO Score</p>
      <div className="flex items-end gap-3 mb-2">
        <span className="text-5xl font-semibold leading-none">{overallScore}</span>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary-foreground/15 mb-1">{band}</span>
      </div>
      {trendDelta !== null && (
        <div className="flex items-center gap-1 text-sm text-primary-foreground/90 mb-2">
          {trendDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          <span>{trendDelta >= 0 ? "+" : ""}{trendDelta}</span>
          <span>vs last audit</span>
        </div>
      )}
      <p className="text-xs text-primary-foreground/70">
        {pagesAudited} page{pagesAudited === 1 ? "" : "s"} audited
        {lastAuditAt && <> · Last audit {formatDate(lastAuditAt)}</>}
      </p>
    </div>
  );
};

export default HeroScoreCard;
