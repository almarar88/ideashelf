import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.athar.chronoai",
  appName: "Chrono AI",
  // نسخة بناء بمسارات نسبية، لأن التطبيق يُقدَّم من داخل الجهاز لا من مجلد فرعي
  webDir: "dist-app",
  android: {
    // لون خلفية الـ WebView قبل ظهور الواجهة — يطابق أرضية الوضع النهاري
    backgroundColor: "#c4c7da",
  },
};

export default config;
