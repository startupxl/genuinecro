export interface TechnicalIssue {
  category: string;
  severity: "high" | "med" | "low";
  title: string;
  description: string;
  fix: string;
  impactScore: number;
}

export interface TechnicalAuditResult {
  url: string;
  technicalScore: number;
  checks: {
    canonical: { present: boolean; href: string | null };
    indexability: { indexable: boolean; reason: string | null };
    robotsTxt: { exists: boolean; valid: boolean; issue: string | null };
    sitemap: { exists: boolean; valid: boolean; issue: string | null };
    linkSummary: { total: number; ok: number; broken: number; redirectChains: number };
  };
  issues: TechnicalIssue[];
}

export async function runTechnicalAudit(url: string): Promise<TechnicalAuditResult> {
  const response = await fetch("/api/technical/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Technical audit failed");
  }

  return data.data as TechnicalAuditResult;
}
