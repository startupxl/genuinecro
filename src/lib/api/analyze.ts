import { supabase } from '@/integrations/supabase/client';
import type { AnalysisResult, AnalysisType } from '@/lib/mockData';

export async function analyzeUrl(url: string, analysisType: AnalysisType, device: "desktop" | "mobile" = "desktop"): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke('analyze-url', {
    body: { url, analysisType, device },
  });

  if (error) {
    throw new Error(error.message || 'Analysis failed');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Analysis returned no results');
  }

  return data.data as AnalysisResult;
}
