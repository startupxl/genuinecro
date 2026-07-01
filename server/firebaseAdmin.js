import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

const adminApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);

export async function verifyIdToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }
  const token = authHeader.slice("Bearer ".length);
  return adminAuth.verifyIdToken(token);
}
