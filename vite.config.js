import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/captain-feed/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "data/feed.json"],
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
            purpose: "any maskable"
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        navigateFallback: "/captain-feed/index.html",
        runtimeCaching: [
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
  build: {
    outDir: "docs",
    emptyOutDir: true
  }
});
