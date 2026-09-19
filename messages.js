/* CCC Team Portal Messages (0.3.6), lazily loaded with messages_i18n.js and messages.css. Contract:
 * docs/API.md 14. Text only via textContent, a photo only from a data:image/jpeg URL, drawn again on a
 * canvas (no location data). Nothing stored but the rules version. Polling only while on screen. */
(function (root) {
  "use strict";

  var doc = root.document, I = root.CCC_I18N, P = null, H = null;
  // 2: rule 5 changed.
  var RULES_V = "2", JPEG = "data:image/jpeg;base64,", BATCH = 12;
  // Idle time, then the wait: 15 s, 30 s after 2 minutes, 60 s after 5, paused after 15.
  var STEPS = [[900000, 0], [300000, 60000], [120000, 30000], [0, 15000]];
  // Tests run this clock by hand.
  var clock = {
    now: function () { return Date.now(); },
    set: function (fn, ms) { return root.setTimeout(fn, ms); },
    clear: function (id) { root.clearTimeout(id); }
  };
  // restoring: a focus the code puts back, not a tap.
  var V = null, route = null, dlg = null, wired = false, popping = false, queued = null, restoring = false;

  /* All Messages holds, in memory only. */
  function blank() {
    return {
      view: "list", list: null, head: 0, fresh: true, busy: false, err: null, off: false, note: null,
      tid: "", hint: {}, th: null, msgs: [], older: "none", out: [], drafts: {}, photo: null,
      filter: { region: "", waiting: false, sup: false }, q: "", qRegion: "", orig: {}, menu: null, below: false,
      readTo: 0, readSent: 0, thumbs: {}, thumbKeys: [], fulls: {}, fullKeys: [], gone: {}, want: [], asking: null,
      poll: { timer: 0, busy: false, active: 0, fails: 0, paused: false, wait: 0 }, dom: null
    };
  }

  function t(key, vars) { return P.t(key, vars); }
  function el(tag, attrs, kids) { return P.h(tag, attrs, kids); }
  function lang() { return P.state.lang; }
  function online() { return root.navigator.onLine !== false; }
  function inside() { return route === "messages" || route === "chat"; }
  function myRole() {
    var m = P.state.dash && P.state.dash.messages;
    return (V && V.list && V.list.role) || (m && m.role) || "cleaner";
  }
  // Only the office reads my thread (API 14.2).
  function priv() { var o = V && V.list && V.list.office_thread; return myRole() === "supervisor" || !!(o && o.office_only); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function keyOf(s) { return String(s).replace(/\W/g, "_"); }
  function rulesKey() { return "ccc.msgrules:" + ((P.state.person && P.state.person.id) || ""); }
  function rulesOk() { return H.store.get(rulesKey()) === RULES_V; }
  function arr(a) { return Array.isArray(a) ? a : []; }

  function fold(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""); }

  function officePhone() {
    var c = P.state.dash && P.state.dash.contact, v = c && c.office_phone;
    return typeof v === "string" && /^\+[0-9]{8,15}$/.test(v) ? v : "";
  }

  function when(iso) {
    var d = new Date(iso || clock.now());
    return isNaN(d.getTime()) ? new Date(clock.now()) : d;
  }

  function timeText(iso) { return when(iso).toLocaleTimeString(I.locales[lang()], { hour: "numeric", minute: "2-digit" }); }

  /* Today, Yesterday or the date, by the phone's clock. */
  function dayText(iso) {
    var ymd = I.toYMD(when(iso)), now = new Date(clock.now());
    if (ymd === I.toYMD(now)) return t("msg_today");
    if (ymd === I.toYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return t("msg_yesterday");
    return I.formatShort(ymd, lang());
  }

  function shortWhen(iso) {
    var d = iso ? dayText(iso) : "";
    return d === t("msg_today") ? timeText(iso) : d;
  }

  function nameOf(m) { return m.from.you ? t("msg_you") : String(m.from.name || ""); }
  /* A label with the sender's name, or "your" for the reader's own message. */
  function named(m, key, vars) {
    vars = vars || {};
    vars.name = nameOf(m);
    return t(m.from.you ? key + "_own" : key, vars);
  }
  function quietFocus(n) {
    restoring = true;
    try { n.focus({ preventScroll: true }); } finally { restoring = false; }
  }

  /* "Olivia, office" in a thread, "Ana S." for a cleaner. */
  function whoLine(m) {
    var r = m.from.role, role = r === "office" ? t("msg_role_office") : r === "supervisor" ? t("msg_role_sup") : "";
    return nameOf(m) + (role ? ", " + role : "");
  }

  /* The words for a refused call. */
  function errKey(res) {
    var e = (res && res.error) || {}, c = e.code, r = e.reason;
    if (c === "RATE_LIMITED") return r === "PHOTOS" ? "msg_photo_limit" : r === "VIEWS" ? "msg_views_limit" : "msg_limit";
    if (c === "FORBIDDEN") {
      return { PHOTOS_OFF: "msg_photos_off", MESSAGES_OFF: "msg_off", READ_ONLY: "msg_ro", NOT_FOUND: "msg_not_found" }[r] || "error_server";
    }
    if (c === "VALIDATION" && e.field === "photo") return "msg_bad_photo";
    if (c === "NETWORK") return online() ? "error_network" : "msg_offline";
    return "error_server";
  }

  /* Sign in again, Messages off, or a thread gone. True when handled. */
  function fatal(res) {
    var e = res.error || {};
    if (e.code === "AUTH_INVALID" || e.code === "AUTH_EXPIRED") {
      P.signOut("signin_again");
    } else if (e.code === "FORBIDDEN" && e.reason === "MESSAGES_OFF") {
      V.off = true;
      stop();
      P.render();
    } else if (e.code === "FORBIDDEN" && e.reason === "NOT_FOUND") {
      V.tid = "";
      V.th = null;
      V.note = "msg_not_found";
      if (route === "chat") P.goBack("messages");
      else refresh();
    } else {
      return false;
    }
    return true;
  }

  function isMsg(m) { return !!m && typeof m.seq === "number" && typeof m.text === "string" && !!m.from; }

  function heading(text, back, extra) {
    return el("div", { class: "page-head" }, [back, el("h1", { tabindex: "-1", "data-k": "h", text: text })].concat(extra || []));
  }

  function focusHead() { doc.querySelector("#app h1").focus({ preventScroll: true }); }

  function button(cls, label, onClick, attrs) {
    var a = attrs || {};
    a.type = "button";
    a.class = cls;
    a.on = { click: onClick };
    return el("button", a, label);
  }

  function view(name) {
    V.view = name;
    P.render();
    focusHead();
  }

  /* On every Messages screen, never dismissible. */
  function banner(compact) {
    var phone = officePhone(), m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
    // No break spaces keep the number on one line.
    var urgent = phone ? t("msg_urgent", { phone: m ? ["(" + m[1] + ")", m[2], m[3]].join("\u00a0") : phone }) : t("msg_urgent_none");
    return el("section", { class: "msg-safe" + (compact ? " is-compact" : ""), "aria-label": t("msg_safety") }, [
      el("a", { class: "msg-sos", href: "tel:911", text: t("msg_sos") }),
      phone ? el("a", { href: "tel:" + phone, text: urgent }) : el("span", { text: urgent }),
      compact ? null : el("p", { class: "msg-watch", text: t("msg_not_watched") })
    ]);
  }

  /* Offline, a problem, paused, cannot connect. */
  function notes() {
    var out = [], n = V.note;
    if (!online() && route !== "chat") out.push(P.msgBox("wait", "wifiOff", t("msg_offline")));
    if (n) out.push(el("div", { role: "alert" }, P.msgBox(n === "msg_offline" ? "wait" : "error", n === "msg_offline" ? "wifiOff" : "alert", t(n))));
    if (V.poll.paused) out.push(button("msg-paused", t("msg_paused"), function () { wake(true); }, { "data-k": "pause" }));
    else if (V.poll.fails >= 3) out.push(el("p", { class: "msg-quiet", role: "status", text: t("msg_retrying") }));
    return out;
  }

  function tag(text, cls) { return el("span", { class: "msg-tag" + (cls ? " " + cls : ""), text: text }); }

  /* A row that opens a thread. */
  function row(k, title, labels, sub, at, unread, onClick) {
    return el("li", null, button("msg-row", [
      el("span", { class: "msg-row-main" }, [
        el("span", { class: "msg-row-title" }, [title].concat(labels)),
        sub ? el("span", { class: "msg-row-sub", text: sub }) : null
      ]),
      el("span", { class: "msg-row-end" }, [at ? el("span", { text: shortWhen(at) }) : null].concat(P.badge(unread) || []))
    ], onClick, { "data-k": k }));
  }

  /* A person's row, with the Supervisor label. */
  function personRow(k, p, more, at, unread) {
    return row(k + keyOf(p.thread_id), String(p.name || ""), [p.supervisor ? tag(t("msg_sup")) : null].concat(more || []).filter(Boolean), p.region || "",
      at, unread, function () { open(p.thread_id, { kind: "direct", name: p.name, region: p.region, supervisor: p.supervisor === true }); });
  }

  function chip(label, on, onClick, k) {
    return button("msg-chip", label, onClick, { "aria-pressed": on ? "true" : "false", "data-k": k });
  }

  function chips(regions, current, pick) {
    return el("div", { class: "msg-chips", role: "group", "aria-label": t("msg_regions") },
      [chip(t("msg_all_regions"), !current, function () { pick(""); }, "r_")].concat(arr(regions).map(function (r) {
        return chip(r, current === r, function () { pick(r); }, "r_" + keyOf(r));
      })));
  }

  /* Messages for a cleaner, the Inbox for staff. */
  function listScreen() {
    var L = V.list, role = myRole(), staff = role !== "cleaner";
    var out = [heading(t(staff ? "msg_inbox" : "msg_title"), P.backButton("home")), banner(false)];
    if (!L) {
      out.push(V.err ? el("div", { class: "load-error" }, [P.msgBox("error", online() ? "alert" : "wifiOff", t(V.err)),
        P.retry(function () { V.err = null; loadList(); refresh(); })]) : P.loading(false));
      return out;
    }
    out = out.concat(notes());
    var own = L.office_thread;
    if (own && own.thread_id) {
      out.push(el("ul", { class: "msg-rows" }, row("own", t("msg_office"), [], t(priv() ? "msg_office_sup" : "msg_office_cleaner"),
        own.last_at, own.unread, function () { open(own.thread_id, { kind: "own" }); })));
    }
    // Groups first: 80 threads would bury them.
    var groups = arr(L.groups);
    out.push(el("h2", { class: "msg-h2", text: t("msg_groups") }), groups.length ? el("ul", { class: "msg-rows" }, groups.map(function (g) {
      var labels = staff ? [tag(t(g.can_post ? "msg_can_write" : "msg_read_only"))] : g.can_post ? [] : [tag(t("msg_announce"))];
      return row("g" + keyOf(g.thread_id), H.pickText(g.name, lang()), labels, g.region || "", g.last_at, g.unread,
        function () { open(g.thread_id, { kind: "group", name: g.name }); });
    })) : el("p", { class: "empty", text: t("msg_no_groups") }));
    if (staff && L.inbox) out = out.concat(el("h2", { class: "msg-h2", text: t("msg_people") }), inbox(L.inbox, role));
    out.push(el("p", { class: "msg-links" }, button("link-btn", t("msg_rules"), function () { view("rules"); }, { "data-k": "rules" })));
    return out;
  }

  function inbox(box, role) {
    var f = V.filter;
    var threads = arr(box.threads).filter(function (r) {
      return (!f.region || r.region === f.region) && (!f.waiting || r.waiting) && (!f.sup || r.supervisor);
    });
    // The toggles in their own row, before the regions.
    var toggles = [chip(t("msg_waiting"), f.waiting, function () { f.waiting = !f.waiting; refresh(); }, "fw")];
    if (role === "office") toggles.push(chip(t("msg_sups"), f.sup, function () { f.sup = !f.sup; refresh(); }, "fs"));
    return [
      el("div", { class: "msg-new" }, button("btn btn-primary", [P.icon("chat"), t("msg_new")], function () {
        V.q = V.qRegion = "";
        view("pick");
      }, { "data-k": "new" })),
      el("div", { class: "msg-chips", role: "group", "aria-label": t("msg_filters") }, toggles),
      chips(box.regions, f.region, function (r) { f.region = r; refresh(); }),
      threads.length ? el("ul", { class: "msg-rows" }, threads.map(function (r) {
        return personRow("t", r, r.waiting && tag(t("msg_waiting"), "is-wait"), r.last_at, r.unread);
      })) : el("p", { class: "empty", text: t("msg_empty") })
    ];
  }

  /* New message. Accents and case do not matter in the search. */
  function pickScreen() {
    var box = V.list.inbox, list = el("ul", { class: "msg-rows" }), said = el("p", { class: "sr-only", role: "status" });
    var input = el("input", { id: "msg-q", class: "msg-search", type: "search", autocomplete: "off", "data-k": "q", value: V.q,
      on: { input: function () { V.q = input.value; people(); } } });
    function people() {
      var q = fold(V.q).trim(), n = 0;
      clear(list);
      arr(box.people).forEach(function (p) {
        if ((V.qRegion && p.region !== V.qRegion) || (q && fold(p.name).indexOf(q) < 0)) return;
        n++;
        list.appendChild(personRow("p", p));
      });
      if (!n) list.appendChild(el("li", { class: "empty", text: t("msg_nobody") }));
      said.textContent = n ? t("msg_found", { n: n }) : t("msg_nobody");
    }
    people();
    return [
      heading(t("msg_new"), button("back-btn", [P.icon("chevronLeft"), el("span", { text: t("back") })], function () { view("list"); })),
      banner(false),
      el("label", { class: "field-label", for: "msg-q", text: t("msg_search") }), input, said,
      chips(box.regions, V.qRegion, function (r) { V.qRegion = r; refresh(); }), list
    ];
  }

  /* Before the first use on each phone, and for a new rules version. */
  function rulesScreen() {
    var role = myRole();
    return [
      heading(t("msg_rules_title"), P.backButton("home")), banner(false),
      el("div", { class: "msg-rules" }, [
        role === "office" ? null : el("p", { text: t(priv() ? "msg_reads_sup" : "msg_reads_cleaner") }),
        el("p", { text: t("msg_reads_group") }), el("p", { text: t("msg_record") }), el("p", { text: t("msg_tr_note") }),
        el("h2", { class: "msg-h2", text: t("msg_rules_head") }),
        el("ul", null, [1, 2, 3, 4, 5, 6].map(function (n) { return el("li", { text: t("msg_rule" + n + (n === 5 && (role !== "cleaner" || priv()) ? "_sup" : "")) }); })),
        el("p", { text: t("msg_screenshot") }),
        button("btn btn-primary", t("msg_ok"), function () {
          H.store.set(rulesKey(), RULES_V);
          view("list");
        }, { "data-k": "ok" })
      ])
    ];
  }

  function open(tid, hint) {
    var n = blank();
    ["th", "msgs", "older", "photo", "note", "orig", "menu", "below", "readTo", "readSent", "want", "view", "busy"].forEach(function (k) { V[k] = n[k]; });
    V.tid = tid;
    V.hint = hint || {};
    zeroUnread(tid);
    P.go("chat");
  }

  /* Read now: out of the badge (a staff thread counts 1 while waiting and unread). */
  function zeroUnread(tid) {
    var L = V.list, cut = 0;
    if (!L) return;
    [L.office_thread].concat(arr(L.groups), arr(L.inbox && L.inbox.threads)).forEach(function (x) {
      if (x && x.thread_id === tid) {
        if (x.waiting === undefined) cut += x.unread || 0;
        else if (x.waiting && x.unread > 0) cut += 1;
        x.unread = 0;
      }
    });
    L.badge = Math.max(0, (L.badge || 0) - cut);
  }

  function loadList() {
    var token = P.state.token;
    P.api("messages_list", { token: token }).then(function (res) {
      if (!V || token !== P.state.token) return;
      if (res.ok) {
        V.list = res;
        V.head = Number(res.head) || 0;
        V.err = null;
        if (route === "messages" && V.view !== "pick") refresh();
        return plan();
      }
      if (fatal(res)) return;
      V.err = errKey(res);
      if (route === "messages") refresh();
    });
  }

  function loadThread(before) {
    var tid = V.tid, token = P.state.token, body = { token: token, thread_id: tid };
    if (before) body.before = before;
    V.busy = true;
    P.api("messages_thread", body).then(function (res) {
      if (!V || token !== P.state.token || V.tid !== tid) return;
      V.busy = false;
      if (!res.ok) {
        if (fatal(res)) return;
        V.note = errKey(res);
        return V.th ? drawNote() : refresh(true);
      }
      var list = arr(res.messages).filter(isMsg), first = !V.th, height = doc.documentElement.scrollHeight;
      V.th = res.thread || {};
      V.older = res.older;
      V.note = null;
      V.msgs = merge(V.msgs, list);
      if (before) {
        refresh();
        return root.scrollBy(0, doc.documentElement.scrollHeight - height);
      }
      V.readTo = V.readSent = lastSeq();
      refresh(first);
      toBottom();
    });
  }

  function merge(a, b) {
    var seen = {};
    return a.concat(b).filter(function (m) { return !seen[m.seq] && (seen[m.seq] = 1); }).sort(function (x, y) { return x.seq - y.seq; });
  }

  function lastSeq() { return V.msgs.length ? V.msgs[V.msgs.length - 1].seq : 0; }

  function own() { return V.th ? V.th.kind === "direct" && !V.th.person : V.hint.kind === "own"; }
  function isGroup() { return V.th ? V.th.kind === "group" : V.hint.kind === "group"; }

  function chatScreen() {
    var th = V.th, person = (th && th.person) || V.hint, title, note, sub = null;
    if (own()) {
      title = t("msg_office");
      note = priv() ? "msg_office_sup" : "msg_office_cleaner";
    } else if (isGroup()) {
      title = H.pickText((th && th.name) || V.hint.name, lang());
      note = "msg_group_note";
    } else {
      title = String(person.name || "");
      sub = el("p", { class: "page-sub msg-sub" }, [person.supervisor ? tag(t("msg_sup")) : null, person.region ? el("span", { text: person.region }) : null]);
      note = person.supervisor || person.office_only ? "msg_office_sup" : "msg_staff_note";
    }
    var d = V.dom = { top: el("div", { class: "msg-top" }), list: el("ol", { class: "msg-list", "aria-label": t("msg_list") }), note: el("div"),
      live: el("p", { class: "sr-only", "aria-live": "polite" }) };
    var out = [heading(title, P.backButton("messages"), [sub, el("p", { class: "page-sub", text: t(note) })]), banner(true), d.top, d.list, d.note, d.live];
    if (!th) d.list.appendChild(el("li", null, P.loading(false)));
    else out.push(th.can_post === true ? composer() : el("p", { class: "msg-ro", text: t("msg_ro") }));
    drawAll();
    return out;
  }

  function drawAll() { drawTop(); drawList(); drawNote(); drawComp(); }

  function drawTop() {
    var top = V.dom && V.dom.top;
    if (!top) return;
    clear(top);
    if (V.older === "more") {
      top.appendChild(button("link-btn", t("msg_earlier"), function () {
        if (!V.busy && V.msgs.length) loadThread(V.msgs[0].seq);
      }, { "data-k": "earlier" }));
    } else if (V.older === "kept") {
      top.appendChild(el("p", { class: "msg-quiet", text: t("msg_kept") }));
    }
  }

  function drawList() {
    var ol = V.dom && V.dom.list, day = "";
    if (!ol || !V.th) return;
    clear(ol);
    var all = V.msgs.concat(V.out.filter(function (o) { return o.tid === V.tid; }));
    all.forEach(function (m) {
      var d = dayText(m.at);
      if (d !== day) ol.appendChild(el("li", { class: "msg-day", text: day = d }));
      ol.appendChild(bubble(m));
    });
    if (!all.length) ol.appendChild(el("li", { class: "msg-day", text: t("msg_empty") }));
    root.setTimeout(seen, 0);
  }

  function bubble(m) {
    var pending = !!m.state, mine = m.from.you === true;
    var kids = [el("p", mine ? { class: "sr-only", text: t("msg_you") } : { class: "msg-who", text: whoLine(m) })];
    if (m.photo) kids.push(pic(m));
    var meta = el("div", { class: "msg-meta" }, el("span", { text: timeText(m.at) + (m.state === "sending" ? " · " + t("msg_sending") : "") }));
    var li = el("li", { class: "msg-b" + (mine ? " is-own" : ""), tabindex: "-1", "data-seq": pending ? null : m.seq },
      [el("div", { class: "msg-bub" }, kids.concat(words(m))), meta]);
    if (m.state === "failed") {
      li.appendChild(el("p", { class: "msg-fail", role: "alert" }, [t("msg_not_sent"), " ",
        button("link-btn", t("msg_retry"), function () { push(m); }, { "data-k": "retry" + m.id })]));
    }
    // Admins: office anywhere, a group's supervisors but not on an office message.
    if (!pending && V.th.admin === true && (myRole() === "office" || m.from.role !== "office")) {
      var isOpen = V.menu === m.seq;
      meta.appendChild(button("msg-more", P.icon("dots"), function () {
        V.menu = isOpen ? null : m.seq;
        refresh();
        var next = doc.querySelector('#app [data-k="' + (isOpen ? "m" : "h") + m.seq + '"]');
        if (next) next.focus();
      }, { "aria-expanded": isOpen ? "true" : "false", "aria-label": named(m, "msg_more"), "data-k": "m" + m.seq }));
      if (isOpen) {
        var hideBtn = button("link-btn msg-hide", t("msg_hide"), function () { askHide(m, hideBtn); },
          { "aria-label": named(m, "msg_hide_named"), "data-k": "h" + m.seq });
        li.appendChild(hideBtn);
      }
    }
    return li;
  }

  /* In the reader's language with a switch, but the reader's own words as written first. */
  function words(m) {
    if (!m.text) return [];
    var L = lang(), tr = m.tr && m.tr.lang === L && typeof m.tr.text === "string" && m.tr.text ? m.tr : null;
    var flip = !!V.orig[m.seq], showTr = m.lang !== L && !!tr && (m.from.you === true ? flip : !flip);
    var out = [el("p", { class: "msg-text", lang: showTr ? L : /^(en|es)$/.test(m.lang) ? m.lang : null, text: showTr ? tr.text : m.text })];
    if (m.lang !== L && !m.state) {
      out.push(tr ? button("msg-tr", t(showTr ? "msg_translated" : "msg_see_tr"), function () {
        V.orig[m.seq] = !V.orig[m.seq];
        refresh();
      }, { "data-k": "tr" + m.seq }) : el("p", { class: "msg-tr-none", text: t("msg_not_tr") }));
    }
    return out;
  }

  /* The thumbnail button in a box the photo's shape, asked for in view, 12 at a time. */
  function pic(m) {
    var key = V.tid + "|" + m.seq, url = m.state ? JPEG + m.photo.thumb : V.thumbs[key];
    if (!m.state && V.gone[key]) return el("p", { class: "msg-gone", text: t("msg_photo_gone") });
    var frame = el("span", { class: "msg-frame" }, url ? img(url, "") : el("span", { text: t("msg_photo") }));
    if (m.photo.w > 0 && m.photo.h > 0) frame.style.aspectRatio = m.photo.w + " / " + m.photo.h;
    if (m.state) return el("span", { class: "msg-pic" }, frame);
    var b = button("msg-pic", frame, function () { viewer(m, b); }, { "data-pic": m.seq, "data-k": "p" + m.seq, "data-want": url ? null : "1",
      "aria-label": named(m, "msg_open_photo", { time: timeText(m.at) }) });
    return b;
  }

  function img(url, alt) {
    var i = el("img", { alt: alt, decoding: "async" });
    if (url.indexOf(JPEG) === 0) i.src = url;
    return i;
  }

  /* Thumbnails to ask for whose bubble is in or near view (after a draw, on scroll). */
  function seen() {
    var list = V && V.dom && V.dom.list, h = root.innerHeight;
    if (!list || !doc.body.contains(list)) return;
    Array.prototype.forEach.call(list.querySelectorAll("[data-want]"), function (b) {
      var r = b.getBoundingClientRect();
      if (r.bottom < -200 || r.top > h + 200) return;
      b.removeAttribute("data-want");
      // Not while it is being asked for.
      var s = +b.getAttribute("data-pic");
      if (V.want.indexOf(s) < 0 && (V.asking || []).indexOf(s) < 0) V.want.push(s);
    });
    askThumbs();
  }

  function keep(map, keys, max, key, url) {
    if (!map[key]) keys.push(key);
    map[key] = url;
    while (keys.length > max) delete map[keys.shift()];
  }

  function askThumbs() {
    if (!V || V.asking || !V.want.length) return;
    var tid = V.tid, token = P.state.token, seqs = V.want.splice(0, BATCH);
    V.asking = seqs;
    P.api("messages_photo", { token: token, thread_id: tid, size: "thumb", seqs: seqs }).then(function (res) {
      if (!V || token !== P.state.token) return;
      V.asking = null;
      if (!res.ok) {
        if (!fatal(res) && res.error.reason === "VIEWS") {
          V.note = "msg_views_limit";
          drawNote();
        }
        return; // the rest are asked for the next time the list is drawn
      }
      arr(res.photos).forEach(function (p) {
        if (p && typeof p.data_url === "string" && p.data_url.indexOf(JPEG) === 0) keep(V.thumbs, V.thumbKeys, 60, tid + "|" + p.seq, p.data_url);
      });
      seqs.forEach(function (s) {
        if (!V.thumbs[tid + "|" + s]) V.gone[tid + "|" + s] = 1;
        var node = tid === V.tid && V.dom && V.dom.list.querySelector('[data-pic="' + s + '"]');
        var m = node && V.msgs.filter(function (x) { return x.seq === s; })[0];
        if (!m) return;
        var focused = doc.activeElement === node, again = pic(m);
        node.parentNode.replaceChild(again, node);
        if (focused && again.focus) quietFocus(again);
      });
      askThumbs();
    });
  }

  function openDialog(label, kids, opener, cls) {
    // A closed dialog's Back is still on its way: open after it.
    if (popping) return (queued = [label, kids, opener, cls]);
    var box = el("div", { class: "msg-dlg" + (cls || ""), role: "dialog", "aria-modal": "true", "aria-label": label, tabindex: "-1" },
      el("div", { class: "msg-dlg-card" }, kids));
    // The question is the dialog's description.
    var q = box.querySelector(".msg-dlg-q");
    if (q) {
      q.id = "msg-dlg-q";
      box.setAttribute("aria-describedby", "msg-dlg-q");
    }
    doc.body.appendChild(box);
    P.inert(true);
    dlg = { el: box, opener: opener };
    try {
      var st = root.history.state;
      root.history.pushState({ cccIdx: ((st && st.cccIdx) || 0) + 1, msgDlg: 1 }, "", root.location.href);
    } catch (e) { /* no history here: Escape and the buttons still close it */ }
    (box.querySelector("button") || box).focus();
  }

  function closeDialog(quiet) {
    if (!dlg) return;
    var d = dlg, o = d.opener, st = root.history.state;
    dlg = null;
    d.el.parentNode.removeChild(d.el);
    P.inert(false);
    if (st && st.msgDlg) {
      popping = true;
      root.setTimeout(popped, 600);
      root.history.back();
    }
    if (o && !doc.body.contains(o)) o = doc.querySelector('#app [data-k="' + o.getAttribute("data-k") + '"]');
    if (!quiet && o) o.focus();
  }

  function popped() {
    var q = queued;
    popping = false;
    queued = null;
    if (q) openDialog.apply(null, q);
  }

  function dialogKeys(e) {
    if (!dlg) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
    } else if (e.key === "Tab") {
      var all = dlg.el.querySelectorAll("button"), first = all[0], last = all[all.length - 1], a = doc.activeElement;
      var out = !dlg.el.contains(a) || a === dlg.el;
      if (e.shiftKey ? a === first || out : a === last || out) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
  }

  function dialogButtons(yes, yesCls, onYes) {
    return el("div", { class: "msg-dlg-btns" }, [button("btn " + yesCls, yes, onYes),
      button("btn btn-secondary", t("msg_cancel"), function () { closeDialog(); })]);
  }

  function viewer(m, opener) {
    var name = named(m, "msg_viewer"), key = V.tid + "|" + m.seq, token = P.state.token;
    var status = el("p", { class: "msg-quiet", role: "status", text: t("msg_loading_photo") }), frame = el("div", { class: "msg-view" });
    openDialog(name, [el("h2", { class: "msg-h2", text: name }), status, frame,
      button("btn btn-secondary", t("close"), function () { closeDialog(); })], opener, " is-viewer");
    function show(url) {
      status.textContent = "";
      frame.appendChild(img(url, name));
    }
    if (V.fulls[key]) return show(V.fulls[key]);
    P.api("messages_photo", { token: token, thread_id: V.tid, size: "full", seqs: [m.seq] }).then(function (res) {
      if (!V || token !== P.state.token || !doc.body.contains(frame)) return;
      var p = res.ok && arr(res.photos)[0];
      if (p && typeof p.data_url === "string" && p.data_url.indexOf(JPEG) === 0) {
        keep(V.fulls, V.fullKeys, 3, key, p.data_url);
        show(p.data_url);
      } else if (res.ok || !fatal(res)) {
        status.textContent = t(res.ok ? "msg_photo_gone" : errKey(res));
      }
    });
  }

  function askHide(m, opener) {
    var q = t(m.photo ? "msg_hide_photo_q" : "msg_hide_q");
    openDialog(q, [el("p", { class: "msg-dlg-q", text: q }), dialogButtons(t("msg_hide_btn"), "msg-danger", function () {
      closeDialog();
      hide(m);
    })], opener);
  }

  function hide(m) {
    var tid = V.tid, token = P.state.token;
    P.api("messages_hide", { token: token, thread_id: tid, seq: m.seq }).then(function (res) {
      if (!V || token !== P.state.token || tid !== V.tid) return;
      var e = res.error || {};
      if (res.ok || (e.field === "seq" && e.reason === "NOT_FOUND")) return drop([m.seq], true);
      if (fatal(res)) return;
      V.note = errKey(res);
      drawNote();
    });
  }

  /* Hidden messages off the screen; focus: to the next one, or the heading. */
  function drop(seqs, focus) {
    var at = -1;
    V.msgs = V.msgs.filter(function (m, i) {
      if (seqs.indexOf(m.seq) < 0) return true;
      if (at < 0) at = i;
      [[V.thumbs, V.thumbKeys], [V.fulls, V.fullKeys]].forEach(function (c) {
        var key = V.tid + "|" + m.seq, i = c[1].indexOf(key);
        delete c[0][key];
        if (i >= 0) c[1].splice(i, 1);
      });
      return false;
    });
    if (at < 0) return;
    drawList();
    var next = focus && V.msgs[at], node = next && V.dom.list.querySelector('[data-seq="' + next.seq + '"]');
    if (node) node.focus();
    else if (focus) focusHead();
  }

  function composer() {
    var d = V.dom;
    d.ta = el("textarea", { id: "msg-ta", class: "msg-ta", rows: 1, maxLength: 1000, "data-k": "ta", autocapitalize: "sentences",
      placeholder: t("msg_write"), "aria-describedby": "msg-count", on: { input: function () {
        V.drafts[V.tid] = d.ta.value;
        sizeBox();
      } } });
    d.ta.value = V.drafts[V.tid] || "";
    d.file = el("input", { type: "file", accept: "image/*", hidden: true, tabindex: "-1", on: { change: picked } });
    d.photo = button("msg-icon", P.icon("camera"), addPhoto, { "aria-label": t("msg_add_photo"), "data-k": "photo" });
    d.send = el("button", { type: "submit", class: "btn btn-primary msg-send", "data-k": "send" });
    d.prev = el("div");
    d.count = el("p", { id: "msg-count", class: "msg-count" });
    d.off = el("p", { class: "offline-note" }, [P.icon("wifiOff"), el("span", { text: t("msg_offline_c") })]);
    d.below = button("btn btn-secondary msg-below", t("msg_below"), function () {
      V.below = false;
      drawComp();
      toBottom();
      read();
      if (d.list.lastChild) d.list.lastChild.focus();
    });
    return el("div", { class: "msg-foot" }, [d.below, d.off, d.prev,
      el("form", { class: "msg-comp", novalidate: true, on: { submit: function (e) {
        e.preventDefault();
        send();
      } } }, [el("label", { class: "sr-only", for: "msg-ta", text: t("msg_write") }), d.photo, d.ta, d.send]),
      d.count, d.file]);
  }

  function drawComp() {
    var d = V.dom, ph = V.photo, ready = !!(ph && ph.full), busy = !!(ph && ph.busy);
    if (!d || !d.ta) return;
    d.off.hidden = online();
    d.photo.hidden = !(V.th.can_photo === true);
    d.photo.disabled = !online() || busy || ready;
    d.send.disabled = !online() || busy;
    clear(d.send);
    d.send.appendChild(P.icon("send"));
    // Under 360 px only the icon shows (messages.css).
    d.send.appendChild(el("span", { class: "msg-send-label", text: t(ready ? "msg_send_photo" : "msg_send") }));
    clear(d.prev);
    if (busy) {
      d.prev.appendChild(el("p", { class: "msg-quiet", role: "status" }, [el("span", { class: "spinner", "aria-hidden": "true" }), " ", t("msg_preparing")]));
    } else if (ready) {
      var line = own() ? t(priv() ? "msg_photo_sup" : "msg_photo_cleaner") : "";
      d.prev.appendChild(el("div", { class: "msg-prev" }, [el("span", { class: "msg-frame is-prev" }, img(JPEG + ph.thumb, t("msg_photo"))),
        el("div", null, [line ? el("p", { class: "msg-prev-line", text: line }) : null, button("link-btn", t("msg_remove_photo"), function () {
          V.photo = null;
          drawComp();
          d.photo.focus();
        }, { "data-k": "rmphoto" })])]));
    }
    d.below.hidden = !V.below;
    sizeBox();
  }

  /* The counter from 900; the box grows where field-sizing is missing. */
  function sizeBox() {
    var d = V.dom, n = d.ta.value.length;
    d.count.textContent = n >= 900 ? t("msg_count", { n: n }) : "";
    d.count.hidden = n < 900;
    if (!(root.CSS && CSS.supports && CSS.supports("field-sizing", "content"))) {
      d.ta.style.height = "auto";
      d.ta.style.height = Math.min(d.ta.scrollHeight + 4, 170) + "px";
    }
  }

  function drawNote() {
    var n = V.dom && V.dom.note;
    if (!n) return;
    clear(n);
    notes().forEach(function (x) { n.appendChild(x); });
  }

  /* In a group the photo rule comes first, every time. */
  function addPhoto() {
    var d = V.dom;
    if (!isGroup()) return d.file.click();
    openDialog(t("msg_add_photo"), [el("p", { class: "msg-dlg-q", text: t("msg_group_photo") }), dialogButtons(t("msg_choose"), "btn-primary", function () {
      closeDialog();
      d.file.click();
    })], d.photo);
  }

  function picked(e) {
    var input = e.target, file = input.files && input.files[0], tid = V.tid;
    if (!file) return;
    V.photo = { busy: true };
    V.note = null;
    drawAll();
    prepare(file).then(function (ph) {
      if (!V || V.tid !== tid) return;
      V.photo = ph;
      drawComp();
      V.dom.ta.focus();
    }, function () {
      if (!V || V.tid !== tid) return;
      V.photo = null;
      V.note = "msg_bad_photo";
      drawAll();
    });
    input.value = "";
  }

  /* docs/API.md 14.14: 1600 px on white, a JPEG under 600,000 bytes, a 320 px thumbnail under 40,000. */
  function prepare(file) {
    if (!file || file.size > 30 * 1024 * 1024) return Promise.reject(new Error("size"));
    return dataUrl(file).then(function (url) {
      var pic0 = new root.Image();
      return new Promise(function (ok, no) {
        pic0.onload = ok;
        pic0.onerror = no;
        pic0.src = url;
      }).then(function () {
        if (!pic0.naturalWidth) throw new Error("empty");
        return shrink(pic0, 1600, [0.82, 0.72, 0.62], 600000);
      }).then(function (full) {
        return full || shrink(pic0, 1280, [0.72, 0.62], 600000);
      }).then(function (full) {
        pic0.src = "";
        if (!full) throw new Error("big");
        return shrink(full.c, 320, [0.7, 0.6], 40000).then(function (thumb) {
          if (!thumb) throw new Error("thumb");
          return Promise.all([base64(full.b), base64(thumb.b)]).then(function (b) {
            return { full: b[0], thumb: b[1], w: full.c.width, h: full.c.height };
          });
        });
      });
    });
  }

  function shrink(src, max, qs, limit) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, k = Math.min(1, max / Math.max(w, h));
    var c = doc.createElement("canvas"), g = c.getContext("2d"), i = 0;
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, c.width, c.height);
    function next() {
      if (i >= qs.length) return Promise.resolve(null);
      return new Promise(function (ok) { c.toBlob(ok, "image/jpeg", qs[i++]); }).then(function (b) {
        return b && b.size <= limit ? { b: b, c: c } : next();
      });
    }
    return next();
  }

  function dataUrl(blob) {
    return new Promise(function (ok, no) {
      var r = new root.FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = no;
      r.readAsDataURL(blob);
    });
  }

  function base64(blob) {
    return dataUrl(blob).then(function (u) {
      if (u.indexOf(JPEG) !== 0) throw new Error("not jpeg");
      return u.slice(JPEG.length);
    });
  }

  function send() {
    var d = V.dom, text = H.cleanDetails(d.ta.value), ph = V.photo && V.photo.full ? V.photo : null;
    if (!online()) return drawComp();
    if (!text && !ph) return d.ta.focus();
    var item = { id: P.randomId(), tid: V.tid, text: text, lang: lang(), photo: ph, at: when().toISOString(), from: { you: true } };
    V.out.push(item);
    d.ta.value = V.drafts[V.tid] = "";
    V.photo = V.note = null;
    drawAll();
    push(item);
    toBottom();
    d.ta.focus();
  }

  /* Try again keeps the client_msg_id, so the office gets it once. */
  function push(item) {
    var token = P.state.token, body = { token: token, thread_id: item.tid, text: item.text, lang: item.lang, client_msg_id: item.id };
    if (item.photo) body.photo = { full: item.photo.full, thumb: item.photo.thumb };
    item.state = "sending";
    drawList();
    P.api("messages_send", body).then(function (res) {
      if (!V || token !== P.state.token) return;
      var e = res.error || {};
      if (e.code === "NETWORK" || e.code === "SERVER") {
        item.state = "failed";
        return drawList();
      }
      V.out = V.out.filter(function (o) { return o !== item; });
      if (res.ok && isMsg(res.message)) {
        if (item.photo) keep(V.thumbs, V.thumbKeys, 60, item.tid + "|" + res.message.seq, JPEG + item.photo.thumb);
        if (item.tid !== V.tid) return;
        V.msgs = merge(V.msgs, [res.message]);
        V.readTo = V.readSent = Math.max(V.readSent, res.message.seq);
        return drawList();
      }
      // Refused: the words, and a photo that was not the problem, go back.
      if (fatal(res) || item.tid !== V.tid || !V.dom || !V.dom.ta) return;
      if (e.reason === "PHOTOS_OFF") V.th.can_photo = false;
      if (e.reason === "READ_ONLY") V.th.can_post = false;
      if (!V.dom.ta.value) V.dom.ta.value = V.drafts[V.tid] = item.text;
      if (item.photo && !/PHOTOS|NOT_JPEG|TOO_LARGE/.test(e.reason || "") && e.field !== "photo") V.photo = item.photo;
      V.note = errKey(res);
      refresh(e.reason === "READ_ONLY");
    });
  }

  function atBottom() {
    var h = doc.documentElement;
    return root.innerHeight + root.scrollY >= h.scrollHeight - 120;
  }

  // V.pos: the app's own scroll, not a tap.
  function toBottom() { root.scrollTo(0, doc.documentElement.scrollHeight); V.pos = root.scrollY; }

  function read() { V.readTo = Math.max(V.readTo, lastSeq()); }

  function live() {
    return !!V && !V.off && !!V.list && inside() && V.view !== "rules" && rulesOk() && doc.visibilityState !== "hidden" && online() && !!P.state.token;
  }

  function stop() {
    if (V && V.poll.timer) clock.clear(V.poll.timer);
    if (V) V.poll.timer = 0;
  }

  /* The next poll by idle time (docs/API.md 14.7). floor: at least this long, still pausing. */
  function plan(ms, floor) {
    stop();
    if (!live()) return;
    var p = V.poll, idle = Math.max(0, clock.now() - p.active);
    if (ms === undefined) {
      ms = STEPS.filter(function (s) { return idle >= s[0]; })[0][1];
      if (!ms) {
        if (!p.paused) { p.paused = true; redrawNotes(); }
        return;
      }
      if (floor) ms = Math.max(ms, floor);
    }
    p.wait = ms;
    p.timer = clock.set(poll, ms);
  }

  /* A tap, key, focus or scroll (not the app's own): 15 s, polling at once if slowed. */
  function wake(now) {
    if (!V || !inside() || restoring) return;
    var p = V.poll, slow = p.paused || clock.now() - p.active >= STEPS[2][0];
    p.active = clock.now();
    if (p.paused) { p.paused = false; redrawNotes(); }
    if ((slow || now === true) && !p.busy) plan(0);
  }

  function redrawNotes() {
    if (route === "chat") drawNote();
    else if (V.view === "list") refresh();
  }

  function poll() {
    var p = V && V.poll;
    if (!p) return;
    p.timer = 0;
    if (!live() || p.busy) return;
    var token = P.state.token, tid = route === "chat" && V.th ? V.tid : "", body = { token: token, since: V.head };
    if (tid) body.thread_id = tid;
    if (tid && V.readTo > V.readSent) body.read = V.readTo;
    p.busy = true;
    P.api("messages_poll", body).then(function (res) {
      if (!V || token !== P.state.token) return;
      p.busy = false;
      if (!res.ok) {
        if (fatal(res)) return;
        if (++p.fails === 3) redrawNotes();
        return plan(undefined, 60000);
      }
      var was = p.fails;
      p.fails = 0;
      if (body.read) V.readSent = Math.max(V.readSent, body.read);
      if (res.reset) {
        loadList();
        if (tid && tid === V.tid) loadThread();
      } else if (res.changed) {
        apply(res, tid);
        p.active = clock.now();
      } else {
        V.head = Number(res.head) || V.head;
        if (was >= 3) redrawNotes();
      }
      plan();
    });
  }

  /* News: the lists, the badge, and the thread on screen. */
  function apply(res, tid) {
    var L = V.list, known = {}, fresh = [], bottom = atBottom();
    V.head = Number(res.head) || V.head;
    if (res.inbox && L.inbox) res.inbox.people = L.inbox.people;
    ["office_thread", "inbox", "groups", "badge"].forEach(function (k) { if (res[k] != null) L[k] = res[k]; });
    if (!tid || tid !== V.tid || !V.dom) return route === "messages" && V.view === "list" && refresh();
    V.msgs.forEach(function (m) { known[m.seq] = 1; });
    arr(res.messages).filter(isMsg).forEach(function (m) { if (!known[m.seq]) fresh.push(m); });
    V.msgs = merge(V.msgs, fresh);
    drop(arr(res.hidden), false);
    if (!fresh.length) return;
    zeroUnread(tid);
    drawList();
    var theirs = fresh.filter(function (m) { return !m.from.you; }), said = V.dom.live;
    said.textContent = "";
    if (theirs.length) Promise.resolve().then(function () { said.textContent = t("msg_live", { name: nameOf(theirs[theirs.length - 1]) }); });
    if (bottom) { toBottom(); read(); } else if (theirs.length) { V.below = true; drawComp(); }
  }

  /* Draws again, keeping the focus; a chat in place unless full. */
  function refresh(full) {
    if (!V || !inside()) return;
    var a = doc.activeElement, k = a && a.getAttribute && a.getAttribute("data-k");
    if (!full && route === "chat" && V.dom && doc.body.contains(V.dom.list)) drawAll();
    else P.render();
    var n = k && doc.querySelector('#app [data-k="' + k + '"]');
    if (n && n !== doc.activeElement) quietFocus(n);
  }

  function wire() {
    if (wired) return;
    wired = true;
    ["pointerdown", "keydown", "focusin"].forEach(function (ev) { doc.addEventListener(ev, wake, true); });
    doc.addEventListener("keydown", dialogKeys);
    root.addEventListener("scroll", function () {
      if (!V || route !== "chat") return;
      if (root.scrollY !== V.pos) wake();
      seen();
      if (V.below && atBottom()) { V.below = false; drawComp(); read(); }
    }, { passive: true });
    // Hidden or offline: no polling. Visible or online: a poll at once.
    [[doc, "visibilitychange"], [root, "online"], [root, "offline"]].forEach(function (x) {
      x[0].addEventListener(x[1], function () {
        if (!V || !inside()) return;
        V.poll.active = clock.now();
        if (x[0] === root) refresh();
        plan(0);
      });
    });
    root.addEventListener("popstate", function () {
      if (popping) popped();
      else if (dlg && !(root.history.state && root.history.state.msgDlg)) closeDialog();
    });
    var icons = P.icons;
    icons.camera = [["path", { d: "M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" }], ["circle", { cx: 12, cy: 13, r: 4 }]];
    icons.send = [["path", { d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" }]];
    icons.dots = [5, 12, 19].map(function (x) { return ["circle", { cx: x, cy: 12, r: 1.6 }]; });
  }

  function screen(r) {
    P = P || root.CCCPortal;
    H = H || root.CCCHelpers;
    wire();
    route = r;
    V = V || blank();
    var body, cls = V.view;
    if (V.fresh) {
      V.fresh = V.off = false;
      V.poll.active = clock.now();
      V.poll.paused = false;
      V.poll.fails = 0;
      loadList();
    }
    if (V.off) {
      cls = "off";
      body = [heading(t("msg_title"), P.backButton("home")), P.msgBox("info", "info", t("msg_off"))];
    } else if (!rulesOk() || V.view === "rules") {
      cls = "rules";
      body = rulesScreen();
    } else if (r === "chat" && V.tid) {
      cls = "chat";
      if (!V.th && !V.busy) loadThread();
      body = chatScreen();
    } else if (r === "chat") {
      Promise.resolve().then(function () { if (route === "chat" && V && !V.tid) P.go("messages", true); });
      body = [P.loading(false)];
    } else if (!online() && !V.list) {
      body = [heading(t("msg_title"), P.backButton("home")), banner(false), P.msgBox("wait", "wifiOff", t("msg_offline"))];
    } else {
      V.dom = null;
      body = V.view === "pick" && V.list && V.list.inbox ? pickScreen() : listScreen();
    }
    if (!V.poll.timer && !V.poll.busy) plan();
    return el("div", { class: "msg is-" + cls }, body);
  }

  root.CCCMsg = {
    screen: screen,
    /* Outside Messages polling stops and home gets the badge. */
    route: function (r) {
      var was = inside();
      route = r;
      if (!V) return;
      if (r !== "chat") V.dom = null;
      if (inside()) {
        V.fresh = V.fresh || !was;
        return;
      }
      stop();
      closeDialog(true);
      V.below = false;
      if (V.list && typeof V.list.badge === "number") P.setBadge(V.list.badge);
    },
    /* Sign out: everything goes. */
    reset: function () {
      stop();
      closeDialog(true);
      V = null;
    },
    clock: clock,
    errKey: errKey,
    prepare: prepare,
    debug: function () {
      return V && { tid: V.tid, poll: V.poll, thumbs: V.thumbKeys.slice(), fulls: V.fullKeys.slice(), dialog: !!dlg };
    }
  };
})(window);
