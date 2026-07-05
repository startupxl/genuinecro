import { motion } from "framer-motion";
import { Clock, Eye, MousePointer, Code, ScanLine, Copy, Check, Sparkles, LayoutGrid, DoorOpen, MessageSquareDiff, Filter as FilterIcon, ArrowUpFromLine, Compass, Layers, BookOpen, ListTree, Search, Heart, ShoppingCart, CreditCard, ShieldCheck, LogOut, TextCursorInput, BadgeCheck, Target, Zap, TrendingUp, BarChart3, Globe } from "lucide-react";
import { useState } from "react";
import type { FrictionPoint, FrictionSeverity } from "@/lib/mockData";
import { categoryLabels } from "@/lib/mockData";

const categoryIconMap: Record<string, React.ElementType> = {
  visual: Eye, technical: Code, ux: MousePointer, accessibility: ScanLine, performance: Clock,
  "value-proposition": Sparkles, "feature-presentation": LayoutGrid, "onboarding-friction": DoorOpen,
  "message-match": MessageSquareDiff, "conversion-funnel": FilterIcon, "bounce-risk": ArrowUpFromLine,
  navigation: Compass, "content-hierarchy": Layers, readability: BookOpen, "content-structure": ListTree,
  seo: Search, engagement: Heart, "cart-friction": ShoppingCart, "payment-ux": CreditCard,
  "trust-security": ShieldCheck, "abandonment-risk": LogOut, "form-ux": TextCursorInput,
  "trust-signals": BadgeCheck, "conversion-clarity": Target,
  // New scoring categories
  "ux-clarity": Eye, "trust-credibility": ShieldCheck, "friction-effort": Zap,
  "speed-performance": Clock, "intent-match": Target, "funnel-health": BarChart3,
};

const severityBorderClass: Record<FrictionSeverity, string> = {
  high: "border-l-4 border-l-friction-high",
  med: "border-l-4 border-l-friction-med",
  low: "border-l-4 border-l-friction-low",
};

const severityTextClass: Record<FrictionSeverity, string> = {
  high: "text-friction-high", med: "text-friction-med", low: "text-friction-low",
};

const severityLabel: Record<FrictionSeverity, string> = {
  high: "Critical", med: "Warning", low: "Info",
};

interface FrictionCardProps {
  point: FrictionPoint;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

const FrictionCard = ({ point, index, isSelected, onClick }: FrictionCardProps) => {
  const [copied, setCopied] = useState(false);
  const Icon = categoryIconMap[point.category] || Eye;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(point.fix);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className={`group relative bg-surface p-4 shadow-card rounded-lg transition-shadow cursor-pointer ${severityBorderClass[point.severity]} ${
        isSelected ? "shadow-card-hover ring-1 ring-primary/20" : "hover:shadow-card-hover"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
            {categoryLabels[point.category] || point.category}
          </span>
          {point.insightCluster && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {point.insightCluster}
            </span>
          )}
          {point.sourceCitation && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-2.5 w-2.5" />
              Evidence-based
            </span>
          )}
        </div>
        <span className={`text-[11px] font-medium ${severityTextClass[point.severity]}`}>
          {severityLabel[point.severity]}
        </span>
      </div>

      <h3 className="text-sm font-medium text-foreground mb-1">{point.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">
        {point.description}
      </p>

      {/* ROI Estimate */}
      {point.roiEstimate && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded-md bg-primary/5 w-fit">
          <TrendingUp className="h-3 w-3 text-primary" />
          <span className="text-[11px] text-primary font-medium">{point.roiEstimate}</span>
        </div>
      )}

      {/* Affected pages (domain-aggregated view only) */}
      {point.affectedUrls && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded-md bg-secondary w-fit">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium">
            Affects {point.affectedUrls.length} page{point.affectedUrls.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">
          {point.selector}
        </code>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary"
        >
          {copied ? (
            <><Check className="h-3 w-3" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3" /> Copy Fix</>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default FrictionCard;
