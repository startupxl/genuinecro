import { useState } from "react";
import { Search, ChevronDown, ChevronRight, HelpCircle, CreditCard, Zap, Shield, Monitor, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  label: string;
  icon: React.ElementType;
  items: FaqItem[];
}

const faqData: FaqCategory[] = [
  {
    label: "Getting Started",
    icon: HelpCircle,
    items: [
      {
        question: "What is GenuineCRO?",
        answer: "GenuineCRO is an AI-powered conversion rate optimization tool that analyzes web pages to identify friction points, UX issues, and conversion barriers. Simply paste a URL and get actionable insights in seconds.",
      },
      {
        question: "How do I run my first analysis?",
        answer: "From the homepage, paste any URL into the input field. Select the page type (e.g. Homepage, Checkout, Product Page), choose a device view (Desktop, Mobile, or Compare), and click Analyze. Your results will appear within moments.",
      },
      {
        question: "What page types can I analyze?",
        answer: "GenuineCRO supports Homepage, Blog/Content, Checkout, Lead/Form, Product/SaaS, Marketing Landing Page, and Paid Media Landing Page analysis. Each type uses specialized scoring criteria relevant to that page's conversion goals.",
      },
      {
        question: "Do I need an account to use GenuineCRO?",
        answer: "You can run up to 3 analyses without an account. Sign up for a free account to get 10 analyses. Upgrade to a paid plan for unlimited access.",
      },
    ],
  },
  {
    label: "Analysis & Scoring",
    icon: BarChart3,
    items: [
      {
        question: "What scoring categories are used?",
        answer: "Pages are scored across six dimensions: UX Clarity, Trust & Credibility, Friction & Effort, Speed & Performance, Intent Match, and Funnel Health. Each category receives a score out of 100, and a weighted overall score is calculated.",
      },
      {
        question: "What is the severity rating?",
        answer: "Each friction point is rated as Critical (major conversion killer), High (significant impact), Medium (noticeable friction), or Low (minor improvement opportunity). Focus on Critical and High items first for maximum impact.",
      },
      {
        question: "Can I compare desktop and mobile views?",
        answer: "Yes! Select 'Compare' in the device toggle to run a side-by-side analysis of desktop and mobile friction points. This helps you identify device-specific issues at a glance.",
      },
      {
        question: "How accurate is the AI analysis?",
        answer: "GenuineCRO uses advanced AI models combined with industry-standard CRO benchmarks and heuristics. While no automated tool replaces human judgment entirely, our analysis surfaces issues that align with established UX and CRO best practices.",
      },
    ],
  },
  {
    label: "Account & Billing",
    icon: CreditCard,
    items: [
      {
        question: "How do I upgrade my plan?",
        answer: "Visit the Subscription page from the navigation menu to view available plans and upgrade. Pro and Team plans are coming soon with unlimited analyses, export features, and more.",
      },
      {
        question: "How do I update my profile?",
        answer: "Go to Account from the navigation menu to update your display name, email address, and profile photo.",
      },
      {
        question: "What happens when I reach my analysis limit?",
        answer: "Anonymous users get 3 free analyses. Signed-in free users get 10. Once you've reached your limit, you'll be prompted to upgrade to a paid plan for unlimited access.",
      },
    ],
  },
  {
    label: "Privacy & Security",
    icon: Shield,
    items: [
      {
        question: "Is my data secure?",
        answer: "Yes. All data is transmitted over HTTPS. Your analysis results and account information are stored securely with row-level security ensuring only you can access your data.",
      },
      {
        question: "Do you store the pages I analyze?",
        answer: "We store the URL and analysis metadata (page type, device, timestamp) for your analysis history. The actual page content is processed in real-time and not permanently stored.",
      },
      {
        question: "Can I delete my account?",
        answer: "Account deletion is coming soon. In the meantime, contact support if you need your data removed.",
      },
    ],
  },
  {
    label: "Features & Tips",
    icon: Zap,
    items: [
      {
        question: "What are A/B test recommendations?",
        answer: "For each friction point, GenuineCRO suggests specific A/B tests you can run to validate improvements. These include the hypothesis, what to test, expected impact, and implementation guidance.",
      },
      {
        question: "Can I export my analysis results?",
        answer: "Export functionality is available for Pro and Team plan users. You'll be able to download PDF reports of your analysis results.",
      },
      {
        question: "What does the benchmark comparison show?",
        answer: "Benchmark data compares your page's scores against industry averages for the same page type, helping you understand where you stand relative to competitors.",
      },
    ],
  },
];

const HelpCenter = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredCategories = faqData
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-display">Help Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find answers to common questions about GenuineCRO
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help articles…"
            className="pl-10"
          />
        </div>

        {/* FAQ Categories */}
        <div className="space-y-4">
          {filteredCategories.map((cat) => (
            <Card key={cat.label}>
              <CardContent className="pt-5 pb-3 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <cat.icon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">{cat.label}</h2>
                </div>
                {cat.items.map((item, i) => {
                  const key = `${cat.label}-${i}`;
                  const isOpen = openItems.has(key);
                  return (
                    <div key={key} className="border-t border-border/40 first:border-t-0">
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between py-3 text-left text-sm text-foreground hover:text-primary transition-colors"
                      >
                        <span className="pr-4">{item.question}</span>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                      {isOpen && (
                        <p className="text-sm text-muted-foreground pb-3 pr-8 leading-relaxed">
                          {item.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {filteredCategories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No results found for "{search}"
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default HelpCenter;
