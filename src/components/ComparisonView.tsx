import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Smartphone, ArrowLeft, Filter, X, ChevronDown, Download, ClipboardList, ArrowDownWideNarrow } from "lucide-react";
import type { AnalysisResult, FrictionCategory, FrictionSeverity } from "@/lib/mockData";
import { categoryLabels, categoriesForType } from "@/lib/mockData";
import { exportCSV, copyAsJiraTickets } from "@/lib/exportUtils";
import { toast } from "sonner";
import FrictionCard from "./FrictionCard";
import EvidencePanel from "./EvidencePanel";
import AppShell from "./AppShell";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type SortOption = "impact-desc" | "impact-asc" | "severity";

const severityOrder: Record<FrictionSeverity, number> = { high: 0, med: 1, low: 2 };
const sortLabels: Record<SortOption, string> = {
  "impact-desc": "Impact ↓",
  "impact-asc": "Impact ↑",
  severity: "Severity",
};

interface ComparisonViewProps {
  desktopResult: AnalysisResult;
  mobileResult: AnalysisResult;
  onBack: () => void;
  onGoHome?: () => void;
}

function useFilteredPoints(result: AnalysisResult, categoryFilter: FrictionCategory | "all", severityFilter: FrictionSeverity | "all", sortBy: SortOption) {
  return useMemo(() => {
    let pts = result.frictionPoints;
    if (categoryFilter !== "all") pts = pts.filter((p) => p.category === categoryFilter);
    if (severityFilter !== "all") pts = pts.filter((p) => p.severity === severityFilter);
    return [...pts].sort((a, b) => {
      if (sortBy === "impact-desc") return b.impactScore - a.impactScore;
      if (sortBy === "impact-asc") return a.impactScore - b.impactScore;
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [result.frictionPoints, categoryFilter, severityFilter, sortBy]);
}

const ComparisonView = ({ desktopResult, mobileResult, onBack, onGoHome }: ComparisonViewProps) => {
  const isMobile = useIsMobile();
  const [categoryFilter, setCategoryFilter] = useState<FrictionCategory | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<FrictionSeverity | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("impact-desc");
  const [selectedPoint, setSelectedPoint] = useState(desktopResult.frictionPoints[0] ?? null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"split" | "desktop" | "mobile">(isMobile ? "desktop" : "split");

  const desktopFiltered = useFilteredPoints(desktopResult, categoryFilter, severityFilter, sortBy);
  const mobileFiltered = useFilteredPoints(mobileResult, categoryFilter, severityFilter, sortBy);

  const hasFilters = categoryFilter !== "all" || severityFilter !== "all";
  const categories = categoriesForType[desktopResult.analysisType];

  const handleCardClick = (point: typeof selectedPoint) => {
    setSelectedPoint(point);
    if (isMobile) setEvidenceOpen(true);
  };

  const desktopHigh = desktopResult.frictionPoints.filter(p => p.severity === "high").length;
  const mobileHigh = mobileResult.frictionPoints.filter(p => p.severity === "high").length;

  const renderColumn = (result: AnalysisResult, filtered: typeof desktopFiltered, device: "desktop" | "mobile") => (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 bg-surface/50">
        {device === "desktop" ? (
          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-medium text-foreground capitalize">{device}</span>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          {filtered.length}/{result.frictionPoints.length}
        </span>
      </div>

      {/* Score summary */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Score</span>
          <span className="text-sm font-semibold text-foreground">{result.benchmark.overallScore}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${device === "desktop" ? "bg-primary" : "bg-orange-500"}`} />
          <span className="text-[10px] text-muted-foreground">
            {result.frictionPoints.filter(p => p.severity === "high").length} critical
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No issues match filters.
            </div>
          ) : (
            filtered.map((point, i) => (
              <FrictionCard
                key={point.id}
                point={point}
                index={i}
                isSelected={selectedPoint?.id === point.id}
                onClick={() => handleCardClick(point)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell onLogoClick={onGoHome}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col h-full bg-background"
      >
      {/* Secondary bar */}
      <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-surface border-b border-border/50">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-foreground truncate">{desktopResult.url}</p>
        </div>

        {/* View toggle for mobile */}
        <div className="inline-flex items-center rounded-md bg-secondary p-0.5">
          {(!isMobile ? ["split", "desktop", "mobile"] as const : ["desktop", "mobile"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "split" && <><Monitor className="h-3 w-3" /><span className="hidden md:inline">vs</span><Smartphone className="h-3 w-3" /></>}
              {tab === "desktop" && <><Monitor className="h-3 w-3" /><span className="hidden sm:inline">Desktop</span></>}
              {tab === "mobile" && <><Smartphone className="h-3 w-3" /><span className="hidden sm:inline">Mobile</span></>}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border/30 px-3 md:px-4 py-2 flex items-center gap-1.5 md:gap-2 flex-wrap">
        <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as FrictionCategory | "all")}
          className="h-7 text-xs bg-secondary text-secondary-foreground rounded-md px-2 border-none outline-none cursor-pointer min-w-0"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{categoryLabels[cat]}</option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as FrictionSeverity | "all")}
          className="h-7 text-xs bg-secondary text-secondary-foreground rounded-md px-2 border-none outline-none cursor-pointer min-w-0"
        >
          <option value="all">All Severity</option>
          <option value="high">Critical</option>
          <option value="med">Warning</option>
          <option value="low">Info</option>
        </select>

        {hasFilters && (
          <button
            onClick={() => { setCategoryFilter("all"); setSeverityFilter("all"); }}
            className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 rounded hover:bg-secondary transition-colors"
          >
            <X className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}

        <div className="flex-1" />

        <ArrowDownWideNarrow className="h-3 w-3 text-muted-foreground hidden sm:block" />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="h-7 text-xs bg-secondary text-secondary-foreground rounded-md px-2 border-none outline-none cursor-pointer min-w-0"
        >
          {(Object.entries(sortLabels) as [SortOption, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Content area */}
      <div className="flex-1 flex min-h-0">
        {/* Side-by-side or single column */}
        <div className="flex-1 flex min-w-0">
          {(activeTab === "split" || activeTab === "desktop") && (
            <div className={`flex-1 flex flex-col min-w-0 ${activeTab === "split" ? "border-r border-border/30" : ""}`}>
              {renderColumn(desktopResult, desktopFiltered, "desktop")}
            </div>
          )}
          {(activeTab === "split" || activeTab === "mobile") && (
            <div className="flex-1 flex flex-col min-w-0">
              {renderColumn(mobileResult, mobileFiltered, "mobile")}
            </div>
          )}
        </div>

        {/* Evidence panel - desktop only */}
        {!isMobile && (
          <div className="w-[360px] flex-shrink-0 border-l border-border/30 overflow-y-auto">
            <EvidencePanel point={selectedPoint} />
          </div>
        )}
      </div>

      {/* Evidence Sheet - Mobile */}
      {isMobile && (
        <Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}>
          <SheetContent side="bottom" className="h-[85svh] rounded-t-xl p-0">
            <SheetTitle className="sr-only">Evidence & Fix</SheetTitle>
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <EvidencePanel point={selectedPoint} />
          </SheetContent>
        </Sheet>
      )}
    </motion.div>
    </AppShell>
  );
};

export default ComparisonView;
