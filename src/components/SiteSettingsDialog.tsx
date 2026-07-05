import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { saveSiteSettings, type SiteSettings } from "@/lib/firebase/siteSettings";

interface SiteSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  initialSettings: SiteSettings | null;
  onSaved: (settings: SiteSettings) => void;
}

const SiteSettingsDialog = ({ open, onOpenChange, domain, initialSettings, onSaved }: SiteSettingsDialogProps) => {
  const { user } = useAuth();
  const [monthlyTraffic, setMonthlyTraffic] = useState("");
  const [averageOrderValue, setAverageOrderValue] = useState("");
  const [baselineConversionRate, setBaselineConversionRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMonthlyTraffic(initialSettings?.monthlyTraffic?.toString() ?? "");
    setAverageOrderValue(initialSettings?.averageOrderValue?.toString() ?? "");
    setBaselineConversionRate(initialSettings?.baselineConversionRate?.toString() ?? "");
  }, [initialSettings, open]);

  const isComplete = monthlyTraffic !== "" && averageOrderValue !== "" && baselineConversionRate !== "";

  const handleSave = async () => {
    if (!user || !isComplete) return;
    const settings: SiteSettings = {
      monthlyTraffic: Number(monthlyTraffic),
      averageOrderValue: Number(averageOrderValue),
      baselineConversionRate: Number(baselineConversionRate),
    };
    setSaving(true);
    try {
      await saveSiteSettings(user.uid, domain, settings);
      onSaved(settings);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revenue impact settings for {domain}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Used to turn each issue's estimated conversion lift into a monthly revenue estimate.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="monthly-traffic" className="text-xs text-muted-foreground block mb-1">
              Monthly traffic (visits)
            </label>
            <input
              id="monthly-traffic"
              type="number"
              value={monthlyTraffic}
              onChange={(e) => setMonthlyTraffic(e.target.value)}
              className="w-full h-9 text-sm bg-secondary rounded-md px-3 border-none outline-none"
              placeholder="e.g. 50000"
            />
          </div>
          <div>
            <label htmlFor="average-order-value" className="text-xs text-muted-foreground block mb-1">
              Average order value ($)
            </label>
            <input
              id="average-order-value"
              type="number"
              value={averageOrderValue}
              onChange={(e) => setAverageOrderValue(e.target.value)}
              className="w-full h-9 text-sm bg-secondary rounded-md px-3 border-none outline-none"
              placeholder="e.g. 80"
            />
          </div>
          <div>
            <label htmlFor="baseline-conversion-rate" className="text-xs text-muted-foreground block mb-1">
              Baseline conversion rate (%)
            </label>
            <input
              id="baseline-conversion-rate"
              type="number"
              value={baselineConversionRate}
              onChange={(e) => setBaselineConversionRate(e.target.value)}
              className="w-full h-9 text-sm bg-secondary rounded-md px-3 border-none outline-none"
              placeholder="e.g. 2.5"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!isComplete || saving}
          className="w-full h-9 text-sm font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default SiteSettingsDialog;
