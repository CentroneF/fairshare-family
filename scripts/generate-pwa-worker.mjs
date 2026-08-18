import { generateSW } from "workbox-build";

const clientOutput = "dist/client";

const { count, size, warnings } = await generateSW({
  globDirectory: clientOutput,
  globPatterns: ["**/*.{css,js,mjs,png,svg,ico,woff,woff2}"],
  globIgnores: ["**/*.map", "**/*.html", "_worker.js", "_routes.json", "sw.js", "workbox-*.js"],
  swDest: `${clientOutput}/sw.js`,
  runtimeCaching: [],
  navigateFallback: undefined,
  skipWaiting: true,
  clientsClaim: true,
});

for (const warning of warnings) {
  console.warn(`PWA worker warning: ${warning}`);
}

console.log(`PWA worker precached ${count} static assets (${size} bytes).`);
