import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { analyzeUrl } from "@/lib/api/analyze";
import { generateMockAnalysis, extractCategoryScores, detectPageType } from "@/lib/mockData";
import { createActionItems } from "@/lib/firebase/actionItems";
import { createScanJob, completeScanJob } from "@/lib/firebase/scanJobs";
import { toast } from "sonner";

interface NewAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewAuditModal = ({ open, onOpenChange }: NewAuditModalProps) => {
  const { user } = useAuth();
  const { trackAnalysis } = useUsageTracking();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [isRunning, setIsRunning] = useState(false);

  const handleAnalyze = async () => {
    if (!user || !url.trim()) return;

    let formatted = url.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }
    const type = detectPageType(formatted);

    setIsRunning(true);
    const jobId = await createScanJob(user.uid, formatted, type, device);

    let result;
    try {
      result = await analyzeUrl(formatted, type, device);
    } catch (err) {
      console.error("Real analysis failed, falling back to mock:", err);
      toast.warning("Live analysis unavailable — showing demo results");
      result = generateMockAnalysis(formatted, type);
    }

    const analysisId = await trackAnalysis(
      formatted,
      type,
      device,
      result.conversionScore ?? result.benchmark.overallScore,
      extractCategoryScores(result.benchmark)
    );
    await createActionItems(user.uid, formatted, type, result.frictionPoints);
    await completeScanJob(jobId);

    setIsRunning(false);
    setUrl("");
    onOpenChange(false);
    if (analysisId) navigate(`/audits/${analysisId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Audit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={isRunning}
            className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              disabled={isRunning}
              className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                device === "desktop" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              disabled={isRunning}
              className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                device === "mobile" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              Mobile
            </button>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isRunning || !url.trim()}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewAuditModal;
