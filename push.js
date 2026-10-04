/* CCC Team Portal Push (0.3.7), fetched with push_i18n.js and push.css: the notice cards and panel, the
 * Firebase adapter (the SDK only from web/vendor/firebase/) and the add to home screen card of 0.3.6.
 * Permission only inside a tap. Kept on the phone: ccc.push:<person id>, nothing else (docs/API.md 15). */
(function (root) {
  "use strict";

  var doc = root.document, nav = root.navigator, P = root.CCCPortal, H = root.CCCHelpers, DAY = 864e5, A2 = "ccc.a2hs_dismissed";
  var PEND = "ccc.push.pending", PEND_KEEP = 90 * DAY, PEND_MAX = 5;
  var HERE = ((doc.currentScript && doc.currentScript.src) || "").replace(/[^/]*$/, "");
  var TEXT = { unavailable: "push_unavailable", old_ios: "push_old_ios", unsupported: "push_unsupported", blocked: "push_blocked" };
  // sdk: 0 not asked, 1 on its way, 2 ready, 3 did not load (this app session), 4 not supported here.
  var sdk = 0, sdkP = null, busy = false, note = "", noteAt = 0, failed = false, quick = false, pre = false, home = 0, boxes = [];

  function t(k, v) { return P.t(k, v); }
  function el(tag, attrs, kids) { return P.h(tag, attrs, kids); }
  function noop() {}
  function fb() { var f = (root.CCC_CONFIG || {}).FIREBASE; return f && typeof f.sdk === "string" && f.sdk && f.config ? f : null; }
  function key(id) { return "ccc.push:" + (id || (P.state.person || {}).id); }
  function saved(id) { var v = H.store.getJSON(key(id)); return v && typeof v === "object" ? v : {}; }
  function save(v) { H.store.setJSON(key(), v); }
  function dash() { return (P.state.dash && P.state.dash.messages) || {}; }
  /* The install state and the 0.3.6 card ask for the same thing, so one "Not now" covers both. */
  function quiet() {
    var s = saved();
    return !!s.off || (+s.dismissed_until || 0) > Date.now() || (state() === "install" && H.store.get(A2) === "1");
  }
  function say(k) { note = k; noteAt = Date.now(); }
  function api(a, body) { body.token = body.token || P.state.token; return P.api(a, body); }
  function tail(sub) { return sub && sub.endpoint ? String(sub.endpoint).slice(-24) : ""; }
  function wait() { return Promise.race([nav.serviceWorker.ready, new Promise(function (ok, no) { root.setTimeout(no, 1e4); })]); }
  function top() { try { return root.top === root && root.isSecureContext !== false; } catch (e) { return false; } }

  /* First match wins: hidden, unavailable, install, old_ios, unsupported, blocked, on, ready. */
  function state() {
    var m = dash(), N = root.Notification, s = saved();
    if (!P.state.token || m.enabled !== true || m.push !== true || (root.CCC_CONFIG || {}).API_MODE !== "http") return "hidden";
    if (!fb() || sdk === 3) return "unavailable";
    if (P.ios() && !P.standalone()) return "install";
    if (P.ios() && !root.PushManager) return "old_ios";
    if (!nav.serviceWorker || !root.PushManager || !N || !root.indexedDB || !top() || sdk === 4) return "unsupported";
    return N.permission === "denied" ? "blocked" : s.token && !s.off ? "on" : "ready";
  }

  function device() {
    var ua = nav.userAgent || "";
    return P.ios() ? (/iPhone|iPod/.test(ua) ? "iphone" : "ipad") : /Android/i.test(ua) ? "android" : P.phone() ? "other" : "computer";
  }

  /* The two vendored files in order, then the app and its messaging, once per app session. */
  function loadSdk() {
    var f = fb(), left = 2;
    if (sdkP) return sdkP;
    sdk = 1;
    sdkP = new Promise(function (ok, no) {
      ["firebase-app-compat.js", "firebase-messaging-compat.js"].forEach(function (name) {
        var s = el("script", { src: HERE + "vendor/firebase/" + name + "?v=" + encodeURIComponent(f.sdk), on: { load: function () { if (!--left) ok(); }, error: no } });
        s.async = false;
        doc.head.appendChild(s);
      });
    }).then(function () {
      var F = root.firebase;
      if (F.messaging.isSupported && !F.messaging.isSupported()) throw (sdk = 4);
      sdk = 2;
      return F.messaging(F.apps && F.apps.length ? F.apps[0] : F.initializeApp(f.config));
    });
    sdkP.catch(function () {
      if (sdk !== 4) sdk = 3;
      redraw();
    });
    return sdkP;
  }

  /* A token for the portal's own worker (sw.js); vapidKey empty is the SDK's own key. */
  function token() {
    return loadSdk().then(function (m) {
      return wait().then(function (reg) {
        return m.getToken({ serviceWorkerRegistration: reg, vapidKey: fb().vapidKey || undefined }).then(function (tok) {
          if (!tok) throw tok;
          return reg.pushManager.getSubscription().then(function (sub) { return { tok: tok, ep: tail(sub), m: m }; });
        });
      });
    });
  }

  /* deleteToken, only where the SDK cannot ask for permission itself (its getToken does when it is default). */
  function drop() {
    var N = root.Notification;
    if (fb() && sdk < 3 && N && N.permission === "granted" && nav.serviceWorker) token().then(function (x) { return x.m.deleteToken(); }).catch(noop);
  }

  function register(x, replaces) {
    var s = saved(), office = dash().role === "office", body = { push_token: x.tok, device: device(), lang: P.state.lang };
    if (office) {
      body.inbox_alerts = s.inbox !== false;
      body.group_alerts = s.groups !== false;
    }
    if (replaces && replaces !== x.tok) body.replaces = replaces;
    return api("push_register", body).then(function (res) {
      var was = saved();
      if (!res.ok) throw res;
      // devices (15.2) is how many of her phones get her notices. Round 1 review of 0.4.4 found the
      // answer carried it and the app threw it away, so a phone registered under a borrowed session
      // went on buzzing for her private line with no screen anywhere that could show it.
      save({ token: x.tok, ep: x.ep, checked: Date.now(), lang: body.lang, off: false, dismissed_until: was.dismissed_until,
        devices: typeof res.devices === "number" && res.devices > 0 ? res.devices : 1,
        inbox: office ? res.inbox_alerts !== false : was.inbox, groups: office ? res.group_alerts !== false : was.groups });
    });
  }

  /* A "Turn off" or a sign out with no signal must not leave a phone buzzing for weeks, so the token
     waits in ccc.push.pending until push_unregister answers ok, 90 days pass, or the backend ends the
     row itself (the daily check, or another person registering the same token on this phone). */
  function pending() { var v = H.store.getJSON(PEND); return Array.isArray(v) ? v.filter(function (x) { return x && typeof x.id === "string" && typeof x.tok === "string"; }) : []; }
  function pendPut(l) { if (l.length) H.store.setJSON(PEND, l.slice(-PEND_MAX)); else H.store.remove(PEND); }
  function pendDrop(tok) { pendPut(pending().filter(function (x) { return x.tok !== tok; })); }
  function pendAdd(id, tok) { if (id && tok) pendPut(pending().filter(function (x) { return x.tok !== tok; }).concat({ id: id, tok: tok, at: Date.now() })); }

  /* push_unregister; the token is forgotten for good only once the backend says the row is ended. */
  function end(tok, session) {
    var body = { push_token: tok };
    if (session) body.token = session;
    return api("push_unregister", body).then(function (res) { if (res && res.ok) pendDrop(tok); }, noop);
  }

  /* One try per check, for this person only: push_unregister ends a row of the signed in person alone. */
  function sweep() {
    var id = (P.state.person || {}).id, list = pending(), now = Date.now(), keep = [], asked = false;
    list.forEach(function (x) {
      if (now - (+x.at || 0) > PEND_KEEP) return;
      keep.push(x);
      if (!asked && id && x.id === id && P.state.token) { asked = true; end(x.tok); }
    });
    if (list.length && keep.length !== list.length) pendPut(keep);
  }

  /* gone: the backend already has no such row, so nothing is left to confirm. */
  function forget(off, gone) {
    var s = saved();
    if (s.token && !gone) pendAdd((P.state.person || {}).id, s.token);
    delete s.token;
    delete s.ep;
    if (off) s.off = true;
    save(s);
  }

  /* The words for a refused call. PUSH_OFF and MESSAGES_OFF: the card goes. */
  function refused(res, other) {
    var c = ((res && res.error) || {}).code;
    if (c === "AUTH_INVALID" || c === "AUTH_EXPIRED") P.signOut("signin_again");
    else if (c === "FORBIDDEN") dash().push = false;
    else return c === "RATE_LIMITED" ? "push_limit" : c === "NETWORK" ? "error_network" : other || "error_server";
    return "";
  }

  /* An action: busy while it waits, then its words and every card again. */
  function run(p, next) {
    busy = true;
    say("");
    redraw();
    p.then(function (k) {
      busy = false;
      say(k);
      redraw(next);
    });
  }

  /* Notification.requestPermission is called in the tap itself, before any wait: iPhone asks only then. */
  function turnOn() {
    var N = root.Notification, ask;
    if (busy) return;
    try {
      ask = N.permission === "granted" ? Promise.resolve("granted") : new Promise(function (ok) {
        var r = N.requestPermission(ok);
        if (r && r.then) r.then(ok, ok);
      });
    } catch (e) {
      ask = Promise.resolve("");
    }
    failed = false;
    run(ask.then(function (perm) {
      if (perm !== "granted") return perm === "denied" ? "" : "push_denied";
      return token().then(function (x) { return register(x, saved().token); }).then(function () { return "push_on"; }, function (res) {
        failed = true;
        return refused(res && res.error ? res : null, "push_failed");
      });
    }));
  }

  /* Off on this phone at once; the token waits in the pending list until the backend confirms it. */
  function turnOff() {
    var s = saved();
    if (busy) return;
    forget(true);
    if (s.token) end(s.token);
    drop();
    failed = false;
    say("push_off_done");
    redraw("on");
  }

  /* Her other phones, hers alone: push_unregister others keeps this one and ends the rest (15.3). */
  function endOthers() {
    var s = saved();
    if (busy || !s.token) return;
    run(api("push_unregister", { push_token: s.token, others: true }).then(function (res) {
      if (!res.ok) return refused(res);
      var now = saved();
      now.devices = typeof res.devices === "number" && res.devices > 0 ? res.devices : 1;
      save(now);
      return "push_phones_ended";
    }), "on");
  }

  function test() {
    if (!busy) run(api("push_test", { push_token: saved().token }).then(function (res) {
      if (res.ok && res.sent === true) return "push_sent";
      if (res.ok && /^(not_registered|invalid)$/.test(res.why)) return forget(false, true), "push_again";
      return res.ok ? "push_test_failed" : refused(res, "push_test_failed");
    }), "on");
  }

  /* An office switch, on this phone. */
  function flip(which, input) {
    var s = saved(), was = s[which] !== false;
    if (busy) return (input.checked = was);
    s[which] = input.checked;
    save(s);
    run(register({ tok: s.token, ep: s.ep }).then(function () { return ""; }, function (res) {
      var back = saved();
      back[which] = was;
      save(back);
      return refused(res);
    }));
  }

  /* After the dashboard while notices are on, when the app language changes and when the push address
     changed; the full check (a token, then push_register) at most once a day otherwise. */
  function check(full) {
    var s = saved(), N = root.Notification, st = state();
    sweep();
    if (!s.token || s.off || st === "hidden") return;
    if (!N || N.permission !== "granted") {
      forget();
      end(s.token);
      return redraw();
    }
    if (s.lang !== P.state.lang) return register({ tok: s.token, ep: s.ep }).catch(noop);
    if ((quick && !full) || st !== "on") return;
    quick = true;
    wait().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (full || !sub || tail(sub) !== s.ep || Date.now() - (+s.checked || 0) > DAY) return token().then(function (x) { return register(x, s.token); });
    }).catch(noop);
  }

  /* ---- One state machine for the home card, the Messages card and the panel ---- */

  /* A busy button says so with aria-disabled, so the focus stays on it; every action checks busy. */
  function btn(cls, label, onClick, k) {
    return el("button", { type: "button", class: "btn " + cls, "data-k": k, "aria-disabled": busy && k !== "later" ? "true" : null, on: { click: onClick } }, label);
  }

  function later() {
    var s = saved();
    s.dismissed_until = Date.now() + 30 * DAY;
    save(s);
    if (state() === "install") H.store.set(A2, "1");
    redraw();
  }

  /* The four iPhone steps, folded on the Messages card so the Office conversation stays on screen. */
  function steps(fold) {
    var ol = el("ol", { class: "push-steps" }, [1, 2, 3, 4].map(function (n) {
      return el("li", null, n === 2 ? [t("push_ios_2") + " ", P.icon("share")] : t("push_ios_" + n));
    }));
    return fold ? el("details", { class: "push-more" }, [el("summary", { text: t("push_ios_more") }), ol]) : ol;
  }

  function toggle(which) {
    var id = "push-" + which, input = el("input", { type: "checkbox", id: id, "data-k": which, checked: saved()[which] !== false,
      on: { change: function () { flip(which, input); } } });
    return el("label", { class: "push-sw", for: id }, [input, el("span", { text: t("push_" + which) })]);
  }

  /* How many of her phones get her notices, as the last push_register said (15.2). */
  function phoneCount() {
    var n = +saved().devices;
    return n > 0 ? n : 1;
  }

  function phones() {
    var n = phoneCount();
    return el("p", { class: "push-phones", text: n > 1 ? t("push_phones_many", { n: n }) : t("push_phones_one") });
  }

  function fill(b) {
    var st = state(), panel = b.kind === "panel", kids = [], line = el("p", { class: "push-note", role: "status", tabindex: "-1" });
    var shown = note && Date.now() - noteAt < 2e4 && /^(ready|on)$/.test(st) && !(panel && note === "push_on") ? note : "";
    // The panel in the on state has no note of its own, so its own strong line carries the announcement,
    // but only when this box is already on screen: a panel drawn from scratch is a screen change.
    var fresh = panel && st === "on" && note === "push_on" && Date.now() - noteAt < 2e4 && doc.body.contains(b);
    var strong = el("p", { class: "push-strong", role: "status", tabindex: "-1", "data-k": fresh ? "said" : null });
    var title = st === "install" ? "push_ios_title" : st === "ready" ? "push_title" : "push_head", body;
    // A live region is heard only when its words arrive after it does, so they come a microtask later.
    if (shown) {
      line.setAttribute("data-k", "said");
      Promise.resolve().then(function () { line.textContent = t(shown); });
    }
    if (fresh) Promise.resolve().then(function () { strong.textContent = t("push_on"); });
    else strong.textContent = t("push_on");
    if (st === "ready" && !pre) {
      // The SDK comes in the background once a card can turn notices on, so the tap never waits for it.
      pre = true;
      root.setTimeout(function () { if (state() === "ready") loadSdk().catch(noop); }, 2000);
    }
    body = TEXT[st] ? [el("p", { class: "a2hs-body", text: t(TEXT[st]) })]
      : st === "install" ? [el("p", { class: "a2hs-body", text: t("push_ios_body") }), steps(b.kind === "msg")]
      : st === "ready" ? [el("p", { class: "a2hs-body", text: t("push_body") })]
      : [strong, phones(), btn("btn-primary", t("push_test"), test, "test"),
        btn("btn-secondary", t("push_off"), turnOff, "off")]
        .concat(phoneCount() > 1 ? btn("btn-secondary", t("push_phones_end"), endOthers, "others") : [])
        .concat(dash().role === "office" ? [toggle("inbox"), toggle("groups")] : []);
    if (st === "hidden") kids = [];
    else if (panel) kids = [el("h2", { class: "push-h2", text: t("push_head") })].concat(st === "install" ? el("p", { class: "push-strong", text: t(title) }) : [],
      body, st === "ready" ? btn("btn-primary", t(busy ? "push_working" : failed ? "push_retry" : "push_btn"), turnOn, "on") : [], line);
    else if (st === "on") kids = shown ? [line] : [];
    else if (!quiet()) {
      kids = [el("section", { class: "a2hs push-card", "aria-labelledby": "push-t-" + b.kind }, [
        el("div", { class: "a2hs-head" }, [el("span", { class: "a2hs-icon" }, P.icon("bell")),
          el("div", null, [el("h2", { class: "a2hs-title", id: "push-t-" + b.kind, text: t(title) })].concat(body, st === "ready" ? line : []))]),
        el("div", { class: "push-acts" }, [st === "ready" ? btn("btn-primary", t(busy ? "push_working" : failed ? "push_retry" : "push_btn"), turnOn, "on") : null,
          btn("btn-secondary", t("a2hs_dismiss"), later, "later")])])];
    }
    while (b.firstChild) b.removeChild(b.firstChild);
    kids.forEach(function (k) { b.appendChild(k); });
    b.hidden = !kids.length;
  }

  function box(kind) {
    var st = state(), b = el("div", { class: "push-box is-" + kind });
    if (st === "hidden" || (kind !== "panel" && (st === "on" || quiet()))) return null;
    boxes = boxes.filter(function (x) { return doc.body.contains(x); }).concat(b);
    b.kind = kind;
    fill(b);
    return b;
  }

  /* Every card again, the focus where it was, else the line just said, else the first button. It waits
     one microtask, so that line has its words by then (docs/API.md 15.14). */
  function redraw(next) {
    var a = doc.activeElement, k = boxes.some(function (b) { return b.contains(a); }) && (a.getAttribute("data-k") || "x"), n = null;
    boxes = boxes.filter(function (b) { return doc.body.contains(b); });
    boxes.forEach(fill);
    boxes.some(function (b) {
      return k && (n = b.querySelector('[data-k="' + k + '"]') || (next && b.querySelector('[data-k="' + next + '"]')) ||
        (!b.hidden && (b.querySelector('[data-k="said"]') || b.querySelector("button"))));
    });
    if (n) Promise.resolve().then(function () { if (doc.body.contains(n)) n.focus(); });
  }

  /* The add to home screen card of 0.3.6, as it was. */
  function a2hs() {
    var ios = P.ios(), c;
    function dismiss() {
      H.store.set(A2, "1");
      if (c.parentNode) c.parentNode.removeChild(c);
    }
    function install() {
      var p = P.state.installPrompt;
      P.state.installPrompt = null;
      dismissOnly();
      try {
        p.prompt();
        p.userChoice.then(function (choice) { if (choice && choice.outcome === "accepted") H.store.set(A2, "1"); }, noop);
      } catch (e) { /* ignore */ }
    }
    function dismissOnly() { if (c.parentNode) c.parentNode.removeChild(c); }
    if (H.store.get(A2) === "1" || P.standalone() || !P.phone() || (!ios && !P.state.installPrompt)) return null;
    return (c = el("section", { class: "a2hs", id: "a2hs", "aria-labelledby": "a2hs-title" }, [
      el("button", { type: "button", class: "a2hs-close", "aria-label": t("close"), on: { click: dismiss } }, P.icon("close")),
      el("div", { class: "a2hs-head" }, [el("span", { class: "a2hs-icon" }, P.icon("phone")), el("div", null, [
        el("h2", { class: "a2hs-title", id: "a2hs-title", text: t("a2hs_title") }),
        ios ? el("p", { class: "a2hs-body" }, [t("a2hs_ios") + " ", P.icon("share")]) : el("p", { class: "a2hs-body", text: t("a2hs_android") })])]),
      el("div", { class: "a2hs-actions" }, [ios ? null : el("button", { type: "button", class: "btn btn-primary", on: { click: install } }, t("a2hs_install")),
        el("button", { type: "button", class: "btn btn-secondary", on: { click: dismiss } }, t("a2hs_dismiss"))])]));
  }

  P.icons.bell = [["path", { d: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" }]];

  root.CCCPush = {
    homeCard: function () { return box("home") || a2hs(); },
    messagesCard: function () { return box("msg"); },
    panel: function () { return box("panel"); },
    check: check,
    /* Sign out, with the old session token. The per person key goes, so the token waits in the shared
       pending list and is tried again the next time that person signs in on this phone. */
    signOut: function (tok, id) {
      var s = saved(id);
      H.store.remove(key(id));
      if (s.token) {
        pendAdd(id, s.token);
        end(s.token, tok);
        drop();
      }
    },
    /* From sw.js: a tapped notice, a notice while the app is open, a new push address. */
    onWorkerMessage: function (d) {
      var r = doc.documentElement.getAttribute("data-screen"), o = typeof d.open === "string" && P.openRe.test(d.open) ? d.open : "";
      if (d.type === "ccc-open") {
        P.state.openThread = o;
        P.go(o ? "messages" : "home");
      } else if (d.type === "ccc-sub") check(true);
      else if (d.type !== "ccc-push") return;
      else if ((r === "messages" || r === "chat") && root.CCCMsg) root.CCCMsg.pushed(o);
      else if (r === "home" && Date.now() - home > 1e4) {
        // Spread out, like the poll in Messages: an announcement reaches every phone in one second.
        home = Date.now();
        root.setTimeout(function () { if (doc.documentElement.getAttribute("data-screen") === "home") P.refresh(); },
          1 + Math.floor(Math.random() * 4000));
      }
    },
    debug: function () { return { state: state(), sdk: sdk, busy: busy, pending: pending() }; }
  };
})(window);
