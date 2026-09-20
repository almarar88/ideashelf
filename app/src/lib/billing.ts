// Subscriptions through RevenueCat (Google Play Billing / App Store / RevenueCat Test Store).
// Native only. The Capacitor plugin bundles the native purchases SDK (Gradle dependency is added
// automatically by `npx cap sync`), so no manual Gradle or Kotlin code is needed.
import { Capacitor } from "@capacitor/core";
import { ENTITLEMENT_PRO, ENTITLEMENT_ULTRA, REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from "../config";

export type Term = "monthly" | "yearly" | "lifetime" | "other";
export interface Offer { id: string; planId: "pro" | "ultra"; term: Term; title: string; priceString: string; pkg: unknown; }

const key = () => (Capacitor.getPlatform() === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY);
export const billingAvailable = () => Capacitor.isNativePlatform() && Boolean(key());
let configuredFor: string | null = null;

async function rc() { return (await import("@revenuecat/purchases-capacitor")).Purchases; }
async function rcUI() { try { return (await import("@revenuecat/purchases-capacitor-ui")).RevenueCatUI; } catch { return null; } }

/** Configure once per signed-in user; the Supabase user id becomes the RevenueCat app user id so the server can match webhooks. */
export async function configureBilling(userId: string): Promise<void> {
  if (!billingAvailable()) return;
  const P = await rc();
  if (configuredFor === null) {
    // Equivalent of `Purchases.logLevel = LogLevel.DEBUG` in the native SDK — only while using a Test Store key.
    if (key().startsWith("test_")) { const { LOG_LEVEL } = await import("@revenuecat/purchases-capacitor"); await P.setLogLevel({ level: LOG_LEVEL.DEBUG }).catch(() => undefined); }
    await P.configure({ apiKey: key(), appUserID: userId });
  } else if (configuredFor !== userId) {
    await P.logIn({ appUserID: userId });
  }
  configuredFor = userId;
}

export async function logoutBilling(): Promise<void> {
  if (!billingAvailable() || configuredFor === null) return;
  try { const P = await rc(); await P.logOut(); } catch { /* anonymous already */ }
  configuredFor = null;
}

function termOf(packageType: string, productId: string): Term {
  const t = String(packageType).toUpperCase(); const p = productId.toLowerCase();
  if (t === "LIFETIME" || p.includes("lifetime")) return "lifetime";
  if (t === "ANNUAL" || p.includes("year") || p.includes("annual")) return "yearly";
  if (t === "MONTHLY" || p.includes("month")) return "monthly";
  return "other";
}

/** Packages from the current offering (monthly / yearly / lifetime), mapped to a plan. */
export async function getOffers(): Promise<Offer[]> {
  if (!billingAvailable()) return [];
  const P = await rc();
  const { current } = await P.getOfferings();
  if (!current) return [];
  const order: Term[] = ["monthly", "yearly", "lifetime", "other"];
  return current.availablePackages
    .map((pkg) => ({ id: pkg.identifier, planId: (pkg.product.identifier.toLowerCase().includes("ultra") ? "ultra" : "pro") as "pro" | "ultra", term: termOf(pkg.packageType, pkg.product.identifier), title: pkg.product.title, priceString: pkg.product.priceString, pkg }))
    .sort((a, b) => order.indexOf(a.term) - order.indexOf(b.term));
}

type Ents = Record<string, unknown>;
const hasPro = (active: Ents) => Boolean(active[ENTITLEMENT_PRO] || active[ENTITLEMENT_ULTRA] || active["pro"] || active["ultra"]);

/** Current entitlement state straight from RevenueCat (the server is still the source of truth for plan limits). */
export async function checkEntitlement(): Promise<{ pro: boolean; ultra: boolean }> {
  if (!billingAvailable() || configuredFor === null) return { pro: false, ultra: false };
  const P = await rc();
  const { customerInfo } = await P.getCustomerInfo();
  const a = customerInfo.entitlements.active as Ents;
  return { pro: hasPro(a), ultra: Boolean(a[ENTITLEMENT_ULTRA] || a["ultra"]) };
}

export async function purchase(offer: Offer): Promise<boolean> {
  const P = await rc();
  try {
    const r = await P.purchasePackage({ aPackage: offer.pkg as Parameters<typeof P.purchasePackage>[0]["aPackage"] });
    return hasPro(r.customerInfo.entitlements.active as Ents);
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return false;
    throw new Error(err.message ?? String(e));
  }
}

export async function restore(): Promise<boolean> {
  const P = await rc();
  const r = await P.restorePurchases();
  return hasPro(r.customerInfo.entitlements.active as Ents);
}

/** RevenueCat's dashboard-designed paywall (Paywalls v2). Returns true if the user ended up entitled. */
export async function presentNativePaywall(): Promise<boolean | null> {
  const UI = await rcUI();
  if (!UI || !billingAvailable()) return null;
  const r = await UI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: ENTITLEMENT_PRO, displayCloseButton: true });
  return ["PURCHASED", "RESTORED", "NOT_PRESENTED"].includes(String(r.result));
}

/** Customer Center: manage / cancel / refund / restore, designed in the RevenueCat dashboard. */
export async function presentCustomerCenter(): Promise<boolean> {
  const UI = await rcUI();
  if (!UI || !billingAvailable()) return false;
  await UI.presentCustomerCenter();
  return true;
}
