package com.ideashelf.partnerhub;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

/** Compact snapshot the web layer syncs so native code (widget, worker) can read it without the WebView. */
public final class Store {
    private static final String PREFS = "partnerhub_native";
    private Store() {}

    public static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    public static void saveSnapshot(Context c, String json) {
        prefs(c).edit().putString("snapshot", json).putLong("snapshotAt", System.currentTimeMillis()).apply();
    }

    public static JSONObject snapshot(Context c) {
        try { return new JSONObject(prefs(c).getString("snapshot", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    public static boolean isArabic(Context c) { return !"en".equals(snapshot(c).optString("lang", "ar")); }
}
