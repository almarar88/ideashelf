import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ideashelf.liwabot",
  appName: "LiwaBot",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    backgroundColor: "#2b2724",
  },
};

export default config;
