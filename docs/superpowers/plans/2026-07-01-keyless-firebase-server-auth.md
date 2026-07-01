# Keyless Firebase Server Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Firebase Admin SDK / service-account-key approach (blocked by an Organization Policy the project owner can't override) with a keyless approach: a dedicated Firebase Auth service user signed in via the public client SDK, a Firestore rules exception scoped to that user's email, and REST-based ID token verification.

**Architecture:** `server/firebaseAdmin.js` is deleted and replaced by `server/firebaseServerAuth.js`, which initializes a second (named) Firebase client app instance server-side, signs into it as a dedicated Firebase Auth user (credentials via env vars), and exposes a Firestore instance authorized as that user. `verifyIdToken` — used to authenticate incoming user requests — becomes a REST call to Firebase's public `accounts:lookup` endpoint instead of `admin.auth().verifyIdToken()`. `server/routes/paypal.js` is updated to use client-SDK-style Firestore calls (`doc`/`getDoc`/`setDoc`/`query`/`getDocs`/`updateDoc`) instead of the Admin SDK's chained `.collection().doc()` style, keeping the exact same route behavior and response shapes as before.

**Tech Stack:** `firebase` (already a dependency, now also used server-side — `firebase-admin` is removed), Express, Vitest + `supertest` (unchanged).

## Global Constraints

- Reference spec revision: `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §4 ("Revision (2026-07-01, post-implementation)") and §8.
- No service-account JSON exists anywhere, committed or otherwise. `FIREBASE_SERVICE_EMAIL`/`FIREBASE_SERVICE_PASSWORD` are the only new secrets, and they must be a strong, randomly-generated password never reused elsewhere (whoever holds these credentials gets the same `subscriptions`-collection access the server has).
- The `verifyIdToken(authHeader): Promise<{ uid: string }>` interface signature from the previous plan is preserved exactly, so `server/routes/paypal.js`'s error-handling (`err.message === "Missing Authorization header"`) continues to work — just extended to also treat `"Invalid or expired token"` as a 401.
- All new/changed logic gets a Vitest unit test mocking the relevant SDK boundary (`firebase/app`, `firebase/auth`, `firebase/firestore`) or `global.fetch` — no live Firebase project is available in this environment.

---

### Task 1: Update Firestore rules for the service-user exception

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: nothing
- Produces: the updated access-control contract — `subscriptions/{userId}` now allows read/write for the request whose auth token's email matches the dedicated service user's email, in addition to remaining fully denied for every other caller

- [ ] **Step 1: Replace the `subscriptions` match block**

In `firestore.rules`, replace:

```
    match /subscriptions/{userId} {
      allow read, write: if false;
    }
```

with:

```
    // Only the dedicated server service-user (see server/firebaseServerAuth.js)
    // may read/write subscriptions — update this email if you change
    // FIREBASE_SERVICE_EMAIL, and redeploy rules after any change.
    match /subscriptions/{userId} {
      allow read, write: if request.auth != null
                          && request.auth.token.email == "server@internal.genuinecro.app";
    }
```

- [ ] **Step 2: Verify (manual — cannot be run from this environment)**

Once the dedicated service user exists in a real Firebase project (Task 4), run:

```bash
firebase deploy --only firestore:rules
```

Expected: `✔  Deploy complete!`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Scope subscriptions Firestore access to the dedicated service user's email"
```

---

### Task 2: Replace `server/firebaseAdmin.js` with `server/firebaseServerAuth.js`

**Files:**
- Delete: `server/firebaseAdmin.js`
- Delete: `server/firebaseAdmin.test.js`
- Create: `server/firebaseServerAuth.js`
- Create: `server/firebaseServerAuth.test.js`
- Modify: `package.json` (remove `firebase-admin` dependency)

