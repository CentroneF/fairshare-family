import { getManifest } from "workbox-build";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isStaticPrecachePath, offlineDocument } from "../src/lib/pwa-cache-policy.mjs";

const clientOutput = "dist/client";
const offlineRevision = createHash("sha256")
  .update(await readFile(resolve(clientOutput, offlineDocument)))
  .digest("hex");

const { count, size, warnings, manifestEntries } = await getManifest({
  globDirectory: clientOutput,
  globPatterns: ["**/*"],
  globIgnores: ["**/*.map", "**/*.html"],
  additionalManifestEntries: [{ url: offlineDocument, revision: offlineRevision }],
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.filter(({ url }) => url === offlineDocument || isStaticPrecachePath(url)),
      warnings: [],
    }),
  ],
});

const cacheName = `fairshare-static-${createHash("sha256").update(JSON.stringify(manifestEntries)).digest("hex")}`;
const precacheUrls = manifestEntries.map(({ url }) => `/${url}`);

await writeFile(
  resolve(clientOutput, "sw.js"),
  `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};
const OFFLINE_DOCUMENT = "/${offlineDocument}";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("fairshare-static-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(new Request(request, { cache: "no-store" })).catch(() =>
        caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_DOCUMENT)),
      ),
    );
    return;
  }

  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(request))
      .then((cached) => cached ?? fetch(new Request(request, { cache: "no-store" }))),
  );
});
`,
);

for (const warning of warnings) {
  console.warn(`PWA worker warning: ${warning}`);
}

console.log(`PWA worker precached ${count} static assets (${size} bytes).`);
