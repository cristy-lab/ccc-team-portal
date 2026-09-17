/* CCC Team Portal service worker.
 *
 * Bump CACHE_VERSION (and the ?v= query in index.html) on every release.
 * Rules:
 *   * Only same origin GET requests are handled. API calls are POST and are never cached.
 *   * Page navigations: network first, cached index.html when offline.
 *   * App shell files (css, js, manifest, icons, logo): served from the versioned cache.
 *   * PDF files: network first, cached copy only as an offline fallback.
 */
var CACHE_VERSION = "0.3.0-1";
var SHELL_CACHE = "ccc-shell-" + CACHE_VERSION;
var RUNTIME_CACHE = "ccc-runtime-" + CACHE_VERSION;
var ASSET_VERSION = "0.3.0";

var SHELL = [
  "./",
  "index.html",
  "app.css?v=" + ASSET_VERSION,
  "config.js?v=" + ASSET_VERSION,
  "i18n.js?v=" + ASSET_VERSION,
  "api.js?v=" + ASSET_VERSION,
  "app.js?v=" + ASSET_VERSION,
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-48.png",
  "img/logo.png",
  "img/mark.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // Cache files one by one so a missing image does not break the install.
      return Promise.all(SHELL.map(function (url) {
        return fetch(new Request(url, { cache: "reload" })).then(function (res) {
          if (res.ok) return cache.put(url, res);
        }).catch(function () { /* skip missing file */ });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf("ccc-") === 0 && key !== SHELL_CACHE && key !== RUNTIME_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function networkFirst(request, cacheName, fallbackUrl) {
  return fetch(request).then(function (res) {
    if (res && res.ok && res.type === "basic") {
      var copy = res.clone();
      caches.open(cacheName).then(function (cache) { cache.put(request, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: false }).then(function (hit) {
      if (hit) return hit;
      if (fallbackUrl) return caches.match(fallbackUrl);
      return Response.error();
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/api(\/|$)/.test(url.pathname)) return;

  if (/\.pdf$/i.test(url.pathname)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, null));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(function (res) {
      if (res && res.ok && !res.redirected && /(\/|\/index\.html)$/.test(url.pathname)) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (cache) { cache.put("index.html", copy); });
      }
      return res;
    }).catch(function () {
      return caches.match("index.html").then(function (hit) {
        return hit || caches.match("./");
      });
    }));
    return;
  }

  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (res) {
        if (res && res.ok && res.type === "basic" && /\.(png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname)) {
          var copy = res.clone();
          caches.open(RUNTIME_CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return res;
      });
    })
  );
});
