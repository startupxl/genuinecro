import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export type SiteType = "ecommerce" | "saas" | "lead-gen" | "content" | "marketplace" | "other";

export interface SiteSettings {
  monthlyTraffic?: number;
  averageOrderValue?: number;
  baselineConversionRate?: number;
  siteType?: SiteType;
  monitoringEnabled?: boolean;
}

function docId(userId: string, domain: string): string {
  return `${userId}_${domain}`;
}

export async function getSiteSettings(userId: string, domain: string): Promise<SiteSettings | null> {
  const snap = await getDoc(doc(db, "siteSettings", docId(userId, domain)));
  if (!snap.exists()) return null;
  const data = snap.data() as SiteSettings;
  return {
    monthlyTraffic: data.monthlyTraffic,
    averageOrderValue: data.averageOrderValue,
    baselineConversionRate: data.baselineConversionRate,
    siteType: data.siteType,
    monitoringEnabled: data.monitoringEnabled,
  };
}

export async function saveSiteSettings(userId: string, domain: string, settings: SiteSettings): Promise<void> {
  await setDoc(
    doc(db, "siteSettings", docId(userId, domain)),
    { userId, domain, ...settings, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
