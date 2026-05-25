import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  server: { host: true, port: 5173 },
  build: { target: "es2020" },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "오늘뽁 · Todapop",
        short_name: "오늘뽁",
        description: "뽁뽁 터뜨려서 스트레스 날리기",
        theme_color: "#7AE5E5",
        background_color: "#E6F9FA",
        display: "standalone",
        orientation: "portrait",
        scope: "./",
        start_url: "./",
        lang: "ko",
        categories: ["games", "health"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/hangeul\.pstatic\.net\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "nanum-font", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
});
