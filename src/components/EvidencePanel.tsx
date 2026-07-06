import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ExternalLink, Clock, Eye, MousePointer, Code, ScanLine, ZoomIn, Sparkles, LayoutGrid, DoorOpen, MessageSquareDiff, Filter, ArrowUpFromLine, Compass, Layers, BookOpen, ListTree, Search, Heart, ShoppingCart, CreditCard, ShieldCheck, LogOut, TextCursorInput, BadgeCheck, Target, FlaskConical, Wand2, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import type { FrictionPoint, FrictionCategory, EffortLevel, ConfidenceLevel } from "@/lib/mockData";
import { categoryLabels } from "@/lib/mockData";
import type { SiteSettings } from "@/lib/firebase/siteSettings";
import { computeRevenueImpact } from "@/lib/revenueImpact";
import { updateActionItemEvidence } from "@/lib/firebase/actionItems";
import { generateVariantCopy, type CopyVariant } from "@/lib/api/variantCopy";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { toast } from "sonner";

const effortDisplay: Record<EffortLevel, string> = { low: "Low", medium: "Medium", high: "High" };
const confidenceDisplay: Record<ConfidenceLevel, string> = { low: "Low", medium: "Medium", high: "High" };

const categoryIconMap: Record<FrictionCategory, React.ElementType> = {
  visual: Eye,
  technical: Code,
  ux: MousePointer,
  accessibility: ScanLine,
  performance: Clock,
  "value-proposition": Sparkles,
  "feature-presentation": LayoutGrid,
  "onboarding-friction": DoorOpen,
  "message-match": MessageSquareDiff,
  "conversion-funnel": Filter,
  "bounce-risk": ArrowUpFromLine,
  navigation: Compass,
  "content-hierarchy": Layers,
  readability: BookOpen,
  "content-structure": ListTree,
  seo: Search,
  engagement: Heart,
  "cart-friction": ShoppingCart,
  "payment-ux": CreditCard,
  "trust-security": ShieldCheck,
  "abandonment-risk": LogOut,
  "form-ux": TextCursorInput,
  "trust-signals": BadgeCheck,
  "conversion-clarity": Target,
  "ux-clarity": Eye,
  "trust-credibility": ShieldCheck,
  "friction-effort": MousePointer,
  "speed-performance": Clock,
  "intent-match": Target,
  "funnel-health": Filter,
};

const severityLabel: Record<string, string> = {
  high: "Critical Impact",
  med: "Moderate Impact",
  low: "Low Impact",
};

interface EvidencePanelProps {
  point: FrictionPoint | null;
  siteSettings?: SiteSettings | null;
}

