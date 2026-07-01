import { Zap, Rocket, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface UpgradeWallProps {
  used: number;
  limit: number;
  isAnon: boolean;
  onSignIn?: () => void;
}

const upgradeReasons = {
  anon: {
    title: "You've used your 3 free audits",
    subtitle: "Create a free account to unlock 10 more audits — no credit card required.",
    cta: "Sign up free",
  },
  free: {
    title: "You've reached your audit limit",
    subtitle: "Upgrade to Starter for 20 audits/month with the full analysis engine.",
    cta: "View plans",
  },
  starter: {
    title: "Ready for mobile previews & comparisons?",
    subtitle: "Upgrade to Growth for 75 audits/month, mobile previews, and multi-palette comparison mode.",
    cta: "Upgrade to Growth",
  },
  growth: {
    title: "Need to export & share with your team?",
    subtitle: "Upgrade to Pro for 250 audits/month, exportable reports, and developer exports.",
    cta: "Upgrade to Pro",
  },
};

const UpgradeWall = ({ used, limit, isAnon, onSignIn }: UpgradeWallProps) => {
  const navigate = useNavigate();
  const variant = isAnon ? "anon" : "free";
  const { title, subtitle, cta } = upgradeReasons[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="max-w-md w-full border-primary/20 shadow-lg">
        <CardContent className="pt-8 pb-6 px-6 space-y-5 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Audits used</span>
              <span className="font-medium text-foreground">{used} / {limit}</span>
            </div>
            <Progress value={100} className="h-1.5" />
          </div>

          {isAnon ? (
            <Button className="w-full" onClick={onSignIn}>
              <Rocket className="h-4 w-4 mr-1" />
              {cta}
            </Button>
          ) : (
            <Button className="w-full" onClick={() => navigate("/subscription")}>
              {cta}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground">
            All features included on every plan. Only pay for scale.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpgradeWall;
