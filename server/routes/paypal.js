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
