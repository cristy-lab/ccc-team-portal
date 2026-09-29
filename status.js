/* CCC Team Portal W2 and 1099 screen (0.3.9), lazily loaded with status_i18n.js and status.css.
 * Contract: docs/API.md section 16.
 *
 * Only the owner ever loads these three files: the tile is drawn from dashboard.worker_status.owner
 * and the route falls back to home for everybody else, so the 76 phones that can never open this
 * screen never download it (README, "Size budgets").
 *
 * The rules this screen keeps:
 *   * Nothing is written to phone storage. The list, the counts and the records live in memory and
 *     go when she leaves the screen or signs out, the same promise the Trainings screen makes.
 *   * No PIN, no phone number, no last name and no birthday is ever drawn. The read action does not
 *     send them, and this file asks for nothing else.
 *   * A switch never changes anything by itself. It opens one confirmation that names the person
 *     and the date, because a change of employment status is a payroll event.
 *   * The effective date is worked out by the backend in the person's own region time zone, so this
 *     file sends no date at all unless she picks one by hand (docs/API.md 16.3).
 */
(function (root) {
  "use strict";

  var doc = root.document, I = root.CCC_I18N, P = null;
  var NOTE_MAX = 200, RECENT = 10;    // ws_note_max and ws_recent_changes, docs/API.md 16.1
  var V = null, dlg = null, wired = false, popping = 0, waiting = null;

  /* Everything this screen holds, in memory only. */
  function blank() {
    return { data: null, err: null, busy: false, q: "", note: null, live: "", dom: null };
  }

  function t(key, vars) { return P.t(key, vars); }
  function el(tag, attrs, kids) { return P.h(tag, attrs, kids); }
  function lang() { return P.state.lang; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function fold(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""); }
  function myId() { return (P.state.person && P.state.person.id) || ""; }

  /* "1099", "W2" or the words for a cell nobody has answered. */
  function typeText(value) {
    if (value === "w2") return "W2";
    if (value === "1099") return "1099";
    return t("st_chip_blank");
  }

  function chipFor(value) {
    var cls = value === "w2" ? "st-chip-w2" : value === "1099" ? "st-chip-1099" : "st-chip-blank";
    var key = value === "w2" ? "st_chip_w2" : value === "1099" ? "st_chip_1099" : "st_chip_blank";
    return el("span", { class: "chip " + cls, text: t(key) });
  }

  /* The phone's own calendar day, the fallback when the backend did not say the person's own. */
  function phoneToday() { return I.toYMD(new Date()); }
  /* Today where that person lives, which is the day the backend will record (docs/API.md 16.3). */
  function theirToday(person) {
    return (person && typeof person.today === "string" && person.today) || phoneToday();
  }
  /* The other end of the same field: the earliest day the backend will accept for this person, the
     later of a year back and their own newest change (docs/API.md 16.3). Without it the field could
     only stop a future day, and the help could only say "pick an earlier day", which is the sentence
     that sent her to a refusal naming no date at all. Empty when an older backend did not send it,
     and then the field simply has no floor, as before. */
  function theirEarliest(person) {
    return (person && typeof person.earliest === "string" && person.earliest) || "";
  }
  /* The year is printed whenever it is not this one: a change may be back dated a whole year, and
     two records twelve months apart must not read the same on the one screen that answers when. */
  function withYear(text, ymd) {
    var year = String(ymd).slice(0, 4);
    return year && year !== String(new Date().getFullYear()) ? text + ", " + year : text;
  }
  function longDate(ymd) { return withYear(I.formatLong(ymd, lang()) || ymd, ymd); }
  function shortDate(ymd) { return withYear(I.formatShort(ymd, lang()) || ymd, ymd); }

  /* Two of these carry a {date}, and only the write can see them, which fills it (16.4). */
  function errKey(res) {
    var e = (res && res.error) || {}, code = e.code, reason = e.reason;
    if (code === "VALIDATION") {
      if (reason === "CHANGED") return "st_err_changed";
      if (reason === "FUTURE") return "st_err_future";
      if (reason === "TOO_OLD") return "st_err_old";
      if (reason === "BEFORE_LAST") return "st_err_before_last";
      if (reason === "REUSED") return "st_err_reused";
      if (reason === "NOT_ACTIVE") return "st_err_inactive";
      if (reason === "NOT_FOUND") return "st_err_notfound";
    }
    if (code === "FORBIDDEN") return reason === "SETUP_INCOMPLETE" ? "st_err_setup" : "st_err_not_owner";
    if (code === "RATE_LIMITED") return "st_err_limit";
    if (code === "NETWORK") return "error_network";
    return "error_server";
  }

  /* ---- The read ---- */

  function load() {
    if (!V || V.busy) return;
    var token = P.state.token;
    V.busy = true;
    P.api("worker_status", { token: token }).then(function (res) {
      if (!V || token !== P.state.token) return;
      V.busy = false;
      if (res && res.ok) {
        V.data = res;
        V.err = null;
      } else if (res && res.error && (res.error.code === "AUTH_INVALID" || res.error.code === "AUTH_EXPIRED")) {
        P.signOut("signin_again");
        return;
      } else {
        V.err = errKey(res);
      }
      P.render();
    });
  }

  /* ---- The list ---- */

  function matches(person, q) {
    if (!q) return true;
    return fold(person.display_name).indexOf(q) >= 0 || fold(person.region).indexOf(q) >= 0;
  }

  function personRow(person) {
    var self = person.id === myId();
    var isW2 = person.worker_type === "w2";
    var isBlank = person.worker_type !== "w2" && person.worker_type !== "1099";
    var nameKey = isBlank ? "st_switch_blank" : isW2 ? "st_switch_to_1099" : "st_switch_to_w2";
    var flags = [chipFor(person.worker_type)];
    if (person.recorded === false) {
      flags.push(el("span", { class: "st-flag" }, [P.icon("alert"), el("span", { text: t("st_not_recorded") })]));
    }
    // The word W2 sits beside the switch, because a switch next to a person's name reads as "this
    // person is on or off" and nothing else on the screen said which position means what.
    var controls = [el("div", { class: "st-switch-wrap" }, [
      el("span", { class: "st-switch-w2", "aria-hidden": "true", text: "W2" }),
      el("button", {
        type: "button", class: "st-switch", role: "switch", "aria-checked": isW2 ? "true" : "false",
        "aria-label": t(nameKey, { name: person.display_name }), "data-k": person.id, disabled: self,
        on: { click: function (e) { ask(person, isW2 ? "1099" : "w2", e.currentTarget); } }
      }, el("span", { class: "st-knob", "aria-hidden": "true" }))
    ])];
    // A blank cell has no opposite, so the second answer gets its own button, on that row only.
    if (isBlank && !self) {
      controls.push(el("button", {
        type: "button", class: "st-second", "data-k": person.id + "|1099",
        "aria-label": t("st_set_1099_named", { name: person.display_name }),
        on: { click: function (e) { ask(person, "1099", e.currentTarget); } }
      }, el("span", { text: t("st_set_1099") })));
    }
    return el("li", { class: "st-person" }, [
      el("div", { class: "st-who" }, [
        el("p", { class: "st-name", text: person.display_name }),
        el("p", { class: "st-flags" }, flags),
        self ? el("p", { class: "st-self", text: t("st_switch_self") }) : null
      ]),
      el("div", { class: "st-controls" }, controls)
    ]);
  }

  function listNode() {
    var box = el("div", { class: "st-list", id: "st-list" });
    fillList(box);
    return box;
  }

  function fillList(box) {
    clear(box);
    var q = fold(V.q).trim(), shown = 0;
    arr(V.data.regions).forEach(function (group) {
      var people = arr(group.people).filter(function (person) { return matches(person, q); });
      if (!people.length) return;
      shown += people.length;
      var ul = el("ul", { class: "st-people" });
      people.forEach(function (person) { ul.appendChild(personRow(person)); });
      box.appendChild(el("section", { class: "st-region" }, [
        el("h2", { text: t("st_region_count", { region: group.region, n: people.length }) }),
        group.held === true ? el("p", { class: "st-held", text: t("st_region_held") }) : null,
        ul
      ]));
    });
    if (!shown) {
      box.appendChild(el("p", { class: "empty", text: q ? t("st_no_results") : t("st_nobody") }));
    }
    return shown;
  }

  /* ---- The last ten records ---- */

  function changeRow(change) {
    var start = change.kind === "start";
    var line = start
      ? t("st_recent_start_line", { name: change.display_name, to: typeText(change.to), date: shortDate(change.effective_on) })
      : t("st_recent_line", {
        name: change.display_name, from: typeText(change.from), to: typeText(change.to),
        date: shortDate(change.effective_on)
      });
    // A note is written by a person, so nothing translates it. The go live rows all carry the same
    // fixed English sentence, which would then be ten English paragraphs on the Spanish screen; the
    // Starting position badge carries the meaning, and one localized line sits under the heading.
    var note = start || typeof change.note !== "string" ? "" : change.note.trim();
    return el("li", { class: "st-change" }, [
      el("p", { class: "st-change-line", text: line }),
      el("p", { class: "st-change-by" }, [
        el("span", { text: t("st_recent_by", { name: change.by_name }) }),
        start ? el("span", { class: "st-tag", text: t("st_recent_start") }) : null
      ]),
      note ? el("p", { class: "st-change-note", text: note }) : null,
      change.sealed === false
        ? el("p", { class: "st-unsealed" }, [P.icon("alert"), el("span", { text: t("st_recent_unsealed") })])
        : null
    ]);
  }

  function changesNode() {
    var changes = arr(V.data.changes);
    var anyStart = changes.some(function (c) { return c.kind === "start"; });
    return el("section", { class: "st-recent" }, [
      el("h2", { text: t("st_recent") }),
      anyStart ? el("p", { class: "st-note", text: t("st_recent_start_note") }) : null,
      changes.length
        ? el("ul", { class: "st-changes" }, changes.map(changeRow))
        : el("p", { class: "empty", text: t("st_recent_none") })
    ]);
  }

  /* ---- The counts ---- */

  function countsNode() {
    var c = (V.data && V.data.counts) || {};
    function one(key, value, warn) {
      return el("div", { class: "st-count" + (warn ? " is-warn" : "") }, [
        el("b", { text: String(value || 0) }),
        el("span", { text: t(key) })
      ]);
    }
    return el("div", {
      class: "st-counts", id: "st-counts", role: "group", "aria-label": t("st_counts_label"),
      "aria-live": "polite"
    }, [
      one("st_count_1099", c.c1099, false),
      one("st_count_w2", c.w2, false),
      one("st_count_blank", c.blank, (c.blank || 0) > 0)
    ]);
  }

  /* ---- The screen ---- */

  function head() {
    return el("div", { class: "page-head" }, [P.backButton("home"), el("h1", { text: t("st_title") })]);
  }

  function screen() {
    if (!V) {
      V = blank();
      root.setTimeout(load, 0);
    }
    wire();
    if (!V.data) {
      return el("div", { class: "status" }, [
        head(),
        V.err
          ? el("div", { class: "load-error" }, [
            P.msgBox("error", V.err === "error_network" ? "wifiOff" : "alert", t(V.err)),
            P.retry(function () { V.err = null; P.render(); load(); })
          ])
          : el("div", { role: "status" }, el("span", { class: "sr-only", text: t("loading") }))
      ]);
    }
    var counts = V.data.counts || {};
    var search = el("input", {
      type: "search", class: "st-search", id: "st-q", value: V.q, maxLength: 60,
      autocomplete: "off", autocorrect: "off", spellcheck: "false",
      on: { input: function (e) { V.q = e.currentTarget.value; onSearch(); } }
    });
    var box = listNode();
    var node = el("div", { class: "status" }, [
      head(),
      // The numbers she came for are above the warning, because on a 320 px phone the warning alone
      // filled the first screen and a block of law she has to scroll past every visit is a block of
      // law she stops reading. The warning is still always there and still has no dismiss control.
      countsNode(),
      el("p", { class: "st-people-n", text: t("st_people", { n: counts.people || 0 }) }),
      el("p", { class: "st-note", text: t("st_switch_help") }),
      P.msgBox("info", "alert", t("st_warning")),
      V.note ? P.msgBox("wait", "alert", t(V.note)) : null,
      el("div", { class: "st-searchbox" }, [
        el("label", { class: "st-label", for: "st-q", text: t("st_search_label") }),
        el("div", { class: "st-search-row" }, [search, el("button", {
          type: "button", class: "st-clear", "aria-label": t("st_search_clear"),
          on: { click: function () { V.q = ""; search.value = ""; onSearch(); search.focus(); } }
        }, P.icon("close"))])
      ]),
      el("p", { class: "sr-only", id: "st-results", role: "status" }),
      box,
      V.data.truncated === true
        ? el("p", { class: "st-note", text: t("st_truncated", { n: countShown() }) })
        : null,
      changesNode(),
      el("p", { class: "st-note", text: t("st_inactive_note") }),
      el("p", { class: "st-note", text: t("st_nochange") }),
      el("p", { class: "sr-only", id: "st-live", role: "status" })
    ]);
    V.dom = { box: box, search: search };
    return node;
  }

  function countShown() {
    var n = 0;
    arr(V.data.regions).forEach(function (group) { n += arr(group.people).length; });
    return n;
  }

  /* The search never redraws the page, so the field keeps the focus and what she typed. */
  function onSearch() {
    if (!V || !V.dom) return;
    var shown = fillList(V.dom.box);
    var results = doc.getElementById("st-results");
    if (results) results.textContent = V.q.trim() ? t("st_results", { n: shown }) : "";
  }

  /* The live region is drawn again with the screen, so the words go in on the next tick: a region
     that arrives with its text already in it is not a change, and nothing is read out. */
  function announce(text) {
    V.live = text;
    root.setTimeout(function () {
      var live = doc.getElementById("st-live");
      if (live && V && V.live === text) live.textContent = text;
    }, 60);
  }

  function focusK(key) {
    var node = doc.querySelector('#app [data-k="' + key + '"]');
    if (node && node.focus) {
      try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
    }
  }

  /* ---- The confirmation ---- */

  function ask(person, to, opener) {
    if (dlg || !V) return;
    // A dialog that has just closed is still giving its history entry back: open after it.
    if (popping) {
      waiting = function () { ask(person, to, opener); };
      return;
    }
    V.note = null;
    var from = person.worker_type === "w2" ? "w2" : person.worker_type === "1099" ? "1099" : "none";
    // One id for the whole question: a retry after an answer that never arrived is the same call.
    var call = {
      person: person, to: to, from: from, req: P.randomId(),
      opener: opener && opener.getAttribute("data-k"), picked: null, note: "", sending: false
    };
    var title = el("h2", { class: "st-dlg-title", id: "st-dlg-title", text: t(to === "w2" ? "st_confirm_w2_title" : "st_confirm_1099_title", { name: person.display_name }) });
    var bodyKey = to === "w2" ? "st_confirm_w2_body" : "st_confirm_1099_body";
    var body = el("p", { class: "st-dlg-body", id: "st-dlg-body" });
    /* The question must always name the day that will really be written: the day she picked, or,
       when she picked none, today where that person lives, which the read action sends. Building
       this once and never again let the words say one day while the field below them said another,
       on an append only row that can never be edited. */
    function sayDate() {
      body.textContent = t(bodyKey, {
        name: person.display_name, date: longDate(call.picked || theirToday(person))
      });
    }
    sayDate();
    // Empty on purpose: empty means "the day where that person lives", which is what the backend
    // does with no date at all. A field pre filled with the owner's own day quietly turned that
    // into "the day on my phone" for anybody who opened the box and touched nothing.
    // Both ends come from the backend, which is the only side that knows this person's own calendar
    // and their own newest change. min is left off entirely when an older backend sent no floor.
    var first = theirEarliest(person);
    var dateAttrs = { type: "date", class: "st-date", id: "st-date", max: theirToday(person),
      on: { input: function (e) { call.picked = e.currentTarget.value || null; sayDate(); } } };
    if (first) dateAttrs.min = first;
    var date = el("input", dateAttrs);
    var dateClear = el("button", {
      type: "button", class: "link-btn st-dateclear", text: t("st_date_clear"),
      on: { click: function () { date.value = ""; call.picked = null; sayDate(); date.focus(); } }
    });
    var dateBox = el("div", { class: "st-datebox", id: "st-datebox", hidden: true }, [
      el("label", { class: "st-label", for: "st-date", text: t("st_date_label") }),
      date,
      // The help names both ends. "Pick an earlier day" on its own was false for everybody the
      // moment the starting position was written, and the refusal it led to named no date.
      el("p", { class: "st-help", text: first
        ? t("st_date_help", { first: longDate(first), last: longDate(theirToday(person)) })
        : t("st_date_help_open", { last: longDate(theirToday(person)) }) }),
      dateClear
    ]);
    var dateBtn = el("button", {
      type: "button", class: "link-btn st-datebtn", "aria-expanded": "false", "aria-controls": "st-datebox",
      text: t("st_change_date"),
      on: { click: function (e) {
        dateBox.hidden = false;
        e.currentTarget.setAttribute("aria-expanded", "true");
        e.currentTarget.hidden = true;
        date.focus();
      } }
    });
    var left = el("p", { class: "st-counter", id: "st-left", text: t("st_note_left", { n: NOTE_MAX }) });
    var note = el("input", {
      type: "text", class: "st-note-input", id: "st-note", maxLength: NOTE_MAX, autocomplete: "off",
      on: { input: function (e) {
        call.note = e.currentTarget.value;
        left.textContent = t("st_note_left", { n: Math.max(0, NOTE_MAX - call.note.length) });
      } }
    });
    var msg = el("div", { class: "st-dlg-msg" });
    var yes = el("button", { type: "button", class: "btn btn-primary", text: t("st_confirm_yes"),
      on: { click: function () { send(call, yes, no, msg); } } });
    var no = el("button", { type: "button", class: "btn btn-secondary", text: t("st_cancel"),
      on: { click: function () { closeDialog(); } } });
    open([title, body, dateBtn, dateBox,
      el("div", { class: "st-field" }, [
        el("label", { class: "st-label", for: "st-note", text: t("st_note_label") }), note, left
      ]),
      msg], el("div", { class: "st-dlg-btns" }, [yes, no]), call);
  }

  /* The words scroll, the two buttons do not: on a 320 px phone the body is longer than the screen,
     and Cancel has to be as easy to reach as Yes on a question about somebody's pay. */
  function open(kids, buttons, call) {
    var box = el("div", {
      class: "st-dlg", role: "dialog", "aria-modal": "true", "aria-labelledby": "st-dlg-title",
      "aria-describedby": "st-dlg-body", tabindex: "-1"
    }, el("div", { class: "st-dlg-card" }, [el("div", { class: "st-dlg-scroll" }, kids), buttons]));
    doc.body.appendChild(box);
    P.inert(true);
    dlg = { el: box, call: call };
    try {
      var st = root.history.state;
      root.history.pushState({ cccIdx: ((st && st.cccIdx) || 0) + 1, stDlg: 1 }, "", root.location.href);
    } catch (e) { /* no history here: Escape and the buttons still close it */ }
    // The dialog itself takes the focus, not its first button, so a screen reader reads the title
    // and the body it is labelled and described by before anything can be pressed.
    box.focus();
  }

  function closeDialog(quiet) {
    if (!dlg) return;
    var key = dlg.call && dlg.call.opener, st = root.history.state;
    dlg.el.parentNode.removeChild(dlg.el);
    dlg = null;
    P.inert(false);
    if (st && st.stDlg) {
      popping = popping + 1;
      var token = popping;
      root.setTimeout(function () { popped(token); }, 600);
      root.history.back();
    }
    if (!quiet && key) focusK(key);
  }

  function popped(token) {
    if (token && token !== popping) return;   // a later close already took this one back
    popping = 0;
    var next = waiting;
    waiting = null;
    if (next) next();
  }

  function dialogKeys(e) {
    if (!dlg) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (e.key !== "Tab") return;
    // getClientRects, not offsetParent: everything inside this dialog has a fixed ancestor,
    // whose children all report offsetParent null, which would leave the trap with nothing to hold.
    var all = Array.prototype.slice.call(dlg.el.querySelectorAll("button, input")).filter(function (n) {
      return !n.disabled && n.getClientRects().length > 0;
    });
    if (!all.length) return;
    var first = all[0], last = all[all.length - 1], a = doc.activeElement;
    var out = !dlg.el.contains(a) || a === dlg.el;
    if (e.shiftKey ? a === first || out : a === last || out) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }

  /* ---- The write ---- */

  function send(call, yes, no, msg) {
    if (call.sending) return;   // a second tap while the call is out sends nothing
    call.sending = true;
    yes.disabled = true;
    no.disabled = true;
    clear(msg).appendChild(el("p", { class: "st-saving", role: "status" }, [
      el("span", { class: "spinner", "aria-hidden": "true" }), el("span", { text: t("st_saving") })
    ]));
    var token = P.state.token;
    var payload = {
      token: token, person_id: call.person.id, from: call.from, to: call.to,
      client_req_id: call.req
    };
    // The date is sent only when she picked one. Left out, the backend uses that person's own day.
    if (call.picked) payload.effective_on = call.picked;
    if (call.note.trim()) payload.note = call.note;
    P.api("worker_status_set", payload).then(function (res) {
      if (!V || token !== P.state.token) return;
      call.sending = false;
      if (res && res.ok) return done(call, res);
      if (res && res.error && (res.error.code === "AUTH_INVALID" || res.error.code === "AUTH_EXPIRED")) {
        P.signOut("signin_again");
        return;
      }
      var key = errKey(res);
      // The two refusals about the date both name the earliest day this person may be dated, which
      // is the one thing she cannot work out from the screen. Every other line ignores {date}.
      var vars = { date: longDate(theirEarliest(call.person) || theirToday(call.person)) };
      if (key === "st_err_changed") {
        // The sheet moved underneath: nothing is flipped, the whole list is read again.
        V.note = key;
        closeDialog(true);
        V.data = null;
        P.render();
        load();
        return;
      }
      yes.disabled = false;
      no.disabled = false;
      // The message is the last thing in the scrolling part of the card, so on a 320 px phone it
      // landed below the visible edge and the card looked untouched after she pressed Yes. It is
      // announced, brought into view and given the focus.
      var box = P.msgBox("error", key === "error_network" ? "wifiOff" : "alert", t(key, vars));
      box.setAttribute("role", "alert");
      box.setAttribute("tabindex", "-1");
      clear(msg).appendChild(box);
      try { msg.scrollIntoView({ block: "nearest" }); } catch (e) { /* older engines */ }
      try { box.focus({ preventScroll: true }); } catch (e2) { box.focus(); }
    });
  }

  function done(call, res) {
    // An answer about somebody else is never painted onto the row she picked. The backend refuses a
    // client_req_id used for a different change, so this should be unreachable; if it ever is not,
    // the whole list is read again rather than a row being drawn from an answer that is not about it.
    if (res.person && res.person.id && res.person.id !== call.person.id) {
      closeDialog(true);
      V.data = null;
      P.render();
      load();
      return;
    }
    apply(call, res);
    closeDialog(true);
    P.render();
    focusK(call.person.id);
    var date = (res.change && res.change.effective_on) || phoneToday();
    announce(t(call.to === "w2" ? "st_done_w2" : "st_done_1099",
      { name: call.person.display_name, date: longDate(date) }));
  }

  /* The answer carries the new counts and the record, so the screen is right without a second call. */
  function apply(call, res) {
    var person = res.person || {};
    if (res.counts) V.data.counts = res.counts;
    arr(V.data.regions).forEach(function (group) {
      arr(group.people).forEach(function (p) {
        if (p.id !== call.person.id) return;
        p.worker_type = person.worker_type || call.to;
        p.track = person.track || p.track;
        // The row was just written, so the record and the cell agree again.
        p.recorded = true;
        // That row is now this person's newest change, so it is also their new floor. Without this
        // a second change in the same sitting kept the old min and offered days the backend would
        // refuse. The backend works out the same day on the next read.
        if (res.change && res.change.effective_on) p.earliest = res.change.effective_on;
      });
    });
    var change = res.change;
    if (change) {
      V.data.changes = [{
        change_id: change.change_id, at: change.at, person_id: call.person.id,
        display_name: person.display_name || call.person.display_name, from: change.from, to: change.to,
        effective_on: change.effective_on, tz: change.tz, kind: change.kind, by_name: change.by_name,
        note: change.note, sealed: true
      }].concat(arr(V.data.changes)).slice(0, RECENT);
    }
  }

  function wire() {
    if (wired) return;
    wired = true;
    doc.addEventListener("keydown", dialogKeys);
    root.addEventListener("popstate", function () {
      if (popping) return popped();
      // Android back, or the browser's own back button, closes the question.
      if (dlg && !(root.history.state && root.history.state.stDlg)) closeDialog(true);
    });
  }

  root.CCCStatus = {
    screen: function () {
      P = P || root.CCCPortal;
      return screen();
    },
    /* Leaving the screen, or signing out: the list, the counts and the records go. */
    route: function (name) {
      if (name === "status") return;
      if (dlg) closeDialog(true);
      waiting = null;
      V = null;
    },
    reset: function () {
      if (dlg) closeDialog(true);
      waiting = null;
      V = null;
    },
    errKey: errKey,
    debug: function () {
      return V && { q: V.q, note: V.note, live: V.live, dialog: !!dlg, busy: V.busy, err: V.err,
        req: dlg && dlg.call ? dlg.call.req : "" };
    }
  };
})(window);
