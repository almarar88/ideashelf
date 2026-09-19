// Subscriptions through RevenueCat (Google Play Billing / App Store). Native only.
import { Capacitor } from "@capacitor/core";
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from "../config";

export interface Offer { id: string; planId: "pro" | "ultra"; title: string; priceString: string; period: string; pkg: unknown; }

const key = () => (Capacitor.getPlatform() === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY);
export const billingAvailable = () => Capacitor.isNativePlatform() && Boolean(key());
let configuredFor: string | null = null;

async function rc() { return (await import("@revenuecat/purchases-capacitor")).Purchases; }

export async function configureBilling(userId: string): Promise<void> {
  if (!billingAvailable() || configuredFor === userId) return;
  const P = await rc();
  await P.configure({ apiKey: key(), appUserID: userId });
  configuredFor = userId;
}

/** Packages from the current offering, mapped to plan ids by product id (majlis_pro_*, majlis_ultra_*). */
export async function getOffers(): Promise<Offer[]> {
  if (!billingAvailable()) return [];
  const P = await rc();
  const { current } = await P.getOfferings();
  if (!current) return [];
  return current.availablePackages.map((pkg) => {
    const pid = pkg.product.identifier.toLowerCase();
    const planId: "pro" | "ultra" = pid.includes("ultra") ? "ultra" : "pro";
    return { id: pkg.identifier, planId, title: pkg.product.title, priceString: pkg.product.priceString, period: pkg.packageType, pkg };
  });
}

export async function purchase(offer: Offer): Promise<boolean> {
  const P = await rc();
  try {
    const r = await P.purchasePackage({ aPackage: offer.pkg as Parameters<typeof P.purchasePackage>[0]["aPackage"] });
    const ents = r.customerInfo.entitlements.active;
    return Boolean(ents["pro"] || ents["ultra"]);
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return false;
    throw new Error(err.message ?? String(e));
  }
}

export async function restore(): Promise<boolean> {
  const P = await rc();
  const r = await P.restorePurchases();
  const ents = r.customerInfo.entitlements.active;
  return Boolean(ents["pro"] || ents["ultra"]);
}
