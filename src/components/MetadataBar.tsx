import { motion } from "framer-motion";
import { Globe, Monitor, Smartphone, Share2, Search, PanelLeftOpen, Target } from "lucide-react";
import { useState } from "react";
import type { AnalysisType } from "@/lib/mockData";
import { analysisTypeLabels } from "@/lib/mockData";
import { GOAL_LABELS, type ConversionGoal } from "@/lib/conversionGoals";

interface MetadataBarProps {
  url: string;
  timestamp: string;
  device: "desktop" | "mobile";
  issueCount: number;
  analysisType?: AnalysisType;
  conversionGoal?: ConversionGoal;
  onNewAnalysis: (url: string) => void;
  onToggleSidebar?: () => void;
  onShare?: () => void;
}

function goalDisplayLabel(goal: ConversionGoal): string {
  return goal.type === "custom" && goal.customLabel ? goal.customLabel : GOAL_LABELS[goal.type];
}

const MetadataBar = ({ url, timestamp, device, issueCount, analysisType, conversionGoal, onNewAnalysis, onToggleSidebar, onShare }: MetadataBarProps) => {
  const [newUrl, setNewUrl] = useState(url);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim()) onNewAnalysis(newUrl.trim());
  };

  const formattedTime = new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 bg-surface border-b border-border/50"
    >
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="flex-shrink-0 p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <form onSubmit={handleSubmit} className="flex items-center flex-1 gap-2 min-w-0">
        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="flex-1 text-xs font-mono bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
          placeholder="Enter URL..."
        />
      </form>

      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <span className="text-[10px] text-muted-foreground hidden sm:inline">{formattedTime}</span>

        {analysisType && (
          <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-primary/10 text-[10px] font-medium text-primary">
            {analysisTypeLabels[analysisType]}
          </span>
        )}

        {conversionGoal && (
          <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-medium text-muted-foreground">
            <Target className="h-3 w-3" />
            {goalDisplayLabel(conversionGoal)}
          </span>
        )}

        <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary">
          {device === "desktop" ? (
            <Monitor className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Smartphone className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-[10px] text-muted-foreground capitalize">{device}</span>
        </div>

        <span className="text-xs font-medium text-foreground whitespace-nowrap">
          <span className="sm:hidden">{issueCount}</span>
          <span className="hidden sm:inline">{issueCount} Friction Points</span>
        </span>

        {onShare && (
          <button
            onClick={onShare}
            className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default MetadataBar;
