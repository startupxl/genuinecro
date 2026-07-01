import { collection, addDoc, query, where, getCountFromServer, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface AnalysisEntry {
  userId: string | null;
  url: string;
  analysisType: string;
  device: string;
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
