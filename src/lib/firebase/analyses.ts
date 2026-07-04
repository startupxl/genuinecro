import { collection, addDoc, query, where, orderBy, limit, getDocs, getCountFromServer, doc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface AnalysisEntry {
  userId: string | null;
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
  categoryScores?: Record<string, number>;
}

export async function recordAnalysis(entry: AnalysisEntry): Promise<string> {
  const docRef = await addDoc(collection(db, "analyses"), { ...entry, createdAt: serverTimestamp() });
  return docRef.id;
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
  id?: string;
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
  createdAt: string;
  categoryScores?: Record<string, number>;
}

interface AnalysisDocData {
  url: string;
  analysisType: string;
  device: string;
  conversionScore: number;
  createdAt: { toDate: () => Date } | string;
  categoryScores?: Record<string, number>;
}

function mapAnalysisDoc(id: string, data: AnalysisDocData): AnalysisRecord {
  return {
    id,
    url: data.url,
    analysisType: data.analysisType,
    device: data.device,
    conversionScore: data.conversionScore,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString(),
    categoryScores: data.categoryScores,
  };
}

export async function getRecentAnalyses(userId: string, take = 200): Promise<AnalysisRecord[]> {
  const q = query(
    collection(db, "analyses"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(take)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => mapAnalysisDoc(docSnap.id, docSnap.data() as AnalysisDocData));
}

export async function getAnalysisById(analysisId: string): Promise<AnalysisRecord | null> {
  const snap = await getDoc(doc(db, "analyses", analysisId));
  if (!snap.exists()) return null;
  return mapAnalysisDoc(snap.id, snap.data() as AnalysisDocData);
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
