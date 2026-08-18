// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import { VitePWA } from "vite-plugin-pwa";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        injectRegister: false,
        registerType: "autoUpdate",
        manifest: {
          name: "FairShare Family",
          short_name: "FairShare",
          start_url: "/",
          scope: "/",
          display: "standalone",
          theme_color: "#0a0e1a",
          background_color: "#0a0e1a",
          icons: [
            {
              src: "/pwa-icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa-icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    ssr: {
      noExternal: ["react", "react-dom", "react-dom/server"],
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
