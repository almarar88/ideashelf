import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ideashelf.partnerhub",
  appName: "PartnerHub",
  webDir: "dist",
  android: { allowMixedContent: false, backgroundColor: "#4B5343" },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#4B5343", showSpinner: false },
    StatusBar: { style: "DARK", backgroundColor: "#4B5343" },
  },
};

export default config;
