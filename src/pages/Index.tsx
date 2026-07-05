import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import LandingView from "@/components/LandingView";
import AnalysisView from "@/components/AnalysisView";
import ComparisonView from "@/components/ComparisonView";
import AuthPage from "@/components/AuthPage";
import UpgradeWall from "@/components/UpgradeWall";
import { extractCategoryScores, type AnalysisResult, type AnalysisType } from "@/lib/mockData";
import { analyzeUrl } from "@/lib/api/analyze";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { createActionItems } from "@/lib/firebase/actionItems";
import { createScanJob, completeScanJob } from "@/lib/firebase/scanJobs";
import { toast } from "sonner";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { usage, trackAnalysis } = useUsageTracking();
  const location = useLocation();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<{ desktop: AnalysisResult; mobile: AnalysisResult } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);
  const recordedResultRef = useRef<AnalysisResult | null>(null);

  useEffect(() => {
    if (location.state?.analysisResult) {
      setResult(location.state.analysisResult);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const pending = result ?? comparisonResults?.desktop ?? null;
    if (!user || !pending || recordedResultRef.current === pending) return;
    recordedResultRef.current = pending;
    (async () => {
      await trackAnalysis(pending.url, pending.analysisType, pending.device, pending.conversionScore ?? pending.benchmark.overallScore, extractCategoryScores(pending.benchmark));
      await createActionItems(user.uid, pending.url, pending.analysisType, pending.frictionPoints);
    })();
  }, [user, result, comparisonResults, trackAnalysis]);

  const handleAnalyze = useCallback(async (url: string, type: AnalysisType = "homepage", device: "desktop" | "mobile" | "both" = "desktop") => {
    if (usage.requiresAuth) {
      setAuthMessage("You've used your free scan. Create an account to keep going!");
      setShowAuth(true);
      return;
    }
    if (usage.requiresPaid) {
      setShowUpgradeWall(true);
      return;
    }

    let formatted = url;
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }
    setIsAnalyzing(true);
    setResult(null);
    setComparisonResults(null);

    const jobId = user ? await createScanJob(user.uid, formatted, type, device) : null;

    try {
      if (device === "both") {
        setProgress("Analyzing desktop & mobile experiences…");
        const [desktopData, mobileData] = await Promise.all([
          analyzeUrl(formatted, type, "desktop"),
          analyzeUrl(formatted, type, "mobile"),
        ]);
        setComparisonResults({ desktop: desktopData, mobile: mobileData });
        if (user) recordedResultRef.current = desktopData;
        await trackAnalysis(formatted, type, "desktop", desktopData.conversionScore ?? desktopData.benchmark.overallScore, extractCategoryScores(desktopData.benchmark));
        if (user) await createActionItems(user.uid, formatted, type, desktopData.frictionPoints);
        toast.success(`Found ${desktopData.frictionPoints.length} desktop + ${mobileData.frictionPoints.length} mobile friction points`);
      } else {
        setProgress(`Analyzing ${device} experience…`);
        setProgress(`Analyzing ${device} view for conversion friction…`);
        const data = await analyzeUrl(formatted, type, device);
        setResult(data);
        if (user) recordedResultRef.current = data;
        await trackAnalysis(formatted, type, device, data.conversionScore ?? data.benchmark.overallScore, extractCategoryScores(data.benchmark));
        if (user) await createActionItems(user.uid, formatted, type, data.frictionPoints);
        toast.success(`Found ${data.frictionPoints.length} friction points (${device})`);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error("Analysis failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      await completeScanJob(jobId);
      setIsAnalyzing(false);
      setProgress("");
    }
  }, [usage, trackAnalysis, user]);

  const goHome = () => {
    setResult(null);
    setComparisonResults(null);
  };

  const openSignIn = () => {
    setAuthMessage("");
    setShowAuth(true);
  };

  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} message={authMessage} />;
  }

  if (comparisonResults && !isAnalyzing) {
    if (!user) {
      return (
        <AuthPage
          onBack={goHome}
          message="Your results are ready — sign in to view them."
          initialMode="signup"
        />
      );
    }
    return (
      <ComparisonView
        desktopResult={comparisonResults.desktop}
        mobileResult={comparisonResults.mobile}
        onBack={goHome}
        onGoHome={goHome}
      />
    );
  }

  if (result && !isAnalyzing) {
    if (!user) {
      return (
        <AuthPage
          onBack={goHome}
          message="Your results are ready — sign in to view them."
          initialMode="signup"
        />
      );
    }
    return (
      <AnalysisView
        result={result}
        onNewAnalysis={(url) => handleAnalyze(url, result.analysisType, result.device)}
        onGoHome={goHome}
      />
    );
  }

  if (isAnalyzing) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-sm font-medium text-foreground mb-2">Analyzing…</h2>
          <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full animate-pulse"
              style={{ width: "60%", transition: "width 1s cubic-bezier(0.25, 0.1, 0.25, 1)" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3 font-mono">{progress}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showUpgradeWall && (
        <UpgradeWall
          used={usage.used}
          limit={usage.limit}
          isAnon={!user}
          onSignIn={() => {
            setShowUpgradeWall(false);
            openSignIn();
          }}
        />
      )}
      <AnimatePresence mode="wait">
        <LandingView
          initialUrl={location.state?.prefillUrl}
          onAnalyze={handleAnalyze}
          usage={usage}
          user={user}
          onSignIn={openSignIn}
        />
      </AnimatePresence>
    </>
  );
};

export default Index;
