import { useState, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import LandingView from "@/components/LandingView";
import AnalysisView from "@/components/AnalysisView";
import ComparisonView from "@/components/ComparisonView";
import AuthPage from "@/components/AuthPage";
import UpgradeWall from "@/components/UpgradeWall";
import { generateMockAnalysis, type AnalysisResult, type AnalysisType } from "@/lib/mockData";
import { analyzeUrl } from "@/lib/api/analyze";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { toast } from "sonner";

const Index = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { usage, trackAnalysis } = useUsageTracking();
  const location = useLocation();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<{ desktop: AnalysisResult; mobile: AnalysisResult } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);

  useEffect(() => {
    if (location.state?.analysisResult) {
      setResult(location.state.analysisResult);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleAnalyze = useCallback(async (url: string, type: AnalysisType = "homepage", device: "desktop" | "mobile" | "both" = "desktop") => {
    if (usage.requiresAuth) {
      setAuthMessage("You've used your 3 free audits. Create an account to get more!");
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

    if (device === "both") {
      setProgress("Analyzing desktop & mobile experiences…");
      try {
        const [desktopData, mobileData] = await Promise.all([
          analyzeUrl(formatted, type, "desktop"),
          analyzeUrl(formatted, type, "mobile"),
        ]);
        setComparisonResults({ desktop: desktopData, mobile: mobileData });
        await trackAnalysis(formatted, type, "desktop");
        toast.success(`Found ${desktopData.frictionPoints.length} desktop + ${mobileData.frictionPoints.length} mobile friction points`);
      } catch (err) {
        console.error("Comparison analysis failed, falling back to mock:", err);
        toast.warning("Live analysis unavailable — showing demo results");
        const mockDesktop = generateMockAnalysis(formatted, type);
        const mockMobile = { ...generateMockAnalysis(formatted, type), device: "mobile" as const };
        setComparisonResults({ desktop: mockDesktop, mobile: mockMobile });
        await trackAnalysis(formatted, type, "desktop");
      }
    } else {
      setProgress(`Analyzing ${device} experience…`);
      try {
        setProgress(`Analyzing ${device} view for conversion friction…`);
        const data = await analyzeUrl(formatted, type, device);
        setResult(data);
        await trackAnalysis(formatted, type, device);
        toast.success(`Found ${data.frictionPoints.length} friction points (${device})`);
      } catch (err) {
        console.error("Real analysis failed, falling back to mock:", err);
        toast.warning("Live analysis unavailable — showing demo results", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        const mockResult = generateMockAnalysis(formatted, type);
        setResult(mockResult);
        await trackAnalysis(formatted, type, device);
      }
    }

    setIsAnalyzing(false);
    setProgress("");
  }, [usage, trackAnalysis]);

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
    return (
      <ComparisonView
        desktopResult={comparisonResults.desktop}
        mobileResult={comparisonResults.mobile}
        onBack={goHome}
        onGoHome={goHome}
        onSignIn={openSignIn}
      />
    );
  }

  if (result && !isAnalyzing) {
    return (
      <AnalysisView
        result={result}
        onNewAnalysis={(url) => handleAnalyze(url, result.analysisType, result.device)}
        onGoHome={goHome}
        onSignIn={openSignIn}
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
          onAnalyze={handleAnalyze}
          usage={usage}
          user={user}
          onSignIn={openSignIn}
          onSignOut={signOut}
        />
      </AnimatePresence>
    </>
  );
};

export default Index;
