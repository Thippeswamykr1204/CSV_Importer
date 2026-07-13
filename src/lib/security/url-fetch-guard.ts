import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Server-Side Request Forgery guard.
 *
 * "Import from URL" means the server makes an outbound HTTP request to
 * a URL the user controls — the textbook SSRF vector (attacker points
 * the server at http://169.254.169.254/... or http://localhost:internal-admin/
 * and reads back whatever comes back as if it were CSV data). This guard
 * is the load-bearing security control for that whole feature; the
 * feature should not exist without it.
 *
 * Defense in depth, in order:
 *  1. Protocol allowlist (http/https only — no file:, gopher:, etc).
 *  2. Hostname denylist for obviously-internal names.
 *  3. DNS resolution + IP-range check — blocks loopback, link-local
 *     (including the 169.254.169.254 cloud metadata endpoint), private
 *     RFC1918 ranges, and other reserved ranges, so a public hostname
 *     that resolves to an internal IP (DNS rebinding) is also caught.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "metadata.google.internal"]);

export interface UrlGuardResult {
  allowed: boolean;
  reason?: string;
}

export async function assertSafeRemoteUrl(rawUrl: string): Promise<UrlGuardResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "Not a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allowed: false, reason: "Only http and https URLs are supported." };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { allowed: false, reason: "This host is not allowed." };
  }

  // A literal IP in the URL — check it directly without a DNS round-trip.
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { allowed: false, reason: "This address is not allowed." };
    }
    return { allowed: true };
  }

  // Resolve the hostname and check every returned address, not just the
  // first — this is what catches DNS rebinding attempts.
  let addresses: string[];
  try {
    const records = await lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    return { allowed: false, reason: "Could not resolve this host." };
  }

  if (addresses.length === 0) {
    return { allowed: false, reason: "Could not resolve this host." };
  }

  if (addresses.some(isBlockedIp)) {
    return { allowed: false, reason: "This host resolves to a blocked network range." };
  }

  return { allowed: true };
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;

    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 0) return true; // "this network"
    if (a >= 224) return true; // multicast/reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (normalized.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 — check the embedded IPv4 address too.
      const mapped = normalized.split(":").pop() ?? "";
      if (net.isIPv4(mapped)) return isBlockedIp(mapped);
    }
    return false;
  }

  return true; // unrecognized format — fail closed
}