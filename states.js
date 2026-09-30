/* CCC Team Portal "Where we work" screen (0.4.0), lazily loaded with states_i18n.js and states.css.
 * Contract: docs/API.md 4.6.
 *
 * What this screen is: an answer to a question people already ask (where does this company work),
 * an open door (if you would consider one of those states, you can say so), and a ladder (the same
 * six steps in every state). What it is NOT: a job board, a transfer form, an application, or a
 * promise. Nobody is offered work, a move, a schedule or a rate anywhere on it.
 *
 * The rules this screen keeps:
 *   * It needs nothing from the dashboard. "states" is not in DATA_ROUTES, so a dashboard that
 *     fails cannot stop it, and it never shows the loading placeholder. It reads two things from
 *     memory, the person's region and the requests they have already sent, and it works without
 *     either of them.
 *   * A closed panel builds no <img>. An open one builds the pictures that are on the screen and no
 *     others, so opening a state costs one picture and the rest come as the strip is moved. A
 *     person who never opens Tennessee never downloads Tennessee. loading="lazy" is not enough on
 *     its own: Chrome's lazy distance covers a whole panel, and it grows on a slow connection.
 *   * Every picture goes through the core bundle's imgWithFallback, and every box is sized by
 *     aspect ratio in CSS, so a picture that never arrives changes nothing about the layout. The
 *     box that holds a picture's place carries the same description, so a screen reader hears it
 *     whether or not the picture has been fetched.
 *   * With every picture missing the screen still does its whole job: the invitation, the five
 *     states, the two sentences each, the six steps in words and the button all still work.
 *   * The button carries the person and the state code and nothing else. There is no free text.
 *   * Nothing is written to phone storage. What the screen holds is in memory, and it is dropped
 *     when somebody else signs in on the same phone, which here are shared.
 */
