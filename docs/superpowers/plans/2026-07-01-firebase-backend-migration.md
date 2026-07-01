# Firebase Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase Auth, Postgres, and Storage with Firebase Auth, Firestore, and Firebase Storage, and port the two Supabase Edge Functions that verify a Supabase Auth JWT (`paypal-create-subscription`, `paypal-subscription-status`) — plus the PayPal webhook — into Express routes, so every currently-working feature (login, profile, avatar, usage limits, subscription status/purchase) keeps working end-to-end under the new stack.

**Architecture:** Firebase Auth (client SDK) replaces Supabase Auth for login/signup/Google/password-reset. Firestore replaces Postgres for `users` (profiles) and `analyses` (usage tracking); a `subscriptions` collection is written only server-side via the Firebase Admin SDK (client has zero direct access — mirrors today's Edge-Function-mediated pattern). Firebase Storage replaces the Supabase `avatars` bucket. New Express routes under `/api/paypal/*` (added to the `server.js` built in the Hosting Foundation plan) replace the three PayPal Edge Functions, verifying the caller via a Firebase ID token instead of a Supabase JWT. `analyze-url` and `ai-analyze` Edge Functions are **out of scope** — they don't check identity today (`verify_jwt = false`), so the Supabase JS client stays temporarily, used only to invoke those two functions, until a later plan ports them to Express too.

**Tech Stack:** `firebase` (client SDK v9+ modular), `firebase-admin` (server), Express (from the Hosting Foundation plan), `supertest` (Express route testing), Vitest + `@testing-library/react` (existing test stack).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §4 (Backend Migration) and §5 (Data Model).
- No secrets committed. Firebase Admin credentials arrive via `FIREBASE_SERVICE_ACCOUNT_JSON` env var (a single-line JSON string), never a committed file.
- Client-exposed env vars must be prefixed `VITE_` (Vite requirement).
- The `subscriptions` Firestore collection is never read/written directly by the client — only via Express + Admin SDK, matching today's Edge-Function-mediated access pattern.
- `src/integrations/supabase/client.ts` and its env vars are **not removed** in this plan — `analyze-url`/`ai-analyze` still depend on it. Do not delete it.
- All new logic gets a Vitest unit test mocking the relevant SDK boundary (`firebase/auth`, `firebase/firestore`, `firebase/storage`, `firebase-admin`) — no live Firebase project or emulator is available in this environment (no Java runtime for the Auth/Firestore emulators), so tests must not depend on network access.

---

### Task 1: Firebase client SDK setup

**Files:**
- Create: `src/integrations/firebase/client.ts`
- Create: `src/integrations/firebase/client.test.ts`
- Modify: `.env.example`
- Modify: `package.json` (add `firebase` dependency)

**Interfaces:**
- Consumes: nothing
- Produces: `app`, `auth`, `db`, `storage` exports from `src/integrations/firebase/client.ts`, used by every subsequent client-side task

- [ ] **Step 1: Install the Firebase client SDK**

```bash
npm install firebase
```

- [ ] **Step 2: Write the failing test**

Create `src/integrations/firebase/client.test.ts`:

```ts
import { describe, it, expect } from "vitest";

vi.stubEnv("VITE_FIREBASE_API_KEY", "test-api-key");
vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test-project.appspot.com");
vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123456789");
vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123456789:web:abcdef");

describe("firebase client", () => {
  it("exports initialized auth, db, and storage instances", async () => {
    const { auth, db, storage } = await import("./client");
    expect(auth).toBeDefined();
    expect(db).toBeDefined();
    expect(storage).toBeDefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/integrations/firebase/client.test.ts`
Expected: FAIL — `Cannot find module './client'` (the file doesn't exist yet).

- [ ] **Step 4: Write the implementation**

Create `src/integrations/firebase/client.ts`:

```ts
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/integrations/firebase/client.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Add the new env vars to `.env.example`**

Append to `.env.example`:

```
# Firebase (client)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_FIREBASE_EMULATORS=false
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/integrations/firebase .env.example
git commit -m "Add Firebase client SDK initialization"
```

---

### Task 2: Firestore and Storage security rules

**Files:**
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `storage.rules`
- Create: `firebase.json`

**Interfaces:**
- Consumes: nothing
- Produces: the access-control contract every later Firestore/Storage task must satisfy (`users/{uid}` owner-only, `analyses` owner-or-anon-create, `subscriptions` server-only, `avatars/{uid}/*` public-read/owner-write)

- [ ] **Step 1: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /analyses/{analysisId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if (request.auth != null && request.auth.uid == request.resource.data.userId)
                    || (request.auth == null && request.resource.data.userId == null);
      allow update, delete: if false;
    }
    match /subscriptions/{userId} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Write `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "analyses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Write `storage.rules`**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{uid}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 4: Write `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- [ ] **Step 5: Verify (manual — cannot be run from this environment)**

This environment has no Firebase CLI login and no live Firebase project, so deployment can't be verified here. Once the manual Firebase project setup in Task 13 is done, run:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

Expected: `✔  Deploy complete!`

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.indexes.json storage.rules firebase.json
git commit -m "Add Firestore and Storage security rules"
```

---

### Task 3: Firestore user-profile data module

**Files:**
- Create: `src/lib/firebase/users.ts`
- Test: `src/lib/firebase/users.test.ts`

**Interfaces:**
- Consumes: `db` from `src/integrations/firebase/client.ts` (Task 1)
- Produces: `ensureUserProfile(uid, profile): Promise<void>`, `getUserProfile(uid): Promise<UserProfile | null>`, `updateUserProfile(uid, updates): Promise<void>`, and the `UserProfile` interface (`{ email: string | null; displayName: string | null; avatarUrl: string | null }`) — used by Task 4 (useAuth) and Task 9 (Account.tsx)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/firebase/users.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const docMock = vi.fn((..._args: unknown[]) => ({ __ref: true }));
const getDocMock = vi.fn();
const setDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  serverTimestamp: () => "server-timestamp",
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { ensureUserProfile, getUserProfile, updateUserProfile } from "./users";

describe("firebase users module", () => {
  beforeEach(() => {
    docMock.mockClear();
    getDocMock.mockReset();
    setDocMock.mockReset();
  });

  it("creates a profile doc when one doesn't exist yet", async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    await ensureUserProfile("uid-1", { email: "a@b.com", displayName: "A", avatarUrl: null });
    expect(setDocMock).toHaveBeenCalledWith(
      { __ref: true },
      expect.objectContaining({ email: "a@b.com", displayName: "A", avatarUrl: null, createdAt: "server-timestamp" })
    );
  });

  it("does not overwrite an existing profile doc", async () => {
    getDocMock.mockResolvedValue({ exists: () => true });
    await ensureUserProfile("uid-1", { email: "a@b.com", displayName: "A", avatarUrl: null });
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it("reads back an existing profile", async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: "a@b.com", displayName: "A", avatarUrl: null }),
    });
    const profile = await getUserProfile("uid-1");
    expect(profile).toEqual({ email: "a@b.com", displayName: "A", avatarUrl: null });
  });

  it("merges partial updates without overwriting other fields", async () => {
    await updateUserProfile("uid-1", { displayName: "New Name" });
    expect(setDocMock).toHaveBeenCalledWith({ __ref: true }, { displayName: "New Name" }, { merge: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/firebase/users.test.ts`
Expected: FAIL — `Cannot find module './users'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/firebase/users.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/firebase/users.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase/users.ts src/lib/firebase/users.test.ts
git commit -m "Add Firestore user-profile data module"
```

---

### Task 4: Migrate `useAuth` to Firebase Auth

**Files:**
- Modify: `src/hooks/useAuth.tsx`
- Test: `src/hooks/useAuth.test.tsx`

**Interfaces:**
- Consumes: `auth` from `src/integrations/firebase/client.ts` (Task 1), `ensureUserProfile` from `src/lib/firebase/users.ts` (Task 3)
- Produces: `AuthContextType = { user: import("firebase/auth").User | null; loading: boolean; signOut: () => Promise<void> }`, `useAuth()`, `AuthProvider` — the `session` field from the old context is dropped (confirmed unused by any consumer)

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAuth.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockUnsubscribe = vi.fn();
let authStateCallback: ((user: unknown) => void) | null = null;
const ensureUserProfileMock = vi.fn().mockResolvedValue(undefined);

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: unknown) => void) => {
    authStateCallback = callback;
    return mockUnsubscribe;
  }),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/integrations/firebase/client", () => ({ auth: {} }));

vi.mock("@/lib/firebase/users", () => ({
  ensureUserProfile: (...args: unknown[]) => ensureUserProfileMock(...args),
}));

import { AuthProvider, useAuth } from "./useAuth";

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `signed in as ${(user as { email: string }).email}` : "signed out"}</div>;
}

describe("useAuth", () => {
  beforeEach(() => {
    authStateCallback = null;
    mockUnsubscribe.mockClear();
    ensureUserProfileMock.mockClear();
  });

  it("starts loading, then reflects the signed-in user and ensures a profile doc exists", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByText("loading")).toBeInTheDocument();

    authStateCallback!({ uid: "uid-1", email: "person@example.com", displayName: "Person", photoURL: null });

    await waitFor(() => {
      expect(screen.getByText("signed in as person@example.com")).toBeInTheDocument();
    });
    expect(ensureUserProfileMock).toHaveBeenCalledWith("uid-1", {
      email: "person@example.com",
      displayName: "Person",
      avatarUrl: null,
    });
  });

  it("reflects signed-out state and skips profile creation when there is no user", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    authStateCallback!(null);
    await waitFor(() => {
      expect(screen.getByText("signed out")).toBeInTheDocument();
    });
    expect(ensureUserProfileMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useAuth.test.tsx`
Expected: FAIL (current implementation still uses Supabase; `onAuthStateChanged`/`ensureUserProfile` mocks are never invoked, and the current `session` field means the test's assumptions about the context shape don't hold once you compare against the current file — behaviorally, `authStateCallback` is never populated because `useAuth.tsx` currently calls `supabase.auth.onAuthStateChanged`, not the mocked `firebase/auth` one, so calling `authStateCallback!(...)` throws `authStateCallback is null`).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/hooks/useAuth.tsx`:

```tsx
import { useState, useEffect, createContext, useContext } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { ensureUserProfile } from "@/lib/firebase/users";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        ensureUserProfile(firebaseUser.uid, {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          avatarUrl: firebaseUser.photoURL,
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useAuth.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.tsx src/hooks/useAuth.test.tsx
git commit -m "Migrate useAuth to Firebase Auth"
```

---

### Task 5: Migrate `AuthPage` to Firebase Auth (email/password, Google, forgot password)

**Files:**
- Modify: `src/components/AuthPage.tsx`

**Interfaces:**
- Consumes: `auth` from `src/integrations/firebase/client.ts`
- Produces: no new exports — this is a leaf UI component

- [ ] **Step 1: Replace the entire contents of `src/components/AuthPage.tsx`**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowLeft } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { toast } from "sonner";

interface AuthPageProps {
  onBack: () => void;
  message?: string;
}

const googleProvider = new GoogleAuthProvider();

const AuthPage = ({ onBack, message }: AuthPageProps) => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    }
    setLoading(false);
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await sendEmailVerification(credential.user);
      toast.success("Account created! Check your email to verify your address.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      toast.success("Password reset link sent to your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-svh items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>

        <h1 className="text-xl font-semibold text-foreground mb-1">
          GenuineCRO
        </h1>

        {message && (
          <p className="text-sm text-primary mb-4">{message}</p>
        )}

        {mode === "forgot" ? (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your email to reset your password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "login" ? "Sign in to your account." : "Create your account."}
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-10 rounded-md border border-border bg-surface text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
              </div>
            </div>

            <form onSubmit={mode === "login" ? handleEmailLogin : handleEmailSignup} className="space-y-3">
              {mode === "signup" && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  minLength={6}
                />
              </div>

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:text-primary/80 transition-colors">
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:text-primary/80 transition-colors">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default AuthPage;
```

Note the intentional behavior change: Firebase signs the user in immediately on signup (unlike Supabase's typical "confirm before login" flow) while still sending a verification email via `sendEmailVerification`. This is a small, deliberate UX simplification, not a regression.

- [ ] **Step 2: Manual verification (no live Firebase project in this environment)**

Once Task 13's manual Firebase project setup is complete, verify by running `npm run dev`, opening the app, and: (a) signing up with email/password — expect a new user in Firebase Console → Authentication and a `users/{uid}` doc in Firestore, (b) signing in with Google, (c) using "Forgot password" — expect a reset email.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthPage.tsx
git commit -m "Migrate AuthPage to Firebase Auth (email/password, Google, forgot password)"
```

---

### Task 6: Migrate `ResetPassword` to confirm via Firebase's `oobCode`

**Files:**
- Modify: `src/pages/ResetPassword.tsx`
- Test: `src/pages/ResetPassword.test.tsx`

**Interfaces:**
- Consumes: `auth` from `src/integrations/firebase/client.ts`
- Produces: no new exports

- [ ] **Step 1: Write the failing tests**

Create `src/pages/ResetPassword.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const confirmPasswordResetMock = vi.fn();

vi.mock("firebase/auth", () => ({
  confirmPasswordReset: (...args: unknown[]) => confirmPasswordResetMock(...args),
}));

vi.mock("@/integrations/firebase/client", () => ({ auth: {} }));

import ResetPassword from "./ResetPassword";

function renderWithCode(code: string | null) {
  const path = code ? `/reset-password?oobCode=${code}` : "/reset-password";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ResetPassword", () => {
  beforeEach(() => {
    confirmPasswordResetMock.mockReset();
  });

  it("confirms the password reset using the oobCode from the URL", async () => {
    confirmPasswordResetMock.mockResolvedValue(undefined);
    renderWithCode("test-code-123");

    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() => {
      expect(confirmPasswordResetMock).toHaveBeenCalledWith({}, "test-code-123", "newpassword123");
    });
  });

  it("shows an error and does not call confirmPasswordReset when oobCode is missing", async () => {
    renderWithCode(null);

    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "newpassword123" },
    });
    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() => {
      expect(confirmPasswordResetMock).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/ResetPassword.test.tsx`
Expected: FAIL (current implementation calls `supabase.auth.updateUser`, never reads `oobCode`, so `confirmPasswordResetMock` is never called and the first test's assertion fails).

- [ ] **Step 3: Replace the entire contents of `src/pages/ResetPassword.tsx`**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      toast.error("This reset link is invalid or has expired.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      toast.success("Password updated successfully!");
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-svh items-center justify-center bg-background px-4"
    >
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-foreground mb-1">GenuineCRO</h1>
        <p className="text-sm text-muted-foreground mb-6">Set your new password.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full h-10 pl-10 pr-3 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default ResetPassword;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/ResetPassword.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/ResetPassword.tsx src/pages/ResetPassword.test.tsx
git commit -m "Migrate ResetPassword to Firebase's confirmPasswordReset"
```

---

### Task 7: Fix Firebase-User-shape references in `AppHeader` and `ContactUs`

**Files:**
- Modify: `src/components/AppHeader.tsx`
- Modify: `src/pages/ContactUs.tsx`

**Interfaces:**
- Consumes: `user` from `useAuth()` (now a Firebase `User`, which has `.email` and `.displayName`, not `.user_metadata`)
- Produces: nothing new

- [ ] **Step 1: Update `AppHeader.tsx`'s display-name derivation**

In `src/components/AppHeader.tsx`, replace:

```tsx
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "User";
```

with:

```tsx
  const displayName =
    user?.displayName ||
    user?.email ||
    "User";
```

- [ ] **Step 2: Update `ContactUs.tsx`'s name default**

In `src/pages/ContactUs.tsx`, replace:

```tsx
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
```

with:

```tsx
  const [name, setName] = useState(user?.displayName || "");
```

- [ ] **Step 3: Verify the app still type-checks**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors referencing `user_metadata` in `AppHeader.tsx` or `ContactUs.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppHeader.tsx src/pages/ContactUs.tsx
git commit -m "Fix user display-name references for the Firebase User shape"
```

---

### Task 8: Firestore analyses module and `useUsageTracking` migration

**Files:**
- Create: `src/lib/firebase/analyses.ts`
- Test: `src/lib/firebase/analyses.test.ts`
- Modify: `src/hooks/useUsageTracking.ts`
- Test: `src/hooks/useUsageTracking.test.ts`

**Interfaces:**
- Consumes: `db` from `src/integrations/firebase/client.ts`, `user` (Firebase `User`, has `.uid`) from `useAuth()`, `currentPlan`/`subscription` from `useSubscription()` (shape unchanged: `subscription.current_period_start` / `current_period_end` remain snake_case strings — Task 12 preserves this)
- Produces: `recordAnalysis(entry): Promise<void>`, `countAnalysesSince(userId, since): Promise<number>` from `analyses.ts`; `useUsageTracking()` returns the same `{ usage, trackAnalysis, refreshUsage }` shape as before

- [ ] **Step 1: Write the failing tests for the analyses module**

Create `src/lib/firebase/analyses.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const collectionMock = vi.fn(() => ({ __collection: true }));
const addDocMock = vi.fn();
const queryMock = vi.fn((...args: unknown[]) => ({ __query: args }));
const whereMock = vi.fn((...args: unknown[]) => ({ __where: args }));
const getCountFromServerMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  getCountFromServer: (...args: unknown[]) => getCountFromServerMock(...args),
  serverTimestamp: () => "server-timestamp",
  Timestamp: { fromDate: (d: Date) => ({ __timestamp: d.toISOString() }) },
}));

vi.mock("@/integrations/firebase/client", () => ({ db: {} }));

import { recordAnalysis, countAnalysesSince } from "./analyses";

describe("firebase analyses module", () => {
  beforeEach(() => {
    addDocMock.mockReset();
    getCountFromServerMock.mockReset();
  });

  it("records an analysis with a server timestamp", async () => {
    addDocMock.mockResolvedValue(undefined);
    await recordAnalysis({ userId: "uid-1", url: "https://example.com", analysisType: "homepage", device: "desktop" });
    expect(addDocMock).toHaveBeenCalledWith(
      { __collection: true },
      expect.objectContaining({
        userId: "uid-1",
        url: "https://example.com",
        analysisType: "homepage",
        device: "desktop",
        createdAt: "server-timestamp",
      })
    );
  });

  it("counts analyses for a user since a given date", async () => {
    getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 7 }) });
    const count = await countAnalysesSince("uid-1", new Date("2026-06-01T00:00:00.000Z"));
    expect(count).toBe(7);
    expect(whereMock).toHaveBeenCalledWith("userId", "==", "uid-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: FAIL — `Cannot find module './analyses'`

- [ ] **Step 3: Write `src/lib/firebase/analyses.ts`**

```ts
import { collection, addDoc, query, where, getCountFromServer, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export interface AnalysisEntry {
  userId: string | null;
  url: string;
  analysisType: string;
  device: string;
}

export async function recordAnalysis(entry: AnalysisEntry): Promise<void> {
  await addDoc(collection(db, "analyses"), { ...entry, createdAt: serverTimestamp() });
}

export async function countAnalysesSince(userId: string, since: Date): Promise<number> {
  const q = query(
    collection(db, "analyses"),
    where("userId", "==", userId),
    where("createdAt", ">=", Timestamp.fromDate(since))
  );
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/firebase/analyses.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `useUsageTracking`**

Create `src/hooks/useUsageTracking.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const countAnalysesSinceMock = vi.fn();
const recordAnalysisMock = vi.fn();

vi.mock("@/lib/firebase/analyses", () => ({
  countAnalysesSince: (...args: unknown[]) => countAnalysesSinceMock(...args),
  recordAnalysis: (...args: unknown[]) => recordAnalysisMock(...args),
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1" } }),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: () => ({ currentPlan: "Growth", subscription: null }),
}));

import { useUsageTracking } from "./useUsageTracking";

describe("useUsageTracking", () => {
  beforeEach(() => {
    countAnalysesSinceMock.mockReset();
    recordAnalysisMock.mockReset();
    localStorage.clear();
  });

  it("reports usage against the signed-in user's plan limit", async () => {
    countAnalysesSinceMock.mockResolvedValue(12);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => {
      expect(result.current.usage.used).toBe(12);
    });
    expect(result.current.usage.limit).toBe(75);
    expect(result.current.usage.requiresPaid).toBe(false);
  });

  it("records an analysis for a signed-in user via Firestore", async () => {
    countAnalysesSinceMock.mockResolvedValue(0);
    recordAnalysisMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUsageTracking());

    await waitFor(() => expect(result.current.usage).toBeDefined());
    await result.current.trackAnalysis("https://example.com", "homepage", "desktop");

    expect(recordAnalysisMock).toHaveBeenCalledWith({
      userId: "uid-1",
      url: "https://example.com",
      analysisType: "homepage",
      device: "desktop",
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/hooks/useUsageTracking.test.ts`
Expected: FAIL (current implementation calls `supabase.from("analyses")`, never `countAnalysesSince`/`recordAnalysis`)

- [ ] **Step 7: Replace the entire contents of `src/hooks/useUsageTracking.ts`**

```ts
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import { recordAnalysis, countAnalysesSince } from "@/lib/firebase/analyses";

const ANON_STORAGE_KEY = "genuinecro_anon_usage";
const ANON_RESET_KEY = "genuinecro_anon_reset";
const FREE_LIMIT_ANON = 3;

const PLAN_LIMITS: Record<string, number> = {
  free: 10,
  starter: 20,
  growth: 75,
  pro: 250,
  agency: 800,
};

interface UsageInfo {
  used: number;
  limit: number;
  canAnalyze: boolean;
  requiresAuth: boolean;
  requiresPaid: boolean;
  periodStart: string | null;
  periodEnd: string | null;
}

function getRolling30DayStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

export function useUsageTracking() {
  const { user } = useAuth();
  const { currentPlan, subscription } = useSubscription();
  const [usage, setUsage] = useState<UsageInfo>({
    used: 0,
    limit: FREE_LIMIT_ANON,
    canAnalyze: true,
    requiresAuth: false,
    requiresPaid: false,
    periodStart: null,
    periodEnd: null,
  });

  const getAnonUsage = useCallback((): number => {
    try {
      const resetAt = localStorage.getItem(ANON_RESET_KEY);
      if (resetAt && new Date(resetAt) <= new Date()) {
        localStorage.setItem(ANON_STORAGE_KEY, "0");
        const next = new Date();
        next.setDate(next.getDate() + 30);
        localStorage.setItem(ANON_RESET_KEY, next.toISOString());
        return 0;
      }
      if (!resetAt) {
        const next = new Date();
        next.setDate(next.getDate() + 30);
        localStorage.setItem(ANON_RESET_KEY, next.toISOString());
      }
      return parseInt(localStorage.getItem(ANON_STORAGE_KEY) || "0", 10);
    } catch {
      return 0;
    }
  }, []);

  const incrementAnonUsage = useCallback(() => {
    const current = getAnonUsage();
    localStorage.setItem(ANON_STORAGE_KEY, String(current + 1));
  }, [getAnonUsage]);

  const fetchUsage = useCallback(async () => {
    if (user) {
      const planKey = currentPlan.toLowerCase();
      const limit = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.free;

      let periodStartDate: Date;
      let periodEnd: string | null = null;

      if (subscription?.current_period_start) {
        periodStartDate = new Date(subscription.current_period_start);
        periodEnd = subscription.current_period_end ?? null;
      } else {
        periodStartDate = getRolling30DayStart();
      }

      const used = await countAnalysesSince(user.uid, periodStartDate);
      setUsage({
        used,
        limit,
        canAnalyze: used < limit,
        requiresAuth: false,
        requiresPaid: used >= limit,
        periodStart: periodStartDate.toISOString(),
        periodEnd,
      });
    } else {
      const used = getAnonUsage();
      const limit = FREE_LIMIT_ANON;
      setUsage({
        used,
        limit,
        canAnalyze: used < limit,
        requiresAuth: used >= limit,
        requiresPaid: false,
        periodStart: null,
        periodEnd: null,
      });
    }
  }, [user, getAnonUsage, currentPlan, subscription]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const trackAnalysis = useCallback(async (url: string, analysisType: string, device: string) => {
    if (user) {
      await recordAnalysis({ userId: user.uid, url, analysisType, device });
    } else {
      incrementAnonUsage();
    }
    await fetchUsage();
  }, [user, incrementAnonUsage, fetchUsage]);

  return { usage, trackAnalysis, refreshUsage: fetchUsage };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/hooks/useUsageTracking.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/firebase/analyses.ts src/lib/firebase/analyses.test.ts \
  src/hooks/useUsageTracking.ts src/hooks/useUsageTracking.test.ts
git commit -m "Migrate usage tracking to Firestore"
```

---

### Task 9: Migrate `Account.tsx` to Firestore profile + Firebase Storage avatar

**Files:**
- Modify: `src/pages/Account.tsx`
- Test: `src/pages/Account.test.tsx`

**Interfaces:**
- Consumes: `getUserProfile`/`updateUserProfile` from `src/lib/firebase/users.ts` (Task 3), `storage` from `src/integrations/firebase/client.ts` (Task 1), `updateEmail` from `firebase/auth`
- Produces: no new exports

- [ ] **Step 1: Write the failing test**

Create `src/pages/Account.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getUserProfileMock = vi.fn();

vi.mock("@/lib/firebase/users", () => ({
  getUserProfile: (...args: unknown[]) => getUserProfileMock(...args),
  updateUserProfile: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "uid-1", email: "person@example.com" } }),
}));

vi.mock("@/hooks/useUsageTracking", () => ({
  useUsageTracking: () => ({ usage: { used: 2, limit: 10, canAnalyze: true, requiresAuth: false, requiresPaid: false, periodStart: null, periodEnd: null } }),
}));

import Account from "./Account";

describe("Account page", () => {
  beforeEach(() => {
    getUserProfileMock.mockReset();
  });

  it("loads the Firestore profile into the form fields", async () => {
    getUserProfileMock.mockResolvedValue({ displayName: "Person Name", email: "person@example.com", avatarUrl: null });

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Person Name")).toBeInTheDocument();
    });
    expect(getUserProfileMock).toHaveBeenCalledWith("uid-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Account.test.tsx`
Expected: FAIL (current implementation calls `supabase.from("profiles")`, never `getUserProfile`)

- [ ] **Step 3: Replace the entire contents of `src/pages/Account.tsx`**

```tsx
import { useState, useEffect } from "react";
import { Camera, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { updateEmail } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/integrations/firebase/client";
import { getUserProfile, updateUserProfile } from "@/lib/firebase/users";
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Account = () => {
  const { user } = useAuth();
  const { usage } = useUsageTracking();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    getUserProfile(user.uid).then((profile) => {
      if (profile) {
        setDisplayName(profile.displayName || "");
        setAvatarUrl(profile.avatarUrl || "");
      }
    });
  }, [user]);

  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email
      ? email.slice(0, 2).toUpperCase()
      : "U";

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { displayName, avatarUrl });

      if (email !== user.email) {
        await updateEmail(user, email);
        toast.success("Email updated. You may need to sign in again.");
      } else {
        toast.success("Profile updated");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const storageRef = ref(storage, `avatars/${user.uid}/avatar.${ext}`);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setAvatarUrl(url);
      await updateUserProfile(user.uid, { avatarUrl: url });

      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const currentPlan = "Free";
  const usagePercent = usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;

  if (!user) {
    return (
      <div className="flex flex-col min-h-svh bg-background">
        <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Please sign in to view your account.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader onGoHome={() => navigate("/")} onSignIn={() => navigate("/")} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Account Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
            <CardDescription>Manage your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="text-lg bg-primary/10 text-primary font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-white" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="sr-only"
                    disabled={uploading}
                  />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{displayName || "Your Name"}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Changing your email may require you to sign in again.
              </p>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscription</CardTitle>
            <CardDescription>Your current plan and usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm px-3 py-1">
                {currentPlan} Plan
              </Badge>
              {usage.canAnalyze ? (
                <span className="text-xs text-muted-foreground">
                  {usage.limit - usage.used} analyses remaining
                </span>
              ) : (
                <span className="text-xs text-destructive">Limit reached</span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Analyses used</span>
                <span className="font-medium text-foreground">
                  {usage.used} / {usage.limit}
                </span>
              </div>
              <Progress value={usagePercent} className="h-2" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Need more analyses?</p>
                <p className="text-xs text-muted-foreground">
                  View plans and upgrade for unlimited access.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/subscription")}>
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Account;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Account.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Account.tsx src/pages/Account.test.tsx
git commit -m "Migrate Account page to Firestore profile and Firebase Storage avatar"
```

---

### Task 10: Firebase Admin SDK setup on the server

**Files:**
- Create: `server/firebaseAdmin.js`
- Test: `server/firebaseAdmin.test.js`
- Modify: `vitest.config.ts` (include `server/**/*.test.js`)
- Modify: `package.json` (add `firebase-admin` dependency)

**Interfaces:**
- Consumes: `FIREBASE_SERVICE_ACCOUNT_JSON` env var
- Produces: `adminAuth`, `adminDb`, `verifyIdToken(authHeader): Promise<{ uid: string }>` — used by Task 11's PayPal routes

- [ ] **Step 1: Install `firebase-admin` and `supertest`**

```bash
npm install firebase-admin
npm install --save-dev supertest
```

- [ ] **Step 2: Extend the Vitest include pattern to cover `server/`**

In `vitest.config.ts`, change:

```ts
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
```

to:

```ts
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.js"],
```

- [ ] **Step 3: Write the failing test**

Create `server/firebaseAdmin.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdTokenMock = vi.fn();

vi.mock("firebase-admin", () => ({
  default: {
    initializeApp: vi.fn(() => ({})),
    credential: { cert: vi.fn((sa) => sa) },
    auth: vi.fn(() => ({ verifyIdToken: verifyIdTokenMock })),
    firestore: vi.fn(() => ({})),
  },
}));

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "test-project" });

