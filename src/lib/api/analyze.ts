import type { AnalysisResult, AnalysisType } from '@/lib/mockData';

export async function analyzeUrl(url: string, analysisType: AnalysisType, device: "desktop" | "mobile" = "desktop"): Promise<AnalysisResult> {
  const response = await fetch('/api/analyze/analyze-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, analysisType, device }),
  });

  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'Analysis failed');
  }

  return data.data as AnalysisResult;
}
