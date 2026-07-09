const ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

export async function listAccountSummaries(accessToken) {
  const res = await fetch(`${ADMIN_BASE}/accountSummaries`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 account summaries failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const properties = [];
  for (const account of data.accountSummaries || []) {
    for (const prop of account.propertySummaries || []) {
      properties.push({
        propertyId: (prop.property || "").replace("properties/", ""),
        displayName: prop.displayName || prop.property,
        accountName: account.displayName || "",
      });
    }
  }
  return properties;
}

export async function runPageReport({ accessToken, propertyId, pagePath }) {
  const res = await fetch(`${DATA_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "sessions" },
        { name: "bounceRate" },
        { name: "engagementRate" },
        { name: "userEngagementDuration" },
        { name: "conversions" },
        { name: "screenPageViews" },
      ],
      dimensionFilter: {
        filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: pagePath } },
      },
      limit: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 report failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const row = data.rows?.[0];
  if (!row) {
    return {
      hasData: false,
      sessions: 0,
      bounceRate: 0,
      engagementRate: 0,
      avgEngagementTimeSeconds: 0,
      conversions: 0,
      pageViews: 0,
    };
  }

  const [sessions, bounceRate, engagementRate, engagementDuration, conversions, pageViews] = row.metricValues.map(
    (m) => Number(m.value)
  );

  return {
    hasData: true,
    sessions,
    // GA4 returns these as 0-1 fractions — convert to a percentage for display.
    bounceRate: Math.round(bounceRate * 1000) / 10,
    engagementRate: Math.round(engagementRate * 1000) / 10,
    avgEngagementTimeSeconds: sessions > 0 ? Math.round(engagementDuration / sessions) : 0,
    conversions,
    pageViews,
  };
}

export async function listConversionEvents({ accessToken, propertyId }) {
  const res = await fetch(`${ADMIN_BASE}/properties/${propertyId}/conversionEvents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 conversion events failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return (data.conversionEvents || []).map((e) => e.eventName);
}
