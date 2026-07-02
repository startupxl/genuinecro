import { collection, addDoc, query, where, orderBy, limit, getDocs, getCountFromServer, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface AnalysisEntry {
  userId: string | null;
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
}

export async function recordAnalysis(entry: AnalysisEntry): Promise<void> {
  await addDoc(collection(db, "analyses"), { ...entry, createdAt: serverTimestamp() });
}

export async function countAnalysesSince(userId: string, since: Date): Promise<number> {
  const q = query(
    collection(db, "analyses"),
    where("userId", "==", userId),
    where("createdAt", ">=", Timestamp.fromDate(since))
  );
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

export interface AnalysisRecord {
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
  createdAt: string;
}

export async function getRecentAnalyses(userId: string, take = 200): Promise<AnalysisRecord[]> {
  const q = query(
    collection(db, "analyses"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(take)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data() as {
      url: string;
      analysisType: string;
      device: string;
      conversionScore: number;
      createdAt: { toDate: () => Date } | string;
    };
    return {
      url: data.url,
      analysisType: data.analysisType,
      device: data.device,
      conversionScore: data.conversionScore,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString(),
    };
  });
}

export interface SiteSummary {
  domain: string;
  latestScore: number;
  previousScore: number | null;
  scoreDelta: number | null;
  lastAnalyzedAt: string;
  analysisCount: number;
}

export function groupAnalysesByDomain(analyses: AnalysisRecord[]): SiteSummary[] {
  const byDomain = new Map<string, AnalysisRecord[]>();

  for (const analysis of analyses) {
    if (analysis.analysisType === "technical") continue;
    let domain: string;
    try {
      domain = new URL(analysis.url).hostname.replace(/^www\./, "");
    } catch {
      domain = analysis.url;
    }
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(analysis);
  }

  const summaries: SiteSummary[] = [];
  for (const [domain, records] of byDomain) {
    const sorted = [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latest = sorted[0];
    const previous = sorted[1] ?? null;
    summaries.push({
      domain,
      latestScore: latest.conversionScore,
      previousScore: previous ? previous.conversionScore : null,
      scoreDelta: previous ? latest.conversionScore - previous.conversionScore : null,
      lastAnalyzedAt: latest.createdAt,
      analysisCount: sorted.length,
    });
  }

  return summaries.sort((a, b) => new Date(b.lastAnalyzedAt).getTime() - new Date(a.lastAnalyzedAt).getTime());
}
