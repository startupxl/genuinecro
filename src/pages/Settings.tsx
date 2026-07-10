import { useState, useEffect } from "react";
import { Bell, BellOff, Mail, MailX, Palette, Globe, Save, Loader2, BarChart3, Lock, Unlink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";
import AppShell from "@/components/AppShell";
import { getUserSettings, saveUserSettings, defaultSettings, type UserSettings } from "@/lib/userSettings";
import { subscribeToKit } from "@/lib/api/kit";
import {
  getGA4Status,
  getGA4AuthorizeUrl,
  getGA4Properties,
  addGA4Property,
  removeGA4Property,
  disconnectGA4,
  type GA4Status,
  type GA4Property,
} from "@/lib/api/ga4";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const Settings = () => {
  const { user } = useAuth();
  const capabilities = usePlanCapabilities();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [ga4Status, setGa4Status] = useState<GA4Status | null>(null);
  const [ga4Properties, setGa4Properties] = useState<GA4Property[]>([]);
  const [ga4Connecting, setGa4Connecting] = useState(false);
  const [newSiteDomain, setNewSiteDomain] = useState("");
  const [newSitePropertyId, setNewSitePropertyId] = useState("");
  const [addingSite, setAddingSite] = useState(false);

  useEffect(() => {
    setSettings(getUserSettings());
  }, []);

  const refreshGa4Status = async () => {
    if (!user || !capabilities.canGA4Integration) return;
    try {
      const status = await getGA4Status(user);
      setGa4Status(status);
      if (status.connected) {
        const properties = await getGA4Properties(user);
        setGa4Properties(properties);
      }
    } catch (err: any) {
      console.error("Failed to load Google Analytics status:", err);
    }
  };

  useEffect(() => {
    refreshGa4Status();
  }, [user, capabilities.canGA4Integration]);

  useEffect(() => {
    const ga4Param = searchParams.get("ga4");
    if (!ga4Param) return;

    if (ga4Param === "connected") {
      toast.success("Google Analytics connected — add your first site below");
      refreshGa4Status();
    } else if (ga4Param === "error") {
      toast.error("Failed to connect Google Analytics. Please try again.");
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("ga4");
      return next;
    });
  }, [searchParams, setSearchParams]);

  const handleConnectGA4 = async () => {
    if (!user) return;
    setGa4Connecting(true);
    try {
      const url = await getGA4AuthorizeUrl(user);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start Google Analytics connection");
      setGa4Connecting(false);
    }
  };

  const handleDisconnectGA4 = async () => {
    if (!user) return;
    try {
      await disconnectGA4(user);
      setGa4Status({ connected: false, properties: [] });
      setGa4Properties([]);
      toast.success("Google Analytics disconnected");
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect Google Analytics");
    }
  };

  const handleAddSite = async () => {
    if (!user || !newSiteDomain.trim() || !newSitePropertyId) return;
    const property = ga4Properties.find((p) => p.propertyId === newSitePropertyId);
    if (!property) return;

    setAddingSite(true);
    try {
      await addGA4Property(user, newSiteDomain.trim(), property.propertyId, property.displayName);
      setNewSiteDomain("");
      setNewSitePropertyId("");
      toast.success(`${newSiteDomain.trim()} connected to ${property.displayName}`);
      await refreshGa4Status();
    } catch (err: any) {
      toast.error(err.message || "Failed to add site");
    } finally {
      setAddingSite(false);
    }
  };

  const handleRemoveSite = async (domain: string) => {
    if (!user) return;
    try {
      await removeGA4Property(user, domain);
      setGa4Status((prev) => (prev ? { ...prev, properties: prev.properties.filter((p) => p.domain !== domain) } : prev));
      toast.success(`${domain} disconnected`);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove site");
    }
  };

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    saveUserSettings(settings);
    if ((settings.weeklyDigest || settings.marketingEmails) && user?.email) {
      await subscribeToKit(user.email);
    }
    setSaving(false);
    setDirty(false);
    toast.success("Settings saved");
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground font-display">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your notifications and preferences</p>
          </div>
          {dirty && (
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          )}
        </div>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Choose what updates you receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive important updates via email</p>
              </div>
              <Switch
                aria-label="Email Notifications"
                checked={settings.emailNotifications}
                onCheckedChange={(v) => update("emailNotifications", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Analysis Alerts</Label>
                <p className="text-xs text-muted-foreground">Get notified when your analysis is ready</p>
              </div>
              <Switch
                aria-label="Analysis Alerts"
                checked={settings.analysisAlerts}
                onCheckedChange={(v) => update("analysisAlerts", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Weekly Digest</Label>
                <p className="text-xs text-muted-foreground">Receive a weekly summary of your CRO insights</p>
              </div>
              <Switch
                aria-label="Weekly Digest"
                checked={settings.weeklyDigest}
                onCheckedChange={(v) => update("weeklyDigest", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Marketing Emails</Label>
                <p className="text-xs text-muted-foreground">Product news, tips, and feature announcements</p>
              </div>
              <Switch
                aria-label="Marketing Emails"
                checked={settings.marketingEmails}
                onCheckedChange={(v) => update("marketingEmails", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Analysis Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Analysis Preferences
            </CardTitle>
            <CardDescription>Customize your default analysis settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Default Device</Label>
                <p className="text-xs text-muted-foreground">Pre-selected device when starting a new analysis</p>
              </div>
              <Select
                value={settings.defaultDevice}
                onValueChange={(v) => update("defaultDevice", v as UserSettings["defaultDevice"])}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="both">Compare</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Auto-detect Page Type</Label>
                <p className="text-xs text-muted-foreground">Automatically detect page type from URL patterns</p>
              </div>
              <Switch
                aria-label="Auto-detect Page Type"
                checked={settings.autoDetectPageType}
                onCheckedChange={(v) => update("autoDetectPageType", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Language</Label>
                <p className="text-xs text-muted-foreground">Analysis report language</p>
              </div>
              <Select
                value={settings.language}
                onValueChange={(v) => update("language", v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Google Analytics 4 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Google Analytics
            </CardTitle>
            <CardDescription>
              Connect a GA4 property to bring real bounce, engagement, and conversion data into your audits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!capabilities.canGA4Integration ? (
              <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-3">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm text-foreground">{getUpgradeMessage("ga4").title}</p>
                  <p className="text-xs text-muted-foreground">{getUpgradeMessage("ga4").description}</p>
                </div>
              </div>
            ) : ga4Status?.connected ? (
              <div className="space-y-4">
                {ga4Status.properties.length > 0 && (
                  <div className="space-y-2">
                    {ga4Status.properties.map((property) => (
                      <div
                        key={property.domain}
                        className="flex items-center justify-between rounded-md border border-border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{property.domain}</p>
                          <p className="text-xs text-muted-foreground">{property.propertyDisplayName}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-muted-foreground"
                          onClick={() => handleRemoveSite(property.domain)}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Add a site</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={newSiteDomain}
                      onChange={(e) => setNewSiteDomain(e.target.value)}
                      placeholder="example.com"
                      className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground flex-1 min-w-[140px]"
                      disabled={addingSite}
                    />
                    <select
                      aria-label="GA4 property"
                      value={newSitePropertyId}
                      onChange={(e) => setNewSitePropertyId(e.target.value)}
                      className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground min-w-[200px]"
                      disabled={addingSite}
                    >
                      <option value="">Choose GA4 property</option>
                      {ga4Properties.map((property) => (
                        <option key={property.propertyId} value={property.propertyId}>
                          {property.displayName} ({property.accountName})
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={handleAddSite}
                      disabled={addingSite || !newSiteDomain.trim() || !newSitePropertyId}
                    >
                      {addingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add site"}
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex justify-end">
                  <Button size="sm" variant="outline" className="gap-2" onClick={handleDisconnectGA4}>
                    <Unlink className="h-3.5 w-3.5" />
                    Disconnect Google account
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground max-w-sm">
                  You'll be sent to Google to grant read-only access to your GA4 property.
                </p>
                <Button size="sm" onClick={handleConnectGA4} disabled={ga4Connecting}>
                  {ga4Connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Google Analytics"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Settings;
