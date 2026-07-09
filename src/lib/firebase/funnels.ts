import { collection, addDoc, doc, deleteDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface FunnelStep {
  label: string;
  url: string;
}

export interface Funnel {
  id: string;
  userId: string;
  name: string;
  steps: FunnelStep[];
  createdAt: string;
}

export interface FunnelRunStepGA4 {
  bounceRate: number;
  engagementRate: number;
  sessions: number;
}

export interface FunnelRunStep extends FunnelStep {
  score: number;
  analysisId: string | null;
  topIssues: string[];
  ga4?: FunnelRunStepGA4 | null;
}

export interface FunnelInsights {
  weakestStepIndex: number;
  summary: string;
  transitionIssues: string[];
  recommendations: string[];
}

export interface FunnelRunInput {
  userId: string;
  funnelId: string;
  steps: FunnelRunStep[];
  insights: FunnelInsights | null;
}

export interface FunnelRun extends FunnelRunInput {
  id: string;
  createdAt: string;
}

type TimestampLike = { toDate: () => Date } | string;

function toIso(value: TimestampLike): string {
  return typeof value === "string" ? value : value.toDate().toISOString();
}

export async function createFunnel(userId: string, name: string, steps: FunnelStep[]): Promise<string> {
  const docRef = await addDoc(collection(db, "funnels"), {
    userId,
    name,
    steps,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// Equality-only filter with a client-side sort, so Firestore needs no
// manually created composite index for this collection.
export async function getFunnels(userId: string): Promise<Funnel[]> {
  const snapshot = await getDocs(query(collection(db, "funnels"), where("userId", "==", userId)));
  const funnels = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as { userId: string; name: string; steps: FunnelStep[]; createdAt: TimestampLike };
    return { id: docSnap.id, userId: data.userId, name: data.name, steps: data.steps, createdAt: toIso(data.createdAt) };
  });
  return funnels.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteFunnel(funnelId: string): Promise<void> {
  await deleteDoc(doc(db, "funnels", funnelId));
}

export async function createFunnelRun(run: FunnelRunInput): Promise<string> {
  const docRef = await addDoc(collection(db, "funnelRuns"), { ...run, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function getFunnelRuns(userId: string, funnelId: string): Promise<FunnelRun[]> {
  const snapshot = await getDocs(
    query(collection(db, "funnelRuns"), where("userId", "==", userId), where("funnelId", "==", funnelId))
  );
  const runs = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<FunnelRunInput, never> & { createdAt: TimestampLike };
    return {
      id: docSnap.id,
      userId: data.userId,
      funnelId: data.funnelId,
      steps: data.steps,
      insights: data.insights,
      createdAt: toIso(data.createdAt),
    };
  });
  return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