const EvidencePanel = ({ point, siteSettings }: EvidencePanelProps) => {
  const capabilities = usePlanCapabilities();
  const revenueImpact = point ? computeRevenueImpact(siteSettings, point.roiEstimate) : null;
  const [copied, setCopied] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [evidenceDraft, setEvidenceDraft] = useState(point?.userEvidence ?? "");
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [variants, setVariants] = useState<CopyVariant[] | null>(null);
  const [generatingVariants, setGeneratingVariants] = useState(false);

  useEffect(() => {
    setEvidenceDraft(point?.userEvidence ?? "");
    setVariants(null);
  }, [point?.id]);

  const handleCopy = () => {
    if (!point) return;
    navigator.clipboard.writeText(point.fix);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveEvidence = async () => {
    if (!point) return;
    setSavingEvidence(true);
    try {
      await updateActionItemEvidence(point.id, evidenceDraft);
      toast.success("Evidence saved");
    } catch (err) {
      toast.error("Failed to save evidence", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSavingEvidence(false);
    }
  };

  const handleGenerateVariants = async () => {
    if (!point) return;
    setGeneratingVariants(true);
    try {
      const result = await generateVariantCopy({
        category: point.category,
        title: point.title,
        description: point.description,
        fix: point.fix,
      });
      setVariants(result.variants);
    } catch (err) {
      toast.error("Failed to generate copy variants", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setGeneratingVariants(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="px-4 py-3 border-b border-border/50">
        <h2 className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
          Evidence & Fix
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {point ? (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="p-4 space-y-4"
            >
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const Icon = categoryIconMap[point.category] || Eye;
                    return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
                  })()}
                  <span className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
                    {categoryLabels[point.category]}
                  </span>
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">{point.title}</h3>
              </div>

              {/* Visual Evidence */}
              {point.screenshotUrl && (
                <div>
                  <h4 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
                    Visual Evidence
                  </h4>
                  <div
                    className="relative group cursor-pointer rounded-md overflow-hidden border border-border/50"
                    onClick={() => setImageExpanded(!imageExpanded)}
                  >
                    <img
                      src={point.screenshotUrl}
                      alt={`Visual evidence for: ${point.title}`}
                      className={`w-full object-cover transition-all duration-300 ${
                        imageExpanded ? "max-h-[600px]" : "max-h-[200px]"
                      }`}
                    />
                    {!imageExpanded && (
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1 text-xs text-foreground/70">
                          <ZoomIn className="h-3 w-3" /> Click to expand
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}


              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Conversion Impact</span>
                    <span className="text-xs font-mono font-medium text-foreground">
                      {point.impactScore}/100
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${point.impactScore}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className={`h-full rounded-full ${
                        point.severity === "high"
                          ? "bg-friction-high"
                          : point.severity === "med"
                          ? "bg-friction-med"
                          : "bg-friction-low"
                      }`}
                    />
                  </div>
                </div>

                {/* Estimated revenue impact */}
                {revenueImpact && (
                  <div className="bg-primary/[0.04] rounded-md p-3 border border-primary/20">
                    <h4 className="text-label text-primary mb-1.5" style={{ fontSize: "10px" }}>
                      Estimated Revenue Impact
                    </h4>
                    <p className="text-sm font-medium text-foreground">
                      ${revenueImpact.low.toLocaleString()} – ${revenueImpact.high.toLocaleString()} / month
                    </p>
                  </div>
                )}

                {/* Effort & confidence */}
                {(point.effort || point.confidence) && (
                  <div className="grid grid-cols-2 gap-3">
                    {point.effort && (
                      <div className="bg-background rounded-md p-2.5 border border-border/50">
                        <span className="text-[10px] text-muted-foreground block mb-1">Effort to fix</span>
                        <span className="text-sm font-medium text-foreground">{effortDisplay[point.effort]}</span>
                      </div>
                    )}
                    {point.confidence && (
                      <div className="bg-background rounded-md p-2.5 border border-border/50">
                        <span className="text-[10px] text-muted-foreground block mb-1">Confidence</span>
                        <span className="text-sm font-medium text-foreground">{confidenceDisplay[point.confidence]}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Benchmark comparison */}
                <div className="bg-background rounded-md p-3 border border-border/50">
                  <h4 className="text-label text-muted-foreground mb-2.5" style={{ fontSize: "10px" }}>
                    Industry Benchmark
                  </h4>
                  <p className="text-xs text-foreground/70 mb-3 leading-relaxed">
                    {point.benchmark.label}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-1">Sites affected</span>
                      <span className="text-sm font-mono font-medium text-foreground">{point.benchmark.industryAvg}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-1">Top quartile</span>
                      <span className="text-sm font-mono font-medium text-primary">{point.benchmark.topPerformers}%</span>
                    </div>
                  </div>
                  <div className="mt-2.5 relative h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="absolute h-full rounded-full bg-muted-foreground/30"
                      style={{ width: `${point.benchmark.industryAvg}%` }}
                    />
                    <div
                      className="absolute h-full rounded-full bg-primary/50"
                      style={{ width: `${point.benchmark.topPerformers}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[9px] text-muted-foreground">
                    <span>0%</span>
                    <span>100% of sites</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
                  Analysis
                </h4>
                <p className="text-body text-foreground/80">{point.description}</p>
              </div>

              {/* Evidence Base */}
              {point.sourceCitation && (
                <div className="bg-primary/[0.04] rounded-md p-3 border border-primary/20">
                  <h4 className="text-label text-primary mb-1.5" style={{ fontSize: "10px" }}>
                    Evidence Base
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed">{point.sourceCitation}</p>
                </div>
              )}

              {/* Your Supporting Evidence */}
              <div>
                <label
                  htmlFor="user-evidence"
                  className="text-label text-muted-foreground mb-2 block"
                  style={{ fontSize: "10px" }}
                >
                  Your Supporting Evidence
                </label>
                <textarea
                  id="user-evidence"
                  value={evidenceDraft}
                  onChange={(e) => setEvidenceDraft(e.target.value)}
                  placeholder="Add your own notes, links, or screenshots backing this finding — useful when presenting to a client."
                  rows={3}
                  className="w-full text-xs text-foreground bg-background rounded-md p-3 border border-border/50 resize-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={handleSaveEvidence}
                  disabled={savingEvidence}
                  className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {savingEvidence ? "Saving…" : "Save note"}
                </button>
              </div>

              {/* Affected pages (domain-aggregated view only) */}
              {point.affectedUrls && (
                <div>
                  <h4 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
                    Affected Pages ({point.affectedUrls.length})
                  </h4>
                  <div className="bg-background rounded-md p-3 border border-border/50 space-y-1 max-h-32 overflow-y-auto">
                    {point.affectedUrls.map((url) => (
                      <p key={url} className="text-xs font-mono text-foreground truncate">{url}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Selector */}
              <div>
                <h4 className="text-label text-muted-foreground mb-2" style={{ fontSize: "10px" }}>
                  Affected Element
                </h4>
                <div className="bg-background rounded-md p-3 border border-border/50">
                  <code className="text-xs font-mono text-foreground">{point.selector}</code>
                </div>
              </div>

              {/* Fix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
                    Recommended Fix
                  </h4>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-foreground/[0.03] rounded-md p-3 border border-border/50">
                  <code className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                    {point.fix}
                  </code>
                </div>
              </div>

              {/* Test Copy Variant Generator */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
                    Test Copy Variants
                  </h4>
                </div>
                {capabilities.canGenerateVariants ? (
                  <>
                    <button
                      onClick={handleGenerateVariants}
                      disabled={generatingVariants}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Wand2 className="h-3 w-3" />
                      {generatingVariants ? "Generating…" : "Generate Test Copy"}
                    </button>
                    {variants && (
                      <div className="mt-3 space-y-2">
                        {variants.map((variant) => (
                          <div key={variant.label} className="bg-background rounded-md p-3 border border-border/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                                {variant.label}
                              </span>
                              <button
                                onClick={() => navigator.clipboard.writeText(variant.copy)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={`Copy ${variant.label}`}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="text-sm text-foreground mb-1">{variant.copy}</p>
                            <p className="text-xs text-muted-foreground">{variant.rationale}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-secondary rounded-md p-3 flex items-start gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{getUpgradeMessage("variants").title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{getUpgradeMessage("variants").description}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* A/B Test Recommendation */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-label text-muted-foreground" style={{ fontSize: "10px" }}>
                    A/B Test Recommendation
                  </h4>
                </div>
                <div className="bg-primary/[0.04] rounded-md p-3 border border-primary/20 space-y-3">
                  <div>
                    <span className="text-[10px] font-medium text-primary uppercase tracking-wider">{point.abTest.testName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Hypothesis</span>
                    <p className="text-xs text-foreground/80 leading-relaxed">{point.abTest.hypothesis}</p>
                  </div>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Primary Metric</span>
                      <span className="text-xs font-mono font-medium text-foreground">{point.abTest.metric}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Duration</span>
                      <span className="text-xs font-mono font-medium text-foreground">{point.abTest.duration}</span>
                    </div>
                  </div>
                  {point.abTest.durationRationale && (
                    <div className="pt-2 border-t border-primary/10">
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Why this duration?</span>
                      <p className="text-xs text-foreground/70 leading-relaxed">{point.abTest.durationRationale}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {severityLabel[point.severity]}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    ID: {point.id}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full p-8"
            >
              <p className="text-sm text-muted-foreground text-center">
                Select a friction point to view evidence and fix recommendations.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EvidencePanel;
