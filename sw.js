/* CCC Team Portal service worker.
 *
 * Bump CACHE_VERSION (and the ?v= query in index.html) on every release.
 * Rules:
 *   * Only same origin GET requests are handled. API calls are POST and are never cached.
 *   * Page navigations: network first, cached index.html when offline.
 *   * App shell files (css, js, manifest, icons, logo, the design art and the CEO photo): served from the versioned cache.
 *     The two lazily loaded bundles (Education and the CEO letter paper) are in there too, so a phone that
 *     goes offline can still open Trainings and the letter. The page never asks for them at
 *     start, which is what start up time depends on, but this worker does save them during
 *     install, so they cost about 46 KB once per release even for somebody who never opens them.
 *   * PDF files: network first, cached copy only as an offline fallback.
 *   * Training packs (trainings/*.json): network first, with the cached copy as the offline
 *     fallback, so an opened training still reads offline and a corrected pack is picked up at
 *     once. Cache first would have served the old bytes for ever: the phone would keep sending
 *     the old fingerprint, the backend would keep answering PACK_CHANGED, and the person would
 *     be stuck on "This training was updated" until the next release.
 */
var CACHE_VERSION = "0.3.3-2";
var SHELL_CACHE = "ccc-shell-" + CACHE_VERSION;
var RUNTIME_CACHE = "ccc-runtime-" + CACHE_VERSION;
var ASSET_VERSION = "0.3.3";

var SHELL = [
  "./",
  "index.html",
  "app.css?v=" + ASSET_VERSION,
  "config.js?v=" + ASSET_VERSION,
  "i18n.js?v=" + ASSET_VERSION,
  "api.js?v=" + ASSET_VERSION,
  "app.js?v=" + ASSET_VERSION,
  "edu_i18n.js?v=" + ASSET_VERSION,
  "edu.js?v=" + ASSET_VERSION,
  "edu.css?v=" + ASSET_VERSION,
  "letter.css?v=" + ASSET_VERSION,
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-48.png",
  "img/logo.png",
  "img/mark.png",
  "img/lattice-ink.svg",
  "img/lattice-glow.svg",
  "img/keypad-gem.svg",
  "img/keypad-gem-dark.svg",
  "img/hero-gem.svg",
  "img/hawaii-sunset.svg",
  "img/california.svg",
  "img/tennessee.svg",
  "img/georgia.svg",
  "img/florida.svg",
  "img/hibiscus.svg",
  "img/ceo-cristy.jpg",
  "img/paper-grain.svg",
  "img/letter-crest.svg",
  "img/signature-line.svg"
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

  if (/\.pdf$/i.test(url.pathname) || /\/trainings\/.+\.json$/i.test(url.pathname)) {
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
