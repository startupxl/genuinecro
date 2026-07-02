import * as cheerio from "cheerio";

export function extractCanonical(html) {
  const $ = cheerio.load(html);
  const href = $('link[rel="canonical"]').attr("href") || null;
  return { present: !!href, href };
}

export function extractIndexability(html) {
  const $ = cheerio.load(html);
  const content = $('meta[name="robots"]').attr("content") || "";
  const indexable = !/noindex/i.test(content);
  return { indexable, reason: indexable ? null : "meta robots tag contains noindex" };
}

export function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
    try {
      links.add(new URL(href, baseUrl).toString());
    } catch {
      // ignore unparsable hrefs
    }
  });
  return [...links];
}

const AUDIT_USER_AGENT = "GenuineCRO-TechnicalAudit/1.0";

export async function checkRobotsTxt(origin) {
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": AUDIT_USER_AGENT } });
    if (!res.ok) {
      return { exists: false, valid: false, issue: `robots.txt returned ${res.status}` };
    }
    const text = await res.text();
    const valid = text.trim().length > 0;
    return { exists: true, valid, issue: valid ? null : "robots.txt is empty" };
  } catch {
    return { exists: false, valid: false, issue: "robots.txt could not be fetched" };
  }
}

export async function checkSitemap(origin) {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": AUDIT_USER_AGENT } });
    if (!res.ok) {
      return { exists: false, valid: false, issue: `sitemap.xml returned ${res.status}` };
    }
    const text = await res.text();
    const valid = /<url(set)?[\s>]/i.test(text) || /<sitemap[\s>]/i.test(text);
    return { exists: true, valid, issue: valid ? null : "sitemap.xml does not contain any <url> or <sitemap> entries" };
  } catch {
    return { exists: false, valid: false, issue: "sitemap.xml could not be fetched" };
  }
}

const LINK_CONCURRENCY = 8;
const MAX_REDIRECT_HOPS = 5;
const LINK_TIMEOUT_MS = 6000;

async function checkOneLink(url) {
  let currentUrl = url;
  let hops = 0;

  try {
    while (hops <= MAX_REDIRECT_HOPS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": AUDIT_USER_AGENT },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          return { url, status: "broken", hops, finalStatus: res.status };
        }
        currentUrl = new URL(location, currentUrl).toString();
        hops += 1;
        continue;
      }

      if (res.status >= 400) {
        return { url, status: "broken", hops, finalStatus: res.status };
      }

      return { url, status: hops > 0 ? "redirect-chain" : "ok", hops, finalStatus: res.status };
    }
    return { url, status: "broken", hops, finalStatus: null };
  } catch {
    return { url, status: "broken", hops, finalStatus: null };
  }
}

export async function checkLinks(links) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < links.length) {
      const current = links[index];
      index += 1;
      results.push(await checkOneLink(current));
    }
  }

  const workerCount = Math.min(LINK_CONCURRENCY, links.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