describe("firebaseAdmin", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
  });

  it("verifies a bearer token from the Authorization header", async () => {
    const { verifyIdToken } = await import("./firebaseAdmin.js");
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });

    const decoded = await verifyIdToken("Bearer abc123");

    expect(verifyIdTokenMock).toHaveBeenCalledWith("abc123");
    expect(decoded).toEqual({ uid: "uid-1" });
  });

  it("rejects when the Authorization header is missing or malformed", async () => {
    const { verifyIdToken } = await import("./firebaseAdmin.js");
    await expect(verifyIdToken(undefined)).rejects.toThrow("Missing Authorization header");
    await expect(verifyIdToken("Basic abc123")).rejects.toThrow("Missing Authorization header");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run server/firebaseAdmin.test.js`
Expected: FAIL — `Cannot find module './firebaseAdmin.js'`

- [ ] **Step 5: Write `server/firebaseAdmin.js`**

```js
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run server/firebaseAdmin.test.js`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts server/firebaseAdmin.js server/firebaseAdmin.test.js
git commit -m "Add Firebase Admin SDK server setup"
```

---

### Task 11: Port PayPal Edge Functions to Express routes

**Files:**
- Create: `server/routes/paypal.js`
- Test: `server/routes/paypal.test.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `adminDb`, `verifyIdToken` from `server/firebaseAdmin.js` (Task 10); `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` env vars
- Produces: an Express `Router` mounted at `/api/paypal` with `POST /create-subscription`, `GET /subscription-status`, `POST /webhook` — consumed by Task 12's `useSubscription.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/routes/paypal.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const verifyIdTokenMock = vi.fn();
const docSetMock = vi.fn();
const docGetMock = vi.fn();
const whereGetMock = vi.fn();
const updateMock = vi.fn();

vi.mock("../firebaseAdmin.js", () => ({
  verifyIdToken: (...args) => verifyIdTokenMock(...args),
  adminDb: {
    collection: () => ({
      doc: () => ({
        set: docSetMock,
        get: docGetMock,
      }),
      where: () => ({
        limit: () => ({
          get: whereGetMock,
        }),
      }),
    }),
  },
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

const { default: paypalRouter } = await import("./paypal.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/paypal", paypalRouter);
  return app;
}

describe("PayPal Express routes", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    docSetMock.mockReset();
    docGetMock.mockReset();
    whereGetMock.mockReset();
    fetchMock.mockReset();
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-secret";
  });

  it("returns 401 when the Authorization header is missing", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("Missing Authorization header"));
    const res = await request(buildApp()).get("/api/paypal/subscription-status");
    expect(res.status).toBe(401);
  });

  it("returns free plan when no subscription document exists", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    docGetMock.mockResolvedValue({ exists: false });

    const res = await request(buildApp())
      .get("/api/paypal/subscription-status")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscription: null, plan: "free" });
  });

  it("creates a PayPal subscription and stores it in Firestore", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "uid-1" });
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-abc" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "sub-123",
          status: "APPROVAL_PENDING",
          links: [{ rel: "approve", href: "https://paypal.example/approve" }],
        }),
      });
    docSetMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "plan-1", plan_name: "growth" });

    expect(res.status).toBe(200);
    expect(res.body.subscription_id).toBe("sub-123");
    expect(res.body.approve_url).toBe("https://paypal.example/approve");
    expect(docSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ paypal_subscription_id: "sub-123", plan_name: "growth" }),
      { merge: true }
    );
  });

  it("updates subscription status from a webhook event", async () => {
    const docRef = { update: updateMock };
    whereGetMock.mockResolvedValue({ empty: false, docs: [{ ref: docRef }] });
    updateMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "sub-123" } });

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/routes/paypal.test.js`
Expected: FAIL — `Cannot find module './paypal.js'`

- [ ] **Step 3: Write `server/routes/paypal.js`**

```js
import express from "express";
import { adminDb, verifyIdToken } from "../firebaseAdmin.js";

