import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initBackend } from "./backend";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

// The backend must exist before any context reads it.
void initBackend().then(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
