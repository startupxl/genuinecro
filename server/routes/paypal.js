import express from "express";
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, updateDoc } from "firebase/firestore";
import { serverDb, ensureServerSignedIn, verifyIdToken } from "../firebaseServerAuth.js";

const router = express.Router();
// Defaults to LIVE (real payments). Set PAYPAL_ENV=sandbox only for testing, and
// then use sandbox credentials, plan IDs and webhook ID. Live needs live ones.
const PAYPAL_BASE = process.env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

// The plan a user gets is decided HERE, from the PayPal plan ID, never from a
// name the browser sends. Set PAYPAL_PLAN_ID_PRO / PAYPAL_PLAN_ID_AGENCY to the
// IDs of your PayPal billing plans.
function planNameForPlanId(planId) {
  const catalog = { pro: process.env.PAYPAL_PLAN_ID_PRO, agency: process.env.PAYPAL_PLAN_ID_AGENCY };
  for (const [name, id] of Object.entries(catalog)) {
    if (id && id === planId) return name;
  }
  return null;
}

// Where PayPal may send the customer back to. Anything else falls back to the
// default, so our checkout can't be used as an open redirect.
function allowedReturnOrigins() {
  const origins = new Set(["https://genuinecro.com", "https://www.genuinecro.com", "https://app.genuinecro.com"]);
  for (const raw of [process.env.FRONTEND_URL, ...(process.env.ALLOWED_RETURN_ORIGINS || "").split(",")]) {
    try {
      if (raw?.trim()) origins.add(new URL(raw.trim()).origin);
    } catch {
      // ignore malformed entries
    }
  }
  return origins;
}

function safeReturnUrl(candidate, fallback) {
  try {
    const url = new URL(candidate);
    if (allowedReturnOrigins().has(url.origin) && url.pathname.startsWith("/subscription")) return url.toString();
  } catch {
    // fall through
  }
  return fallback;
}

// Asks PayPal to verify that a webhook call really came from PayPal.
// Fails closed: no webhook ID configured, or anything but SUCCESS, means reject.
async function verifyWebhookSignature(req) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    const err = new Error("PAYPAL_WEBHOOK_ID not configured");
    err.code = "not_configured";
    throw err;
  }
  const h = req.headers;
  const transmissionId = h["paypal-transmission-id"];
  const transmissionTime = h["paypal-transmission-time"];
  const certUrl = h["paypal-cert-url"];
  const authAlgo = h["paypal-auth-algo"];
  const transmissionSig = h["paypal-transmission-sig"];
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false;

  const accessToken = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: req.body,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

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
    const { plan_id, return_url, cancel_url } = req.body;
    if (!plan_id || typeof plan_id !== "string") {
      return res.status(400).json({ error: "Missing plan_id" });
    }
    // plan_name from the client is ignored on purpose — see planNameForPlanId.
    const plan_name = planNameForPlanId(plan_id);
    if (!plan_name) {
      return res.status(400).json({ error: "Unknown plan" });
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
          return_url: safeReturnUrl(return_url, "https://genuinecro.com/subscription?success=true"),
          cancel_url: safeReturnUrl(cancel_url, "https://genuinecro.com/subscription?canceled=true"),
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
    let verified;
    try {
      verified = await verifyWebhookSignature(req);
    } catch (err) {
      console.error("PayPal webhook verification unavailable:", err.message);
      // Misconfiguration or PayPal outage: reject (PayPal will retry) rather than trust the call.
      return res.status(503).json({ error: "Webhook verification unavailable" });
    }
    if (!verified) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

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
      // PayPal's own record of which plan this subscription is on beats whatever
      // was stored at checkout, if it maps to a plan we sell.
      const verifiedPlan = planNameForPlanId(resource.plan_id);
      await updateDoc(matches.docs[0].ref, {
        status,
        ...(verifiedPlan ? { plan_name: verifiedPlan } : {}),
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
