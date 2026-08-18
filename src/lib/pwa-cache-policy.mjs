export const offlineDocument = "offline/index.html";
export const pwaIconFiles = ["pwa-icon-192.png", "pwa-icon-512.png", "pwa-icon-512-maskable.png"];

const staticAssetPattern = /\.(?:css|js|mjs|png|svg|ico|woff2?)$/i;

export function isStaticPrecachePath(pathname) {
  const path = pathname.replace(/^\//, "");

  return (
    staticAssetPattern.test(path) &&
    !path.endsWith(".map") &&
    !path.endsWith("sw.js") &&
    !path.startsWith("workbox-") &&
    !path.startsWith("_worker") &&
    !path.startsWith("_routes")
  );
}

export function isNetworkOnlyRequest({ method, pathname, isSupabaseRequest = false }) {
  return method !== "GET" || pathname.startsWith("/api/") || pathname.startsWith("/auth/") || isSupabaseRequest;
}

export function usesOfflineFallback({ method, mode }) {
  return method === "GET" && mode === "navigate";
}
