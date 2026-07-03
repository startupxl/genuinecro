import { collection, getDocs } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface LiveBenchmarkStats {
  accountAvg: number;
  topQuartile: number;
  sampleCount: number;
}

export async function getLiveBenchmarks(): Promise<Record<string, LiveBenchmarkStats>> {
  const snapshot = await getDocs(collection(db, "benchmarks"));

  const result: Record<string, LiveBenchmarkStats> = {};
  for (const doc of snapshot.docs) {
    const samples = (doc.data() as { samples?: number[] }).samples ?? [];
    if (samples.length === 0) continue;

    const sorted = [...samples].sort((a, b) => a - b);
    const accountAvg = Math.round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length);
    const topQuartileIndex = Math.round((sorted.length - 1) * 0.75);

    result[doc.id] = { accountAvg, topQuartile: sorted[topQuartileIndex], sampleCount: sorted.length };
  }

  return result;
}
