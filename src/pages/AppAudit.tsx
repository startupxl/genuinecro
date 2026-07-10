import { useState, useRef, type DragEvent } from "react";
import { Lock, Upload, RefreshCw, Image as ImageIcon, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import AnalysisView from "@/components/AnalysisView";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import { analyzeAppScreen } from "@/lib/api/appAudit";
import { createActionItems } from "@/lib/firebase/actionItems";
import { extractCategoryScores, type AnalysisResult } from "@/lib/mockData";
import { toast } from "sonner";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.readAsDataURL(file);
  });
}

const AppAudit = () => {
  const { user } = useAuth();
  const capabilities = usePlanCapabilities();
  const { usage, trackAnalysis } = useUsageTracking();
  const upgradeMessage = getUpgradeMessage("app-audit");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [screenLabel, setScreenLabel] = useState("");
  const [context, setContext] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | undefined>(undefined);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP, etc.)");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setFileName(file.name);
    } catch (err) {
      toast.error("Couldn't read that file", { description: err instanceof Error ? err.message : "Please try again." });
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setResult(null);
    setAnalysisId(undefined);
    setImageDataUrl(null);
    setFileName("");
    setScreenLabel("");
    setContext("");
  };

  const canRun = !!imageDataUrl && screenLabel.trim().length > 0 && !running;

  const handleRun = async () => {
    if (!user || !imageDataUrl || !screenLabel.trim()) return;
    if (usage.limit - usage.used < 1) {
      toast.error("You've used all your audits for this billing period.");
      return;
    }

    setRunning(true);
    try {
      const label = screenLabel.trim();
      const auditResult = await analyzeAppScreen({
        imageDataUrl,
        screenLabel: label,
        context: context.trim() || undefined,
      });

      const id = await trackAnalysis(
        label,
        "app-screen",
        "desktop",
        auditResult.conversionScore ?? auditResult.benchmark.overallScore,
        extractCategoryScores(auditResult.benchmark)
      );

      // screenshotUrl here is a small saved-file path (server/lib/screenshotStorage.js),
      // not the raw upload — safe to persist directly, unlike the original data URL.
      await createActionItems(user.uid, label, "app-screen", auditResult.frictionPoints);

      setResult(auditResult);
      setAnalysisId(id ?? undefined);
    } catch (err) {
      toast.error("App audit failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setRunning(false);
    }
  };

  if (!user) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Please sign in to run an app audit.</p>
        </div>
      </AppShell>
    );
  }

  if (capabilities.isLoading) {
    return <AppShell><div className="p-6" /></AppShell>;
  }

  if (!capabilities.canAppAudit) {
    return (
      <AppShell>
        <div className="p-6 max-w-3xl">
          <h1 className="text-xl font-semibold text-foreground font-display mb-1">App Audit</h1>
          <div className="bg-secondary rounded-md p-4 flex items-start gap-3 max-w-md mt-6">
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{upgradeMessage.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{upgradeMessage.description}</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (result) {
    return <AnalysisView result={result} analysisId={analysisId} onNewAnalysis={reset} onGoHome={reset} />;
  }

  return (
    <AppShell>
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">App Audit</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Screenshot an authenticated in-app screen — onboarding, a dashboard, settings, anything behind login — and get a
          product-experience audit: onboarding friction, feature discoverability, navigation, empty states, upgrade clarity.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={`rounded-lg border-2 border-dashed p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload screenshot"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
          />
          {imageDataUrl ? (
            <>
              <img src={imageDataUrl} alt="Uploaded screenshot preview" className="max-h-64 rounded-md border border-border" />
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" />
                {fileName}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImageDataUrl(null); setFileName(""); }}
                  aria-label="Remove screenshot"
                  className="text-muted-foreground hover:text-friction-high transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-foreground">Drop a screenshot here, or click to browse</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, or WebP</p>
            </>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Screen name</label>
            <input
              type="text"
              value={screenLabel}
              onChange={(e) => setScreenLabel(e.target.value)}
              placeholder="e.g. Onboarding — Step 2, or Client App — Dashboard"
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
              disabled={running}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">What should this screen let the user do? (optional)</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Create their first project within 2 minutes of signing up"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none"
              disabled={running}
            />
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={!canRun}
          className="mt-4 flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
          {running ? "Auditing…" : "Run Audit"}
        </button>
      </div>
    </AppShell>
  );
};

export default AppAudit;
