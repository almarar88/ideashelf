import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the built web app in a native Android shell. The web assets
 * are bundled inside the APK (webDir: dist), so the game runs with no network
 * at all — which is the point, since the local backend and the offline
 * question bank need nothing but the device.
 */
const config: CapacitorConfig = {
  appId: "ai.maskoff.app",
  appName: "MaskOff AI",
  webDir: "dist",
  android: {
    // The design is a pure-black OLED page; letting the WebView paint white
    // behind it causes a flash on every navigation.
    backgroundColor: "#000000",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlaysWebView: false,
    },
  },
};

export default config;
