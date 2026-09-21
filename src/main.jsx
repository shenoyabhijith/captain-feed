import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import {
  isInstallChromeSuppressed,
  syncStandaloneDomFlag,
} from "./installGate.js";

// Paint-time standalone flag so CSS can hide install chrome before React hydrates.
syncStandaloneDomFlag(document.documentElement, isInstallChromeSuppressed());

import App from "./App.jsx";
import "./styles.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
