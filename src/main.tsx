import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./store/store";
import { AuthProvider } from "./server/auth";
import { SyncBridge } from "./server/SyncBridge";
import "./index.css";

// الاتجاه واللغة يُضبطان برمجياً كي تعمل النسخة المستضافة خارج index.html أيضاً
document.documentElement.dir = "rtl";
document.documentElement.lang = "ar";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <StoreProvider>
        <SyncBridge>
          <App />
        </SyncBridge>
      </StoreProvider>
    </AuthProvider>
  </StrictMode>,
);
