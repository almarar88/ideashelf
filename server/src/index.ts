// Majlis AI hosted API.
// - Verifies the user's Supabase session (Bearer JWT)
// - Enforces the user's plan: allowed models, web search, monthly AI budget, daily message cap
// - Proxies /v1/messages to the Claude API (streaming passthrough) and meters real usage/cost
// - Receives RevenueCat webhooks to update plans; account deletion for store compliance
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";
import { addUsage, costUSD, emptyUsage, type UsageTotals } from "./pricing.js";
import { makeMeter } from "./meter.js";

const env = (k: string, d = "") => process.env[k] ?? d;
const ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY");
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const UPSTREAM = env("ANTHROPIC_UPSTREAM", "https://api.anthropic.com");
const MAX_CONCURRENT = Number(env("MAX_CONCURRENT", "4"));
const ADMINS = env("ADMIN_USERS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

interface Plan { id: string; name: string; price_usd: number; monthly_budget_usd: number; daily_messages: number; allowed_models: string[]; web_search: boolean; council: boolean; device_control: boolean; max_tokens: number; }
interface Profile { user_id: string; email: string | null; plan: string; plan_source: string | null; plan_expires_at: string | null; }

// ---------- caches ----------
const plansCache: { at: number; plans: Record<string, Plan> } = { at: 0, plans: {} };
async function getPlans(): Promise<Record<string, Plan>> {
  if (Date.now() - plansCache.at < 60_000 && Object.keys(plansCache.plans).length) return plansCache.plans;
  const { data, error } = await db.from("plans").select("*");
  if (error) throw error;
  plansCache.plans = Object.fromEntries((data as Plan[]).map((p) => [p.id, p]));
  plansCache.at = Date.now();
  return plansCache.plans;
}

const userCache = new Map<string, { at: number; user: { id: string; email: string | null } }>();
async function verifyToken(token: string): Promise<{ id: string; email: string | null } | null> {
  const c = userCache.get(token);
  if (c && Date.now() - c.at < 5 * 60_000) return c.user;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const user = { id: data.user.id, email: data.user.email ?? null };
  userCache.set(token, { at: Date.now(), user });
  if (userCache.size > 5000) userCache.clear();
  return user;
}

async function getProfile(user: { id: string; email: string | null }): Promise<Profile> {
  const { data } = await db.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  let p = data as Profile | null;
  if (!p) {
    await db.from("profiles").upsert({ user_id: user.id, email: user.email, plan: "free" });
    p = { user_id: user.id, email: user.email, plan: "free", plan_source: "default", plan_expires_at: null };
  }
  if (ADMINS.includes(user.id.toLowerCase()) || (user.email && ADMINS.includes(user.email.toLowerCase()))) p = { ...p, plan: "ultra", plan_source: "admin" };
  if (p.plan_expires_at && new Date(p.plan_expires_at).getTime() < Date.now() && p.plan_source === "revenuecat") p = { ...p, plan: "free" };
  return p;
}

const month = () => new Date().toISOString().slice(0, 7);
const day = () => new Date().toISOString().slice(0, 10);

async function getUsage(userId: string) {
  const [{ data: m }, { data: d }] = await Promise.all([
    db.from("usage_monthly").select("*").eq("user_id", userId).eq("month", month()).maybeSingle(),
    db.from("usage_daily").select("*").eq("user_id", userId).eq("day", day()).maybeSingle(),
  ]);
  return { month: month(), cost_usd: Number(m?.cost_usd ?? 0), requests: Number(m?.requests ?? 0), messages: Number(m?.messages ?? 0), day_messages: Number(d?.messages ?? 0) };
}

async function recordUsage(userId: string, model: string, u: UsageTotals, isUserMessage: boolean) {
  const cost = costUSD(model, u);
  await Promise.all([
    db.from("usage_events").insert({ user_id: userId, model, input_tokens: u.input, output_tokens: u.output, cache_read: u.cacheRead, cache_write: u.cacheWrite, web_searches: u.webSearches, cost_usd: cost, is_user_message: isUserMessage }),
    db.rpc("increment_usage", { p_user: userId, p_month: month(), p_day: day(), p_cost: cost, p_is_message: isUserMessage }),
  ]).catch((e) => console.error("recordUsage failed", e));
}

// ---------- RevenueCat ----------
const RC_SECRET = env("REVENUECAT_SECRET_KEY");
const RC_PRO = env("RC_ENTITLEMENT_PRO", "pro");
const RC_ULTRA = env("RC_ENTITLEMENT_ULTRA", "ultra");
function planFromEntitlements(ents: Record<string, { expires_date?: string | null }> | undefined): { plan: string; expires: string | null } {
  if (!ents) return { plan: "free", expires: null };
  const active = (id: string) => { const e = ents[id]; return e && (!e.expires_date || new Date(e.expires_date).getTime() > Date.now()); };
  if (active(RC_ULTRA)) return { plan: "ultra", expires: ents[RC_ULTRA].expires_date ?? null };
  if (active(RC_PRO)) return { plan: "pro", expires: ents[RC_PRO].expires_date ?? null };
  return { plan: "free", expires: null };
}
async function syncPlanFromRevenueCat(userId: string): Promise<void> {
  if (!RC_SECRET) return;
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${RC_SECRET}` } });
    if (!r.ok) return;
    const j = (await r.json()) as { subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> } };
    const { plan, expires } = planFromEntitlements(j.subscriber?.entitlements);
    await db.from("profiles").update({ plan, plan_source: "revenuecat", plan_expires_at: expires, updated_at: new Date().toISOString() }).eq("user_id", userId).neq("plan_source", "manual");
  } catch (e) { console.warn("revenuecat sync failed", e); }
}

// ---------- app ----------
const app = new Hono();
app.use("*", cors({ origin: (o) => o || "*", allowHeaders: ["Authorization", "Content-Type", "anthropic-version", "anthropic-beta", "anthropic-dangerous-direct-browser-access", "x-api-key", "x-stainless-arch", "x-stainless-lang", "x-stainless-os", "x-stainless-package-version", "x-stainless-retry-count", "x-stainless-runtime", "x-stainless-runtime-version", "x-stainless-timeout", "x-majlis-message"], exposeHeaders: ["request-id", "x-majlis-plan", "x-majlis-cost"], maxAge: 86400 }));

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

type Auth = { user: { id: string; email: string | null }; profile: Profile; plan: Plan };
async function auth(c: { req: { header: (k: string) => string | undefined } }): Promise<Auth | Response> {
  const h = c.req.header("Authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return new Response(JSON.stringify({ error: { type: "authentication_error", message: "Sign in required" } }), { status: 401, headers: { "content-type": "application/json" } });
  const user = await verifyToken(token);
  if (!user) return new Response(JSON.stringify({ error: { type: "authentication_error", message: "Session expired — sign in again" } }), { status: 401, headers: { "content-type": "application/json" } });
  const profile = await getProfile(user);
  const plans = await getPlans();
  return { user, profile, plan: plans[profile.plan] ?? plans["free"] };
}

app.get("/me", async (c) => {
  const a = await auth(c); if (a instanceof Response) return a;
  if (c.req.query("refresh") === "1") { await syncPlanFromRevenueCat(a.user.id); const p = await getProfile(a.user); a.profile = p; a.plan = (await getPlans())[p.plan] ?? a.plan; }
  const usage = await getUsage(a.user.id);
  return c.json({ user: a.user, plan: a.plan, plan_source: a.profile.plan_source, plan_expires_at: a.profile.plan_expires_at, usage, plans: Object.values(await getPlans()).sort((x, y) => x.price_usd - y.price_usd) });
});

app.post("/account/delete", async (c) => {
  const a = await auth(c); if (a instanceof Response) return a;
  await db.auth.admin.deleteUser(a.user.id);
  return c.json({ ok: true });
});

app.post("/webhooks/revenuecat", async (c) => {
  const expected = env("REVENUECAT_WEBHOOK_AUTH");
  if (expected && c.req.header("Authorization") !== expected) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json()) as { event?: { app_user_id?: string; original_app_user_id?: string } };
  const id = body.event?.app_user_id ?? body.event?.original_app_user_id;
  if (id) await syncPlanFromRevenueCat(id);
  return c.json({ ok: true });
});

const inflight = new Map<string, number>();

app.post("/v1/messages", async (c) => {
  const a = await auth(c); if (a instanceof Response) return a;
  const { user, plan } = a;
  const body = (await c.req.json()) as Record<string, unknown>;
  const isUserMessage = c.req.header("x-majlis-message") === "1";

  // ---- quota checks ----
  const usage = await getUsage(user.id);
  const err = (msg: string, code: string) => c.json({ error: { type: "quota_exceeded", code, message: msg, plan: plan.id, usage } }, 402);
  if (usage.cost_usd >= plan.monthly_budget_usd) return err("Monthly AI allowance used up", "monthly_budget");
  if (plan.daily_messages > 0 && isUserMessage && usage.day_messages >= plan.daily_messages) return err("Daily message limit reached", "daily_messages");
  if ((inflight.get(user.id) ?? 0) >= MAX_CONCURRENT) return c.json({ error: { type: "rate_limit_error", message: "Too many parallel requests" } }, 429);

  // ---- enforce plan on the request ----
  let model = String(body.model ?? "claude-sonnet-5");
  if (!plan.allowed_models.includes(model)) model = plan.allowed_models[plan.allowed_models.length - 1];
  body.model = model;
  if (typeof body.max_tokens === "number") body.max_tokens = Math.min(body.max_tokens as number, plan.max_tokens);
  if (Array.isArray(body.tools)) {
    body.tools = (body.tools as Array<Record<string, unknown>>).filter((t) => {
      const type = String(t.type ?? "");
      if (/^web_(search|fetch)/.test(type)) return plan.web_search;
      if (type === "computer_toolset_20260801") return plan.device_control;
      return true;
    });
    if ((body.tools as unknown[]).length === 0) delete body.tools;
  }
  if (model === "claude-haiku-4-5") { delete body.output_config; delete body.thinking; }

  // ---- forward ----
  const headers: Record<string, string> = { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": c.req.header("anthropic-version") ?? "2023-06-01" };
  const beta = c.req.header("anthropic-beta"); if (beta) headers["anthropic-beta"] = beta;
  inflight.set(user.id, (inflight.get(user.id) ?? 0) + 1);
  const done = () => inflight.set(user.id, Math.max(0, (inflight.get(user.id) ?? 1) - 1));
  let up: Response;
  try {
    up = await fetch(`${UPSTREAM}/v1/messages`, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) { done(); return c.json({ error: { type: "api_error", message: "Upstream unreachable: " + String(e) } }, 502); }

  const passHeaders = new Headers();
  for (const k of ["content-type", "request-id", "anthropic-ratelimit-requests-remaining"]) { const v = up.headers.get(k); if (v) passHeaders.set(k, v); }
  passHeaders.set("x-majlis-plan", plan.id);

  if (!up.ok || !body.stream) {
    const text = await up.text(); done();
    if (up.ok) {
      try { const j = JSON.parse(text) as { usage?: Record<string, unknown> }; const u = emptyUsage(); addUsage(u, j.usage); await recordUsage(user.id, model, u, isUserMessage); passHeaders.set("x-majlis-cost", costUSD(model, u).toFixed(5)); } catch { /* ignore */ }
    }
    return new Response(text, { status: up.status, headers: passHeaders });
  }

  // Streaming: pass bytes through untouched, meter from the SSE events as they fly by.
  const totals = emptyUsage();
  const meter = makeMeter(totals, () => { done(); void recordUsage(user.id, model, totals, isUserMessage); });
  return new Response(up.body!.pipeThrough(meter), { status: 200, headers: passHeaders });
});

const port = Number(env("PORT", "8080"));
serve({ fetch: app.fetch, port }, () => console.log(`Majlis server listening on :${port}`));
