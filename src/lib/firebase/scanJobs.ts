import { collection, addDoc, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

const STALE_JOB_MS = 5 * 60 * 1000;
const CREATE_TIMEOUT_MS = 4000;

export interface ScanJob {
  id: string;
  userId: string;
  url: string;
  analysisType: string;
  device: string;
  status: "scanning" | "complete";
  createdAt: string;
}

export async function createScanJob(
  userId: string,
  url: string,
  analysisType: string,
  device: string,
  timeoutMs = CREATE_TIMEOUT_MS
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    const docRef = await Promise.race([
      addDoc(collection(db, "scanJobs"), {
        userId,
        url,
        analysisType,
        device,
        status: "scanning",
        createdAt: serverTimestamp(),
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("createScanJob timed out")), timeoutMs);
      }),
    ]);
    return docRef.id;
  } catch (err) {
    console.error("Failed to create scan job (status tracking skipped for this scan):", err);
    return null;
  } finally {
    clearTimeout(timer!);
  }
}

export async function completeScanJob(jobId: string | null): Promise<void> {
  if (!jobId) return;
  try {
    await updateDoc(doc(db, "scanJobs", jobId), { status: "complete" });
  } catch (err) {
    console.error("Failed to complete scan job:", err);
  }
}

export async function getActiveScanJobs(userId: string): Promise<ScanJob[]> {
  const q = query(
    collection(db, "scanJobs"),
    where("userId", "==", userId),
    where("status", "==", "scanning")
  );

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err) {
    console.error("Failed to load active scan jobs (Dashboard scan-status will be skipped):", err);
    return [];
  }

  const cutoff = Date.now() - STALE_JOB_MS;

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as {
        userId: string;
        url: string;
        analysisType: string;
        device: string;
        status: "scanning" | "complete";
        createdAt: { toDate: () => Date } | string;
      };
      const createdAt = typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString();
      return {
        id: docSnap.id,
        userId: data.userId,
        url: data.url,
        analysisType: data.analysisType,
        device: data.device,
        status: data.status,
        createdAt,
      };
    })
    .filter((job) => new Date(job.createdAt).getTime() >= cutoff);
}
