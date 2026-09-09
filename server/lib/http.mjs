/** Fetch with a hard timeout and a readable error, so one slow partner cannot
 *  hang a whole search. */
export async function getJson(url, { headers = {}, timeoutMs = 12000, method = "GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...headers },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* Upstream returned non-JSON; surfaced below with the status. */
    }
    if (!res.ok) {
      const detail = json?.errors?.[0]?.detail ?? json?.error ?? text.slice(0, 200);
      const err = new Error(`${res.status} ${res.statusText}: ${detail}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (err) {
    if (err.name === "AbortError") {
      const e = new Error(`timed out after ${timeoutMs}ms`);
      e.status = 504;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Wikimedia's policy asks every client to identify itself and a contact. */
export const USER_AGENT =
  process.env.CONTACT_EMAIL
    ? `AlcodeTrips/1.0 (${process.env.CONTACT_EMAIL})`
    : "AlcodeTrips/1.0 (https://github.com/almarar88/ideashelf)";
