import { useState } from "react";
import { Target, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { checkMessageMatch, type MessageMatchResult } from "@/lib/api/messageMatch";
import AppShell from "@/components/AppShell";
import AuthPage from "@/components/AuthPage";
import { toast } from "sonner";

const verdictStyle: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  "Strong Match": { icon: CheckCircle2, className: "text-primary" },
  "Partial Match": { icon: AlertTriangle, className: "text-friction-med" },
  Mismatch: { icon: XCircle, className: "text-friction-high" },
};

const MessageMatchChecker = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MessageMatchResult | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const handleCheck = async () => {
    if (!url.trim() || !sourceMessage.trim()) return;
    if (!user) {
      setShowAuth(true);
      return;
    }

    let formatted = url.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }

    setIsRunning(true);
    setResult(null);
    try {
      const data = await checkMessageMatch(formatted, sourceMessage.trim());
      setResult(data);
    } catch (err) {
      toast.error("Message match check failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (showAuth && !user) {
    return <AuthPage onBack={() => setShowAuth(false)} message="Create an account to run message match checks." />;
  }

  const verdict = result ? verdictStyle[result.verdict] ?? verdictStyle["Partial Match"] : null;
  const VerdictIcon = verdict?.icon;

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">Message Match Checker</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Compare the ad, email, or social message that drove traffic against what the landing page actually says.
        </p>

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Landing page URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com/landing-page"
              className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm text-foreground"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Source message (ad headline, email subject, social caption…)
            </label>
            <textarea
              value={sourceMessage}
              onChange={(e) => setSourceMessage(e.target.value)}
              placeholder="e.g. Get 50% off your first order — today only"
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm text-foreground resize-none"
              disabled={isRunning}
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={isRunning || !url.trim() || !sourceMessage.trim()}
            className="flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            {isRunning ? "Checking…" : "Check Match"}
          </button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Match Score</p>
                <p className="text-2xl font-semibold text-foreground">{result.matchScore}/100</p>
              </div>
              {VerdictIcon && verdict && (
                <div className={`flex items-center gap-1.5 text-sm font-medium ${verdict.className}`}>
                  <VerdictIcon className="h-4 w-4" />
                  {result.verdict}
                </div>
              )}
            </div>

            {result.pageHeadline && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Page Headline</p>
                <p className="text-sm text-foreground">{result.pageHeadline}</p>
              </div>
            )}

            {result.alignedElements.length > 0 && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">What Matches</p>
                <ul className="space-y-1.5">
                  {result.alignedElements.map((el, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" /> {el}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.misalignedElements.length > 0 && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">What Doesn't Match</p>
                <ul className="space-y-1.5">
                  {result.misalignedElements.map((el, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-friction-high mt-0.5 flex-shrink-0" /> {el}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="bg-primary/[0.04] border border-primary/20 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-2">Recommendations</p>
                <ul className="space-y-1.5">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-foreground">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default MessageMatchChecker;
