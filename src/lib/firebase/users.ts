import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface UserProfile {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function ensureUserProfile(uid: string, profile: UserProfile): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, "users", uid), updates, { merge: true });
}