**Interfaces:**
- Consumes: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (same values already used to build the client, readable from `process.env` at server runtime since they're real OS-level env vars, not Vite-only), `FIREBASE_SERVICE_EMAIL`, `FIREBASE_SERVICE_PASSWORD`
- Produces: `serverDb` (a Firestore instance), `ensureServerSignedIn(): Promise<UserCredential>` (idempotent — signs in once, reuses the same promise on subsequent calls), `verifyIdToken(authHeader): Promise<{ uid: string }>` — same signature as before, consumed by Task 3

- [ ] **Step 1: Remove the old Admin SDK files and dependency**

```bash
rm server/firebaseAdmin.js server/firebaseAdmin.test.js
npm uninstall firebase-admin
```

- [ ] **Step 2: Write the failing tests**

Create `server/firebaseServerAuth.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";

const initializeAppMock = vi.fn(() => ({}));
const getAuthMock = vi.fn(() => ({}));
const signInWithEmailAndPasswordMock = vi.fn();
const getFirestoreMock = vi.fn(() => ({}));

vi.mock("firebase/app", () => ({
  initializeApp: (...args) => initializeAppMock(...args),
}));
vi.mock("firebase/auth", () => ({
  getAuth: (...args) => getAuthMock(...args),
  signInWithEmailAndPassword: (...args) => signInWithEmailAndPasswordMock(...args),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: (...args) => getFirestoreMock(...args),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

process.env.VITE_FIREBASE_API_KEY = "test-web-api-key";
process.env.FIREBASE_SERVICE_EMAIL = "server@internal.genuinecro.app";
process.env.FIREBASE_SERVICE_PASSWORD = "test-password";

describe("firebaseServerAuth", () => {
  beforeEach(() => {
    signInWithEmailAndPasswordMock.mockReset();
    fetchMock.mockReset();
  });

  it("signs in once and reuses the same promise on subsequent calls", async () => {
    const { ensureServerSignedIn } = await import("./firebaseServerAuth.js");
    signInWithEmailAndPasswordMock.mockResolvedValue({ user: { uid: "server-uid" } });

    const first = ensureServerSignedIn();
    const second = ensureServerSignedIn();

    expect(first).toBe(second);
    await first;
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledTimes(1);
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      {},
      "server@internal.genuinecro.app",
      "test-password"
    );
  });

  it("verifies a bearer token via the accounts:lookup REST endpoint", async () => {
    const { verifyIdToken } = await import("./firebaseServerAuth.js");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ users: [{ localId: "uid-1" }] }),
    });

    const decoded = await verifyIdToken("Bearer abc123");

    expect(decoded).toEqual({ uid: "uid-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=test-web-api-key",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("rejects when the Authorization header is missing or malformed", async () => {
    const { verifyIdToken } = await import("./firebaseServerAuth.js");
    await expect(verifyIdToken(undefined)).rejects.toThrow("Missing Authorization header");
    await expect(verifyIdToken("Basic abc123")).rejects.toThrow("Missing Authorization header");
  });

  it("rejects when the REST endpoint returns no matching user", async () => {
    const { verifyIdToken } = await import("./firebaseServerAuth.js");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ users: [] }) });
    await expect(verifyIdToken("Bearer abc123")).rejects.toThrow("Invalid or expired token");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server/firebaseServerAuth.test.js`
Expected: FAIL — `Cannot find module './firebaseServerAuth.js'`

- [ ] **Step 4: Write `server/firebaseServerAuth.js`**

```js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/firebaseServerAuth.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json server/firebaseServerAuth.js server/firebaseServerAuth.test.js
git commit -m "Replace Firebase Admin SDK with a keyless service-user client"
```

---

### Task 3: Rewrite `server/routes/paypal.js` for the client-SDK Firestore API

**Files:**
- Modify: `server/routes/paypal.js`
- Modify: `server/routes/paypal.test.js`

**Interfaces:**
- Consumes: `serverDb`, `ensureServerSignedIn`, `verifyIdToken` from `server/firebaseServerAuth.js` (Task 2)
- Produces: the same `/create-subscription`, `/subscription-status`, `/webhook` routes with identical request/response shapes as before — only the Firestore access pattern changes

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `server/routes/paypal.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const verifyIdTokenMock = vi.fn();
const ensureServerSignedInMock = vi.fn().mockResolvedValue(undefined);
const docMock = vi.fn((..._args) => ({ __doc: true }));
const getDocMock = vi.fn();
const setDocMock = vi.fn();
const collectionMock = vi.fn((..._args) => ({ __collection: true }));
const queryMock = vi.fn((..._args) => ({ __query: true }));
const whereMock = vi.fn((..._args) => ({ __where: true }));
const limitMock = vi.fn((..._args) => ({ __limit: true }));
const getDocsMock = vi.fn();
const updateDocMock = vi.fn();

vi.mock("../firebaseServerAuth.js", () => ({
  verifyIdToken: (...args) => verifyIdTokenMock(...args),
  ensureServerSignedIn: (...args) => ensureServerSignedInMock(...args),
  serverDb: {},
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args) => docMock(...args),
  getDoc: (...args) => getDocMock(...args),
  setDoc: (...args) => setDocMock(...args),
  collection: (...args) => collectionMock(...args),
  query: (...args) => queryMock(...args),
  where: (...args) => whereMock(...args),
  limit: (...args) => limitMock(...args),
  getDocs: (...args) => getDocsMock(...args),
  updateDoc: (...args) => updateDocMock(...args),
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
    getDocMock.mockReset();
    setDocMock.mockReset();
    getDocsMock.mockReset();
    updateDocMock.mockReset();
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
    getDocMock.mockResolvedValue({ exists: () => false });

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
    setDocMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/create-subscription")
      .set("Authorization", "Bearer test-token")
      .send({ plan_id: "plan-1", plan_name: "growth" });

    expect(res.status).toBe(200);
    expect(res.body.subscription_id).toBe("sub-123");
    expect(res.body.approve_url).toBe("https://paypal.example/approve");
    expect(setDocMock).toHaveBeenCalledWith(
      { __doc: true },
      expect.objectContaining({ paypal_subscription_id: "sub-123", plan_name: "growth" }),
      { merge: true }
    );
  });

  it("updates subscription status from a webhook event", async () => {
    getDocsMock.mockResolvedValue({ empty: false, docs: [{ ref: { __ref: true } }] });
    updateDocMock.mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/api/paypal/webhook")
      .send({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "sub-123" } });

    expect(res.status).toBe(200);
    expect(updateDocMock).toHaveBeenCalledWith({ __ref: true }, expect.objectContaining({ status: "active" }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/routes/paypal.test.js`
Expected: FAIL (current implementation imports `adminDb`/`verifyIdToken` from `../firebaseAdmin.js`, which no longer exists — import error)

- [ ] **Step 3: Replace the entire contents of `server/routes/paypal.js`**

```js
import express from "express";
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, updateDoc } from "firebase/firestore";
import { serverDb, ensureServerSignedIn, verifyIdToken } from "../firebaseServerAuth.js";

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

    await ensureServerSignedIn();
    await setDoc(
      doc(serverDb, "subscriptions", decoded.uid),
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
    if (err.message === "Missing Authorization header" || err.message === "Invalid or expired token") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

router.get("/subscription-status", async (req, res) => {
  try {
    const decoded = await verifyIdToken(req.headers.authorization);

    await ensureServerSignedIn();
    const snap = await getDoc(doc(serverDb, "subscriptions", decoded.uid));
    const data = snap.exists() ? snap.data() : null;

    res.json({
      subscription: data || null,
      plan: data?.status === "active" ? data.plan_name : "free",
    });
  } catch (err) {
    console.error("Status check error:", err);
    if (err.message === "Missing Authorization header" || err.message === "Invalid or expired token") {
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

    await ensureServerSignedIn();
    const matches = await getDocs(
      query(collection(serverDb, "subscriptions"), where("paypal_subscription_id", "==", subscriptionId), limit(1))
    );

    if (!matches.empty) {
      await updateDoc(matches.docs[0].ref, {
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

- [ ] **Step 5: Boot-verify the server (now needs no Firebase credential at all to start)**

```bash
npm run build
node server.js &
sleep 1
curl -s http://localhost:3000/api/health
kill %1
```

Expected: `{"status":"ok"}` — and notably, no `FIREBASE_SERVICE_ACCOUNT_JSON`/service-account setup is needed just to boot, since `initializeApp`/`getAuth`/`getFirestore` don't validate credentials until something actually signs in.

- [ ] **Step 6: Commit**

```bash
git add server/routes/paypal.js server/routes/paypal.test.js
git commit -m "Rewrite PayPal routes for the keyless client-SDK Firestore API"
```

---

### Task 4: Update env vars and Firebase setup docs

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing
- Produces: the documented manual procedure for creating the dedicated service user (replaces the blocked "generate service account key" step)

- [ ] **Step 1: Update `.env.example`**

Replace:

```
# Firebase Admin (server) — paste the full service account JSON as one line
FIREBASE_SERVICE_ACCOUNT_JSON=
```

with:

```
# Firebase (server) — a dedicated Firebase Auth user, NOT a GCP service account.
# Create it in Firebase Console > Authentication > Users > Add user, with a
# long randomly-generated password. Must match firestore.rules' subscriptions
# match block if you use a different email than the default.
FIREBASE_SERVICE_EMAIL=server@internal.genuinecro.app
FIREBASE_SERVICE_PASSWORD=
```

- [ ] **Step 2: Update the Firebase setup section in `README.md`**

Replace step 6 (the blocked "Generate new private key" step):

```markdown
6. **Project settings → Service accounts** → Generate new private key. Convert
   the downloaded JSON to a single line (e.g. `jq -c . service-account.json`)
   and set it as `FIREBASE_SERVICE_ACCOUNT_JSON` — in `.env` locally, and as a
   Hostinger environment variable in production. Never commit the JSON file.
```

with:

```markdown
6. **Authentication → Users → Add user** — create a dedicated user for the
   server (e.g. `server@internal.genuinecro.app`) with a long, randomly
   generated password used nowhere else. Set `FIREBASE_SERVICE_EMAIL` and
   `FIREBASE_SERVICE_PASSWORD` to those values — in `.env` locally, and as
   Hostinger environment variables in production. This account only ever
   needs Firestore access to the `subscriptions` collection, granted via
   `firestore.rules`, not any GCP IAM role — no service-account key is
   created or needed. (If your organization's `iam.disableServiceAccountKeyCreation`
   policy blocks key creation and you can't get it overridden, this is why
   we use this approach instead.)
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "Document the dedicated Firebase service-user setup"
```

---

## What this plan does NOT cover (by design)

This plan only replaces the credential/authorization mechanism for the server. It doesn't change any route behavior, request/response shape, or client-side code — `useSubscription.ts` (from the previous plan) needs no changes, since it just calls `/api/paypal/*` the same way as before.
