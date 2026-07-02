import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { updateEmail } from "firebase/auth";
import { getUserProfile, updateUserProfile } from "@/lib/firebase/users";
import AppShell from "@/components/AppShell";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Account = () => {
  const { user } = useAuth();
  const { usage } = useUsageTracking();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    getUserProfile(user.uid).then((profile) => {
      if (profile) {
        setDisplayName(profile.displayName || "");
        setAvatarUrl(profile.avatarUrl || "");
      }
    });
  }, [user]);

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email
      ? email.slice(0, 2).toUpperCase()
      : "U";

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { displayName, avatarUrl });

      if (email !== user.email) {
        await updateEmail(user, email);
        toast.success("Email updated. You may need to sign in again.");
      } else {
        toast.success("Profile updated");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const currentPlan = "Free";
  const usagePercent = usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;

  if (!user) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">Please sign in to view your account.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-xl font-semibold text-foreground font-display">Account Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
            <CardDescription>Manage your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">{displayName || "Your Name"}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/your-photo.jpg"
              />
              <p className="text-[11px] text-muted-foreground">
                Paste a direct link to an image.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Changing your email may require you to sign in again.
              </p>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscription</CardTitle>
            <CardDescription>Your current plan and usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm px-3 py-1">
                {currentPlan} Plan
              </Badge>
              {usage.canAnalyze ? (
                <span className="text-xs text-muted-foreground">
                  {usage.limit - usage.used} analyses remaining
                </span>
              ) : (
                <span className="text-xs text-destructive">Limit reached</span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Analyses used</span>
                <span className="font-medium text-foreground">
                  {usage.used} / {usage.limit}
                </span>
              </div>
              <Progress value={usagePercent} className="h-2" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Need more analyses?</p>
                <p className="text-xs text-muted-foreground">
                  View plans and upgrade for unlimited access.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/subscription")}>
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Account;
