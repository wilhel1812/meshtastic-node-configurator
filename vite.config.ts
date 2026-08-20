import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/meshtastic-node-configurator/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Meshtastic Node Configurator",
        short_name: "Node Configurator",
        description: "Create and inspect native Meshtastic node profiles.",
        theme_color: "#087f68",
        background_color: "#f5f7f7",
        display: "standalone",
        start_url: "/meshtastic-node-configurator/",
        scope: "/meshtastic-node-configurator/",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallback: "/meshtastic-node-configurator/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], exclude: ["e2e/**", "node_modules/**", "dist/**"] },
});
