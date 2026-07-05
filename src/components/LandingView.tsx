import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Monitor, Smartphone, ChevronDown, Lock } from "lucide-react";
import AppShell from "@/components/AppShell";
import type { AnalysisType } from "@/lib/mockData";
import { analysisTypeLabels, detectPageType } from "@/lib/mockData";
import {
  CONVERSION_GOAL_OPTIONS,
  GOAL_LABELS,
  getDefaultGoalForPageType,
  type ConversionGoal,
  type ConversionGoalType,
} from "@/lib/conversionGoals";
import type { User } from "firebase/auth";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { getUserSettings } from "@/lib/userSettings";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LandingViewProps {
  onAnalyze: (url: string, type: AnalysisType, device: "desktop" | "mobile" | "both", goal: ConversionGoal) => void;
  usage: { used: number; limit: number; canAnalyze: boolean; requiresAuth: boolean; requiresPaid: boolean };
  user: User | null;
  onSignIn: () => void;
  initialUrl?: string;
}

const macroGoalOptions = CONVERSION_GOAL_OPTIONS.filter((o) => o.isMacro);
const microGoalOptions = CONVERSION_GOAL_OPTIONS.filter((o) => !o.isMacro && o.type !== "custom");
const customGoalOption = CONVERSION_GOAL_OPTIONS.find((o) => o.type === "custom")!;

function isGoalComplete(goal: ConversionGoal): boolean {
  return goal.type !== "custom" || !!goal.customLabel?.trim();
}

const typeDescriptions: Record<AnalysisType, string> = {
  homepage: "Navigation clarity, hero messaging, visual hierarchy, and content structure.",
  "blog-content": "Readability, content structure, SEO optimization, and reader engagement.",
  checkout: "Cart friction, payment UX, trust signals, and abandonment risk factors.",
  "lead-form": "Form UX, trust signals, conversion clarity, and field optimization.",
  "product-page": "Value proposition clarity, feature presentation, onboarding friction, and conversion barriers.",
  "landing-marketing": "Visual hierarchy, content structure, conversion funnel, and accessibility.",
  "landing-paid-media": "Ad-to-page message match, conversion funnel, attention ratio, and bounce risk.",
};

const allTypes: AnalysisType[] = [
  "homepage",
  "blog-content",
  "checkout",
  "lead-form",
  "product-page",
  "landing-marketing",
  "landing-paid-media",
];

