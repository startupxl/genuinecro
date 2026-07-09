export interface AuthorizedUser {
  getIdToken: () => Promise<string>;
}

export interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

export interface GA4Status {
  connected: boolean;
  pendingPropertySelection: boolean;
  propertyId: string | null;
  propertyDisplayName: string | null;
}

export interface GA4TagDetection {
  hasGA4Tag: boolean;
  measurementId: string | null;
  hasGTM: boolean;
  gtmContainerId: string | null;
}

export interface GA4Behavioral {
  hasData: boolean;
  sessions: number;
  bounceRate: number;
  engagementRate: number;
  avgEngagementTimeSeconds: number;
  conversions: number;
  pageViews: number;
}

export interface GA4PageMetrics {
  tagDetection: GA4TagDetection;
  connected: boolean;
  propertyDisplayName?: string | null;
  behavioral?: GA4Behavioral | null;
  conversionEventNames?: string[];
  metricsError?: string;
}

async function authorizedFetch(path: string, options: RequestInit, user: AuthorizedUser) {
  const token = await user.getIdToken();
  const res = await fetch(path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Google Analytics request failed");
  return data;
}

export async function getGA4AuthorizeUrl(user: AuthorizedUser): Promise<string> {
  const data = await authorizedFetch("/api/ga4/oauth/authorize-url", { method: "POST" }, user);
  return data.url;
}

export async function getGA4Status(user: AuthorizedUser): Promise<GA4Status> {
  return authorizedFetch("/api/ga4/status", { method: "GET" }, user);
}

export async function getGA4Properties(user: AuthorizedUser): Promise<GA4Property[]> {
  const data = await authorizedFetch("/api/ga4/properties", { method: "GET" }, user);
  return data.properties;
}

export async function selectGA4Property(user: AuthorizedUser, propertyId: string, displayName: string): Promise<void> {
  await authorizedFetch(
    "/api/ga4/select-property",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, displayName }),
    },
    user
  );
}

export async function disconnectGA4(user: AuthorizedUser): Promise<void> {
  await authorizedFetch("/api/ga4/disconnect", { method: "POST" }, user);
}

export async function getGA4PageMetrics(user: AuthorizedUser, url: string): Promise<GA4PageMetrics> {
  return authorizedFetch(
    "/api/ga4/page-metrics",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    },
    user
  );
}
