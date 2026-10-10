import dns from "dns/promises";
import net from "net";

// SSRF guard for every place the server fetches a URL a user supplied.
// Rejects non-http(s) schemes, embedded credentials, odd ports, and any host
// that is (or resolves to) a loopback / private / link-local / reserved
// address — and re-checks on every redirect hop.
//
// Residual risk: DNS can change between this check and the socket connect
// (DNS rebinding). Closing that fully needs pinning the resolved IP into the
// connection; this guard stops the practical cases (typed internal IPs,
// internal hostnames, redirects to metadata/localhost).

export class UnsafeUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp"];

function ipv4ToInt(ip) {
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

const V4_BLOCKS = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
].map(([base, bits]) => ({ base: ipv4ToInt(base), mask: bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0 }));

function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  return V4_BLOCKS.some(({ base, mask }) => ((n & mask) >>> 0) === ((base & mask) >>> 0));
}

function ipv6ToBytes(input) {
  let ip = input.split("%")[0].toLowerCase();
  // Embedded dotted IPv4 tail (::ffff:1.2.3.4) -> two hex groups.
  const tail = ip.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const v = tail[1].split(".").map(Number);
    ip = ip.slice(0, -tail[1].length) + ((v[0] << 8) | v[1]).toString(16) + ":" + ((v[2] << 8) | v[3]).toString(16);
  }
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill("0"), ...rest];
  const bytes = [];
  for (const g of groups) {
    const n = parseInt(g || "0", 16);
    if (Number.isNaN(n) || n > 0xffff) return null;
    bytes.push(n >> 8, n & 0xff);
  }
  return bytes;
}

function isPrivateIPv6(ip) {
  const b = ipv6ToBytes(ip);
  if (!b) return true; // unparsable -> refuse
  const allZeroUntil = (n) => b.slice(0, n).every((x) => x === 0);
  if (allZeroUntil(15) && (b[15] === 0 || b[15] === 1)) return true; // :: and ::1
  if (b[0] === 0xff) return true; // multicast
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // documentation
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible, and NAT64 (64:ff9b::/96): judge the embedded v4.
  const mapped = allZeroUntil(10) && b[10] === 0xff && b[11] === 0xff;
  const nat64 = b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && b.slice(4, 12).every((x) => x === 0);
  if (mapped || nat64 || allZeroUntil(12)) return isPrivateIPv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  return false;
}

export function isPrivateAddress(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

// Cheap synchronous check (no DNS) for URLs we hand to a third-party scraper
// (Firecrawl). It won't stop DNS tricks, but it rejects obviously internal
// targets and junk input before we spend an API call on them.
export function validateTargetUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) throw new UnsafeUrlError("Invalid URL");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("That host is not allowed");
  }
  if (net.isIP(host) && isPrivateAddress(host)) throw new UnsafeUrlError("That address is not allowed");
  if (!net.isIP(host) && !host.includes(".")) throw new UnsafeUrlError("That host is not allowed");
  return url;
}

export async function assertPublicUrl(rawUrl, { lookup = dns.lookup } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed");
  if (!ALLOWED_PORTS.has(url.port)) throw new UnsafeUrlError("That port is not allowed");

  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host) throw new UnsafeUrlError("Invalid URL");
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("That host is not allowed");
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("That address is not allowed");
    return url;
  }

  let addrs;
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("Could not resolve that host");
  }
  if (!addrs?.length) throw new UnsafeUrlError("Could not resolve that host");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError("That host resolves to a non-public address");
  return url;
}

// fetch() with SSRF checks on the first URL and every redirect hop, a timeout,
// and a hop limit. Returns the final Response.
export async function safeFetch(rawUrl, { headers, method = "GET", timeoutMs = 8000, maxRedirects = 5, lookup } = {}) {
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const url = await assertPublicUrl(current, { lookup });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url.toString(), { method, headers, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    const location = res.status >= 300 && res.status < 400 ? res.headers?.get?.("location") : null;
    if (!location) return res;
    current = new URL(location, url).toString();
  }
  throw new Error("Too many redirects");
}

// Reads a response body as text but stops (and throws) past maxBytes.
export async function readTextCapped(res, maxBytes = 2_000_000) {
  if (!res.body?.getReader) return res.text(); // non-streaming (e.g. test doubles)
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}
