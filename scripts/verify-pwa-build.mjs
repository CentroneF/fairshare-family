import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { isStaticPrecachePath, offlineDocument, pwaIconFiles } from "../src/lib/pwa-cache-policy.mjs";

const clientOutput = "dist/client";
const requiredManifest = {
  name: "FairShare Family",
  short_name: "FairShare",
  start_url: "/",
  scope: "/",
  display: "standalone",
};

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing required PWA output: ${path}`);
  }
}

const manifestPath = resolve(clientOutput, "manifest.webmanifest");
await requireFile(manifestPath);

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  throw new Error("PWA manifest is not valid JSON.");
}

for (const [key, value] of Object.entries(requiredManifest)) {
  if (manifest[key] !== value) throw new Error(`PWA manifest ${key} must be ${JSON.stringify(value)}.`);
}

const iconSources = manifest.icons?.map((icon) => icon.src.replace(/^\//, "")) ?? [];
for (const icon of pwaIconFiles) {
  if (!iconSources.includes(icon)) throw new Error(`PWA manifest does not declare ${icon}.`);
  await requireFile(resolve(clientOutput, icon));
}

const serviceWorkerPath = resolve(clientOutput, "sw.js");
await requireFile(serviceWorkerPath);
const serviceWorker = await readFile(serviceWorkerPath, "utf8");
const precacheMatch = serviceWorker.match(/const PRECACHE_URLS = (\[[^;]+\]);/);
if (!precacheMatch) throw new Error("PWA worker does not declare its precache policy.");

const precacheUrls = JSON.parse(precacheMatch[1]);
if (!precacheUrls.includes(`/${offlineDocument}`)) {
  throw new Error("PWA worker does not precache the neutral offline document.");
}
const fallbackMatch = serviceWorker.match(/const OFFLINE_DOCUMENT = ("[^"]+");/);
if (
  !fallbackMatch ||
  JSON.parse(fallbackMatch[1]) !== `/${offlineDocument}` ||
  !serviceWorker.includes("cache.match(OFFLINE_DOCUMENT)")
) {
  throw new Error("PWA worker does not use the precached neutral offline document as its navigation fallback.");
}
for (const url of precacheUrls) {
  const path = url.replace(/^\//, "");
  if (path !== offlineDocument && !isStaticPrecachePath(path)) {
    throw new Error(`PWA worker precaches a non-static resource: ${url}`);
  }
}

if (/(?:runtimeCaching|NetworkFirst|CacheFirst|StaleWhileRevalidate|NavigationRoute)/.test(serviceWorker)) {
  throw new Error("PWA worker contains an unsupported runtime cache rule.");
}

const listeners = new Map();
const cacheLookups = [];
const networkRequests = [];
let networkUnavailable = false;
runInNewContext(serviceWorker, {
  URL,
  Request,
  Response,
  self: {
    location: { origin: "https://fairshare.test" },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  },
  caches: {
    open: async () => ({
      match: async (request) => {
        const path = typeof request === "string" ? request : new URL(request.url).pathname;
        cacheLookups.push(path);
        return path === `/${offlineDocument}` ? new Response("offline fallback") : undefined;
      },
    }),
    keys: async () => [],
  },
  fetch: async (request) => {
    networkRequests.push(request);
    if (networkUnavailable) throw new Error("offline");
    return new Response("network");
  },
});

function invokeFetch(request) {
  let response;
  listeners.get("fetch")({
    request,
    respondWith(promise) {
      response = promise;
    },
  });
  return response;
}

if (invokeFetch(new Request("https://fairshare.test/api/expenses")) !== undefined) {
  throw new Error("PWA worker must not intercept API requests.");
}
if (invokeFetch(new Request("https://fairshare.test/expenses", { method: "POST" })) !== undefined) {
  throw new Error("PWA worker must not intercept mutation requests.");
}
const staticUrl = precacheUrls.find((url) => url !== `/${offlineDocument}`);
const staticResponse = invokeFetch(new Request(`https://fairshare.test${staticUrl}`));
if (staticResponse === undefined) {
  throw new Error("PWA worker must serve declared static precache assets through Cache Storage.");
}
await staticResponse;
if (cacheLookups.includes("/api/expenses")) {
  throw new Error("PWA worker must not look up API requests in Cache Storage.");
}
const navigationRequest = new Request("https://fairshare.test/dashboard");
Object.defineProperty(navigationRequest, "mode", { value: "navigate" });
await invokeFetch(navigationRequest);
if (!networkRequests.some((request) => request.cache === "no-store")) {
  throw new Error("PWA worker must fetch document navigations with no-store.");
}
networkUnavailable = true;
const offlineResponse = await invokeFetch(navigationRequest);
if ((await offlineResponse.text()) !== "offline fallback" || !cacheLookups.includes(`/${offlineDocument}`)) {
  throw new Error("PWA worker must return the precached offline document when navigation fails.");
}

const offlineHtml = await readFile(resolve(clientOutput, offlineDocument), "utf8");
if (!offlineHtml.includes('rel="manifest" href="/manifest.webmanifest"')) {
  throw new Error("Emitted document HTML does not link the PWA manifest.");
}
if (!offlineHtml.includes('name="theme-color" content="#0a0e1a"')) {
  throw new Error("Emitted document HTML does not declare the PWA theme color.");
}

console.log("PWA build output verified.");
