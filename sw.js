/* CCC Team Portal service worker.
 *
 * Bump CACHE_VERSION (and the ?v= query in index.html) on every release.
 * Rules:
 *   * Only same origin GET requests are handled. API calls are POST and are never cached.
 *   * Page navigations: network first, cached index.html when offline.
 *   * App shell files (css, js, manifest, icons, logo, the design art and the CEO photo): served from the versioned cache.
 *     The lazily loaded bundles (Education, the CEO letter paper, Messages, the birthday celebration and
 *     Push) are in there too, so a phone that goes offline can still open them. The
 *     page never asks for them at start, which is what start up time depends on, but this worker does
 *     save them during install, so they cost about 224 KB once per release even for somebody who never
 *     opens them (measured in 0.4.0; it was written as 216 KB before anybody counted). Moving bytes
 *     into one of these five files therefore saves no phone anything: it only moves them from the
 *     start up fetch into the install fetch. Messages itself only ever travels in POST answers,
 *     which this worker never touches.
 *   * PDF files: network first, cached copy only as an offline fallback.
 *   * Training packs (trainings/*.json): network first, the cached copy offline, so a corrected pack is
 *     picked up at once (cache first kept the old bytes, and PACK_CHANGED, until the next release).
 *   * Videos and captions: network only, never stored, a Range request untouched (0.3.5).
 *   * vendor/firebase/ files (0.3.7): kept once seen with their ?v=, never in SHELL.
 *   * The Status bundle (0.3.9), web/status_i18n.js, web/status.js and web/status.css: kept once seen
 *     with their ?v=, never in SHELL. One person in the company can open that screen, so 76 phones
 *     should not download it at every release the way they download the bundles above.
 *   * The States bundle (0.4.0), web/states_i18n.js, web/states.js and web/states.css: the same rule.
 *   * The Preview bundle (0.4.2), web/preview.js and web/preview.css: the same rule again.
 *   * The Globe bundle (0.4.1), web/globe.js, web/globe.css and web/img/globe/world.json: the same
 *     rule again, and never in SHELL. Home asks for them after it has already drawn.
 *   * web/img/states/ (0.4.0) is never in SHELL: 30 pictures, about 7.2 MB, must not be pushed to every
 *     phone at every release. They are kept in the runtime cache after a panel has opened once.
 *   * A push (0.3.7) shows exactly one notice, from data.title and data.body only. A tap opens its chat.
 */
var CACHE_VERSION = "0.4.6";
var SHELL_CACHE = "ccc-shell-" + CACHE_VERSION;
var RUNTIME_CACHE = "ccc-runtime-" + CACHE_VERSION;
var ASSET_VERSION = "0.4.6";
var OPEN_RE = /^([do]:[A-Za-z0-9_.]{1,64}|g:[a-z0-9]+(-[a-z0-9]+)*)$/;

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
  "party.css?v=" + ASSET_VERSION,
  "messages_i18n.js?v=" + ASSET_VERSION,
  "messages.js?v=" + ASSET_VERSION,
  "messages.css?v=" + ASSET_VERSION,
  "push_i18n.js?v=" + ASSET_VERSION,
  "push.js?v=" + ASSET_VERSION,
  "push.css?v=" + ASSET_VERSION,
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
  if (request.headers.has("range") || /^(video|audio|track)$/.test(request.destination) ||
    /\.(mp4|m4v|webm|mov|vtt)$/i.test(url.pathname)) return;

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
        if (res && res.ok && res.type === "basic" && (/\.(png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname) ||
          /\/globe\/world\.json$/.test(url.pathname) ||
          ((/\/vendor\/firebase\//.test(url.pathname) || /\/(status|states|globe|preview)(_i18n)?\.(js|css)$/.test(url.pathname)) &&
            /[?&]v=/.test(url.search)))) {
          var copy = res.clone();
          caches.open(RUNTIME_CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return res;
      });
    })
  );
});

/* Even an empty or broken push shows one notice: iPhone ends a subscription whose pushes show nothing. */
function tell(msg) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    list.forEach(function (c) { c.postMessage(msg); });
  });
}

self.addEventListener("push", function (event) {
  var d = {};
  try { d = (event.data && event.data.json().data) || {}; } catch (e) { d = {}; }
  var open = OPEN_RE.test(d.open || "") && String(d.open).length <= 66 ? d.open : "";
  event.waitUntil(self.registration.showNotification(String(d.title || "CCC Team Portal").slice(0, 60), {
    body: String(d.body || "").slice(0, 120), tag: open ? "ccc-" + open : "ccc", renotify: true,
    icon: "icons/icon-192.png", lang: d.lang === "es" ? "es" : "en", data: { open: open }
  }).then(function () { return tell({ type: "ccc-push", open: open }); }));
});

self.addEventListener("notificationclick", function (event) {
  var n = event.notification, o = n.data && n.data.open, open = OPEN_RE.test(o || "") ? o : "";
  n.close();
  var scope = self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    var win = list.filter(function (c) { return c.url.indexOf(scope) === 0; })[0];
    if (!win) return self.clients.openWindow(new URL(open ? "./#/messages?open=" + encodeURIComponent(open) : "./#/home", scope).href);
    win.postMessage({ type: "ccc-open", open: open });
    return win.focus && win.focus();
  }));
});

self.addEventListener("pushsubscriptionchange", function (event) {
  event.waitUntil(tell({ type: "ccc-sub" }));
});
