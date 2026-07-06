import { Link } from "react-router-dom";
import { Calculator, TrendingUp, ShieldQuestion, ArrowRight } from "lucide-react";
import PublicToolLayout from "@/components/PublicToolLayout";

const TOOLS = [
  {
    path: "/tools/sample-size-calculator",
    label: "Sample Size Calculator",
    description: "Figure out how many visitors each variant needs before you can trust your test's results.",
    icon: Calculator,
  },
  {
    path: "/tools/significance-calculator",
    label: "Significance Calculator",
    description: "Paste your test results from any platform and find out whether the difference is real or just noise.",
    icon: TrendingUp,
  },
  {
    path: "/tools/aa-test-checker",
    label: "A/A Test Checker",
    description: "Run two identical variants against each other to sanity-check your test setup before trusting real results.",
    icon: ShieldQuestion,
  },
];

const FreeTools = () => {
  return (
    <PublicToolLayout
      title="Free CRO Tools"
      description="Quick, free statistics tools for running better A/B tests — no account required, works with any testing platform."
    >
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
    </PublicToolLayout>
  );
};

export default FreeTools;
