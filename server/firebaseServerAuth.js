import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const serverApp = initializeApp(firebaseConfig, "server");
const serverAuth = getAuth(serverApp);
export const serverDb = getFirestore(serverApp);

let signInPromise = null;

export function ensureServerSignedIn() {
  if (!signInPromise) {
    signInPromise = signInWithEmailAndPassword(
      serverAuth,
      process.env.FIREBASE_SERVICE_EMAIL,
      process.env.FIREBASE_SERVICE_PASSWORD
    );
  }
  return signInPromise;
}

export async function verifyIdToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }
  const idToken = authHeader.slice("Bearer ".length);

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    throw new Error("Invalid or expired token");
  }

  const data = await res.json();
  const user = data.users?.[0];
  if (!user) {
    throw new Error("Invalid or expired token");
  }

  return { uid: user.localId };
}