const router = express.Router();
const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

router.post("/create-subscription", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    const { plan_id, plan_name, return_url, cancel_url } = req.body;
    if (!plan_id || !plan_name) {
      return res.status(400).json({ error: "Missing plan_id or plan_name" });
    }

    const accessToken = await getPayPalAccessToken();

    const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id,
        application_context: {
          brand_name: "GenuineCRO",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: return_url || "https://genuinecro.com/subscription?success=true",
          cancel_url: cancel_url || "https://genuinecro.com/subscription?canceled=true",
        },
      }),
    });

    if (!subRes.ok) {
      const text = await subRes.text();
      throw new Error(`PayPal subscription creation failed [${subRes.status}]: ${text}`);
    }

    const subscription = await subRes.json();

    await adminDb.collection("subscriptions").doc(decoded.uid).set(
      {
        paypal_subscription_id: subscription.id,
        plan_name,
        status: (subscription.status || "approval_pending").toLowerCase(),
      },
      { merge: true }
    );

    const approveLink = subscription.links?.find((l) => l.rel === "approve")?.href;

    res.json({
      subscription_id: subscription.id,
      approve_url: approveLink,
      status: subscription.status,
    });
  } catch (err) {
    console.error("PayPal create subscription error:", err);
    if (err.message === "Missing Authorization header") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.get("/subscription-status", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);

    const snap = await adminDb.collection("subscriptions").doc(decoded.uid).get();
    const data = snap.exists ? snap.data() : null;

    res.json({
      subscription: data || null,
      plan: data?.status === "active" ? data.plan_name : "free",
    });
  } catch (err) {
    console.error("Status check error:", err);
    if (err.message === "Missing Authorization header") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    const event = req.body;
    const eventType = event.event_type;
    const resource = event.resource;

    const subscriptionId = resource?.id;
    if (!subscriptionId) {
      return res.status(200).json({ received: true });
    }

    let status;
    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        status = "active";
        break;
      case "BILLING.SUBSCRIPTION.CANCELLED":
        status = "cancelled";
        break;
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        status = "suspended";
        break;
      case "BILLING.SUBSCRIPTION.EXPIRED":
        status = "expired";
        break;
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        status = "payment_failed";
        break;
      default:
        return res.status(200).json({ received: true });
    }

    const matches = await adminDb
      .collection("subscriptions")
      .where("paypal_subscription_id", "==", subscriptionId)
      .limit(1)
      .get();

    if (!matches.empty) {
      await matches.docs[0].ref.update({
        status,
        updated_at: new Date().toISOString(),
        current_period_start: resource.billing_info?.last_payment?.time || null,
        current_period_end: resource.billing_info?.next_billing_time || null,
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/routes/paypal.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Mount the router in `server.js`**

Replace the entire contents of `server.js`:

```javascript
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import paypalRouter from "./server/routes/paypal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, "dist");

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/paypal", paypalRouter);

app.use(express.static(DIST_DIR));

// SPA fallback: any non-API GET request that isn't a static file gets index.html
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`GenuineCRO server listening on port ${PORT}`);
});
```

- [ ] **Step 6: Verify the server still boots and serves health/static routes**

```bash
npm run build
FIREBASE_SERVICE_ACCOUNT_JSON='{"project_id":"placeholder"}' node server.js &
sleep 1
curl -s http://localhost:3000/api/health
kill %1
```

Expected: `{"status":"ok"}` (this only proves the server boots with the new router mounted — real PayPal calls need a live Firebase project and PayPal credentials, verified manually per Task 13).

- [ ] **Step 7: Commit**

```bash
git add server.js server/routes/paypal.js server/routes/paypal.test.js
git commit -m "Port PayPal Edge Functions to Express routes using Firebase Admin SDK"
```

---

### Task 12: Migrate `useSubscription` to call the Express PayPal routes

**Files:**
- Modify: `src/hooks/useSubscription.ts`
- Test: `src/hooks/useSubscription.test.ts`

**Interfaces:**
- Consumes: `user` (Firebase `User`, has `.getIdToken()`) from `useAuth()`
- Produces: `useSubscription()` returns the same `{ subscription, currentPlan, loading, subscribe, refresh }` shape as before, with `subscription.current_period_start`/`current_period_end` still snake_case strings (consumed by `useUsageTracking` from Task 8)

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useSubscription.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getIdTokenMock = vi.fn().mockResolvedValue("id-token-abc");
const fetchMock = vi.fn();
global.fetch = fetchMock;

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { getIdToken: getIdTokenMock } }),
}));

