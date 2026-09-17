/* CCC Team Portal app.
 *
 * Structure:
 *   1. Pure helpers, exported as window.CCCHelpers (unit tested in tests/web/).
 *   2. Safe storage, DOM builder and inline SVG icons.
 *   3. State, router and screens.
 *   4. Boot (skipped when window.CCC_NO_BOOT is true, as on the test page).
 *
 * Security: API and storage data is only ever put in the page with textContent
 * or setAttribute. Never assign HTML strings to the page here.
 */
(function (root) {
  "use strict";

  var I = root.CCC_I18N;
  var doc = root.document;

  /* ---- 1. Pure helpers ---- */

  var CATEGORIES = ["schedule", "pay", "my_info", "property", "other"];
  var CONTACTS = ["whatsapp", "call", "text", "none"];
  var DETAILS_MIN = 10;
  var DETAILS_MAX = 1000;
  var KEY_RE = /^[A-Za-z0-9_-]{16,64}$/; // client_request_id

  function ymdToday(now) {
    return I.toYMD(now || new Date());
  }

  /* YYYY-MM-DD in New York (the server's zone), or the phone's date without Intl zones. */
  var nyFmt = null;
  function nyYmd(now) {
    var d = now || new Date();
    try {
      nyFmt = nyFmt || new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
      var p = {};
      nyFmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      if (/^\d{4}$/.test(p.year) && p.month && p.day) return p.year + "-" + p.month + "-" + p.day;
    } catch (e) { /* no Intl time zones */ }
    return I.toYMD(d);
  }

  /* Whole calendar days from a to b (b minus a), safe across DST changes. */
  function daysBetween(fromYmd, toYmd) {
    var a = I.parseYMD(fromYmd), b = I.parseYMD(toYmd);
    if (!a || !b) return null;
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / 86400000);
  }

  function validPeriods(periods) {
    if (!Array.isArray(periods)) return [];
    return periods
      .filter(function (p) {
        return p && I.parseYMD(p.payday) && I.parseYMD(p.period_start) && I.parseYMD(p.period_end);
      })
      .slice()
      .sort(function (a, b) {
        return a.payday < b.payday ? -1 : a.payday > b.payday ? 1 : 0;
      });
  }

  /* The first period whose payday is today or later. A pending payday stays
     "next" for up to 13 days after its placeholder date, until the office confirms it.
     On day 14 the following regular payday is today, so it takes over. */
  function nextPayday(periods, todayYmd) {
    var list = validPeriods(periods);
    for (var i = 0; i < list.length; i++) {
      if (list[i].payday >= todayYmd || (isPending(list[i]) && daysBetween(list[i].payday, todayYmd) < 14)) return list[i];
    }
    return null;
  }

  /* The work period that contains today. */
  function currentPeriod(periods, todayYmd) {
    var list = validPeriods(periods);
    for (var i = 0; i < list.length; i++) {
      if (list[i].period_start <= todayYmd && todayYmd <= list[i].period_end) return list[i];
    }
    return null;
  }

  function isPending(period) {
    return !!period && period.status === "pending";
  }

  /* Countdown for the hero card. kind: pending | today | tomorrow | days | past */
  function countdown(paydayYmd, todayYmd, lang, pending) {
    if (pending) return { kind: "pending", text: I.t(lang, "to_be_confirmed") };
    var n = daysBetween(todayYmd, paydayYmd);
    if (n === null) return { kind: "pending", text: I.t(lang, "to_be_confirmed") };
    if (n < 0) return { kind: "past", text: I.t(lang, "chip_passed") };
    if (n === 0) return { kind: "today", text: I.t(lang, "today_excl") };
    if (n === 1) return { kind: "tomorrow", text: I.t(lang, "tomorrow") };
    return { kind: "days", text: I.t(lang, "in_days", { n: n }) };
  }

  /* A pending period is never "past": the app cannot claim a payday happened. */
  function periodFlags(period, todayYmd) {
    return {
      past: !isPending(period) && period.payday < todayYmd,
      current: period.period_start <= todayYmd && todayYmd <= period.period_end,
      pending: isPending(period)
    };
  }

  function groupByYear(periods) {
    var groups = [];
    validPeriods(periods).forEach(function (p) {
      var y = I.formatYear(p.payday);
      if (!groups.length || groups[groups.length - 1].year !== y) groups.push({ year: y, items: [] });
      groups[groups.length - 1].items.push(p);
    });
    return groups;
  }

  function greetingKey(hour) {
    if (hour < 12) return "greet_morning";
    if (hour < 18) return "greet_afternoon";
    return "greet_evening";
  }

  /* The team in Hawaii gets "Aloha": the region names Hawaii, an island or Honolulu, in any case,
     with or without accents and okinas (Hawái, Oʻahu). */
  function isHawaii(region) {
    var r = String(region == null ? "" : region).toLowerCase();
    if (r.normalize) r = r.normalize("NFD");
    return /hawai|oahu|maui|kauai|honolulu/.test(r.replace(/[^a-z]/g, ""));
  }

  function langFromSearch(search) {
    var m = /[?&]lang=(en|es)(?:&|#|$)/i.exec(search || "");
    return m ? m[1].toLowerCase() : null;
  }

  /* URL wins, then the saved choice, then the roster language, then the phone setting. */
  function resolveLang(o) {
    o = o || {};
    var ok = function (v) { return v === "en" || v === "es"; };
    if (ok(o.urlLang)) return o.urlLang;
    if (ok(o.savedLang)) return o.savedLang;
    if (ok(o.personLang)) return o.personLang;
    if (typeof o.navLang === "string" && /^es\b/i.test(o.navLang)) return "es";
    return "en";
  }

  /* Mirrors the server: drop control characters (U+0000 to U+001F and
     U+007F to U+009F) except newline, then trim. */
  function cleanDetails(text) {
    var s = String(text == null ? "" : text);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 10 || (c > 31 && (c < 127 || c > 159))) out += s.charAt(i);
    }
    return out.trim();
  }

  /* Adds whole days to a YYYY-MM-DD date. */
  function addDays(ymd, n) {
    var d = I.parseYMD(ymd);
    if (!d) return null;
    return I.toYMD(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  }

  /* Today for pay math, as a New York date: server_today plus the days that passed
     since the dashboard was saved, both counted in New York time (saved_ny_day), so
     it works offline, in any US time zone and with a wrong phone clock. */
  function effectiveToday(serverToday, savedNyDay, nyToday) {
    if (!I.parseYMD(serverToday)) return nyToday;
    if (!I.parseYMD(nyToday)) return serverToday;
    if (!I.parseYMD(savedNyDay)) return nyToday > serverToday ? nyToday : serverToday;
    var passed = daysBetween(savedNyDay, nyToday);
    return passed > 0 ? addDays(serverToday, passed) : serverToday;
  }

  /* Today for a saved dashboard at the moment now. */
  function todayFor(dash, now) {
    return effectiveToday(dash && dash.pay && dash.pay.server_today, dash && dash.saved_ny_day, nyYmd(now));
  }

  function validateRequest(d) {
    d = d || {};
    if (CATEGORIES.indexOf(d.category) < 0) return { ok: false, field: "category", key: "err_topic" };
    var details = cleanDetails(d.details);
    if (details.length < DETAILS_MIN) return { ok: false, field: "details", key: "err_details_short" };
    if (details.length > DETAILS_MAX) return { ok: false, field: "details", key: "err_details_long" };
    var contact = d.contact_pref == null || d.contact_pref === "" ? "whatsapp" : d.contact_pref;
    if (CONTACTS.indexOf(contact) < 0) return { ok: false, field: "contact_pref", key: "err_contact" };
    return { ok: true, value: { category: d.category, details: details, contact_pref: contact } };
  }

  function minutesLeft(untilMs, nowMs) {
    return Math.max(0, Math.ceil((untilMs - nowMs) / 60000));
  }

  function minutesText(n, lang) {
    return n === 60 ? I.t(lang, "time_hour_one") : n === 1 ? I.t(lang, "time_minute_one") : I.t(lang, "time_minutes", { n: n });
  }

  /* "My info" details and office replies never stay on the phone. The server already
     blanks them; this makes sure before anything is shown or saved. */
  function hideInfo(r) {
    if (!r || typeof r !== "object" || (r.category !== "my_info" && r.details_hidden !== true && r.reply_hidden !== true)) return r;
    var c = {};
    Object.keys(r).forEach(function (k) { c[k] = r[k]; });
    c.details = "";
    c.details_hidden = true;
    c.reply_hidden = r.reply_hidden === true || (typeof r.reply === "string" && r.reply.trim() !== "");
    c.reply = "";
    return c;
  }

  function hideDash(d) {
    if (d && Array.isArray(d.requests)) d.requests = d.requests.map(hideInfo);
    return d;
  }

  function statusInfo(status) {
    if (status === "in_progress") return { key: "status_in_progress", cls: "chip-progress" };
    if (status === "done") return { key: "status_done", cls: "chip-done" };
    return { key: "status_new", cls: "chip-new" };
  }

  function categoryKey(cat) {
    return CATEGORIES.indexOf(cat) >= 0 ? "cat_" + cat : "cat_other";
  }

  /* ISO UTC timestamp to a short local date in the chosen language. */
  function formatIsoDate(iso, lang) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return "";
    return I.formatShort(I.toYMD(d), lang);
  }

  function initialOf(label) {
    var s = String(label || "").trim();
    return s ? s.charAt(0).toLocaleUpperCase() : "?";
  }

  /* Only http(s) links, absolute or relative. Anything else becomes "". */
  function safeUrl(url, base) {
    if (typeof url !== "string" || !url.trim()) return "";
    try {
      var u = new URL(url.trim(), base || root.location.href);
      return u.protocol === "https:" || u.protocol === "http:" ? url.trim() : "";
    } catch (e) {
      return "";
    }
  }

  /* "Friday, September 18" -> "Friday, September&nbsp;18" and
     "viernes, 18 de septiembre" -> "viernes, 18&nbsp;de&nbsp;septiembre",
     so a long date only breaks after the weekday. */
  function noWrapDate(text) {
    return String(text || "").replace(/, (.+)$/, function (m, rest) {
      return ", " + rest.replace(/ /g, "\u00a0");
    });
  }

  function pickText(obj, lang) {
    if (!obj || typeof obj !== "object") return "";
    var a = typeof obj[lang] === "string" ? obj[lang].trim() : "";
    if (a) return a;
    var other = lang === "es" ? "en" : "es";
    return typeof obj[other] === "string" ? obj[other].trim() : "";
  }

  /* ---- Birthdays ---- */

  /* The only wishes the backend accepts: party popper, cake, balloon, partying face, heart, present. */
  var WISH_EMOJIS = ["\uD83C\uDF89", "\uD83C\uDF82", "\uD83C\uDF88", "\uD83E\uDD73", "\u2764\uFE0F", "\uD83C\uDF81"];

  /* The dashboard's celebrations, cleaned, and only while that dashboard is from today in New York. */
  function todaysCelebrations(dash, now) {
    if (!dash || !Array.isArray(dash.celebrations) || !dash.pay || !I.parseYMD(dash.pay.server_today)) return [];
    if (todayFor(dash, now || new Date()) !== dash.pay.server_today) return [];
    return dash.celebrations.filter(function (c) {
      return c && typeof c.person_id === "string" && c.person_id && typeof c.display_name === "string";
    }).map(function (c) {
      return {
        person_id: c.person_id,
        first_name: typeof c.first_name === "string" && c.first_name.trim() ? c.first_name.trim() : c.display_name,
        display_name: c.display_name,
        is_you: c.is_you === true,
        demo: c.demo === true,
        wish_count: Math.max(0, Math.floor(Number(c.wish_count)) || 0),
        my_wishes: WISH_EMOJIS.filter(function (e) { return Array.isArray(c.my_wishes) && c.my_wishes.indexOf(e) >= 0; })
      };
    });
  }

  /* What a card shows: the saved wishes plus the ones still on their way (optimistic). */
  function wishView(c, pending) {
    var mine = c.my_wishes.slice();
    var count = c.wish_count;
    WISH_EMOJIS.forEach(function (e) {
      if (pending && pending[e] && mine.indexOf(e) < 0) {
        mine.push(e);
        count++;
      }
    });
    return { my_wishes: WISH_EMOJIS.filter(function (e) { return mine.indexOf(e) >= 0; }), wish_count: count };
  }

  function wishCountText(n, lang, you) {
    var base = you ? "bday_you_count" : "bday_count";
    return I.t(lang, n === 0 ? base + "_zero" : n === 1 ? base + "_one" : base, { n: n });
  }

  /* The celebration shows once a day per phone for each set of people: the key names the day and the ids. */
  function partyKey(serverToday, list) {
    return "ccc.party:" + serverToday + ":" + list.map(function (c) { return c.person_id; }).sort().join(",");
  }

  /* How the celebration moves. Reduced motion: confetti drawn once, balloons that stand still, no buzz. */
  function partyPlan(reduced) {
    return reduced
      ? { motion: "reduced", bursts: [], field: 90, rain_ms: 0, balloons: "still", vibrate: null }
      : { motion: "full", bursts: [[0, "center", 260], [220, "corners", 140], [700, "center", 180]], field: 0, rain_ms: 4500,
        balloons: "rise", vibrate: [40, 60, 40, 60, 120] };
  }

  function joinNames(names, lang) {
    if (names.length < 2) return names.join("");
    var last = names[names.length - 1];
    // Spanish writes "e" for "y" before the sound i (Isabel, Hilda), but not before hie or hia (Hierro).
    var and = lang === "es" && /^h?[i\u00ed](?![aeiou\u00e1\u00e9\u00ed\u00f3\u00fa])/i.test(last) ? "party_and_i" : "party_and";
    return names.slice(0, -1).join(", ") + " " + I.t(lang, and) + " " + last;
  }

  /* Merges a wish answer into a celebration. A person's wishes of the day only ever grow, so an
     answer that arrives late can never take back a wish or lower the count. */
  function mergeWish(c, res) {
    var mine = (Array.isArray(c.my_wishes) ? c.my_wishes : []).concat(Array.isArray(res.my_wishes) ? res.my_wishes : []);
    return {
      wish_count: Math.max(Math.floor(Number(c.wish_count)) || 0, Math.floor(Number(res.wish_count)) || 0),
      my_wishes: WISH_EMOJIS.filter(function (e) { return mine.indexOf(e) >= 0; })
    };
  }

  /* wishes_received, cleaned: allowed emojis and names only, at most 100. */
  function receivedWishes(dash) {
    var list = dash && Array.isArray(dash.wishes_received) ? dash.wishes_received : [];
    return list.filter(function (w) {
      return w && typeof w.from_display === "string" && WISH_EMOJIS.indexOf(w.emoji) >= 0;
    }).slice(0, 100);
  }

  /* ---- The message from the CEO ---- */

  /* It opens by itself only for a new hire: the dashboard's own person says show_welcome is exactly true
     (a dashboard saved by an older version has no show_welcome, so it never opens by itself). */
  function wantsWelcome(dash) {
    var p = dash && dash.person;
    return !!p && p.show_welcome === true && typeof p.id === "string" && p.id !== "";
  }

  /* Once per person on this phone. The key stays after sign out, so it never opens again for that person. */
  function welcomeKey(personId) {
    return "ccc.welcome:" + personId;
  }

  var Helpers = {
    CATEGORIES: CATEGORIES,
    wantsWelcome: wantsWelcome,
    welcomeKey: welcomeKey,
    WISH_EMOJIS: WISH_EMOJIS,
    todaysCelebrations: todaysCelebrations,
    wishView: wishView,
    wishCountText: wishCountText,
    partyKey: partyKey,
    partyPlan: partyPlan,
    joinNames: joinNames,
    mergeWish: mergeWish,
    receivedWishes: receivedWishes,
    CONTACTS: CONTACTS,
    ymdToday: ymdToday,
    nyYmd: nyYmd,
    todayFor: todayFor,
    daysBetween: daysBetween,
    validPeriods: validPeriods,
    nextPayday: nextPayday,
    currentPeriod: currentPeriod,
    isPending: isPending,
    countdown: countdown,
    periodFlags: periodFlags,
    groupByYear: groupByYear,
    greetingKey: greetingKey,
    isHawaii: isHawaii,
    langFromSearch: langFromSearch,
    resolveLang: resolveLang,
    cleanDetails: cleanDetails,
    addDays: addDays,
    effectiveToday: effectiveToday,
    validateRequest: validateRequest,
    minutesLeft: minutesLeft,
    minutesText: minutesText,
    hideInfo: hideInfo,
    hideDash: hideDash,
    statusInfo: statusInfo,
    categoryKey: categoryKey,
    formatIsoDate: formatIsoDate,
    initialOf: initialOf,
    safeUrl: safeUrl,
    noWrapDate: noWrapDate,
    pickText: pickText
  };
  root.CCCHelpers = Helpers;

  /* ---- 2. Storage, DOM builder, icons ---- */

  var K = {
    token: "ccc.token",
    person: "ccc.person",
    dash: "ccc.dash",
    device: "ccc.device",
    lang: "ccc.lang",
    a2hs: "ccc.a2hs_dismissed",
    lock: "ccc.lock_until",
    draft: "ccc.draft",
    party: "ccc.party:"
  };

  var memStore = {};
  var store = {
    get: function (k) {
      try {
        var v = root.localStorage.getItem(k);
        if (v !== null) return v;
      } catch (e) { /* storage blocked */ }
      return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null;
    },
    set: function (k, v) {
      memStore[k] = String(v);
      try { root.localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked or full */ }
    },
    remove: function (k) {
      delete memStore[k];
      try { root.localStorage.removeItem(k); } catch (e) { /* storage blocked */ }
    },
    getJSON: function (k) {
      var v = store.get(k);
      if (v === null) return null;
      try { return JSON.parse(v); } catch (e) { return null; }
    },
    setJSON: function (k, v) {
      try { store.set(k, JSON.stringify(v)); } catch (e) { /* not serializable */ }
    }
  };
  Helpers.store = store;

  function randomId() {
    var bytes = [];
    try {
      var arr = new Uint8Array(16);
      root.crypto.getRandomValues(arr);
      for (var i = 0; i < arr.length; i++) bytes.push(arr[i]);
    } catch (e) {
      for (var j = 0; j < 16; j++) bytes.push(Math.floor(Math.random() * 256));
    }
    return bytes.map(function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
  }

  var PROPS = { disabled: 1, checked: 1, value: 1, hidden: 1, maxLength: 1, rows: 1 };

  /* h("button", {class: "btn", text: "Hi", on: {click: fn}}, [children]) */
  function h(tag, attrs, children) {
    var el = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var v = attrs[key];
        if (v === null || v === undefined || v === false) return;
        if (key === "class") el.className = v;
        else if (key === "text") el.textContent = v;
        else if (key === "on") {
          Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
        } else if (PROPS[key]) el[key] = v;
        else el.setAttribute(key, v === true ? "" : String(v));
      });
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    if (children === null || children === undefined) return el;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === "string" || typeof c === "number" ? doc.createTextNode(String(c)) : c);
    });
    return el;
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  var ICONS = {
    dayOff: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ["path", { d: "M16 2v4M8 2v4M3 10h18M10 14l4 4M14 14l-4 4" }]],
    survey: [["rect", { x: 8, y: 2, width: 8, height: 4, rx: 1 }], ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }], ["path", { d: "M9 14l2 2 4-4" }]],
    calendar: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ["path", { d: "M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" }]],
    message: [["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }], ["path", { d: "M8 8h8M8 12h5" }]],
    chevronRight: [["path", { d: "M9 18l6-6-6-6" }]],
    chevronLeft: [["path", { d: "M15 18l-6-6 6-6" }]],
    external: [["path", { d: "M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]],
    pin: [["path", { d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" }], ["circle", { cx: 12, cy: 10, r: 3 }]],
    backspace: [["path", { d: "M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" }], ["path", { d: "M18 9l-6 6M12 9l6 6" }]],
    alert: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 8v4M12 16h.01" }]],
    clock: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 6v6l4 2" }]],
    wifiOff: [["path", { d: "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5c4-.4 8.1.9 11.3 3.8M16.9 11.3a10 10 0 0 1 2.2 1.7M5 13a10 10 0 0 1 5.2-2.8M2 2l20 20" }]],
    megaphone: [["path", { d: "M3 11l18-5v12L3 14v-3z" }], ["path", { d: "M11.6 16.8a3 3 0 1 1-5.8-1.6" }]],
    lock: [["rect", { x: 3, y: 11, width: 18, height: 11, rx: 2 }], ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }]],
    check: [["path", { d: "M20 6L9 17l-5-5" }]],
    close: [["path", { d: "M18 6L6 18M6 6l12 12" }]],
    info: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 16v-4M12 8h.01" }]],
    download: [["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" }]],
    share: [["path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" }]],
    phone: [["rect", { x: 5, y: 2, width: 14, height: 20, rx: 2 }], ["path", { d: "M12 18h.01" }]],
    reply: [["path", { d: "M9 17l-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4" }]],
    briefcase: [["rect", { x: 2, y: 7, width: 20, height: 14, rx: 2 }], ["path", { d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" }]],
    refresh: [["path", { d: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" }]],
    wallet: [["rect", { x: 2, y: 6, width: 20, height: 12, rx: 2 }], ["circle", { cx: 12, cy: 12, r: 2 }], ["path", { d: "M6 12h.01M18 12h.01" }]],
    arrowRight: [["path", { d: "M5 12h14M13 6l6 6-6 6" }]],
    cap: [["path", { d: "M22 10L12 5 2 10l10 5 10-5z" }], ["path", { d: "M6 12v5c3 2.7 9 2.7 12 0v-5M22 10v6" }]]
  };

  function svgEl(tag, attrs, children) {
    var el = doc.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (a) { el.setAttribute(a, String(attrs[a])); });
    (children || []).forEach(function (c) { el.appendChild(c); });
    return el;
  }

  function icon(name) {
    return svgEl("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round",
      "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" },
    (ICONS[name] || []).map(function (spec) { return svgEl(spec[0], spec[1]); }));
  }

  /* A small gem: its outline, the table on top and the facet lines (the PIN dots and the CEO welcome burst). */
  function gemSvg() {
    return svgEl("svg", { viewBox: "0 0 30 26", "aria-hidden": "true" },
      [["pg", "M8 2h14l6.5 8L15 24 1.5 10z"], ["pc", "M8 2l3.5 8h7L22 2z"], ["pf", "M1.5 10h27M8 2l3.5 8L15 24l3.5-14L22 2"]].map(function (p) {
        return svgEl("path", { class: p[0], d: p[1] });
      }));
  }

  /* The birthday cake of the approved preview, with candles that flicker. */
  var CAKE = [
    ["ellipse", { cx: 60, cy: 108, rx: 48, ry: 7, fill: "#000", opacity: 0.18 }],
    ["rect", { x: 10, y: 98, width: 100, height: 8, rx: 4, fill: "#E6E2F5" }],
    ["rect", { x: 16, y: 66, width: 88, height: 34, rx: 8, fill: "url(#ccc-sponge2)" }],
    ["path", { d: "M16 72c6 8 12 8 18 0s12-8 18 0 12 8 18 0 12-8 18 0 10 7 16 0v-6H16z", fill: "url(#ccc-frost)" }],
    ["circle", { cx: 30, cy: 88, r: 3, fill: "#fff" }], ["circle", { cx: 52, cy: 92, r: 3, fill: "#FFD27A" }],
    ["circle", { cx: 74, cy: 88, r: 3, fill: "#fff" }], ["circle", { cx: 92, cy: 92, r: 3, fill: "#FFD27A" }],
    ["rect", { x: 28, y: 40, width: 64, height: 28, rx: 7, fill: "url(#ccc-sponge1)" }],
    ["path", { d: "M28 46c5 7 11 7 16 0s11-7 16 0 11 7 16 0 11-7 16 0v-6H28z", fill: "url(#ccc-frost)" }],
    ["rect", { x: 44, y: 22, width: 5, height: 19, rx: 2, fill: "#6BA9F8" }], ["rect", { x: 58, y: 18, width: 5, height: 23, rx: 2, fill: "#FFC857" }],
    ["rect", { x: 72, y: 22, width: 5, height: 19, rx: 2, fill: "#FF8FB1" }]
  ];

  function cakeSvg(cls) {
    if (!doc.getElementById("ccc-cake-defs")) {
      // The gradients live once in the page, so every cake can point at them.
      doc.body.appendChild(svgEl("svg", { id: "ccc-cake-defs", class: "svg-defs", "aria-hidden": "true", focusable: "false" }, [
        svgEl("defs", null, [["ccc-frost", "#FFFFFF", "#FDEBDD"], ["ccc-sponge1", "#F6A078", "#E9835A"], ["ccc-sponge2", "#82CAFB", "#5FA9E6"]].map(function (g) {
          return svgEl("linearGradient", { id: g[0], x1: 0, x2: 0, y1: 0, y2: 1 }, [
            svgEl("stop", { offset: 0, "stop-color": g[1] }), svgEl("stop", { offset: 1, "stop-color": g[2] })]);
        }))
      ]));
    }
    var kids = CAKE.map(function (spec) { return svgEl(spec[0], spec[1]); });
    [[46.5, 12], [60.5, 8], [74.5, 12]].forEach(function (f) {
      kids.push(svgEl("g", { class: "flame" }, [
        svgEl("path", { d: "M" + f[0] + " " + f[1] + "c3 4 4 6 0 9c-4-3-3-5 0-9z", fill: "#FFB020" }),
        svgEl("path", { d: "M" + f[0] + " " + (f[1] + 3) + "c1.5 2 2 3 0 5c-2-2-1.5-3 0-5z", fill: "#FFF3B0" })
      ]));
    });
    return svgEl("svg", { viewBox: "0 0 120 120", class: cls || "cake", "aria-hidden": "true", focusable: "false" }, kids);
  }

  /* Image that swaps to a text fallback if the file is missing. */
  function imgWithFallback(src, alt, cls, fallbackNode) {
    var img = doc.createElement("img");
    if (cls) img.className = cls;
    img.alt = alt;
    img.decoding = "async";
    img.addEventListener("error", function () {
      if (img.parentNode) img.parentNode.replaceChild(fallbackNode, img);
    });
    img.src = src;
    return img;
  }

  /* ---- 3. State, router, shared UI ---- */

  var CFG = root.CCC_CONFIG || {};
  var APP_VERSION = CFG.APP_VERSION || "0.3.1";

  var state = {
    lang: "en",
    urlLang: null,
    token: null,
    person: null,
    dash: null,
    deviceId: null,
    pin: "",
    busy: false,
    loginMsg: null, // {kind: "error"|"wait"|"info"|"network", key, vars}
    choices: null,
    choicePin: null,
    lockUntil: 0,
    draft: { category: "", details: "", contact_pref: "whatsapp" },
    reqErrors: {},
    reqStatus: null, // i18n key of a form level message
    sending: false,
    lastRequest: null,
    refreshing: false,
    lastRefresh: 0,
    netDown: false,
    loadError: null,
    installPrompt: null,
    flash: null,
    wishPending: {} // person id -> {emoji: true} while a wish is on its way
  };

  var ROUTES = ["login", "choose", "home", "calendar", "request", "requests", "done", "training", "welcome"];
  var AUTH_ROUTES = { home: 1, calendar: 1, request: 1, requests: 1, done: 1, training: 1, welcome: 1 };
  var DATA_ROUTES = { home: 1, calendar: 1, requests: 1 };
  var currentRoute = null;
  var lockTimer = null;

  function t(key, vars) {
    return I.t(state.lang, key, vars);
  }

  function $(id) {
    return doc.getElementById(id);
  }

  function isOnline() {
    return root.navigator.onLine !== false;
  }

  function routeFromHash() {
    var m = /^#\/([a-z]+)/.exec(root.location.hash || "");
    return m && ROUTES.indexOf(m[1]) >= 0 ? m[1] : null;
  }

  function histIdx() {
    var st = root.history.state;
    return st && typeof st.cccIdx === "number" ? st.cccIdx : 0;
  }

  function replaceHash(route) {
    var hash = "#/" + route;
    try {
      root.history.replaceState({ cccIdx: histIdx() }, "", root.location.pathname + root.location.search + hash);
    } catch (e) {
      root.location.replace(hash);
    }
  }

  /* Navigate. replace=true keeps the back button from returning to this step. */
  function go(route, replace) {
    if (partyPop) {
      partyPop.next = function () { go(route, replace); };
      return;
    }
    var hash = "#/" + route;
    if (replace || root.location.hash === hash) {
      replaceHash(route);
    } else {
      try {
        root.history.pushState({ cccIdx: histIdx() + 1 }, "", root.location.pathname + root.location.search + hash);
      } catch (e) {
        root.location.hash = hash;
        return; // hashchange renders
      }
    }
    render();
  }

  /* Use real history when the previous entry is ours, so Android back and this button agree. */
  function goBack(target) {
    if (partyPop) partyPop.next = function () { goBack(target); };
    else if (histIdx() > 0) root.history.back();
    else go(target, true);
  }

  function onHistoryChange() {
    var popped = partyPop;
    // Android back while the celebration is open leaves its history entry: close it and stay put.
    if (party && !popped && !(root.history.state && root.history.state.party)) closeParty();
    if (routeFromHash() !== currentRoute) render();
    else welcomeNow();
    if (popped) finishPartyPop();
  }

  function render() {
    var route = routeFromHash();
    var signedIn = !!state.token;
    if (!route) route = signedIn ? "home" : "login";
    if (!signedIn && AUTH_ROUTES[route]) route = "login";
    if (signedIn && (route === "login" || route === "choose")) route = "home";
    if (route === "choose" && !state.choices) route = "login";
    if (route === "done" && !state.lastRequest) route = "home";
    // A new hire's first visit: the message from the CEO comes before home and before any birthday celebration.
    if (route === "home" && signedIn && welcomeDue()) {
      route = "welcome";
      welcomeAuto = true;
    } else if (route !== "welcome") {
      welcomeAuto = false;
    }
    if (root.location.hash !== "#/" + route) replaceHash(route);

    var changed = route !== currentRoute;
    if (changed && currentRoute === "login") stopLockTimer();
    currentRoute = route;
    doc.documentElement.setAttribute("data-screen", route);

    var app = $("app");
    if (!app) return;
    var screen = SCREENS[route]();
    if (changed) screen.classList.add("screen");
    screen.setAttribute("data-route", route);
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(screen);
    updateChrome();
    fillParty();
    if (route === "home") autoParty();
    if (changed && route === "welcome") welcomeOpened(screen);

    if (changed && DATA_ROUTES[route] && booted && Date.now() - state.lastRefresh > 60000) {
      root.setTimeout(refreshDashboard, 0);
    }
    if (changed) {
      try { root.scrollTo(0, 0); } catch (e) { /* ignore */ }
      var h1 = screen.querySelector("h1");
      // The letter's heading takes the focus even when the app opens on it.
      if (h1 && (booted || route === "welcome")) {
        h1.setAttribute("tabindex", "-1");
        try { h1.focus({ preventScroll: true }); } catch (e) { h1.focus(); }
      }
    }
  }

  function updateChrome() {
    doc.documentElement.setAttribute("lang", state.lang);
    doc.title = t("app_name");
    var toggle = $("lang-toggle");
    if (toggle) {
      toggle.setAttribute("aria-label", t("language"));
      var btns = toggle.querySelectorAll(".lang-btn");
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-lang") === state.lang ? "true" : "false");
      }
    }
    var brandText = $("brand-text");
    if (brandText) brandText.textContent = t("app_name");
    var brandLink = $("brand-link");
    if (brandLink) {
      brandLink.setAttribute("href", state.token ? "#/home" : "#/login");
      brandLink.setAttribute("aria-label", t("app_name"));
    }
    var banner = $("offline-banner");
    if (banner) {
      var show = !!state.token && (!isOnline() || state.netDown);
      var sig = show ? state.lang : "";
      banner.hidden = !show;
      // Live region: rebuild only when it appears or the language changes.
      if (banner.getAttribute("data-sig") !== sig) {
        banner.setAttribute("data-sig", sig);
        while (banner.firstChild) banner.removeChild(banner.firstChild);
        if (show) {
          var wifi = icon("wifiOff");
          wifi.setAttribute("width", "20");
          wifi.setAttribute("height", "20");
          append(banner, [wifi, h("span", { text: t("offline_banner") })]);
        }
      }
    }
    var submit = $("req-submit");
    if (submit && !state.sending) submit.disabled = !isOnline();
    var offlineNote = $("req-offline");
    if (offlineNote) offlineNote.hidden = isOnline();
  }

  function setLang(lang, remember) {
    lang = I.normLang(lang);
    if (remember) {
      store.set(K.lang, lang);
      state.urlLang = null;
      try {
        var search = root.location.search
          .replace(/([?&])lang=(en|es)(&|$)/i, function (m, a, b, c) { return c ? a : ""; })
          .replace(/\?$/, "");
        root.history.replaceState(root.history.state, "", root.location.pathname + search + root.location.hash);
      } catch (e) { /* ignore */ }
    }
    if (lang === state.lang) return;
    state.lang = lang;
    render();
  }

  function adoptLang() {
    state.lang = resolveLang({
      urlLang: state.urlLang,
      savedLang: store.get(K.lang),
      personLang: state.person && state.person.language,
      navLang: root.navigator.language || ""
    });
  }

  function api(action, payload) {
    if (!root.CCCApi) return Promise.resolve({ ok: false, error: { code: "NETWORK" } });
    return root.CCCApi.call(action, payload);
  }

  function errCode(res) {
    return res && res.error && res.error.code ? res.error.code : "SERVER";
  }

  function isAuthError(res) {
    var c = errCode(res);
    return c === "AUTH_INVALID" || c === "AUTH_EXPIRED";
  }

  function saveSession(res) {
    state.token = res.token;
    state.person = res.person || null;
    store.set(K.token, res.token);
    store.setJSON(K.person, state.person);
  }

  function clearSession() {
    state.token = null;
    state.person = null;
    state.dash = null;
    state.lastRequest = null;
    state.choices = null;
    state.choicePin = null;
    state.pin = "";
    state.draft = { category: "", details: "", contact_pref: "whatsapp" };
    state.reqErrors = {};
    state.reqStatus = null;
    state.netDown = false;
    state.loadError = null;
    // Forget a dashboard call still running for the old token.
    state.refreshing = false;
    state.lastRefresh = 0;
    state.wishPending = {};
    closeParty();
    store.remove(K.token);
    store.remove(K.person);
    store.remove(K.dash);
    store.remove(K.draft);
    // Which people celebrated on which day stays on a shared phone no longer than the session.
    forgetParties(null);
  }

  function signOut(flashKey) {
    clearSession();
    state.loginMsg = flashKey ? { kind: "info", key: flashKey } : null;
    go("login", true);
  }

  /* state.refreshing holds the token of the dashboard call in progress. */
  function refreshDashboard() {
    var token = state.token;
    if (!token || state.refreshing === token) return Promise.resolve();
    state.refreshing = token;
    return api("dashboard", { token: token }).then(function (res) {
      if (state.refreshing === token) state.refreshing = false;
      if (token !== state.token) return;
      if (res.ok) {
        res.saved_ny_day = nyYmd(new Date());
        state.dash = hideDash(res);
        if (res.person) state.person = res.person;
        store.setJSON(K.dash, res);
        store.setJSON(K.person, state.person);
        state.netDown = false;
        state.loadError = null;
        state.lastRefresh = Date.now();
        if (DATA_ROUTES[currentRoute]) render();
        else updateChrome();
        return;
      }
      if (isAuthError(res)) {
        signOut("signin_again");
        return;
      }
      state.loadError = errCode(res);
      state.netDown = state.loadError === "NETWORK";
      if (DATA_ROUTES[currentRoute] && !state.dash) render();
      else updateChrome();
    });
  }

  function backButton(target) {
    return h("button", {
      type: "button",
      class: "back-btn",
      on: { click: function () { goBack(target); } }
    }, [icon("chevronLeft"), h("span", { text: t("back") })]);
  }

  function msgBox(kind, iconName, text, extra) {
    var cls = kind === "error" ? "msg-error" : kind === "wait" ? "msg-wait" : "msg-info";
    return h("div", { class: "msg-box " + cls }, [icon(iconName), h("div", null, [h("p", { text: text }), extra || null])]);
  }

  function errorKeyFor(code) {
    if (code === "NETWORK") return "error_network";
    if (code === "RATE_LIMITED") return "err_rate";
    return "error_server";
  }

  function externalLink(url, cls, children) {
    return h("a", { class: cls, href: url, target: "_blank", rel: "noopener noreferrer" }, children);
  }

  var SCREENS = {};

  /* ---- Sign in ---- */

  function lockRemainingMs() {
    return Math.max(0, state.lockUntil - Date.now());
  }

  function keypadLocked() {
    return state.busy || lockRemainingMs() > 0;
  }

  function setLock(untilMs) {
    state.lockUntil = untilMs || 0;
    if (untilMs) store.set(K.lock, String(untilMs));
    else store.remove(K.lock);
  }

  function lockText() {
    return t("login_locked", { time: minutesText(minutesLeft(state.lockUntil, Date.now()), state.lang) });
  }

  function startLockTimer() {
    stopLockTimer();
    lockTimer = root.setInterval(function () {
      if (lockRemainingMs() <= 0) {
        stopLockTimer();
        setLock(0);
        state.loginMsg = { kind: "info", key: "login_unlocked" };
        refreshLogin();
        return;
      }
      var p = $("lock-text");
      var text = lockText();
      if (p && p.textContent !== text) p.textContent = text;
    }, 1000);
  }

  function stopLockTimer() {
    if (lockTimer) root.clearInterval(lockTimer);
    lockTimer = null;
  }

  function unlockKeypad() {
    stopLockTimer();
    setLock(0);
    state.loginMsg = null;
    refreshLogin();
    var k = doc.querySelector("#keypad .key");
    if (k) k.focus();
  }

  function reducedMotion() {
    try {
      return root.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  function fillLoginMsg(box) {
    var m = state.loginMsg;
    var sig = m ? m.kind + "|" + (m.key || "") + "|" + state.lang : "";
    if (box.getAttribute("data-sig") === sig) return;
    box.setAttribute("data-sig", sig);
    while (box.firstChild) box.removeChild(box.firstChild);
    if (!m) return;
    if (m.kind === "busy") {
      append(box, h("p", { class: "msg-quiet" }, [h("span", { class: "spinner", "aria-hidden": "true" }), t("login_checking")]));
    } else if (m.kind === "wait") {
      // Try again: the office may have ended the pause early, and a LOCKED answer is never counted.
      append(box, h("div", { class: "msg-box msg-wait" }, [icon("clock"), h("div", null, [
        h("p", { id: "lock-text", text: lockText() }),
        h("button", { type: "button", class: "link-btn", on: { click: unlockKeypad } }, t("try_again"))
      ])]));
    } else if (m.kind === "error") {
      append(box, msgBox("error", "alert", t(m.key)));
    } else if (m.kind === "network") {
      var retry = h("div", { class: "msg-actions" }, h("button", {
        type: "button",
        class: "btn btn-secondary",
        on: { click: function () { submitPin(m.retryPick || null); } }
      }, [icon("refresh"), t("try_again")]));
      append(box, h("div", { class: "msg-box msg-error" }, [icon(m.key === "error_network" ? "wifiOff" : "alert"), h("div", null, [h("p", { text: t(m.key) })])]));
      append(box, retry);
    } else {
      append(box, msgBox("info", "info", t(m.key)));
    }
  }

  /* Update the sign in screen in place so focus stays where it is. */
  function refreshLogin() {
    if (currentRoute === "choose") {
      render();
      return;
    }
    if (currentRoute !== "login") return;
    var dots = $("pin-dots");
    if (dots) {
      for (var i = 0; i < dots.children.length; i++) {
        dots.children[i].classList.toggle("filled", i < state.pin.length);
      }
    }
    var prog = $("pin-progress");
    if (prog) {
      var ptext = t("login_progress", { n: state.pin.length });
      if (prog.textContent !== ptext) prog.textContent = ptext;
    }
    var box = $("login-msg");
    if (box) fillLoginMsg(box);
    var keys = doc.querySelectorAll("#keypad .key");
    var locked = keypadLocked();
    for (var k = 0; k < keys.length; k++) keys[k].disabled = locked;
  }

  function pressDigit(d) {
    if (keypadLocked() || state.pin.length >= 4) return;
    if (state.loginMsg && state.loginMsg.kind !== "wait") state.loginMsg = null;
    state.pin += d;
    refreshLogin();
    if (state.pin.length === 4) submitPin(null);
  }

  function pressDelete() {
    if (state.busy || !state.pin.length) return;
    if (state.loginMsg && state.loginMsg.kind !== "wait") state.loginMsg = null;
    state.pin = state.pin.slice(0, -1);
    refreshLogin();
  }

  function flashKey(name) {
    var el = doc.querySelector('#keypad [data-key="' + name + '"]');
    if (!el) return;
    el.classList.add("pressed");
    root.setTimeout(function () { el.classList.remove("pressed"); }, 130);
  }

  function shakeAndClear() {
    state.busy = true;
    refreshLogin();
    var dots = $("pin-dots");
    if (dots) {
      dots.classList.remove("shake");
      void dots.offsetWidth; // restart the animation
      dots.classList.add("shake");
    }
    root.setTimeout(function () {
      if (dots) dots.classList.remove("shake");
      state.busy = false;
      state.pin = "";
      refreshLogin();
    }, reducedMotion() ? 150 : 480);
  }

  function submitPin(pickId) {
    var pin = pickId ? state.choicePin : state.pin;
    if (state.busy || !/^[0-9]{4}$/.test(pin || "")) return;
    if (!pickId && lockRemainingMs() > 0) return;
    state.busy = true;
    state.loginMsg = { kind: "busy" };
    refreshLogin();
    var payload = { pin: pin, device_id: state.deviceId };
    if (pickId) payload.pick_id = pickId;

    api("login", payload).then(function (res) {
      state.busy = false;
      if (res.ok && res.status === "signed_in" && res.token) {
        state.pin = "";
        state.choices = null;
        state.choicePin = null;
        state.loginMsg = null;
        setLock(0);
        store.remove(K.dash);
        state.dash = null;
        saveSession(res);
        adoptLang();
        go("home", true);
        refreshDashboard();
        return;
      }
      if (res.ok && res.status === "choose" && Array.isArray(res.choices) && res.choices.length) {
        state.choices = res.choices;
        state.choicePin = pin;
        state.pin = "";
        state.loginMsg = null;
        go("choose");
        return;
      }
      var code = res.ok ? "SERVER" : errCode(res);
      if (code === "LOCKED") {
        var secs = Number(res.error && res.error.retry_after_s) || 900;
        setLock(Date.now() + secs * 1000);
        state.pin = "";
        state.choices = null;
        state.choicePin = null;
        state.loginMsg = { kind: "wait" };
        if (pickId) go("login", true);
        else refreshLogin();
        startLockTimer();
        return;
      }
      if (code === "NO_MATCH" || code === "BAD_PIN_FORMAT") {
        state.loginMsg = { kind: "error", key: "login_no_match" };
        if (pickId) {
          state.choices = null;
          state.choicePin = null;
          state.pin = "";
          go("login", true);
          return;
        }
        shakeAndClear();
        return;
      }
      state.loginMsg = { kind: "network", key: errorKeyFor(code), retryPick: pickId || null };
      refreshLogin();
    });
  }

  SCREENS.login = function () {
    if (state.loginMsg && state.loginMsg.kind === "wait" && lockRemainingMs() <= 0) {
      setLock(0);
      state.loginMsg = null;
    }
    var fallback = h("span", { class: "logo-fallback", text: "Cristal Clear Cleaning" });
    var plate = h("div", { class: "logo-plate" }, imgWithFallback("img/logo.png", t("logo_alt"), null, fallback));

    var dots = h("div", { class: "pin-dots", id: "pin-dots", "aria-hidden": "true" });
    for (var i = 0; i < 4; i++) {
      dots.appendChild(h("span", { class: "dot" + (i < state.pin.length ? " filled" : "") }, gemSvg()));
    }

    var box = h("div", { class: "login-msg", id: "login-msg", role: "status", "aria-live": "polite" });
    fillLoginMsg(box);

    var locked = keypadLocked();
    var keypad = h("div", { class: "keypad", id: "keypad", role: "group", "aria-labelledby": "login-instr" });
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"].forEach(function (d) {
      keypad.appendChild(digitKey(d, locked));
    });
    keypad.appendChild(h("span", { class: "key key-blank", "aria-hidden": "true" }));
    keypad.appendChild(digitKey("0", locked));
    keypad.appendChild(h("button", {
      type: "button",
      class: "key key-del",
      "data-key": "del",
      "aria-label": t("key_delete"),
      disabled: locked,
      on: { click: pressDelete }
    }, icon("backspace")));

    if (state.loginMsg && state.loginMsg.kind === "wait" && lockRemainingMs() > 0 && !lockTimer) startLockTimer();

    return h("section", { class: "login", "aria-labelledby": "login-title" }, [
      plate,
      h("h1", { id: "login-title", class: "login-title", text: t("login_title") }),
      h("p", { id: "login-instr", class: "login-instruction", text: t("login_instruction") }),
      dots,
      h("p", { id: "pin-progress", class: "sr-only", "aria-live": "polite", text: t("login_progress", { n: state.pin.length }) }),
      box,
      keypad,
      h("p", { class: "login-help", text: t("login_help") }),
      h("p", { class: "tagline", text: t("tagline") })
    ]);
  };

  function digitKey(d, locked) {
    return h("button", {
      type: "button",
      class: "key",
      "data-key": d,
      disabled: locked,
      text: d,
      on: { click: function () { pressDigit(d); } }
    });
  }

  SCREENS.choose = function () {
    var list = h("ul", { class: "choice-list" });
    (state.choices || []).forEach(function (c) {
      var label = String((c && c.label) || "");
      list.appendChild(h("li", null, h("button", {
        type: "button",
        class: "person-btn",
        disabled: state.busy,
        on: { click: function () { submitPin(String(c.pick_id)); } }
      }, [
        h("span", { class: "avatar", "aria-hidden": "true", text: initialOf(label) }),
        h("span", { class: "grow", text: label }),
        icon("chevronRight")
      ])));
    });
    var box = h("div", { class: "login-msg", id: "login-msg", role: "status", "aria-live": "polite" });
    fillLoginMsg(box);
    return h("section", { class: "choose" }, [
      h("div", { class: "page-head" }, [
        backButton("login"),
        h("h1", { text: t("choose_title") }),
        h("p", { class: "page-sub", text: t("choose_sub") })
      ]),
      list,
      box
    ]);
  };

  /* ---- Home ---- */

  function todayLocal() {
    return todayFor(state.dash, new Date());
  }

  function navClick(route) {
    return function (e) {
      e.preventDefault();
      go(route);
    };
  }

  function chip(cls, text) {
    return h("span", { class: "chip " + cls, text: text });
  }

  function noteFor(period) {
    var en = typeof period.note_en === "string" ? period.note_en.trim() : "";
    var es = typeof period.note_es === "string" ? period.note_es.trim() : "";
    return state.lang === "es" ? es || en : en || es;
  }

  function retryButton() {
    return h("button", {
      type: "button",
      class: "btn btn-primary",
      on: {
        click: function () {
          state.loadError = null;
          render();
          refreshDashboard();
        }
      }
    }, [icon("refresh"), t("try_again")]);
  }

  /* Shown while there is no saved dashboard yet. */
  function dataPlaceholder(skeleton) {
    if (state.loadError) {
      var code = state.loadError;
      return h("div", { class: "load-error" }, [
        msgBox("error", code === "NETWORK" ? "wifiOff" : "alert", t(errorKeyFor(code))),
        retryButton()
      ]);
    }
    if (skeleton) {
      return h("div", { role: "status" }, [
        h("span", { class: "sr-only", text: t("home_loading") }),
        h("div", { class: "skeleton skeleton-hero", "aria-hidden": "true" }),
        h("div", { class: "skeleton skeleton-tile", "aria-hidden": "true" }),
        h("div", { class: "skeleton skeleton-tile", "aria-hidden": "true" }),
        h("div", { class: "skeleton skeleton-tile", "aria-hidden": "true" }),
        h("div", { class: "skeleton skeleton-tile", "aria-hidden": "true" }),
        h("div", { class: "skeleton skeleton-tile", "aria-hidden": "true" })
      ]);
    }
    return h("div", { class: "boot", role: "status" }, [
      h("span", { class: "spinner spinner-lg", "aria-hidden": "true" }),
      h("span", { class: "sr-only", text: t("home_loading") })
    ]);
  }

  function heroCard(dash) {
    var today = todayLocal();
    var next = nextPayday(dash.pay && dash.pay.periods, today);
    var card = h("section", { class: "hero", "aria-labelledby": "hero-label" }, [
      h("h2", { class: "hero-label", id: "hero-label", text: t("next_payday") })
    ]);
    if (!next) {
      append(card, h("p", { class: "hero-empty", text: t("no_payday") }));
      return card;
    }
    var pending = isPending(next);
    var cd = countdown(next.payday, today, state.lang, pending);
    if (pending) {
      append(card, h("p", { class: "hero-date", text: t("to_be_confirmed") }));
    } else {
      append(card, [
        h("p", { class: "hero-date", text: noWrapDate(I.capFirst(I.formatLong(next.payday, state.lang))) }),
        h("p", { class: "hero-count" + (cd.kind === "today" || cd.kind === "tomorrow" ? " is-soon" : "") }, [icon("clock"), cd.text])
      ]);
    }
    append(card, h("p", {
      class: "hero-work",
      text: t("for_work", { range: I.formatRange(next.period_start, next.period_end, state.lang) })
    }));
    var note = noteFor(next);
    if (note) append(card, h("p", { class: "hero-note", text: note }));
    return card;
  }

  function tile(o) {
    var titleKids = [o.title];
    if (o.external) titleKids.push(h("span", { class: "sr-only", text: " " + t("opens_new_tab") }));
    if (o.badge) titleKids.push(" ", h("span", { class: "badge", text: o.badge }));
    var kids = [
      h("span", { class: "tile-icon " + o.tone }, icon(o.icon)),
      h("span", { class: "tile-body" }, [
        h("span", { class: "tile-title" }, titleKids),
        h("span", { class: "tile-sub", text: o.sub })
      ]),
      h("span", { class: "tile-end" }, icon(o.external ? "external" : "chevronRight"))
    ];
    if (o.external) return externalLink(o.href, "tile", kids);
    return h("a", { class: "tile", href: "#/" + o.route, on: { click: navClick(o.route) } }, kids);
  }

  function tiles(dash) {
    var links = dash.links || {};
    var dayOff = safeUrl(links.day_off_url);
    var survey = safeUrl(links.survey_url);
    return h("nav", { class: "tiles", "aria-label": t("app_name") }, [
      dayOff ? tile({ external: true, href: dayOff, icon: "dayOff", tone: "ti-peach", title: t("tile_dayoff_title"), sub: t("tile_dayoff_sub") }) : null,
      survey ? tile({ external: true, href: survey, icon: "survey", tone: "ti-lblue", title: t("tile_survey_title"), sub: t("tile_survey_sub") }) : null,
      tile({ route: "calendar", icon: "calendar", tone: "ti-navy", title: t("tile_calendar_title"), sub: t("tile_calendar_sub") }),
      tile({ route: "request", icon: "message", tone: "ti-blue", title: t("tile_change_title"), sub: t("tile_change_sub") }),
      // Education department, built later. The tile works and opens a coming soon screen.
      tile({ route: "training", icon: "cap", tone: "ti-peach", title: t("tile_training_title"), sub: t("tile_training_sub"), badge: t("coming_soon") })
    ]);
  }

  function requestItem(r, compact) {
    var st = statusInfo(r.status);
    var date = formatIsoDate(r.created_at, state.lang);
    var meta = [];
    if (r.request_id) meta.push(t("request_number", { id: String(r.request_id) }));
    if (date) meta.push(t("sent_on", { date: date }));
    var hid = r.reply_hidden === true;
    var reply = hid ? t("req_reply_hidden") : typeof r.reply === "string" ? r.reply.trim() : "";
    return h("li", { class: "req" }, [
      h("div", { class: "req-top" }, [
        h("div", null, [
          h("h3", { class: "req-cat", text: t(categoryKey(r.category)) }),
          meta.length ? h("p", { class: "req-meta", text: meta.join(" · ") }) : null
        ]),
        chip(st.cls, t(st.key))
      ]),
      r.details_hidden ? h("p", { class: "req-details req-hidden", text: t("req_details_hidden") })
        : r.details ? h("p", { class: "req-details" + (compact ? " clamp" : ""), text: String(r.details) }) : null,
      reply ? h("div", { class: "req-reply" }, [
        h("p", { class: "req-reply-label" }, [icon("reply"), t("office_reply")]),
        h("p", { class: "req-reply-text" + (hid ? " req-hidden" : compact ? " req-details clamp" : ""), text: reply })
      ]) : null
    ]);
  }

  function requestList(reqs, compact) {
    var ul = h("ul", { class: "req-list" });
    reqs.forEach(function (r) {
      if (r && typeof r === "object") ul.appendChild(requestItem(r, compact));
    });
    return ul;
  }

  function dashRequests() {
    return state.dash && Array.isArray(state.dash.requests) ? state.dash.requests : [];
  }

  function requestsSection() {
    var reqs = dashRequests();
    return h("section", { "aria-labelledby": "req-head" }, [
      h("div", { class: "section-head" }, [
        h("h2", { id: "req-head", text: t("my_requests") }),
        reqs.length ? h("a", { class: "link-btn", href: "#/requests", on: { click: navClick("requests") } }, t("see_all")) : null
      ]),
      reqs.length ? requestList(reqs.slice(0, 3), true) : h("p", { class: "empty", text: t("no_requests") })
    ]);
  }

  function footer() {
    var support = state.dash && state.dash.support;
    var supportText = support && typeof support[state.lang] === "string" && support[state.lang].trim()
      ? support[state.lang].trim()
      : t("support_default");
    return h("footer", { class: "footer" }, [
      h("p", { class: "footer-support", text: supportText }),
      h("p", { class: "footer-signout" }, [
        h("span", { text: t("not_you") }),
        h("button", { type: "button", class: "link-btn", on: { click: function () { signOut("signed_out"); } } }, t("sign_out"))
      ]),
      h("p", { class: "tagline", text: t("tagline") }),
      h("p", { class: "version", text: t("version", { v: APP_VERSION }) })
    ]);
  }

  function isStandalone() {
    try {
      if (root.matchMedia("(display-mode: standalone)").matches) return true;
    } catch (e) { /* ignore */ }
    return root.navigator.standalone === true;
  }

  function isIOS() {
    var nav = root.navigator;
    return /iPhone|iPad|iPod/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  }

  function isPhone() {
    return isIOS() || /Android|Mobi/i.test(root.navigator.userAgent || "");
  }

  function a2hsCard() {
    if (store.get(K.a2hs) === "1" || isStandalone() || !isPhone()) return null;
    var ios = isIOS();
    if (!ios && !state.installPrompt) return null;

    function removeCard() {
      var c = $("a2hs");
      if (c && c.parentNode) c.parentNode.removeChild(c);
    }
    function dismiss() {
      store.set(K.a2hs, "1");
      removeCard();
    }
    function install() {
      var p = state.installPrompt;
      state.installPrompt = null;
      removeCard();
      if (!p) return;
      try {
        p.prompt();
        p.userChoice.then(function (choice) {
          if (choice && choice.outcome === "accepted") store.set(K.a2hs, "1");
        }, function () { /* ignore */ });
      } catch (e) { /* ignore */ }
    }

    var body = ios
      ? h("p", { class: "a2hs-body" }, [t("a2hs_ios") + " ", icon("share")])
      : h("p", { class: "a2hs-body", text: t("a2hs_android") });
    return h("section", { class: "a2hs", id: "a2hs", "aria-labelledby": "a2hs-title" }, [
      h("button", { type: "button", class: "a2hs-close", "aria-label": t("close"), on: { click: dismiss } }, icon("close")),
      h("div", { class: "a2hs-head" }, [
        h("span", { class: "a2hs-icon" }, icon("phone")),
        h("div", null, [h("h2", { class: "a2hs-title", id: "a2hs-title", text: t("a2hs_title") }), body])
      ]),
      h("div", { class: "a2hs-actions" }, [
        ios ? null : h("button", { type: "button", class: "btn btn-primary", on: { click: install } }, t("a2hs_install")),
        h("button", { type: "button", class: "btn btn-secondary", on: { click: dismiss } }, t("a2hs_dismiss"))
      ])
    ]);
  }

  /* ---- Birthdays: confetti, the celebration and the home cards ---- */

  var FX_COLORS = ["#F6A078", "#6BA9F8", "#82CAFB", "#FFC857", "#FF8FB1", "#FFFFFF", "#B7A6FF"];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /* Canvas confetti, the engine of the approved preview. */
  function makeFx(canvas) {
    var ctx = null;
    try { ctx = canvas.getContext("2d"); } catch (e) { ctx = null; }
    var W = 0, H = 0, parts = [], raf = 0, rainUntil = 0;
    function piece(x, y, angle, speed) {
      var shape = Math.random();
      return { x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, g: rand(0.18, 0.32), drag: rand(0.965, 0.985),
        w: rand(6, 12), h: rand(10, 18), r: rand(0, 6.3), vr: rand(-0.3, 0.3), tilt: rand(0, 6.3), vt: rand(0.05, 0.2),
        color: FX_COLORS[(Math.random() * FX_COLORS.length) | 0], kind: shape < 0.55 ? 0 : shape < 0.8 ? 1 : 2, life: 0, max: rand(160, 260) };
    }
    function draw(p, alpha) {
      var sy = Math.abs(Math.cos(p.tilt));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      if (p.kind === 1 && ctx.ellipse) {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2, p.w / 2 * sy + 0.5, 0, 0, 6.2832);
        ctx.fill();
      } else if (p.kind === 2) ctx.fillRect(-1.5, -p.h, 3, p.h * 2 * sy + 2);
      else ctx.fillRect(-p.w / 2, -p.h / 2 * sy, p.w, p.h * sy);
      ctx.restore();
    }
    function tick(now) {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
      if (now < rainUntil && parts.length < 500) {
        for (var k = 0; k < 4; k++) parts.push(piece(rand(0, W), -20, Math.PI / 2 + rand(-0.4, 0.4), rand(1, 4)));
      }
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g;
        p.x += p.vx + Math.sin(p.tilt) * 0.6;
        p.y += p.vy;
        p.r += p.vr;
        p.tilt += p.vt;
        p.life++;
        if (p.y > H + 40 || p.life > p.max + 60) parts.splice(i, 1);
        else draw(p, p.life > p.max ? Math.max(0, 1 - (p.life - p.max) / 60) : 1);
      }
      if (parts.length || now < rainUntil) raf = root.requestAnimationFrame(tick);
    }
    function run() {
      if (ctx && !raf) raf = root.requestAnimationFrame(tick);
    }
    return {
      /* True when the size changed, which also clears the canvas. */
      resize: function () {
        var w = root.innerWidth || 390, hh = root.innerHeight || 844, dpr = Math.min(root.devicePixelRatio || 1, 2);
        if (w === W && hh === H) return false;
        W = w;
        H = hh;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
      },
      burst: function (x, y, n, from, to, sMin, sMax) {
        for (var i = 0; i < n; i++) parts.push(piece(x, y, rand(from, to), rand(sMin, sMax)));
        run();
      },
      rain: function (ms) {
        rainUntil = (root.performance && root.performance.now ? root.performance.now() : Date.now()) + ms;
        run();
      },
      /* Reduced motion: confetti drawn once where it landed, nothing moves. */
      field: function (n) {
        if (!ctx) return;
        for (var i = 0; i < n; i++) {
          // Around the edges and above and below the words, so every line stays easy to read.
          var p = piece(rand(0, W), rand(0, H), 0, 0);
          if (p.x > W * 0.14 && p.x < W * 0.86) p.y = Math.random() < 0.6 ? rand(0, H * (H < 700 ? 0.05 : 0.12)) : rand(H * 0.96, H);
          draw(p, 0.95);
        }
      },
      stop: function () {
        if (raf) root.cancelAnimationFrame(raf);
        raf = 0;
        parts = [];
        rainUntil = 0;
        if (ctx) ctx.clearRect(0, 0, W, H);
      },
      width: function () { return W; },
      height: function () { return H; }
    };
  }

  var BALLOON_COLORS = [["#F6A078", "#FFC4A6"], ["#6BA9F8", "#A9CDFB"], ["#FFC857", "#FFE3A1"], ["#FF8FB1", "#FFC2D4"], ["#82CAFB", "#C2E6FD"], ["#B7A6FF", "#DCD3FF"]];
  /* Still balloons (reduced motion) wait at the edges: [left %, top %, size]. */
  var STILL_BALLOONS = [[-3, 6, 0.7], [84, 3, 0.8], [-6, 52, 0.75], [88, 58, 0.7], [6, 78, 0.85], [76, 82, 0.8]];

  function fillBalloons(box, still) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var count = still ? STILL_BALLOONS.length : 9;
    for (var i = 0; i < count; i++) {
      var c = BALLOON_COLORS[i % BALLOON_COLORS.length];
      var scale = still ? STILL_BALLOONS[i][2] : rand(0.75, 1.15);
      var svg = svgEl("svg", { viewBox: "0 0 78 170", class: "balloon" + (still ? " is-still" : "") }, [
        svgEl("defs", null, [svgEl("radialGradient", { id: "ccc-balloon" + i, cx: "35%", cy: "30%", r: "70%" }, [
          svgEl("stop", { offset: 0, "stop-color": c[1] }), svgEl("stop", { offset: 1, "stop-color": c[0] })])]),
        svgEl("ellipse", { cx: 39, cy: 42, rx: 33, ry: 40, fill: "url(#ccc-balloon" + i + ")" }),
        svgEl("ellipse", { cx: 27, cy: 26, rx: 7, ry: 11, fill: "#fff", opacity: 0.45 }),
        svgEl("path", { d: "M35 82l4 7 4-7z", fill: c[0] }),
        svgEl("path", { d: "M39 89c-6 18 8 30 0 48s8 24 2 33", stroke: "#ffffffaa", "stroke-width": 1.6, fill: "none" })
      ]);
      // Styles set through the DOM are allowed by the page's security policy (style-src 'self').
      svg.style.width = 78 * scale + "px";
      svg.style.height = 170 * scale + "px";
      if (still) {
        svg.style.left = STILL_BALLOONS[i][0] + "%";
        svg.style.top = STILL_BALLOONS[i][1] + "%";
      } else {
        svg.style.left = 4 + i * (92 / 9) + rand(-3, 3) + "%";
        svg.style.animationDuration = rand(7, 10.5) + "s";
        svg.style.animationDelay = rand(0, 1.6) + "s";
      }
      box.appendChild(svg);
    }
  }

  var party = null; // the open celebration: {el, fx, timers, opener, list, sig}
  var partyTimer = null;
  var partyPop = null; // while Continue takes the celebration's history entry back: {next, timer}
  var wishFx = null;
  var wishQueue = null;

  /* The history entry is gone: run the navigation that waited for it (so it is not undone). */
  function finishPartyPop() {
    var p = partyPop;
    partyPop = null;
    if (!p) return;
    root.clearTimeout(p.timer);
    if (p.next) p.next();
    else welcomeNow();
  }

  function onPartyResize() {
    if (!party) return;
    // Resizing clears the canvas. Confetti that stands still is drawn again, moving confetti redraws itself.
    if (party.fx.resize() && party.el.getAttribute("data-motion") === "reduced") party.fx.field(partyPlan(true).field);
    markMoreWishes();
  }

  /* Fades the bottom of the wishes list while more wishes are below. */
  function markMoreWishes() {
    var list = party && party.el.querySelector(".party-wish-list");
    if (list) list.classList.toggle("is-more", list.scrollTop + list.clientHeight < list.scrollHeight - 2);
  }

  function findCelebration(personId) {
    var list = state.dash && Array.isArray(state.dash.celebrations) ? state.dash.celebrations : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].person_id === personId) return list[i];
    return null;
  }

  function setInert(on) {
    [$("app"), $("offline-banner"), doc.querySelector(".topbar")].forEach(function (el) {
      if (!el) return;
      if (on) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
  }

  function partyButtons(root2) {
    return Array.prototype.slice.call(root2.querySelectorAll("button, [tabindex='0']"));
  }

  /* Opens the full screen celebration for these people (or refreshes it when it is open). */
  function openParty(list, opener) {
    if (!list || !list.length) return;
    if (partyPop) {
      partyPop.next = function () { openParty(list, opener); };
      return;
    }
    if (party) {
      party.list = list;
      fillParty();
      celebrate();
      return;
    }
    var canvas = h("canvas", { class: "party-canvas", "aria-hidden": "true" });
    var el = h("div", { class: "party", id: "party", role: "dialog", "aria-modal": "true", "aria-labelledby": "party-title",
      "aria-describedby": "party-from", tabindex: "-1" }, [
      h("div", { class: "party-sparkles", "aria-hidden": "true" }),
      h("div", { class: "party-balloons", "aria-hidden": "true" }),
      canvas,
      h("div", { class: "party-card" })
    ]);
    party = { el: el, fx: makeFx(canvas), timers: [], opener: opener || null, list: list, sig: "" };
    // A history entry of its own, so the Android back button closes the celebration instead of the app.
    try {
      var st = root.history.state;
      if (!(st && st.party)) root.history.pushState({ cccIdx: histIdx() + 1, party: true }, "", root.location.pathname + root.location.search + root.location.hash);
    } catch (e) { /* no history here: back works as before */ }
    doc.body.appendChild(el);
    doc.documentElement.classList.add("party-open");
    setInert(true);
    root.addEventListener("resize", onPartyResize);
    party.fx.resize();
    fillParty();
    void el.offsetWidth; // let the fade in start from transparent
    el.classList.add("on");
    celebrate();
    // Focus the dialog itself: a screen reader reads its title, and Tab goes to the buttons.
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function celebrate() {
    if (!party) return;
    var plan = partyPlan(reducedMotion());
    var fx = party.fx;
    party.el.setAttribute("data-motion", plan.motion);
    party.timers.forEach(root.clearTimeout);
    party.timers = [];
    fx.stop();
    fx.resize();
    fillBalloons(party.el.querySelector(".party-balloons"), plan.balloons === "still");
    var card = party.el.querySelector(".party-card");
    card.classList.remove("pop");
    void card.offsetWidth;
    card.classList.add("pop");
    var W = fx.width(), H = fx.height(), cy = H * 0.42;
    plan.bursts.forEach(function (b) {
      party.timers.push(root.setTimeout(function () {
        if (b[1] === "corners") {
          fx.burst(0, H, b[2], -Math.PI / 2.2, -Math.PI / 6, 14, 26);
          fx.burst(W, H, b[2], -Math.PI + Math.PI / 6, -Math.PI + Math.PI / 2.2, 14, 26);
        } else if (b[0]) fx.burst(W / 2, cy - 40, b[2], 0, Math.PI * 2, 8, 20);
        else fx.burst(W / 2, cy, b[2], 0, Math.PI * 2, 6, 22);
      }, b[0]));
    });
    if (plan.rain_ms) fx.rain(plan.rain_ms);
    if (plan.field) fx.field(plan.field);
    if (plan.vibrate) {
      try { if (root.navigator.vibrate) root.navigator.vibrate(plan.vibrate); } catch (e) { /* not allowed */ }
    }
  }

  function fillParty() {
    if (!party) return;
    var list = party.list;
    var you = list.filter(function (c) { return c.is_you; })[0];
    var others = list.filter(function (c) { return !c.is_you; });
    var received = you ? receivedWishes(state.dash) : [];
    var sig = [state.lang, JSON.stringify(list), JSON.stringify(received)].join("|");
    if (sig === party.sig) return;
    party.sig = sig;
    var card = party.el.querySelector(".party-card");
    var active = doc.activeElement && card.contains(doc.activeElement) ? doc.activeElement.getAttribute("data-act") : null;
    while (card.firstChild) card.removeChild(card.firstChild);
    var from = t("party_from", { company: "{company}" }).split("{company}");
    var parts = [
      you && you.demo ? h("p", { class: "party-tag", text: t("demo_note") }) : null,
      cakeSvg("party-cake"),
      h("h2", { id: "party-title", class: "party-hb" + (you ? " is-you" : ""), text: you ? t("party_title_you", { name: you.first_name }) : t("party_title") })
    ];
    // The dialog's name says whose birthday it is: the title, then the names (or the title with the first name).
    party.el.setAttribute("aria-labelledby", you ? "party-title" : "party-title party-names");
    if (!you) {
      parts.push(h("ul", { class: "party-names" + (others.length > 2 ? " is-many" : ""), id: "party-names",
        "aria-label": joinNames(others.map(function (c) { return c.display_name; }), state.lang) }, others.map(function (c) {
        return h("li", { text: c.display_name });
      })));
    }
    parts.push(h("p", { class: "party-from", id: "party-from" }, [from[0], h("b", { text: "Cristal Clear Cleaning" }), from[1] || ""]));
    if (you) {
      // The total in the title, so a short list that scrolls never looks complete.
      var total = received.length < 100 ? received.length : Math.max(received.length, you.wish_count);
      var box = h("section", { class: "party-wishes", "aria-labelledby": "party-wishes-title" },
        h("h3", { id: "party-wishes-title", text: received.length ? t("party_wishes_title_n", { n: total }) : t("party_wishes_title") }));
      if (received.length) {
        append(box, h("ul", { class: "party-wish-list", tabindex: "0", "data-act": "wishes", "aria-labelledby": "party-wishes-title", on: { scroll: markMoreWishes } }, received.map(function (w) {
          return h("li", null, [h("span", { class: "party-wish-emoji", text: w.emoji }), h("span", { text: w.from_display })]);
        })));
      } else {
        append(box, h("p", { class: "party-empty", text: t("party_wishes_empty") }));
      }
      parts.push(box);
      if (others.length) {
        parts.push(h("p", { class: "party-also", text: t("party_also", { names: joinNames(others.map(function (c) { return c.display_name; }), state.lang) }) }));
      }
    }
    parts.push(h("div", { class: "party-btns" }, [
      h("button", { type: "button", class: "party-btn party-again", "data-act": "again", on: { click: celebrate } }, [
        t("party_again"), h("span", { "aria-hidden": "true", text: " \uD83C\uDF89" })]),
      h("button", { type: "button", class: "party-btn party-go", "data-act": "close", on: { click: function () { closeParty(true); } } }, t("party_continue"))
    ]));
    append(card, parts);
    markMoreWishes();
    var again = active && card.querySelector('[data-act="' + active + '"]');
    if (again) again.focus();
  }

  /* byPerson: Continue or Escape, which also take back the celebration's history entry. */
  function closeParty(byPerson) {
    if (partyTimer) root.clearTimeout(partyTimer);
    partyTimer = null;
    if (!party) return;
    var p = party;
    party = null;
    p.timers.forEach(root.clearTimeout);
    p.fx.stop();
    root.removeEventListener("resize", onPartyResize);
    if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
    doc.documentElement.classList.remove("party-open");
    setInert(false);
    if (byPerson && root.history.state && root.history.state.party) {
      // Navigation waits for the entry to go (finishPartyPop), so a quick tap is not undone by it.
      partyPop = { next: null, timer: root.setTimeout(finishPartyPop, 600) };
      try { root.history.back(); } catch (e) { finishPartyPop(); }
    }
    // Back where the person was: the button that opened it, else the birthday card, else the page title.
    var target = p.opener && doc.body.contains(p.opener) ? p.opener : doc.querySelector(".bday-cake") || doc.querySelector("#app h1");
    if (target) {
      if (target.tagName === "H1") target.setAttribute("tabindex", "-1");
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }
    if (byPerson && !partyPop) welcomeNow();
  }

  /* Keyboard inside the celebration: Escape closes it, Tab stays inside it. */
  function partyKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeParty(true);
    } else if (e.key === "Tab") {
      var items = partyButtons(party.el);
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      var inside = party.el.contains(doc.activeElement) && doc.activeElement !== party.el;
      if (e.shiftKey && (doc.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (doc.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* Forgets which celebrations were shown: every one (keepDay null), or those of other days than keepDay. */
  function forgetParties(keepDay) {
    var old = function (k) { return k && k.indexOf(K.party) === 0 && !(keepDay && k.indexOf(K.party + keepDay + ":") === 0); };
    Object.keys(memStore).forEach(function (k) { if (old(k)) delete memStore[k]; });
    try {
      var ls = root.localStorage;
      for (var i = ls.length - 1; i >= 0; i--) if (old(ls.key(i))) ls.removeItem(ls.key(i));
    } catch (e) { /* storage blocked */ }
  }

  /* Remembers that this set of celebrations was shown today. Other sets of today stay remembered. */
  function rememberParty(key, today) {
    forgetParties(today);
    store.set(key, "1");
  }

  /* Shows the celebration by itself once a day on this phone, when home has birthdays. */
  function autoParty() {
    if (party || partyTimer || currentRoute !== "home" || !state.token) return;
    var list = todaysCelebrations(state.dash, new Date());
    if (!list.length || store.get(partyKey(state.dash.pay.server_today, list)) === "1") return;
    partyTimer = root.setTimeout(function () {
      partyTimer = null;
      var now = todaysCelebrations(state.dash, new Date());
      if (party || currentRoute !== "home" || !state.token || !now.length) return;
      var key = partyKey(state.dash.pay.server_today, now);
      if (store.get(key) === "1") return;
      rememberParty(key, state.dash.pay.server_today);
      openParty(now, null);
    }, 350);
  }

  /* A small burst of confetti from a wish button. */
  function miniBurst(btn) {
    if (reducedMotion() || !btn) return;
    var canvas = doc.querySelector(".fx-canvas");
    if (!canvas) {
      canvas = h("canvas", { class: "fx-canvas", "aria-hidden": "true" });
      doc.body.appendChild(canvas);
      wishFx = makeFx(canvas);
    }
    canvas.setAttribute("data-bursts", String(Number(canvas.getAttribute("data-bursts") || 0) + 1));
    wishFx.resize();
    var r = btn.getBoundingClientRect();
    wishFx.burst(r.left + r.width / 2, r.top + r.height / 2, 36, -Math.PI * 0.95, -Math.PI * 0.05, 3, 9);
  }

  function cardFor(personId) {
    var cards = doc.querySelectorAll(".bday");
    for (var i = 0; i < cards.length; i++) if (cards[i].getAttribute("data-person") === personId) return cards[i];
    return null;
  }

  /* Updates one card in place, so the focus stays on the emoji that was tapped. */
  function updateCard(personId, msgKey) {
    var card = cardFor(personId);
    var raw = findCelebration(personId);
    if (!card || !raw) return;
    var c = todaysCelebrations({ celebrations: [raw], pay: state.dash.pay, saved_ny_day: state.dash.saved_ny_day })[0];
    if (!c) return;
    var view = wishView(c, state.wishPending[personId]);
    var btns = card.querySelectorAll(".wish-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", view.my_wishes.indexOf(btns[i].getAttribute("data-emoji")) >= 0 ? "true" : "false");
    }
    var count = card.querySelector(".bday-count");
    var text = wishCountText(view.wish_count, state.lang, false);
    if (count && count.textContent !== text) count.textContent = text;
    var msg = card.querySelector(".bday-msg");
    if (msg && msgKey !== undefined) msg.textContent = msgKey ? t(msgKey) : "";
  }

  function sendWish(personId, emoji, btn) {
    var raw = findCelebration(personId);
    if (!raw || !state.token) return;
    var pending = state.wishPending[personId] || (state.wishPending[personId] = {});
    miniBurst(btn);
    if (pending[emoji] || (Array.isArray(raw.my_wishes) && raw.my_wishes.indexOf(emoji) >= 0)) return;
    pending[emoji] = true;
    updateCard(personId, "");
    var token = state.token;
    var send = function () {
      if (token !== state.token) return null; // signed out while it waited
      return api("wish", { token: token, to_person_id: personId, emoji: emoji }).then(function (res) {
        delete pending[emoji];
        if (token !== state.token) return;
        if (res && res.ok) {
          var cur = findCelebration(personId);
          if (cur) {
            var merged = mergeWish(cur, res);
            cur.wish_count = merged.wish_count;
            cur.my_wishes = merged.my_wishes;
            store.setJSON(K.dash, state.dash);
          }
          updateCard(personId);
          return;
        }
        if (isAuthError(res)) {
          signOut("signin_again");
          return;
        }
        var code = errCode(res);
        var key = code === "NETWORK" ? "wish_err_network" : code === "RATE_LIMITED" ? "wish_err_rate"
          : res && res.error && res.error.reason === "NOT_BIRTHDAY" ? "wish_err_over" : "wish_err_server";
        updateCard(personId, key);
        if (key === "wish_err_over") refreshDashboard();
      });
    };
    // One wish at a time from this phone, in the order tapped: answers come back in order, and a
    // burst of taps never asks the backend for its script lock (which sign in also uses) all at once.
    wishQueue = (wishQueue || Promise.resolve()).then(send, send);
  }

  function birthdayCard(c, all) {
    var id = "bday-" + c.person_id.replace(/[^A-Za-z0-9_]/g, "_");
    var view = wishView(c, state.wishPending[c.person_id]);
    var cake = h("button", {
      type: "button",
      class: "bday-cake",
      "aria-label": t("bday_cake", { name: c.display_name }),
      on: { click: function () { openParty(c.is_you ? all : [c], cake); } }
    }, cakeSvg());
    var kids = [cake, h("div", { class: "bday-text" }, [
      c.demo ? h("span", { class: "badge bday-demo", text: t("demo_label") }) : null,
      h("h2", { id: id, class: "bday-title", text: c.is_you ? t("bday_title_you", { name: c.first_name }) : t("bday_title", { name: c.display_name.replace(/ /g, "\u00a0") }) }),
      h("p", { class: "bday-sub", text: c.is_you ? wishCountText(c.wish_count, state.lang, true) : t("bday_sub") })
    ])];
    if (c.is_you) {
      var see = h("button", { type: "button", class: "btn btn-primary bday-see", on: { click: function () { openParty(all, see); } } }, t("bday_see"));
      kids.push(h("div", { class: "bday-foot" }, [c.demo ? h("p", { class: "bday-note", text: t("demo_note") }) : null, see]));
    } else {
      kids.push(h("div", { class: "wish-row", role: "group", "aria-labelledby": id }, WISH_EMOJIS.map(function (e) {
        var btn = h("button", {
          type: "button",
          class: "wish-btn",
          "data-emoji": e,
          "aria-pressed": view.my_wishes.indexOf(e) >= 0 ? "true" : "false",
          "aria-label": t("wish_send", { emoji: e }),
          on: { click: function () { sendWish(c.person_id, e, btn); } }
        }, [h("span", { class: "wish-emoji", "aria-hidden": "true", text: e }), h("span", { class: "wish-check", "aria-hidden": "true" }, icon("check"))]);
        return btn;
      })));
      kids.push(h("p", { class: "bday-count", text: wishCountText(view.wish_count, state.lang, false) }));
      kids.push(h("p", { class: "bday-msg", role: "status", "aria-live": "polite" }));
    }
    return h("section", { class: "bday" + (c.is_you ? " is-you" : ""), "data-person": c.person_id, "aria-labelledby": id }, kids);
  }

  function birthdayCards(dash) {
    var list = todaysCelebrations(dash, new Date());
    if (!list.length) return null;
    return h("div", { class: "bdays" }, list.map(function (c) { return birthdayCard(c, list); }));
  }

  SCREENS.home = function () {
    var person = state.person || {};
    var first = typeof person.first_name === "string" ? person.first_name.trim() : "";
    var hawaii = isHawaii(person.region);
    var greet = t(hawaii ? "greet_aloha" : greetingKey(new Date().getHours()), { name: first });
    if (!first) greet = greet.replace(/,\s*$/, "");
    var parts = [
      h("div", { class: "greeting" + (hawaii ? " is-hawaii" : "") }, [
        // Hawaii: "Aloha," in gold, then the name (the drawn sunset behind it is only decoration, in app.css).
        hawaii ? h("h1", null, first ? [h("span", { class: "aloha", text: t("greet_aloha", { name: "" }).trim() }), " ", h("span", { class: "hi-name", text: first })]
          : [h("span", { class: "aloha", text: greet })]) : h("h1", { text: greet }),
        person.region ? h("p", { class: "region" }, [icon("pin"), h("span", { text: String(person.region) })]) : null
      ])
    ];
    var dash = state.dash;
    if (!dash) {
      parts.push(dataPlaceholder(true));
      parts.push(footer());
      return h("div", { class: "home" }, parts);
    }
    parts.push(birthdayCards(dash));
    parts.push(heroCard(dash));
    var notice = pickText(dash.notice, state.lang);
    if (notice) {
      parts.push(h("section", { class: "notice", "aria-label": t("notice_label") }, [
        icon("megaphone"),
        h("div", null, [h("p", { class: "notice-label", text: t("notice_label") }), h("p", { class: "notice-text", text: notice })])
      ]));
    }
    parts.push(tiles(dash));
    // A quiet link, not a sixth button: everyone can read the message from the CEO again.
    parts.push(h("a", { class: "ceo-link", href: "#/welcome", on: { click: navClick("welcome") } }, [
      h("span", { class: "ceo-thumb", "aria-hidden": "true" }, imgWithFallback(CEO_PHOTO, "", null, h("span", { text: "C" }))),
      h("span", { class: "ceo-link-text", text: t("ceo_link") }),
      icon("chevronRight")
    ]));
    parts.push(requestsSection());
    parts.push(a2hsCard());
    parts.push(footer());
    return h("div", { class: "home" }, parts);
  };

  /* ---- The message from the CEO ---- */

  var CEO_PHOTO = "img/ceo-cristy.jpg";
  var CEO_NAME = "Cristy Bartley";
  var welcomeSeen = {}; // person id -> true once the letter opened in this app session (storage may be blocked)
  var welcomeAuto = false; // the letter on screen opened by itself

  function welcomeDue() {
    if (party || partyPop || !wantsWelcome(state.dash)) return false;
    var id = state.dash.person.id;
    return !welcomeSeen[id] && store.get(welcomeKey(id)) !== "1";
  }

  /* A letter that came due while a celebration was open opens as soon as the celebration closes. */
  function welcomeNow() {
    if (currentRoute === "home" && state.token && welcomeDue()) render();
  }

  /* Remembered as soon as it opens, so a reload never shows it again. Then a burst of gems plays once around the photo. */
  function welcomeOpened(screen) {
    if (wantsWelcome(state.dash)) {
      welcomeSeen[state.dash.person.id] = true;
      store.set(welcomeKey(state.dash.person.id), "1");
    }
    if (reducedMotion()) return;
    var burst = h("span", { class: "burst", "aria-hidden": "true" });
    for (var i = 0; i < 10; i++) burst.appendChild(i % 3 === 2 ? h("i") : gemSvg());
    var photo = screen.querySelector(".ceo-photo");
    photo.insertBefore(burst, photo.firstChild);
  }

  /* Let's get started: home (where the birthday celebration may open), or back to where the link was. */
  function closeWelcome() {
    if (welcomeAuto) go("home", true);
    else goBack("home");
  }

  SCREENS.welcome = function () {
    var gem = function (cls) { return h("span", { class: cls, "aria-hidden": "true" }); };
    var alt = CEO_NAME + ", " + t("ceo_role");
    var motto = t("ceo_p3").split("{motto}");
    return h("div", { class: "ceo" }, h("article", { class: "letter", "aria-labelledby": "ceo-title" }, [
      gem("corner c-tl"), gem("corner c-tr"), gem("corner c-bl"), gem("corner c-br"), gem("crest"),
      h("div", { class: "ceo-photo" }, h("div", { class: "ceo-avatar" },
        imgWithFallback(CEO_PHOTO, alt, null, h("span", { class: "ceo-initial", role: "img", "aria-label": alt, text: "C" })))),
      h("h1", { id: "ceo-title", class: "ceo-title", text: t("ceo_title") }),
      h("div", { class: "flourish", "aria-hidden": "true" }, [h("b"), h("i"), h("b")]),
      h("div", { class: "letter-body" }, [
        h("p", { class: "letter-lead", text: t("ceo_lead") }),
        h("p", { text: t("ceo_p1") }),
        h("p", { text: t("ceo_p2") }),
        h("p", null, [motto[0], h("strong", { lang: state.lang === "es" ? "en" : null, text: t("tagline") }), motto[1] || ""])
      ]),
      h("div", { class: "signoff" }, [
        h("p", { class: "signoff-with", text: t("ceo_with") }),
        h("p", { class: "signoff-name", text: CEO_NAME }),
        h("p", { class: "signoff-role", text: t("ceo_role") })
      ]),
      h("button", { type: "button", class: "btn letter-go", on: { click: closeWelcome } }, [h("span", { text: t("ceo_go") }), icon("arrowRight")]),
      gem("crest crest-b")
    ]));
  };

  /* ---- Pay calendar ---- */

  function periodRow(p, today, next) {
    var f = periodFlags(p, today);
    var isNext = !!next && next.payday === p.payday;
    var cls = "period" + (f.current ? " is-current" : "") + (f.pending ? " is-pending" : "") + (f.past ? " is-past" : "");
    var chips = [];
    if (f.current) chips.push(chip("chip-current", t("chip_this_period")));
    if (isNext) chips.push(chip("chip-next", t("next_payday")));
    if (f.pending) chips.push(chip("chip-pending", t("chip_pending")));
    if (f.past) chips.push(chip("chip-paid", t("chip_passed")));
    var note = noteFor(p);
    return h("li", { class: cls, "aria-current": f.current ? "true" : null }, [
      chips.length ? h("div", { class: "period-chips" }, chips) : null,
      h("p", { class: "period-label", text: t("cal_payday") }),
      h("p", { class: "period-payday", text: noWrapDate(I.capFirst(I.formatLong(p.payday, state.lang))) }),
      h("p", { class: "period-line" }, [
        icon("briefcase"),
        h("span", { text: t("cal_work", { range: I.formatRange(p.period_start, p.period_end, state.lang) }) })
      ]),
      h("p", { class: "period-line" }, [
        icon("clock"),
        h("span", { text: t("cal_closes", { date: I.formatWeekdayShort(I.parseYMD(p.closes) ? p.closes : p.period_end, state.lang) }) })
      ]),
      note ? h("p", { class: "period-note", text: note }) : null
    ]);
  }

  SCREENS.calendar = function () {
    var dash = state.dash;
    var parts = [
      h("div", { class: "page-head" }, [backButton("home"), h("h1", { text: t("cal_title") })]),
      h("div", { class: "info-card" }, [icon("info"), h("p", { text: t("cal_rule") })])
    ];
    var pdf = safeUrl(dash && dash.links && dash.links.calendar_pdf_url);
    if (pdf) {
      parts.push(h("div", { class: "cal-actions" }, externalLink(pdf, "btn btn-primary", [
        icon("download"),
        h("span", { text: t("cal_pdf") }),
        h("span", { class: "sr-only", text: " " + t("opens_new_tab") })
      ])));
    }
    if (!dash) {
      parts.push(dataPlaceholder(false));
      return h("div", { class: "calendar" }, parts);
    }
    var today = todayLocal();
    var periods = dash.pay && dash.pay.periods;
    var next = nextPayday(periods, today);
    var groups = groupByYear(periods);
    if (!groups.length) parts.push(h("p", { class: "empty", text: t("cal_empty") }));
    groups.forEach(function (g) {
      parts.push(h("h2", { class: "year-head", text: g.year }));
      var ol = h("ol", { class: "periods" });
      g.items.forEach(function (p) { ol.appendChild(periodRow(p, today, next)); });
      parts.push(ol);
    });
    return h("div", { class: "calendar" }, parts);
  };

  /* ---- Request a change ---- */

  function choiceInput(name, value, label, checked, extraCls, onChange) {
    return h("label", { class: "choice" + (extraCls ? " " + extraCls : "") }, [
      h("input", { type: "radio", name: name, value: value, checked: checked, on: { change: onChange } }),
      h("span", { class: "choice-face" }, [icon("check"), h("span", { text: label })])
    ]);
  }

  function fieldError(field, key) {
    return h("p", { id: "err-" + field, class: "field-error", role: "alert" }, [icon("alert"), h("span", { text: t(key) })]);
  }

  function clearErr(field) {
    if (!state.reqErrors[field]) return;
    delete state.reqErrors[field];
    var el = $("err-" + field);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (field === "details") {
      var ta = $("req-details");
      if (ta) {
        ta.removeAttribute("aria-invalid");
        ta.setAttribute("aria-describedby", "req-privacy req-foot");
      }
    }
    if (field === "category") {
      var g = $("cat-grid");
      if (g) g.classList.remove("is-invalid");
      var fs = $("cat-fieldset");
      if (fs) fs.removeAttribute("aria-describedby");
    }
  }

  function updateCounter() {
    var c = $("req-counter");
    if (!c) return;
    var n = state.draft.details.length;
    var text = t("req_counter", { n: n });
    if (c.textContent !== text) c.textContent = text;
    c.classList.toggle("is-bad", n > DETAILS_MAX);
  }

  function requestErrors(d) {
    var errs = {};
    if (CATEGORIES.indexOf(d.category) < 0) errs.category = "err_topic";
    var len = cleanDetails(d.details).length;
    if (len < DETAILS_MIN) errs.details = "err_details_short";
    else if (len > DETAILS_MAX) errs.details = "err_details_long";
    return errs;
  }

  /* A "My info" draft is kept in memory only: its details are never written to storage. */
  function saveDraft() {
    var d = state.draft;
    store.setJSON(K.draft, d.category === "my_info" ? { category: d.category, details: "", contact_pref: d.contact_pref } : d);
  }

  function onSubmitRequest(e) {
    e.preventDefault();
    if (state.sending) return;
    var d = state.draft;
    var errs = requestErrors(d);
    if (errs.category || errs.details) {
      state.reqErrors = errs;
      state.reqStatus = null;
      render();
      var target = errs.category ? doc.querySelector('#cat-grid input') : $("req-details");
      if (target) target.focus();
      return;
    }
    if (!isOnline()) {
      updateChrome();
      return;
    }
    var v = validateRequest(d);
    if (!v.ok) {
      state.reqErrors = {};
      state.reqErrors[v.field] = v.key;
      render();
      return;
    }
    // One id per draft: an automatic retry or a second tap on Send for the same text and topic
    // reuses it, so the office gets the request once. Editing the text or topic makes a new one.
    if (!KEY_RE.test(d.client_request_id || "")) d.client_request_id = randomId();
    saveDraft();
    state.sending = true;
    state.reqErrors = {};
    state.reqStatus = null;
    render();
    var token = state.token;
    api("request", {
      token: token,
      category: v.value.category,
      details: v.value.details,
      contact_pref: v.value.contact_pref,
      client_request_id: d.client_request_id
    }).then(function (res) {
      state.sending = false;
      if (token !== state.token) return;
      if (res.ok && res.request) {
        state.lastRequest = hideInfo(res.request);
        d.details = "";
        state.draft = { category: "", details: "", contact_pref: "whatsapp" };
        store.remove(K.draft);
        if (state.dash) {
          // A resend of a saved draft gets the saved request back, which may already be in the list.
          var list = dashRequests().filter(function (r) { return !r || r.request_id !== state.lastRequest.request_id; });
          list.unshift(state.lastRequest);
          state.dash.requests = list.slice(0, 10);
          store.setJSON(K.dash, state.dash);
        }
        go("done", true);
        refreshDashboard();
        return;
      }
      if (isAuthError(res)) {
        signOut("signin_again");
        return;
      }
      var code = res.ok ? "SERVER" : errCode(res);
      if (code === "VALIDATION") {
        var field = res.error && res.error.field;
        if (field === "details") {
          state.reqErrors = { details: cleanDetails(d.details).length > DETAILS_MAX ? "err_details_long" : "err_details_short" };
        } else if (field === "category") {
          state.reqErrors = { category: "err_topic" };
        } else if (field === "contact_pref") {
          state.reqErrors = { contact_pref: "err_contact" };
        } else {
          state.reqStatus = "error_server";
        }
      } else if (code === "NETWORK") {
        // The request may have been saved before the connection failed or timed out.
        state.reqStatus = "err_unsure";
        refreshDashboard();
      } else {
        state.reqStatus = errorKeyFor(code);
      }
      if (currentRoute === "request") render();
    });
  }

  SCREENS.request = function () {
    var d = state.draft;
    var errs = state.reqErrors;

    var catGrid = h("div", { class: "choice-grid" + (errs.category ? " is-invalid" : ""), id: "cat-grid" });
    CATEGORIES.forEach(function (c, i) {
      catGrid.appendChild(choiceInput("category", c, t("cat_" + c), d.category === c, i === CATEGORIES.length - 1 ? "span2" : "", function () {
        d.category = c;
        d.client_request_id = "";
        saveDraft();
        clearErr("category");
      }));
    });

    var ta = h("textarea", {
      id: "req-details",
      class: "textarea",
      name: "details",
      rows: 6,
      maxLength: DETAILS_MAX,
      autocapitalize: "sentences",
      spellcheck: "true",
      "aria-describedby": "req-privacy req-foot" + (errs.details ? " err-details" : ""),
      "aria-invalid": errs.details ? "true" : null
    });
    ta.value = d.details;
    ta.addEventListener("input", function () {
      d.details = ta.value;
      d.client_request_id = "";
      saveDraft();
      updateCounter();
      if (state.reqErrors.details && !requestErrors({ category: "schedule", details: ta.value }).details) clearErr("details");
    });

    var contactGrid = h("div", { class: "choice-grid" });
    CONTACTS.forEach(function (c) {
      contactGrid.appendChild(choiceInput("contact_pref", c, t("contact_" + c), d.contact_pref === c, "", function () {
        d.contact_pref = c;
        saveDraft();
        clearErr("contact_pref");
      }));
    });

    var online = isOnline();
    var unsure = state.reqStatus === "err_unsure";
    var submit = h("button", {
      type: "submit",
      id: "req-submit",
      class: "btn btn-primary",
      disabled: state.sending || !online
    }, state.sending
      ? [h("span", { class: "spinner", "aria-hidden": "true" }), t("req_sending")]
      : [icon("message"), t("req_submit")]);

    var form = h("form", { class: "form", novalidate: true, on: { submit: onSubmitRequest } }, [
      h("fieldset", { id: "cat-fieldset", "aria-describedby": errs.category ? "err-category" : null }, [
        h("legend", { text: t("req_topic") }),
        catGrid,
        errs.category ? fieldError("category", errs.category) : null
      ]),
      h("div", { class: "field" }, [
        h("label", { for: "req-details", class: "field-label", text: t("req_details") }),
        h("p", { id: "req-privacy", class: "privacy" }, [icon("lock"), h("span", { text: t("req_privacy") })]),
        ta,
        h("div", { id: "req-foot", class: "field-foot" }, [
          h("span", { text: t("req_min_hint") }),
          h("span", { id: "req-counter", class: "counter" + (d.details.length > DETAILS_MAX ? " is-bad" : ""), text: t("req_counter", { n: d.details.length }) })
        ]),
        errs.details ? fieldError("details", errs.details) : null
      ]),
      h("fieldset", { "aria-describedby": errs.contact_pref ? "err-contact_pref" : null }, [
        h("legend", { text: t("req_contact") }),
        contactGrid,
        errs.contact_pref ? fieldError("contact_pref", errs.contact_pref) : null
      ]),
      state.reqStatus ? h("div", { class: "form-status", role: "alert" }, msgBox(unsure ? "wait" : "error", unsure ? "info" : "alert", t(state.reqStatus),
        unsure ? h("a", { class: "link-btn", href: "#/requests", on: { click: navClick("requests") } }, t("see_my_requests")) : null)) : null,
      h("div", { class: "submit-wrap" }, [
        h("p", { id: "req-offline", class: "offline-note", hidden: online }, [icon("wifiOff"), h("span", { text: t("req_offline") })]),
        submit
      ])
    ]);

    return h("div", { class: "request" }, [
      h("div", { class: "page-head" }, [
        backButton("home"),
        h("h1", { text: t("req_title") }),
        h("p", { class: "page-sub", text: t("req_intro") })
      ]),
      form
    ]);
  };

  /* ---- Done and My requests ---- */

  function checkAnimation() {
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("class", "check-anim");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var ring = doc.createElementNS(SVGNS, "circle");
    ring.setAttribute("class", "ring");
    ring.setAttribute("cx", "60");
    ring.setAttribute("cy", "60");
    ring.setAttribute("r", "53");
    var tick = doc.createElementNS(SVGNS, "path");
    tick.setAttribute("class", "tick");
    tick.setAttribute("d", "M37 62l15 15 31-32");
    svg.appendChild(ring);
    svg.appendChild(tick);
    return svg;
  }

  SCREENS.done = function () {
    var r = state.lastRequest || {};
    var id = r.request_id ? String(r.request_id) : "";
    return h("div", { class: "done" }, [
      checkAnimation(),
      h("h1", { text: t("done_title") }),
      id ? h("p", { class: "done-number" }, [
        h("span", { text: t("done_number", { id: "" }).trim() }),
        h("br"),
        h("span", { class: "req-id", text: id })
      ]) : null,
      h("p", { class: "done-body", text: t("done_body") }),
      h("div", { class: "btn-row" }, [
        h("button", { type: "button", class: "btn btn-primary", on: { click: function () { goBack("home"); } } }, t("back_home")),
        h("button", { type: "button", class: "btn btn-secondary", on: { click: function () { go("requests", true); } } }, t("see_my_requests"))
      ])
    ]);
  };

  SCREENS.requests = function () {
    var parts = [h("div", { class: "page-head" }, [backButton("home"), h("h1", { text: t("my_requests") })])];
    if (!state.dash) {
      parts.push(dataPlaceholder(false));
      return h("div", { class: "requests" }, parts);
    }
    var reqs = dashRequests();
    if (reqs.length) {
      parts.push(requestList(reqs, false));
    } else {
      parts.push(h("div", { class: "empty" }, [
        h("p", { text: t("no_requests") }),
        h("a", { class: "btn btn-primary", href: "#/request", on: { click: navClick("request") } }, t("tile_change_title"))
      ]));
    }
    return h("div", { class: "requests" }, parts);
  };

  /* ---- Trainings (coming soon) ---- */

  SCREENS.training = function () {
    return h("div", { class: "training" }, [
      h("div", { class: "page-head" }, [backButton("home"), h("h1", { text: t("tile_training_title") })]),
      h("section", { class: "soon" }, [
        h("span", { class: "soon-icon" }, icon("cap")),
        h("p", null, h("span", { class: "badge", text: t("coming_soon") })),
        h("p", { class: "soon-text", text: t("training_body") }),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn-primary", on: { click: function () { goBack("home"); } } }, t("back_home")))
      ])
    ]);
  };

  /* ---- 4. Boot ---- */

  var booted = false;
  var REFRESH_AFTER_MS = 5 * 60 * 1000;

  function onKeyDown(e) {
    if (party) {
      partyKeyDown(e);
      return;
    }
    if (currentRoute !== "login" || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName ? e.target.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      flashKey(e.key);
      pressDigit(e.key);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      flashKey("del");
      pressDelete();
    }
  }

  function registerServiceWorker() {
    if (CFG.API_MODE === "gas" || !("serviceWorker" in root.navigator)) return;
    // Only the top level app gets offline support (not previews or test frames).
    try {
      if (root.top !== root) return;
    } catch (e) {
      return;
    }
    var loc = root.location;
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(loc.hostname);
    if (loc.protocol !== "https:" && !(loc.protocol === "http:" && local)) return;
    var doRegister = function () {
      root.navigator.serviceWorker.register("sw.js").catch(function () { /* offline support is optional */ });
    };
    if (doc.readyState === "complete") doRegister();
    else root.addEventListener("load", doRegister);
  }

  function loadSaved() {
    var device = store.get(K.device);
    if (!device || !/^[a-f0-9]{16,64}$/.test(device)) {
      device = randomId();
      store.set(K.device, device);
    }
    state.deviceId = device;

    state.urlLang = langFromSearch(root.location.search);
    if (state.urlLang) store.set(K.lang, state.urlLang);

    var token = store.get(K.token);
    if (token && /^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(token)) {
      state.token = token;
      var person = store.getJSON(K.person);
      var dash = store.getJSON(K.dash);
      state.dash = dash && typeof dash === "object" && dash.ok === true ? hideDash(dash) : null;
      // Rewrite what an older version saved, so no "My info" details or replies stay on the phone.
      if (state.dash) store.setJSON(K.dash, state.dash);
      state.person = person && typeof person === "object" ? person : (state.dash && state.dash.person) || {};
      var draft = store.getJSON(K.draft);
      if (draft && typeof draft === "object") {
        state.draft = {
          category: CATEGORIES.indexOf(draft.category) >= 0 ? draft.category : "",
          details: typeof draft.details === "string" && draft.category !== "my_info" ? draft.details.slice(0, DETAILS_MAX) : "",
          contact_pref: CONTACTS.indexOf(draft.contact_pref) >= 0 ? draft.contact_pref : "whatsapp",
          client_request_id: KEY_RE.test(draft.client_request_id || "") ? draft.client_request_id : ""
        };
        saveDraft();
      }
    } else if (token) {
      clearSession();
    }

    var lockUntil = Number(store.get(K.lock)) || 0;
    if (lockUntil > Date.now()) {
      state.lockUntil = lockUntil;
      state.loginMsg = { kind: "wait" };
    } else if (lockUntil) {
      store.remove(K.lock);
    }
    adoptLang();
  }

  function wireChrome() {
    var btns = doc.querySelectorAll("#lang-toggle .lang-btn");
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () { setLang(btn.getAttribute("data-lang"), true); });
      })(btns[i]);
    }
    var brand = $("brand-link");
    if (brand) {
      brand.addEventListener("click", function (e) {
        e.preventDefault();
        var target = state.token ? "home" : "login";
        if (currentRoute !== target) go(target);
      });
    }
    var mark = $("brand-mark");
    if (mark && !mark.firstChild) {
      mark.appendChild(imgWithFallback("img/mark.png", "", null, h("span", { class: "mark-fallback", "aria-hidden": "true", text: "CCC" })));
    }
  }

  function boot() {
    loadSaved();
    wireChrome();
    // Wake the Apps Script backend while the person types their PIN: the first call after a new
    // deployment can take 25 seconds or answer with an error page. The answer is not used.
    api("ping");

    root.addEventListener("popstate", onHistoryChange);
    root.addEventListener("hashchange", onHistoryChange);
    root.addEventListener("online", function () {
      updateChrome();
      if (state.token && (state.netDown || !state.dash)) refreshDashboard();
    });
    root.addEventListener("offline", updateChrome);
    doc.addEventListener("keydown", onKeyDown);
    doc.addEventListener("touchstart", function () { /* enables :active styles on iOS */ }, { passive: true });
    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState === "visible" && state.token && Date.now() - state.lastRefresh > REFRESH_AFTER_MS) {
        refreshDashboard();
      }
    });
    root.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      state.installPrompt = e;
      if (currentRoute === "home" && state.dash) render();
    });
    root.addEventListener("appinstalled", function () {
      state.installPrompt = null;
      store.set(K.a2hs, "1");
      var c = $("a2hs");
      if (c && c.parentNode) c.parentNode.removeChild(c);
    });

    render();
    booted = true;
    if (state.token) refreshDashboard();
    registerServiceWorker();
  }

  if (!root.CCC_NO_BOOT && doc.getElementById("app")) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(window);
