import type { AnalysisResult } from "@/lib/mockData";

export interface AppAuditInput {
  imageDataUrl: string;
  screenLabel: string;
  context?: string;
}

export async function analyzeAppScreen(input: AppAuditInput): Promise<AnalysisResult> {
  const response = await fetch("/api/app-audit/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "App audit failed");
  }

  return data.data as AnalysisResult;
}
