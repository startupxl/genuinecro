import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownWideNarrow, Filter, X, PanelLeftOpen, ChevronDown, Download, ClipboardList, Lock } from "lucide-react";
import type { AnalysisResult, FrictionSeverity } from "@/lib/mockData";
import { exportCSV, copyAsJiraTickets } from "@/lib/exportUtils";
import { toast } from "sonner";
import { getCategoryTab } from "@/lib/mergedAudit";
import Sidebar from "./Sidebar";
import MetadataBar from "./MetadataBar";
import FrictionCard from "./FrictionCard";
import EvidencePanel from "./EvidencePanel";
import AppShell from "./AppShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { useNavigate } from "react-router-dom";

type SortOption = "impact-desc" | "impact-asc" | "severity";

const severityOrder: Record<FrictionSeverity, number> = { high: 0, med: 1, low: 2 };

const sortLabels: Record<SortOption, string> = {
  "impact-desc": "Impact ↓",
  "impact-asc": "Impact ↑",
  severity: "Severity",
};

const TABLET_BREAKPOINT = 1024;

const CATEGORY_TABS = ["All", "Technical", "Content", "Conversion", "Navigation", "Accessibility", "Performance"];

interface AnalysisViewProps {
  result: AnalysisResult;
  onNewAnalysis: (url: string) => void;
  onGoHome?: () => void;
}

const AnalysisView = ({ result, onNewAnalysis, onGoHome }: AnalysisViewProps) => {
  const capabilities = usePlanCapabilities();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(
    result.frictionPoints[0]?.id ?? null
  );
  const [categoryTab, setCategoryTab] = useState<string>("All");
  const [severityFilter, setSeverityFilter] = useState<FrictionSeverity | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("impact-desc");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const isMobile = useIsMobile();
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768 && window.innerWidth < TABLET_BREAKPOINT;
  });

  useEffect(() => {
    const check = () => {
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < TABLET_BREAKPOINT);
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const filteredPoints = useMemo(() => {
    let pts = result.frictionPoints;
    if (categoryTab !== "All") pts = pts.filter((p) => getCategoryTab(p.category) === categoryTab);
    if (severityFilter !== "all") pts = pts.filter((p) => p.severity === severityFilter);
    return [...pts].sort((a, b) => {
      if (sortBy === "impact-desc") return b.impactScore - a.impactScore;
      if (sortBy === "impact-asc") return a.impactScore - b.impactScore;
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [result.frictionPoints, categoryTab, severityFilter, sortBy]);

  const selectedPoint =
    result.frictionPoints.find((p) => p.id === selectedId) ?? null;

  const hasFilters = categoryTab !== "All" || severityFilter !== "all";

  const showSidebarInline = !isMobile && !isTablet;
  const showEvidenceInline = !isMobile && !isTablet;

  const handleCardClick = (id: string) => {
    setSelectedId(id);
    if (!showEvidenceInline) {
      setEvidenceOpen(true);
    }
  };

  return (
    <AppShell onLogoClick={onGoHome}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col h-full bg-background"
      >
      <div className="flex flex-1 min-h-0">
      {/* Left Sidebar - Desktop only */}
      {showSidebarInline && (
        <div className="w-[280px] flex-shrink-0 border-r border-border/30 overflow-y-auto">
          <Sidebar result={result} />
        </div>
      )}

      {/* Sidebar Sheet - Mobile & Tablet */}
      {!showSidebarInline && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[300px] p-0">
            <SheetTitle className="sr-only">Sidebar</SheetTitle>
            <Sidebar result={result} />
          </SheetContent>
        </Sheet>
      )}

      {/* Center */}
      <div className="flex-1 flex flex-col min-w-0">
        <MetadataBar
          url={result.url}
          timestamp={result.timestamp}
          device={result.device}
          issueCount={result.frictionPoints.length}
          analysisType={result.analysisType}
          onNewAnalysis={onNewAnalysis}
          onToggleSidebar={!showSidebarInline ? () => setSidebarOpen(true) : undefined}
        />

        {/* Category tabs */}
        <div className="border-b border-border/30 px-3 md:px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategoryTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                categoryTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter & Sort Bar */}
        <div className="border-b border-border/30 px-3 md:px-4 py-2 flex items-center gap-1.5 md:gap-2 flex-wrap">
          <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />

          {/* Severity filter */}
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
              onClick={() => { setCategoryTab("All"); setSeverityFilter("all"); }}
              className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 rounded hover:bg-secondary transition-colors"
            >
              <X className="h-3 w-3" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <div className="flex-1" />

          {/* Export buttons */}
          <button
            onClick={() => {
              if (!capabilities.canExport) {
                const msg = getUpgradeMessage("export");
                toast.error(msg.title, {
                  description: msg.description,
                  action: { label: "Upgrade", onClick: () => navigate("/subscription") },
                });
                return;
              }
              const text = copyAsJiraTickets(result, filteredPoints);
              navigator.clipboard.writeText(text);
              toast.success(`${filteredPoints.length} issues copied as Jira tickets`);
            }}
            className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 rounded hover:bg-secondary transition-colors"
            title="Copy as Jira tickets"
          >
            <ClipboardList className="h-3 w-3" />
            <span className="hidden md:inline">Jira</span>
            {!capabilities.canExport && <Lock className="h-2.5 w-2.5 ml-0.5" />}
          </button>
          <button
            onClick={() => {
              if (!capabilities.canExport) {
                const msg = getUpgradeMessage("export");
                toast.error(msg.title, {
                  description: msg.description,
                  action: { label: "Upgrade", onClick: () => navigate("/subscription") },
                });
                return;
              }
              exportCSV(result, filteredPoints);
              toast.success("CSV downloaded");
            }}
            className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 rounded hover:bg-secondary transition-colors"
            title="Download CSV"
          >
            <Download className="h-3 w-3" />
            <span className="hidden md:inline">CSV</span>
            {!capabilities.canExport && <Lock className="h-2.5 w-2.5 ml-0.5" />}
          </button>

          {/* Sort */}
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

          <span className="text-[10px] text-muted-foreground font-mono ml-1">
            {filteredPoints.length}/{result.frictionPoints.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div data-testid="friction-list" className="max-w-2xl mx-auto space-y-3">
            {filteredPoints.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No issues match the current filters.
              </div>
            ) : (
              filteredPoints.map((point, i) => (
                <FrictionCard
                  key={point.id}
                  point={point}
                  index={i}
                  isSelected={selectedId === point.id}
                  onClick={() => handleCardClick(point.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Evidence Panel - Desktop only */}
      {showEvidenceInline && (
        <div className="w-[400px] flex-shrink-0 border-l border-border/30 overflow-y-auto">
          <EvidencePanel point={selectedPoint} />
        </div>
      )}

      {/* Evidence Sheet - Mobile & Tablet */}
      {!showEvidenceInline && (
        <Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}>
          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={isMobile ? "h-[85svh] rounded-t-xl p-0" : "w-[400px] p-0"}
          >
            <SheetTitle className="sr-only">Evidence & Fix</SheetTitle>
            {isMobile && (
              <div className="flex justify-center py-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
            )}
            <EvidencePanel point={selectedPoint} />
          </SheetContent>
        </Sheet>
      )}
      </div>
      </motion.div>
    </AppShell>
  );
};

export default AnalysisView;
