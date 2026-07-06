import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { saveSiteSettings, type SiteSettings, type SiteType } from "@/lib/firebase/siteSettings";

const SITE_TYPE_OPTIONS: { value: SiteType; label: string }[] = [
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS / Subscription" },
  { value: "lead-gen", label: "Lead Generation" },
  { value: "content", label: "Content / Media" },
  { value: "marketplace", label: "Marketplace" },
  { value: "other", label: "Other" },
];

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
  const [siteType, setSiteType] = useState<SiteType | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMonthlyTraffic(initialSettings?.monthlyTraffic?.toString() ?? "");
    setAverageOrderValue(initialSettings?.averageOrderValue?.toString() ?? "");
    setBaselineConversionRate(initialSettings?.baselineConversionRate?.toString() ?? "");
    setSiteType(initialSettings?.siteType ?? "");
  }, [initialSettings, open]);

  const revenueFieldsComplete = monthlyTraffic !== "" && averageOrderValue !== "" && baselineConversionRate !== "";
  const isComplete = revenueFieldsComplete || siteType !== "";

  const handleSave = async () => {
    if (!user || !isComplete) return;
    const settings: SiteSettings = {};
    if (revenueFieldsComplete) {
      settings.monthlyTraffic = Number(monthlyTraffic);
      settings.averageOrderValue = Number(averageOrderValue);
      settings.baselineConversionRate = Number(baselineConversionRate);
    }
    if (siteType !== "") settings.siteType = siteType;
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
          <DialogTitle>Site settings for {domain}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="site-type" className="text-xs text-muted-foreground block mb-1">
              Site type
            </label>
            <select
              id="site-type"
              value={siteType}
              onChange={(e) => setSiteType(e.target.value as SiteType | "")}
              className="w-full h-9 text-sm bg-secondary rounded-md px-3 border-none outline-none"
            >
              <option value="">Select a site type…</option>
              {SITE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Used to tailor recommendations to your business model on future audits of this site.
            </p>
          </div>
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">
              Revenue impact inputs — used to turn each issue's estimated conversion lift into a monthly revenue estimate.
            </p>
          </div>
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
