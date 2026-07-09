const GTAG_ID_PATTERN = /\bG-[A-Z0-9]{6,10}\b/;
const GTM_ID_PATTERN = /\bGTM-[A-Z0-9]{4,10}\b/;

// Scans raw page HTML for GA4's own tag (gtag.js with a G- measurement ID)
// and, separately, for a Google Tag Manager container. GTM commonly loads
// GA4 indirectly, so its presence doesn't guarantee GA4 is configured —
// callers should treat it as "verify inside GTM" rather than "GA4 present".
export function detectGA4Tag(html) {
  const source = html || "";

  const gtagScriptMatch = source.match(/googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]{6,10})/i);
  const gtagConfigMatch = source.match(/gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]{6,10})['"]/i);
  const measurementId = (gtagScriptMatch?.[1] || gtagConfigMatch?.[1] || source.match(GTAG_ID_PATTERN)?.[0] || null);

  const gtmMatch = source.match(GTM_ID_PATTERN);

  return {
    hasGA4Tag: !!measurementId,
    measurementId: measurementId ? measurementId.toUpperCase() : null,
    hasGTM: !!gtmMatch,
    gtmContainerId: gtmMatch ? gtmMatch[0].toUpperCase() : null,
  };
}