const LandingView = ({ onAnalyze, usage, user, onSignIn, initialUrl }: LandingViewProps) => {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("homepage");
  const [device, setDevice] = useState<"desktop" | "mobile" | "both">(() => getUserSettings().defaultDevice);
  const [userOverridden, setUserOverridden] = useState(false);
  const [isEditingType, setIsEditingType] = useState(false);
  const [goal, setGoal] = useState<ConversionGoal>(() => getDefaultGoalForPageType("homepage"));
  const [goalOverridden, setGoalOverridden] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const capabilities = usePlanCapabilities();
  const navigate = useNavigate();

  useEffect(() => {
    if (goalOverridden) return;
    setGoal(getDefaultGoalForPageType(analysisType));
  }, [analysisType, goalOverridden]);

  const handleGoalChange = (type: ConversionGoalType) => {
    const option = CONVERSION_GOAL_OPTIONS.find((o) => o.type === type)!;
    setGoal(type === "custom" ? { type, isMacro: option.isMacro, customLabel: "" } : { type, isMacro: option.isMacro });
    setGoalOverridden(true);
    setIsEditingGoal(false);
  };

  const resetGoalToSuggested = () => {
    setGoalOverridden(false);
    setGoal(getDefaultGoalForPageType(analysisType));
  };

  useEffect(() => {
    if (!getUserSettings().autoDetectPageType) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!url.trim()) return;
    if (userOverridden) return;
    debounceRef.current = setTimeout(() => {
      const detected = detectPageType(url.trim());
      setAnalysisType(detected);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, userOverridden]);

  const handleTypeChange = (type: AnalysisType) => {
    setAnalysisType(type);
    setUserOverridden(true);
    setIsEditingType(false);
  };

  const resetToAutoDetect = () => {
    setUserOverridden(false);
    if (url.trim()) setAnalysisType(detectPageType(url.trim()));
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUserOverridden(false);
  };

  const handleDeviceSelect = (d: "desktop" | "mobile" | "both") => {
    if (d === "mobile" && !capabilities.canMobileAnalysis) {
      const msg = getUpgradeMessage("mobile");
      toast.error(msg.title, {
        description: msg.description,
        action: { label: "Upgrade", onClick: () => navigate("/subscription") },
      });
      return;
    }
    if (d === "both" && !capabilities.canComparisonAnalysis) {
      const msg = getUpgradeMessage("comparison");
      toast.error(msg.title, {
        description: msg.description,
        action: { label: "Upgrade", onClick: () => navigate("/subscription") },
      });
      return;
    }
    setDevice(d);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && isGoalComplete(goal)) onAnalyze(url.trim(), analysisType, device, goal);
  };

  const isDeviceLocked = (d: "desktop" | "mobile" | "both") => {
    if (d === "mobile") return !capabilities.canMobileAnalysis;
    if (d === "both") return !capabilities.canComparisonAnalysis;
    return false;
  };

  return (
    <motion.div
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <AppShell onSignIn={onSignIn}>
      <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground tracking-tight leading-[1.05] mb-4">
            Conversion Friction Checker
          </h1>
          <p className="text-body text-muted-foreground mb-8">
            Paste a URL. Get a prioritized backlog of conversion-killing friction.
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-3"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="w-full h-12 pl-10 pr-24 rounded-lg bg-surface shadow-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary border border-border transition-shadow font-mono"
              required
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Analyze
            </button>
          </div>

          {/* Page type selector */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center"
          >
            {isEditingType ? (
              <div className="relative inline-flex items-center">
                <select
                  autoFocus
                  value={analysisType}
                  onChange={(e) => handleTypeChange(e.target.value as AnalysisType)}
                  onBlur={() => setIsEditingType(false)}
                  className="appearance-none bg-secondary text-foreground text-xs font-medium pl-3 pr-7 py-1.5 rounded-full border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {allTypes.map((t) => (
                    <option key={t} value={t}>
                      {analysisTypeLabels[t]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="bg-secondary text-foreground text-xs font-medium px-3 py-1.5 rounded-full">
                  {analysisTypeLabels[analysisType]}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {userOverridden ? "Manual" : "Auto-detected"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingType(true)}
                  className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Change
                </button>
                {userOverridden && getUserSettings().autoDetectPageType && (
                  <button
                    type="button"
                    onClick={resetToAutoDetect}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </motion.div>

          {/* Conversion goal selector */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center justify-center gap-1.5"
          >
            {isEditingGoal ? (
              <div className="relative inline-flex items-center">
                <select
                  autoFocus
                  value={goal.type}
                  onChange={(e) => handleGoalChange(e.target.value as ConversionGoalType)}
                  onBlur={() => setIsEditingGoal(false)}
                  className="appearance-none bg-secondary text-foreground text-xs font-medium pl-3 pr-7 py-1.5 rounded-full border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <optgroup label="Macro">
                    {macroGoalOptions.map((o) => (
                      <option key={o.type} value={o.type}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Micro">
                    {microGoalOptions.map((o) => (
                      <option key={o.type} value={o.type}>{o.label}</option>
                    ))}
                  </optgroup>
                  <option value={customGoalOption.type}>{customGoalOption.label}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="bg-secondary text-foreground text-xs font-medium px-3 py-1.5 rounded-full">
                  {GOAL_LABELS[goal.type]}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {goalOverridden ? "Manual" : "Suggested"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(true)}
                  className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Change goal
                </button>
                {goalOverridden && (
                  <button
                    type="button"
                    onClick={resetGoalToSuggested}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
            {goal.type === "custom" && (
              <input
                type="text"
                value={goal.customLabel ?? ""}
                onChange={(e) => setGoal({ type: "custom", isMacro: false, customLabel: e.target.value })}
                placeholder="Describe the goal…"
                className="w-48 h-8 px-3 rounded-full bg-secondary text-xs text-foreground placeholder:text-muted-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}
          </motion.div>

          {/* Device Toggle */}
          <div className="flex items-center justify-center gap-1">
            <div className="inline-flex items-center rounded-lg bg-secondary p-0.5">
              {(["desktop", "mobile", "both"] as const).map((d) => {
                const locked = isDeviceLocked(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDeviceSelect(d)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      device === d
                        ? "bg-background text-foreground shadow-sm"
                        : locked
                        ? "text-muted-foreground/50 cursor-not-allowed"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d === "desktop" && <Monitor className="h-3.5 w-3.5" />}
                    {d === "mobile" && <Smartphone className="h-3.5 w-3.5" />}
                    {d === "both" && <><Monitor className="h-3 w-3" /><span className="mx-0.5 text-muted-foreground">+</span><Smartphone className="h-3 w-3" /></>}
                    {d === "both" ? "Compare" : d.charAt(0).toUpperCase() + d.slice(1)}
                    {locked && <Lock className="h-2.5 w-2.5 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 text-xs text-muted-foreground"
        >
          {typeDescriptions[analysisType]}
        </motion.p>

        {/* Usage indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-4"
        >
          <p className="text-[10px] text-muted-foreground font-mono">
            {usage.used}/{usage.limit} audits used
            {!user && usage.used > 0 && (
              <> · <button onClick={onSignIn} className="text-primary hover:text-primary/80 transition-colors">Sign in for more</button></>
            )}
            {user && usage.requiresPaid && (
              <> · <button onClick={() => navigate("/subscription")} className="text-primary hover:text-primary/80 transition-colors">Upgrade for more</button></>
            )}
          </p>
        </motion.div>
      </div>
      </div>

      {/* Footer with legal links */}
      <div className="flex-shrink-0 flex justify-center py-4">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <span className="hidden sm:inline">·</span>
          <a href="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</a>
          <span className="hidden sm:inline">·</span>
          <a href="/cancellation" className="hover:text-foreground transition-colors">Cancellation & Refunds</a>
          <span className="hidden sm:inline">·</span>
          <a href="/delivery" className="hover:text-foreground transition-colors">Delivery Policy</a>
          <span className="hidden sm:inline">·</span>
          <a href="/contact" className="hover:text-foreground transition-colors">Contact Us</a>
        </nav>
      </div>
      </div>
      </AppShell>
    </motion.div>
  );
};

export default LandingView;