(function (root) {
  "use strict";

  var doc = root.document, P = null, V = null, wired = false;

  /* The five states, in English alphabetical order. scene is what the core bundle's stateScene()
     returns for a region, and it is also the name of the picture files. Every other string this
     screen needs is worked out from the code, so the table stays one line per state.

     All five ship a ladder picture. Georgia's was held back when 0.4.0 was built, because the flag
     in that artwork was the University of Georgia's mark. Cristy chose the plain gold flag the other
     ladders already fly, the picture was repainted, and the held back path came out with it: a
     picture that fails to load is a different thing and slot() already says so in words. */
  var STATES = [
    { code: "CA", scene: "california" },
    { code: "FL", scene: "florida" },
    { code: "GA", scene: "georgia" },
    { code: "HI", scene: "hawaii" },
    { code: "TN", scene: "tennessee" }
  ];
  var STEPS = [1, 2, 3, 4, 5, 6];
  var PHOTOS = [1, 2, 3, 4, 5];

  function t(key, vars) { return P.t(key, vars); }
  function el(tag, attrs, kids) { return P.h(tag, attrs, kids); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function lc(st) { return st.code.toLowerCase(); }
  function stateName(st) { return t("state_" + lc(st)); }
  function myId() { return (P.state.person && P.state.person.id) || ""; }
  function myRegion() { return (P.state.person && P.state.person.region) || ""; }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  /* After the browser has laid the panel out, which is when a picture's place can be measured. Both,
     and not one or the other: a phone that is busy can hold a frame back for a long time, and these
     two calls do the same work twice at worst. */
  function soon(fn) {
    if (root.requestAnimationFrame) root.requestAnimationFrame(fn);
    root.setTimeout(fn, 60);
  }

  /* The person's own state, from the one region reading the whole app already shares
     (web/app.js stateScene, the same table as EDU_STATE_PATTERNS in both backends). It is used for
     one thing only: putting their state first and opening it, so somebody in Memphis does not
     scroll past four states to find the one they live in. It never decides who may send. */
  function mineScene() {
    var helpers = root.CCCHelpers;
    return helpers && helpers.stateScene ? helpers.stateScene(myRegion()) : "";
  }

  function blank() {
    var scene = mineScene(), order = [], open = {}, mine = null;
    STATES.forEach(function (st) { if (st.scene === scene) mine = st; else order.push(st); });
    if (mine) {
      order.unshift(mine);
      open[mine.code] = true;
    }
    return { who: myId(), mine: mine, order: order, open: open, send: {}, dom: {}, io: null };
  }

  /* One error line per refusal. VALIDATION on anything but state means the app sent something the
     backend did not like, which is not a sentence a cleaner can act on, so it reads as a server
     problem. Section 4.6 of docs/API.md has the table. */
  function errKey(res) {
    var e = (res && res.error) || {}, code = e.code;
    if (code === "VALIDATION") return e.field === "state" ? "ww_err_state" : "error_server";
    if (code === "FORBIDDEN") return "ww_err_setup";
    if (code === "RATE_LIMITED") return "ww_err_rate";
    if (code === "NETWORK") return "error_network";
    return "error_server";
  }

  /* ---- The pictures ---- */

  /* A picture is built only when it is about to be seen. Until then a box of exactly the same size
     holds its place and carries the same description, so nothing moves and nobody reading with
     their ears loses anything. A picture that fails leaves the same box with the state's name. */
  function slot(file, alt, gone) {
    var box = el("span", { class: "ww-gone ww-wait", role: "img", "aria-label": alt });
    box.__show = function () {
      if (!box.parentNode) return;
      var img = P.img("img/states/" + file, alt, null, el("span", { class: "ww-gone", text: gone }));
      img.loading = "lazy";
      box.parentNode.replaceChild(img, box);
    };
    return box;
  }

  function photo(st, n) {
    return el("li", { class: "ww-shot" },
      slot(st.scene + "-" + n + ".jpg", t("ww_" + lc(st) + "_alt" + n),
        t("ww_photo_missing", { state: stateName(st) })));
  }

  /* Build the pictures that are on the screen now, and, once somebody is moving the strip, the next
     screenful as well. Opening a panel costs one picture; the others follow the finger. */
  function fillStrip(strip, ahead) {
    var left = strip.getBoundingClientRect().left;
    var edge = strip.clientWidth * (1 + (ahead || 0));
    // An open panel always has at least its first picture, whatever the browser says about sizes.
    var empty = !strip.querySelector("img"), first = true;
    each(strip.querySelectorAll(".ww-wait"), function (box) {
      var li = box.parentNode;
      if (!li) return;
      if ((empty && first) || li.getBoundingClientRect().left - left < edge) box.__show();
      first = false;
    });
  }

  /* Five pictures in a row that scrolls sideways under a finger. No dots, no arrows, no timer and
     no carousel: nothing on this screen moves by itself. The strip takes focus and the arrow keys
     scroll it, which is what a scroll container needs so it is not a keyboard trap. */
  function strip(st) {
    function more(e) { fillStrip(e.currentTarget, 1); }
    var row = el("ul", {
      class: "ww-strip", tabindex: "0", "aria-label": t("ww_photos", { state: stateName(st) }),
      on: {
        scroll: more,
        focus: more,
        keydown: function (e) {
          var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          e.currentTarget.scrollLeft += step * Math.max(120, e.currentTarget.clientWidth * 0.8);
          more(e);
        }
      }
    }, PHOTOS.map(function (n) { return photo(st, n); }));
    soon(function () { fillStrip(row, 0); });
    return row;
  }

  /* The ladder picture sits far below the top of a panel, so it waits until it is near the screen.
     One watcher does the whole screen, and it is dropped when the screen is drawn again. */
  function watcher() {
    if (V.io || !root.IntersectionObserver) return V.io;
    // The callback holds its own watcher, not V's: somebody else may sign in before it ever fires.
    var io = new root.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target.__show) e.target.__show();
      });
    }, { rootMargin: "200px 0px" });
    V.io = io;
    return io;
  }

  function watch(box) {
    var io = watcher();
    soon(function () {
      if (!box.parentNode) return;
      if (io) io.observe(box);
      else box.__show();
    });
  }

  /* The tests and the QA screenshots ask for every picture at once: the same screen a swipe makes. */
  function showAll(node) {
    each((node || doc).querySelectorAll(".ww-wait"), function (box) { if (box.__show) box.__show(); });
  }

  /* ---- The ladder ---- */

  /* The picture's own English name belongs on the row only for a reader who cannot read the picture.
     In English the line repeated the step's own name word for word ("Cleaner", then "in the picture:
     Cleaner"), six times in every panel on all five states. */
  function showsImageName() {
    return P.state.lang === "es";
  }

  function ladderRow(n, withImageName) {
    return el("li", { class: "ww-step" }, [
      el("p", { class: "ww-step-name" }, [
        el("span", { class: "ww-step-n", "aria-hidden": "true", text: n + ". " }),
        el("span", { text: t("ww_step" + n + "_name") })
      ]),
      // Marked lang="en" so a Spanish screen reader pronounces the English name as English.
      withImageName ? el("p", { class: "ww-step-en" }, el("span", {
        lang: "en",
        text: t("ww_ladder_in_image", { name: t("ww_step" + n + "_image") })
      })) : null,
      el("p", { class: "ww-step-line", text: t("ww_step" + n + "_line") })
    ]);
  }

  function ladder(st) {
    var withImageName = showsImageName();
    var art = slot(st.scene + "-ladder.jpg", t("ww_" + lc(st) + "_ladder_alt"), t("ww_ladder_head"));
    watch(art);
    return el("section", { class: "ww-ladder" }, [
      el("h3", { class: "ww-ladder-head", text: t("ww_ladder_head") }),
      el("p", { class: "ww-ladder-same", text: t("ww_ladder_same") }),
      el("div", { class: "ww-art" }, art),
      el("p", { class: "ww-note", text: t("ww_ladder_note") }),
      el("ol", { class: "ww-steps" }, STEPS.map(function (n) {
        return ladderRow(n, withImageName);
      })),
      el("p", { class: "ww-note", text: t("ww_ladder_club") }),
      el("p", { class: "ww-note", text: t("ww_ladder_foot") })
    ]);
  }

  /* ---- The button ---- */

  /* What this person has already told the office about this state. The first time a panel asks, the
     answer comes from the dashboard the phone already holds, so somebody who said yes weeks ago is
     told the office has it instead of finding out by pressing the button again. */
  function sendState(st) {
    if (V.send[st.code]) return V.send[st.code];
    var rows = (P.state.dash && P.state.dash.requests) || [], old = null;
    each(rows, function (r) {
      if (!r || r.category !== "state_interest" || r.state !== st.code || !r.request_id) return;
      if (!old || String(r.created_at || "") > String(old.created_at || "")) old = r;
    });
    V.send[st.code] = old
      ? { busy: false, id: String(old.request_id), already: true, req: "" }
      : { busy: false, id: "", already: false, req: "" };
    return V.send[st.code];
  }

  function sendLabel(st) { return t("ww_send_state", { state: stateName(st) }); }

  function answerLine(st, s) {
    return s.already
      ? t("ww_already", { state: stateName(st), id: s.id })
      : t("ww_sent", { id: s.id });
  }

  /* The answer goes into a live region inside the panel it belongs to, so it is announced where it
     belongs. Nobody is offered the button for the state they already work in: there is nothing to
     tell the office about that one. */
  function sendBox(st) {
    if (st === V.mine) return el("p", { class: "ww-yours-note ww-note", text: t("ww_your_state_note") });
    var s = sendState(st);
    var live = el("div", { class: "ww-live", role: "status" });
    var label = el("span", { class: "ww-send-text", text: sendLabel(st) });
    var btn = el("button", {
      type: "button", class: "btn btn-primary ww-send", "data-state": st.code,
      on: { click: function () { send(st); } }
    }, label);
    var box = el("div", { class: "ww-sendbox" }, [btn, live]);
    V.dom[st.code] = { btn: btn, label: label, live: live };
    if (s.id) {
      btn.hidden = true;
      say(st, answerLine(st, s), true);
    } else {
      btn.disabled = !P.isOnline();
      if (!P.isOnline()) say(st, t("ww_offline"), false, "wait");
    }
    return box;
  }

  /* kind: an answer (with the line that keeps a yes from reading as a yes from the company and the
     way back to the row it made), or a message box for a refusal. move: the person just pressed the
     button, which is gone now, so the focus goes to the sentence that answers them. */
  function say(st, text, done, kind, move) {
    var d = V.dom[st.code];
    if (!d) return;
    clear(d.live);
    if (done) {
      var said = el("p", { class: "ww-done", tabindex: "-1", text: text });
      d.live.appendChild(said);
      d.live.appendChild(el("p", { class: "ww-note", text: t("ww_sent_note") }));
      d.live.appendChild(el("a", {
        class: "link-btn ww-see", href: "#/requests",
        on: { click: function (e) { e.preventDefault(); P.go("requests", true); } },
        text: t("see_my_requests")
      }));
      if (move) {
        Promise.resolve().then(function () {
          if (!doc.body.contains(said)) return;
          try { said.focus({ preventScroll: true }); } catch (e) { said.focus(); }
        });
      }
      return;
    }
    d.live.appendChild(P.msgBox(kind || "error", kind === "wait" ? "wifiOff" : "alert", text));
  }

  function send(st) {
    var s = sendState(st), d = V.dom[st.code];
    if (!d || s.busy || s.id) return;
    if (!P.isOnline()) {
      d.btn.disabled = true;
      say(st, t("ww_offline"), false, "wait");
      return;
    }
    s.busy = true;
    // One id for this state, kept until the answer comes, so a retry of web/api.js is the same call.
    s.req = s.req || P.randomId();
    d.btn.disabled = true;
    d.label.textContent = t("ww_sending");
    clear(d.live);
    var token = P.state.token;
    P.api("state_interest", { token: token, state: st.code, client_request_id: s.req }).then(function (res) {
      if (!V || !V.dom[st.code] || token !== P.state.token) return;
      s.busy = false;
      d = V.dom[st.code];
      if (res && res.ok) {
        s.id = String((res.request && res.request.request_id) || "");
        s.already = res.already === true;
        d.btn.hidden = true;
        say(st, answerLine(st, s), true, null, true);
        return;
      }
      if (res && res.error && (res.error.code === "AUTH_INVALID" || res.error.code === "AUTH_EXPIRED")) {
        P.signOut("signin_again");
        return;
      }
      d.btn.disabled = false;
      d.label.textContent = sendLabel(st);
      say(st, t(errKey(res)));
    });
  }

  /* The phone came back, or lost the signal: every button that has not been used yet follows. */
  function netChanged() {
    if (!V) return;
    var on = P.isOnline();
    STATES.forEach(function (st) {
      var d = V.dom[st.code], s = V.send[st.code];
      if (!d || (s && (s.busy || s.id))) return;
      d.btn.disabled = !on;
      if (on) clear(d.live);
      else say(st, t("ww_offline"), false, "wait");
    });
  }

  /* ---- The panels ---- */

  function fillPanel(st, body) {
    clear(body);
    body.appendChild(el("p", { class: "ww-work", text: t("ww_" + lc(st) + "_work") }));
    body.appendChild(strip(st));
    body.appendChild(el("p", { class: "ww-count ww-note", text: t("ww_photo_count") }));
    body.appendChild(ladder(st));
    body.appendChild(sendBox(st));
  }

  function panel(st) {
    var open = V.open[st.code] === true;
    var id = "ww-body-" + st.code;
    var word = el("span", { class: "ww-toggle-text", text: t(open ? "ww_close" : "ww_open") });
    var body = el("div", { class: "ww-body", id: id, hidden: !open });
    var btn = el("button", {
      type: "button", class: "ww-toggle", "aria-expanded": open ? "true" : "false",
      "aria-controls": id, "data-state": st.code,
      "aria-label": t(open ? "ww_close_state" : "ww_open_state", { state: stateName(st) }),
      on: { click: function () { toggle(st, btn, word, body); } }
    }, [word, P.icon("chevronRight")]);
    if (open) fillPanel(st, body);
    return el("section", { class: "ww-state", "data-state": st.code }, [
      el("div", { class: "ww-head" }, [
        el("div", null, [
          el("h2", { class: "ww-name", text: stateName(st) }),
          V.mine === st ? el("p", { class: "ww-yours", text: t("ww_your_state") }) : null
        ]),
        btn
      ]),
      body
    ]);
  }

  /* Opening one panel never closes another. A closed one keeps no <img>, so a state somebody
     opened and closed again is not fetched twice either: the browser has it. */
  function toggle(st, btn, word, body) {
    var open = V.open[st.code] !== true;
    V.open[st.code] = open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", t(open ? "ww_close_state" : "ww_open_state", { state: stateName(st) }));
    word.textContent = t(open ? "ww_close" : "ww_open");
    if (open) fillPanel(st, body);
    else {
      clear(body);
      delete V.dom[st.code];
    }
    body.hidden = !open;
  }

  /* ---- The screen ---- */

  function screen() {
    // The old picture watcher belongs to a screen that is about to be thrown away.
    if (V && V.io) { V.io.disconnect(); V.io = null; }
    // A phone here is shared. What the last person did on this screen is not for the next one.
    if (!V || V.who !== myId()) V = blank();
    V.dom = {};
    wire();
    return el("div", { class: "ww" }, [
      el("div", { class: "page-head" }, [P.backButton("home"), el("h1", { text: t("ww_title") })]),
      el("section", { class: "ww-intro" }, [
        el("h2", { class: "ww-intro-head", text: t("ww_intro_head") }),
        el("p", { text: t("ww_intro_1") }),
        el("p", { text: t("ww_intro_2") }),
        el("p", { class: "ww-note", text: t("ww_intro_3") })
      ]),
      el("div", { class: "ww-states" }, V.order.map(panel)),
      el("p", { class: "ww-credits", text: t("ww_credits") })
    ]);
  }

  function wire() {
    if (wired) return;
    wired = true;
    root.addEventListener("online", netChanged);
    root.addEventListener("offline", netChanged);
  }

  root.CCCStates = {
    screen: function () {
      P = P || root.CCCPortal;
      return screen();
    },
    /* The tests read this. It carries no words and no person, only what the screen is doing. */
    debug: function () {
      if (!V) return null;
      var sent = [];
      Object.keys(V.send).forEach(function (k) { if (V.send[k].id) sent.push(k + ":" + V.send[k].id); });
      return {
        mine: V.mine ? V.mine.code : "",
        order: V.order.map(function (st) { return st.code; }),
        open: Object.keys(V.open).filter(function (k) { return V.open[k]; }).sort(),
        sent: sent.sort(),
        waiting: doc.querySelectorAll(".ww-wait").length
      };
    },
    show: showAll,
    reset: function () {
      if (V && V.io) V.io.disconnect();
      V = null;
    }
  };
})(window);
