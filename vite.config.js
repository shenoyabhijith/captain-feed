import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/captain-feed/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // App registers via workbox-window with updateViaCache: "none"
      injectRegister: false,
      includeAssets: [
        "favicon.ico",
        "favicon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-192-maskable.png",
        "icons/icon-512-maskable.png",
        "icons/apple-touch-icon.png",
        "icons/mark-28.png",
        "icons/mark-28-light.png",
        "icons/mark-28-dark.png",
        "icons/mark-56.png",
        "data/feed.json",
        "data/finances-ledger.json"
      ],
      manifest: {
        name: "Captain Feed",
        short_name: "Captain Feed",
        description: "Daily doses: books, tax, trends, AWS, deals, gym.",
        theme_color: "#d4542a",
        background_color: "#f4f1ec",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/captain-feed/",
        scope: "/captain-feed/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // Explicit autoUpdate activation (also set by registerType, kept for clarity)
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Disable Cache-First NavigationRoute / createHandlerBoundToURL sticky shell
        navigateFallback: null,
        // Do not map "/captain-feed/" → precached index.html (would bypass NetworkFirst)
        directoryIndex: null,
        // Keep hashed JS/CSS/icons in precache; HTML shell uses NetworkFirst runtime cache
        globIgnores: ["**/index.html"],
        runtimeCaching: [
          {
            // Navigations + index.html: prefer network so deploys activate without ?cb=
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" ||
              url.pathname === "/captain-feed/" ||
              url.pathname === "/captain-feed/index.html",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-shell",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          },
          {
            urlPattern: /\/captain-feed\/data\/feed\.json.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "feed-json",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /\/captain-feed\/data\/finances-ledger\.json.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "finances-ledger-json",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /^https:\/\/picsum\.photos\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "picsum",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 14 }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "docs",
    emptyOutDir: true
  }
});
