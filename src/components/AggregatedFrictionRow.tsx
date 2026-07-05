import { useState } from "react";
import { ChevronDown, Copy, Check, FlaskConical, Globe } from "lucide-react";
import { categoryLabels } from "@/lib/mockData";
import type { AggregatedFrictionPoint } from "@/lib/siteAggregation";

const severityTextClass: Record<string, string> = {
  high: "text-friction-high",
  med: "text-friction-med",
  low: "text-friction-low",
};

const severityBorderClass: Record<string, string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const severityLabel: Record<string, string> = { high: "Critical", med: "Warning", low: "Info" };

interface AggregatedFrictionRowProps {
  point: AggregatedFrictionPoint;
}

const AggregatedFrictionRow = ({ point }: AggregatedFrictionRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(point.fix);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`bg-surface rounded-lg shadow-card ${severityBorderClass[point.severity]}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
              {categoryLabels[point.category] ?? point.category}
            </span>
            <span className={`text-[11px] font-medium ${severityTextClass[point.severity]}`}>
              {severityLabel[point.severity] ?? point.severity}
            </span>
          </div>
          <h3 className="text-sm font-medium text-foreground">{point.title}</h3>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Globe className="h-3 w-3" />
            {point.affectedUrls.length} page{point.affectedUrls.length === 1 ? "" : "s"}
          </span>
          <span className="text-sm font-mono font-medium text-foreground">{point.avgImpactScore}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{point.description}</p>

          <div>
            <h4 className="text-label text-muted-foreground mb-1.5" style={{ fontSize: "10px" }}>
              Affected Pages
            </h4>
            <ul className="space-y-1">
              {point.affectedUrls.map((url) => (
                <li key={url} className="text-xs font-mono text-foreground/80 truncate">{url}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
                Recommended Fix
              </h4>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <><Check className="h-3 w-3" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy Fix</>
                )}
              </button>
            </div>
            <div className="bg-background rounded-md p-3 border border-border/50">
              <code className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">{point.fix}</code>
            </div>
          </div>

          {point.abTest && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
                  A/B Test Recommendation
                </h4>
              </div>
              <div className="bg-primary/[0.04] rounded-md p-3 border border-primary/20 space-y-2">
                <span className="text-[10px] font-medium text-primary uppercase tracking-wider">{point.abTest.testName}</span>
                <p className="text-xs text-foreground/80 leading-relaxed">{point.abTest.hypothesis}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Control</span>
                    <p className="text-xs text-foreground/70 leading-relaxed">{point.abTest.control}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Variant</span>
                    <p className="text-xs text-foreground/70 leading-relaxed">{point.abTest.variant}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AggregatedFrictionRow;
