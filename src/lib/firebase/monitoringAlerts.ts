import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface MonitoringAlertInput {
  userId: string;
  domain: string;
  previousScore: number;
  newScore: number;
  scoreDelta: number;
  newCriticalIssueTitles: string[];
}

export interface MonitoringAlert extends MonitoringAlertInput {
  id: string;
  createdAt: string;
}

export async function createMonitoringAlert(entry: MonitoringAlertInput): Promise<void> {
  await addDoc(collection(db, "monitoringAlerts"), { ...entry, createdAt: serverTimestamp() });
}

interface MonitoringAlertDocData extends MonitoringAlertInput {
  createdAt: { toDate: () => Date } | string;
}

export async function getMonitoringAlerts(userId: string): Promise<MonitoringAlert[]> {
  const q = query(
    collection(db, "monitoringAlerts"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as MonitoringAlertDocData;
    return {
      id: docSnap.id,
      userId: data.userId,
      domain: data.domain,
      previousScore: data.previousScore,
      newScore: data.newScore,
      scoreDelta: data.scoreDelta,
      newCriticalIssueTitles: data.newCriticalIssueTitles,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString(),
    };
  });
}
