import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

const adminApp = initializeApp({
  credential: cert(serviceAccount),
});

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

export async function verifyIdToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }
  const token = authHeader.slice("Bearer ".length);
  return adminAuth.verifyIdToken(token);
}
