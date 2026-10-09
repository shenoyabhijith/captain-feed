import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Workbox } from "workbox-window";
import {
  isInstallChromeSuppressed,
  syncStandaloneDomFlag,
} from "./installGate.js";

// Paint-time standalone flag so CSS can hide install chrome before React hydrates.
syncStandaloneDomFlag(document.documentElement, isInstallChromeSuppressed());

import App from "./App.jsx";
/* coss.css loads Inter Variable + Geist Mono; styles.css maps feed chrome to Inter */
import "./coss.css";
import "./palette.css";
import "./styles.css";
import "./liquid-glass.css";

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

function registerPwa() {
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  const wb = new Workbox(swUrl, {
    scope: import.meta.env.BASE_URL,
    // Bypass HTTP cache on sw.js (GH Pages max-age=600) so updates are discovered
    updateViaCache: "none",
  });

  wb.addEventListener("activated", (event) => {
    if (event.isUpdate || event.isExternal) {
      window.location.reload();
    }
  });

  wb.register({ immediate: true }).then((registration) => {
    if (!registration) return;

    const checkForUpdate = () => {
      registration.update().catch(() => {});
    };

    setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
  });
}

registerPwa();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
