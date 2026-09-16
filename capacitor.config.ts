import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.digitalcodelibrary.app",
  appName: "مكتبة الكود الرقمية",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#2b2826",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