import { useSubscription } from "./useSubscription";

describe("useSubscription", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getIdTokenMock.mockClear();
  });

  it("fetches subscription status with a bearer token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ subscription: { plan_name: "growth", status: "active" }, plan: "growth" }),
    });

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.currentPlan).toBe("Growth"));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/paypal/subscription-status",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer id-token-abc" }) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useSubscription.test.ts`
Expected: FAIL (current implementation calls `supabase.functions.invoke`, never `fetch("/api/paypal/subscription-status", ...)`)

- [ ] **Step 3: Replace the entire contents of `src/hooks/useSubscription.ts`**

```ts
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface Subscription {
  paypal_subscription_id: string | null;
  plan_name: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface AuthorizedUser {
  getIdToken: () => Promise<string>;
}

async function authorizedFetch(path: string, options: RequestInit, user: AuthorizedUser) {
  const token = await user.getIdToken();
  return fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [loading, setLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setCurrentPlan("Free");
      return;
    }

    try {
      const res = await authorizedFetch("/api/paypal/subscription-status", { method: "GET" }, user);
      if (!res.ok) throw new Error("Failed to fetch subscription status");
      const data = await res.json();
      setSubscription(data.subscription);
      setCurrentPlan(
        data.plan && data.plan !== "free"
          ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1)
          : "Free"
      );
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const subscribe = useCallback(
    async (paypalPlanId: string, planName: string) => {
      if (!user) {
        toast.error("Please sign in to subscribe");
        return;
      }

      setLoading(true);
      try {
        const res = await authorizedFetch(
          "/api/paypal/create-subscription",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan_id: paypalPlanId,
              plan_name: planName,
              return_url: `${window.location.origin}/subscription?success=true`,
              cancel_url: `${window.location.origin}/subscription?canceled=true`,
            }),
          },
          user
        );

        if (!res.ok) throw new Error("Failed to create subscription");
        const data = await res.json();

        if (data.approve_url) {
          window.location.href = data.approve_url;
        } else {
          throw new Error("No approval URL returned from PayPal");
        }
      } catch (err: any) {
        console.error("Subscribe error:", err);
        toast.error(err.message || "Failed to create subscription");
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return { subscription, currentPlan, loading, subscribe, refresh: fetchSubscription };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useSubscription.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSubscription.ts src/hooks/useSubscription.test.ts
git commit -m "Migrate useSubscription to call Express PayPal routes with a Firebase ID token"
```

---

### Task 13: Environment variables, manual Firebase project setup, and README

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing
- Produces: the documented, repeatable manual setup procedure the user follows to get a real Firebase project working (not automatable — same pattern as the Hostinger hPanel steps in the Hosting Foundation plan)

- [ ] **Step 1: Finalize `.env.example`**

Replace the entire contents of `.env.example`:

```
# Supabase — transitional. analyze-url/ai-analyze Edge Functions still run on
# Supabase and don't check identity (verify_jwt = false), so this stays until
# a later plan ports them to Express too. Everything else has moved to Firebase.
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=

# Firebase (client)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_FIREBASE_EMULATORS=false

# Firebase Admin (server) — paste the full service account JSON as one line
FIREBASE_SERVICE_ACCOUNT_JSON=

# PayPal (server)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
```

- [ ] **Step 2: Add a Firebase setup section to `README.md`**

Insert a new section after "Deploying to Hostinger (Node.js App)":

```markdown
## Firebase project setup (manual, one-time)

1. Create a project at https://console.firebase.google.com.
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Firestore Database** → Create database (production mode, choose a region).
4. **Storage** → Get started (accept the default bucket).
5. **Project settings → General** → under "Your apps", add a Web app and copy
   the config values into `VITE_FIREBASE_*` in your `.env`.
6. **Project settings → Service accounts** → Generate new private key. Convert
   the downloaded JSON to a single line (e.g. `jq -c . service-account.json`)
   and set it as `FIREBASE_SERVICE_ACCOUNT_JSON` — in `.env` locally, and as a
   Hostinger environment variable in production. Never commit the JSON file.
7. Log in and link the CLI to this project, then deploy the security rules:

\`\`\`sh
firebase login
firebase use --add   # select the project you just created
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
\`\`\`
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "Document Firebase project setup and finalize env vars"
```

---

## What this plan does NOT cover (by design)

`analyze-url` and `ai-analyze` (Firecrawl scraping + AI scoring, currently on Supabase Edge Functions with `verify_jwt = false`) are untouched — they don't check identity today, so they keep working through the still-present Supabase JS client regardless of this Auth/Data migration. Porting them to Express (and replacing Lovable's AI gateway with OpenAI) is a separate future plan. The visual redesign, new IA/Dashboard shell, Monitoring, Action Center, Reports (PDF/white-label), Kit email, and i18n are also separate future plans — see `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` and the companion roadmap doc.
