import { collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface EvidenceBenchmark {
  industryAvg: number;
  topPerformers: number;
  label: string;
}

export interface EvidenceABTest {
  testName: string;
  hypothesis: string;
  control: string;
  variant: string;
  metric: string;
  duration: string;
}

export interface FrictionPointInput {
  category: string;
  severity: "high" | "med" | "low";
  title: string;
  description: string;
  fix: string;
  impactScore: number;
  selector?: string;
  roiEstimate?: string;
  insightCluster?: string;
  screenshotUrl?: string;
  sourceCitation?: string;
  benchmark?: EvidenceBenchmark;
  abTest?: EvidenceABTest;
}

export interface ActionItem extends FrictionPointInput {
  id: string;
  userId: string;
  url: string;
  analysisType: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
}

export async function createActionItems(
  userId: string,
  url: string,
  analysisType: string,
  frictionPoints: FrictionPointInput[]
): Promise<void> {
  await Promise.all(
    frictionPoints.map((fp) => {
      const data: Record<string, unknown> = {
        userId,
        url,
        analysisType,
        category: fp.category,
        severity: fp.severity,
        title: fp.title,
        description: fp.description,
        fix: fp.fix,
        impactScore: fp.impactScore,
        status: "open",
        createdAt: serverTimestamp(),
      };
      const evidence = {
        selector: fp.selector,
        roiEstimate: fp.roiEstimate,
        insightCluster: fp.insightCluster,
        screenshotUrl: fp.screenshotUrl,
        sourceCitation: fp.sourceCitation,
        benchmark: fp.benchmark,
        abTest: fp.abTest,
      };
      for (const [key, value] of Object.entries(evidence)) {
        if (value !== undefined) data[key] = value;
      }
      return addDoc(collection(db, "actionItems"), data);
    })
  );
}

export async function getActiveActionItems(userId: string): Promise<ActionItem[]> {
  const q = query(
    collection(db, "actionItems"),
    where("userId", "==", userId),
    where("status", "in", ["open", "in_progress"]),
    orderBy("impactScore", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapActionItemDoc);
}

function mapActionItemDoc(docSnap: { id: string; data: () => Record<string, unknown> }): ActionItem {
  const data = docSnap.data() as {
    userId: string;
    url: string;
    analysisType: string;
    category: string;
    severity: "high" | "med" | "low";
    title: string;
    description: string;
    fix: string;
    impactScore: number;
    status: "open" | "in_progress" | "resolved";
    createdAt: { toDate: () => Date } | string;
    resolvedAt?: { toDate: () => Date } | string;
    selector?: string;
    roiEstimate?: string;
    insightCluster?: string;
    screenshotUrl?: string;
    sourceCitation?: string;
    benchmark?: EvidenceBenchmark;
    abTest?: EvidenceABTest;
  };
  return {
    id: docSnap.id,
    userId: data.userId,
    url: data.url,
    analysisType: data.analysisType,
    category: data.category,
    severity: data.severity,
    title: data.title,
    description: data.description,
    fix: data.fix,
    impactScore: data.impactScore,
    status: data.status,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : data.createdAt.toDate().toISOString(),
    resolvedAt: !data.resolvedAt ? undefined : typeof data.resolvedAt === "string" ? data.resolvedAt : data.resolvedAt.toDate().toISOString(),
    selector: data.selector,
    roiEstimate: data.roiEstimate,
    insightCluster: data.insightCluster,
    screenshotUrl: data.screenshotUrl,
    sourceCitation: data.sourceCitation,
    benchmark: data.benchmark,
    abTest: data.abTest,
  };
}

export async function getAllActionItems(userId: string): Promise<ActionItem[]> {
  const q = query(
    collection(db, "actionItems"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapActionItemDoc);
}

export async function updateActionItemStatus(itemId: string, status: ActionItem["status"]): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === "resolved") updates.resolvedAt = serverTimestamp();
  await updateDoc(doc(db, "actionItems", itemId), updates);
}
