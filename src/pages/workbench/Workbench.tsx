import { Link } from "react-router-dom";
import { Lock, Layers, FileText, ArrowRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import { usePlanCapabilities, getUpgradeMessage } from "@/hooks/usePlanCapabilities";

const TOOLS = [
  {
    path: "/workbench/multivariate-idea-expander",
    label: "Multivariate Idea Expander",
    description: "Turn a single testing idea into a proper multivariate design — factors, levels, and concrete combinations to test together.",
    icon: Layers,
  },
  {
    path: "/workbench/test-brief-writer",
    label: "Test Brief Writer",
    description: "Turn a hypothesis into a complete, ready-to-share test brief — problem statement, metrics, variants, and risks.",
    icon: FileText,
  },
];

const Workbench = () => {
  const capabilities = usePlanCapabilities();
  const upgradeMessage = getUpgradeMessage("workbench");

  return (
    <AppShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-semibold text-foreground font-display mb-1">Experiment Workbench</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The audit tells you what's broken. The Workbench helps you plan and write up the tests that fix it.
        </p>

        {capabilities.isLoading ? null : capabilities.canExperimentWorkbench ? (
          <div className="space-y-3 max-w-md">
            {TOOLS.map((tool) => (
              <Link
                key={tool.path}
                to={tool.path}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface hover:border-primary/40 transition-colors group"
              >
                <tool.icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground flex items-center gap-1">
                    {tool.label}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-secondary rounded-md p-4 flex items-start gap-3 max-w-md">
            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{upgradeMessage.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{upgradeMessage.description}</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Workbench;
