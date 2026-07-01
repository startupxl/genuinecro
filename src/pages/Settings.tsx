import { useState, useEffect } from "react";
import { Bell, BellOff, Mail, MailX, Palette, Globe, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SETTINGS_KEY = "genuinecro_settings";

interface UserSettings {
  emailNotifications: boolean;
  analysisAlerts: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  defaultDevice: "desktop" | "mobile" | "both";
  autoDetectPageType: boolean;
  language: string;
}

const defaultSettings: UserSettings = {
  emailNotifications: true,
  analysisAlerts: true,
  weeklyDigest: false,
  marketingEmails: false,
  defaultDevice: "desktop",
  autoDetectPageType: true,
  language: "en",
};

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings(JSON.parse(stored));
    } catch {}
  }, []);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSaving(false);
      setDirty(false);
      toast.success("Settings saved");
    }, 400);
  };

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
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
      </main>
    </div>
  );
};

export default Settings;
