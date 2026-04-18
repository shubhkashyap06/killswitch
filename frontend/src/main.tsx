import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfills for Vite + RainbowKit/Wagmi
if (typeof window !== "undefined") {
  (window as any).global = window;
  (window as any).process = { env: {} };
}

createRoot(document.getElementById("root")!).render(<App />);
