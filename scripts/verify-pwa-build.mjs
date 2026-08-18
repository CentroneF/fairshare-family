import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
for (const url of precacheUrls) {
  const path = url.replace(/^\//, "");
  if (path !== offlineDocument && !isStaticPrecachePath(path)) {
    throw new Error(`PWA worker precaches a non-static resource: ${url}`);
  }
}

if (/(?:runtimeCaching|NetworkFirst|CacheFirst|StaleWhileRevalidate|NavigationRoute)/.test(serviceWorker)) {
  throw new Error("PWA worker contains an unsupported runtime cache rule.");
}

const offlineHtml = await readFile(resolve(clientOutput, offlineDocument), "utf8");
if (!offlineHtml.includes('rel="manifest" href="/manifest.webmanifest"')) {
  throw new Error("Emitted document HTML does not link the PWA manifest.");
}
if (!offlineHtml.includes('name="theme-color" content="#0a0e1a"')) {
  throw new Error("Emitted document HTML does not declare the PWA theme color.");
}

console.log("PWA build output verified.");
