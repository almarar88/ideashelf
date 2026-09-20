// Update checker for sideloaded builds: compares the running build with the "latest" GitHub release.
// Reads the small version.json asset that the APK workflow publishes next to the installers.
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { APP_BUILD, RELEASE_API, RELEASE_URL } from "../config";

export interface UpdateInfo { version: string; build: number; url: string; date?: string; }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const r = await CapacitorHttp.get({ url, headers: { Accept: "application/json" }, connectTimeout: 8000, readTimeout: 8000 });
      if (r.status < 200 || r.status >= 300) return null;
      return (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as T;
    }
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ac.signal }).finally(() => clearTimeout(tm));
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

let cached: { at: number; info: UpdateInfo | null } | null = null;

/** Resolves with the newer build's info, or null when up to date / offline. Cached for an hour. */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (!force && cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.info;
  let info: UpdateInfo | null = null;
  const rel = await getJson<{ name?: string; html_url?: string; published_at?: string; assets?: { name: string; browser_download_url: string }[] }>(RELEASE_API);
  if (rel) {
    const asset = rel.assets?.find((a) => a.name === "version.json");
    const v = asset ? await getJson<{ version?: string; build?: number }>(asset.browser_download_url) : null;
    let version = v?.version; let build = v?.build;
    if (!version || !build) { // fall back to the release name "LiwaBot 2.1.0 (build 10)"
      const m = /(\d+\.\d+\.\d+)\D+(\d+)\)?/.exec(rel.name ?? "");
      if (m) { version = version ?? m[1]; build = build ?? Number(m[2]); }
    }
    if (version && build && build > APP_BUILD) info = { version, build, url: rel.html_url || RELEASE_URL, date: rel.published_at };
  }
  cached = { at: Date.now(), info };
  return info;
}
