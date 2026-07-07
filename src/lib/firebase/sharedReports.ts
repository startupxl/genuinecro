import { collection, addDoc, doc, getDoc, deleteDoc, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import type { FrictionPoint } from "@/lib/mockData";

export interface SharedReportData {
  url: string;
  analysisType: string;
  device: "desktop" | "mobile";
  conversionScore: number;
  categoryScores?: Record<string, number>;
  frictionPoints: FrictionPoint[];
}

export interface SharedReport {
  id: string;
  userId: string;
  analysisId: string;
  reportData: SharedReportData;
  createdAt: string;
}

export async function createSharedReport(
  userId: string,
  analysisId: string,
  reportData: SharedReportData
): Promise<string> {
  const docRef = await addDoc(collection(db, "sharedReports"), {
    userId,
    analysisId,
    reportData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

interface SharedReportDocData {
  userId: string;
  analysisId: string;
  reportData: SharedReportData;
  createdAt: { toDate: () => Date } | string;
}

function mapSharedReportDoc(id: string, data: SharedReportDocData): SharedReport {
  return {
    id,
    userId: data.userId,
    analysisId: data.analysisId,
    reportData: data.reportData,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString(),
  };
}

export async function getSharedReport(shareId: string): Promise<SharedReport | null> {
  const snap = await getDoc(doc(db, "sharedReports", shareId));
  if (!snap.exists()) return null;
  return mapSharedReportDoc(snap.id, snap.data() as SharedReportDocData);
}

export async function getSharedReportsForUser(userId: string): Promise<SharedReport[]> {
  const q = query(
    collection(db, "sharedReports"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => mapSharedReportDoc(docSnap.id, docSnap.data() as SharedReportDocData));
}

export async function revokeSharedReport(shareId: string): Promise<void> {
  await deleteDoc(doc(db, "sharedReports", shareId));
}
