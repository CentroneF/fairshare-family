import { getManifest } from "workbox-build";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const clientOutput = "dist/client";
const offlineDocument = "offline/index.html";
const offlineRevision = createHash("sha256")
  .update(await readFile(resolve(clientOutput, offlineDocument)))
  .digest("hex");

const { count, size, warnings, manifestEntries } = await getManifest({
  globDirectory: clientOutput,
  globPatterns: ["**/*.{css,js,mjs,png,svg,ico,woff,woff2}"],
  globIgnores: ["**/*.map", "**/*.html", "_worker.js", "_routes.json", "sw.js", "workbox-*.js"],
  additionalManifestEntries: [{ url: offlineDocument, revision: offlineRevision }],
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
