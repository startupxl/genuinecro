import { collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface FrictionPointInput {
  category: string;
  severity: "high" | "med" | "low";
  title: string;
  description: string;
  fix: string;
  impactScore: number;
}

export interface ActionItem extends FrictionPointInput {
  id: string;
  userId: string;
  url: string;
  analysisType: string;
  status: "open" | "resolved";
  createdAt: string;
}

export async function createActionItems(
  userId: string,
  url: string,
  analysisType: string,
  frictionPoints: FrictionPointInput[]
): Promise<void> {
  await Promise.all(
    frictionPoints.map((fp) =>
      addDoc(collection(db, "actionItems"), {
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
      })
    )
  );
}

export async function getOpenActionItems(userId: string): Promise<ActionItem[]> {
  const q = query(
    collection(db, "actionItems"),
    where("userId", "==", userId),
    where("status", "==", "open"),
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
    status: "open" | "resolved";
    createdAt: { toDate: () => Date } | string;
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

export async function resolveActionItem(itemId: string): Promise<void> {
  await updateDoc(doc(db, "actionItems", itemId), { status: "resolved" });
}
