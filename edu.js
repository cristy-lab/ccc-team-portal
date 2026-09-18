/* CCC Team Portal Education screens (the Trainings tile).
 *
 * This file and web/edu_i18n.js and web/edu.css are the Education bundle. They are fetched the
 * first time someone opens Trainings, so sign in and home never pay for them (README, "Size
 * budgets"). web/app.js loads them and hands over through window.CCCPortal. In the Apps Script
 * build there are no files to fetch, so tools/build_gas_html.py inlines all three instead.
 *
 * Privacy, the rules this file keeps (docs/API.md section 13):
 *   * The answer key never reaches the phone. The pack file has no correct answer, no
 *     explanation and no pass mark, and the server scores every submission.
 *   * Answers live in memory for one attempt and are dropped as soon as the server answers.
 *     A score is on screen and nowhere else. Nothing about a quiz is ever written to storage.
 *   * A person only ever sees their own list, which the backend builds for their token.
 *
 * Security: like web/app.js, everything from the API or a pack file goes into the page with
 * textContent, never as an HTML string.
 */
(function (root) {
  "use strict";

  var doc = root.document;
  var P = null; // window.CCCPortal, the app shell
  var H = null; // window.CCCHelpers, its pure helpers
  var I = root.CCC_I18N;

  var STATUS_CHIP = { todo: "chip-new", not_passed: "chip-progress", past_due: "chip-pending", done: "chip-done" };
  var PACK_RETRY = 1; // one reload when the pack on the site no longer matches what the server expects

  /* One person taking one training. Memory only: never stored, and dropped on sign out. */
  var view = null;

  function blank() {
    return {
      step: "list",     // list, lesson, quiz, result, ack, thanks
      item: null,       // the row from the trainings list
      pack: null,       // the lesson file
      part: null,       // the variant of the pack this person reads
      sha: "",          // the fingerprint of the bytes this phone actually loaded
      session: "",      // the signed session from training_start, empty when offline
      quiz: null,       // {pass_percent, question_count}
      index: 0,         // which lesson screen, or which question
      answers: {},      // question id to choice id, for this attempt only
      result: null,     // what the server said about this attempt
      done_on: "",      // the date an acknowledgment was saved
      busy: false,
      msg: null,        // {key, vars, kind}
      offline: false,   // opened from the cache with no session
      tries: 0,         // pack reloads after a fingerprint mismatch
      focus: false      // move the focus to this screen's heading after it is drawn
    };
  }

  function t(key, vars) {
    return P.t(key, vars);
  }

  function lang() {
    return P.state.lang;
  }

  function text(obj) {
    return H.pickText(obj, lang());
  }

  function shortDate(ymd) {
    return ymd ? I.formatShort(ymd, lang()) : "";
  }

  /* Draw again, and move the focus to the new heading when the screen changed. */
  function go(step, focus) {
    view.step = step;
    view.focus = focus !== false;
    P.render();
  }

  function fail(key, vars) {
    view.msg = { key: key, vars: vars || null, kind: "error" };
  }

  /* ---- Talking to the backend ---- */

  function auth(res) {
    var code = res && res.error && res.error.code;
    if (code === "AUTH_INVALID" || code === "AUTH_EXPIRED") {
      P.signOut("signin_again");
      return true;
    }
    return false;
  }

  /* The message for a refused Education call, and whether the list has to be read again. */
  function problem(res) {
    var err = (res && res.error) || {};
    if (err.code === "NETWORK") return { key: "edu_err_send", back: false };
    if (err.code === "RATE_LIMITED") return { key: "err_rate", back: false };
    if (err.code !== "VALIDATION") return { key: "edu_err_send", back: false };
    if (err.reason === "NOT_ASSIGNED") return { key: "edu_err_gone", back: true };
    if (err.reason === "NOT_AVAILABLE") return { key: "edu_err_notready", back: true };
    if (err.reason === "ALREADY_DONE") return { key: "edu_err_already", back: true };
    if (err.reason === "VERSION_CHANGED" || err.reason === "PACK_CHANGED") return { key: "edu_err_changed", back: true };
    if (err.reason === "SESSION_EXPIRED") return { key: "edu_err_session", back: true };
    if (err.reason === "INCOMPLETE") return { key: "edu_answer_first", back: false };
    return { key: "edu_err_send", back: false };
  }

  /* The list. The home banner and the tile badge read the same answer, so app.js keeps it. */
  function loadList(after) {
    var token = P.state.token;
    if (!token) return;
    view.busy = true;
    P.api("trainings", { token: token }).then(function (res) {
      view.busy = false;
      if (token !== P.state.token) return;
      if (res.ok === true) {
        P.setTrainings(res);
        // The list arrived, so a message saying it could not be loaded goes. Any other message,
        // such as a training that is already finished, is the reason we came back here at all.
        if (view.msg && view.msg.key === "edu_err_list") view.msg = null;
      } else if (!auth(res)) {
        // The list, not one training: the old message told somebody whose internet had dropped
        // that we could not load "this training", above an empty list claiming there are none.
        fail(res.error && res.error.code === "NETWORK" ? "edu_err_list" : "edu_err_send");
      }
      if (after) after(res);
      else {
        // The list is the one screen the app shell does not focus for us, because the route did
        // not change while it was loading. Every other screen moves the focus to its heading.
        if (view.step === "list") view.focus = true;
        P.render();
      }
    });
  }

  /* The lesson file, as the exact bytes this phone loaded. */
  function loadPack(url) {
    var full;
    try {
      full = new root.URL(url, root.location.href).href;
    } catch (e) {
      return Promise.resolve(null);
    }
    if (typeof root.fetch !== "function") return Promise.resolve(null);
    return root.fetch(full, { credentials: "omit", redirect: "follow" }).then(function (res) {
      if (!res || !res.ok) return null;
      return res.text();
    }).then(function (body) {
      if (typeof body !== "string") return null;
      var pack;
      try {
        pack = JSON.parse(body);
      } catch (e) {
        return null;
      }
      return fingerprint(body).then(function (sha) {
        return { pack: pack, sha: sha };
      });
    }).catch(function () {
      return null;
    });
  }

  /* SHA 256 of the pack bytes, so the server is told what this phone really read. Old browsers
     and plain http have no crypto.subtle: then the fingerprint the API gave is sent instead. */
  function fingerprint(body) {
    var subtle = root.crypto && root.crypto.subtle;
    if (!subtle || typeof root.TextEncoder !== "function") return Promise.resolve("");
    try {
      return subtle.digest("SHA-256", new root.TextEncoder().encode(body)).then(function (buf) {
        var out = "";
        new Uint8Array(buf).forEach(function (b) { out += (b < 16 ? "0" : "") + b.toString(16); });
        return out;
      }).catch(function () { return ""; });
    } catch (e) {
      return Promise.resolve("");
    }
  }

  function variantOf(pack, kind) {
    var variants = pack && pack.variants;
    var part = variants && variants[kind === "notice" ? "notice" : "full"];
    if (!part || !Array.isArray(part.screens) || !part.screens.length) return null;
    return part;
  }

  /* Open one training: read the lesson file, then ask the backend for a session. */
  function open(item) {
    if (view.busy) return;
    view.item = item;
    view.pack = null;
    view.part = null;
    view.session = "";
    view.quiz = null;
    view.index = 0;
    view.answers = {};
    view.result = null;
    view.offline = false;
    view.msg = null;
    view.busy = true;
    P.render();
    loadPack(item.pack_url).then(function (loaded) {
      if (!loaded) {
        view.busy = false;
        fail("edu_err_pack");
        P.render();
        return;
      }
      var part = variantOf(loaded.pack, item.kind);
      if (!part || loaded.pack.training_id !== item.training_id || loaded.pack.version !== item.version) {
        view.busy = false;
        fail("edu_err_changed");
        loadList();
        return;
      }
      view.pack = loaded.pack;
      view.part = part;
      view.sha = loaded.sha || item.pack_sha256;
      start();
    });
  }

  /* training_start. Offline, the lessons still open from the cached file, with no session. */
  function start() {
    var token = P.state.token;
    var item = view.item;
    view.busy = true;
    P.api("training_start", {
      token: token,
      training_id: item.training_id,
      version: item.version,
      pack_sha256: view.sha,
      lang: lang(),
      client_request_id: P.randomId()
    }).then(function (res) {
      view.busy = false;
      if (token !== P.state.token) return;
      if (res.ok === true) {
        view.session = typeof res.session === "string" ? res.session : "";
        view.quiz = res.training && res.training.quiz ? res.training.quiz : null;
        view.offline = false;
        view.msg = null;
        go("lesson");
        return;
      }
      if (auth(res)) return;
      var code = res.error && res.error.code;
      if (code === "NETWORK") {
        // The file came out of the cache, so this can still be read. Nothing can be sent yet.
        view.offline = true;
        // A notice has no questions, only a confirmation, so it is never told about answers.
        view.msg = { key: view.item.kind === "notice" ? "edu_offline_read_notice" : "edu_offline_read",
          kind: "info" };
        go("lesson");
        return;
      }
      var p = problem(res);
      // The pack on the site moved on from what the backend expects: read it again, once.
      if (res.error && res.error.reason === "PACK_CHANGED" && view.tries < PACK_RETRY) {
        view.tries++;
        loadList(function () { retryOpen(); });
        return;
      }
      fail(p.key);
      if (p.back) loadList(function () { go("list"); });
      else P.render();
    });
  }

  function retryOpen() {
    var fresh = itemFor(view.item.training_id);
    if (!fresh) {
      fail("edu_err_gone");
      go("list");
      return;
    }
    open(fresh);
  }

  function itemFor(id) {
    var items = listItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].training_id === id) return items[i];
    }
    return null;
  }

  function listItems() {
    var edu = P.state.edu;
    return edu && Array.isArray(edu.items) ? edu.items : [];
  }

  /* training_submit. The server scores it: this phone never knows a correct answer. */
  function submit() {
    if (view.busy) return;
    var item = view.item;
    var questions = quizQuestions();
    var answers = [];
    questions.forEach(function (q) {
      if (view.answers[q.id]) answers.push({ question_id: q.id, choice_id: view.answers[q.id] });
    });
    if (answers.length !== questions.length) {
      showMsg("edu_answer_first");
      return;
    }
    if (!view.session || !P.isOnline()) {
      showMsg("edu_offline_send");
      return;
    }
    var token = P.state.token;
    view.busy = true;
    view.msg = null;
    P.render();
    P.api("training_submit", {
      token: token,
      training_id: item.training_id,
      version: item.version,
      pack_sha256: view.sha,
      session: view.session,
      answers: answers,
      lang: lang(),
      client_request_id: P.randomId()
    }).then(function (res) {
      view.busy = false;
      if (token !== P.state.token) return;
      // The answers did their job. They are dropped whatever happened next.
      view.answers = {};
      if (res.ok === true) {
        view.result = res.result || null;
        view.msg = null;
        loadList(function () { go("result"); });
        return;
      }
      if (auth(res)) return;
      var p = problem(res);
      fail(p.key === "edu_err_send" && !P.isOnline() ? "edu_offline_send" : p.key);
      if (p.back) loadList(function () { go("list"); });
      else P.render();
    });
  }

  /* training_ack. Only the date is kept: no score, no minutes, no attempt. */
  function acknowledge() {
    if (view.busy) return;
    var item = view.item;
    if (!view.session || !P.isOnline()) {
      showMsg("edu_offline_ack");
      return;
    }
    var token = P.state.token;
    view.busy = true;
    view.msg = null;
    P.render();
    P.api("training_ack", {
      token: token,
      training_id: item.training_id,
      version: item.version,
      pack_sha256: view.sha,
      session: view.session,
      acknowledged: true,
      lang: lang(),
      client_request_id: P.randomId()
    }).then(function (res) {
      view.busy = false;
      if (token !== P.state.token) return;
      if (res.ok === true) {
        view.done_on = typeof res.completed_on === "string" ? res.completed_on : "";
        view.msg = null;
        loadList(function () { go("thanks"); });
        return;
      }
      if (auth(res)) return;
      var p = problem(res);
      fail(p.key === "edu_err_send" && !P.isOnline() ? "edu_offline_ack" : p.key);
      if (p.back) loadList(function () { go("list"); });
      else P.render();
    });
  }

  function quizQuestions() {
    var quiz = view.part && view.part.quiz;
    return quiz && Array.isArray(quiz.questions) ? quiz.questions : [];
  }

  function toList() {
    view = blank();
    loadList();
    go("list");
  }

  /* ---- Drawing ---- */

  function el(tag, attrs, kids) {
    return P.h(tag, attrs, kids);
  }

  function head(tag, key, vars) {
    return el(tag, { class: "edu-head", "data-edu-head": "1", text: t(key, vars) });
  }

  function message() {
    if (!view.msg) return null;
    var body = t(view.msg.key, view.msg.vars);
    if (view.msg.kind === "info") {
      return el("p", { class: "offline-note", role: "status" }, [P.icon("wifiOff"), el("span", { text: body })]);
    }
    return el("div", { class: "edu-msg", tabindex: "-1", role: "alert" },
      P.msgBox("error", "alert", body));
  }

  /* A message drawn at the top of a long screen is off the screen of the person who caused it,
     so the focus and the view are taken to it. */
  function focusMsg() {
    var node = doc.querySelector(".edu .edu-msg");
    if (!node) return;
    try {
      node.focus({ preventScroll: true });
    } catch (e) {
      node.focus();
    }
    try {
      node.scrollIntoView({ block: "center" });
    } catch (e) { /* ignore */ }
  }

  /* Draw again for a message, without moving to another step, and take the person to it. */
  function showMsg(key, vars) {
    fail(key, vars);
    P.render();
    Promise.resolve().then(focusMsg);
  }

  /* Takes one message off the screen without redrawing it. Redrawing the quiz would throw the
     focus out of the radio group, which for a keyboard or a screen reader means the first arrow
     key press lands at the top of the page. */
  function clearMsg() {
    if (!view.msg) return;
    view.msg = null;
    var node = doc.querySelector(".edu .edu-msg");
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function button(cls, label, onClick, disabled) {
    return el("button", { type: "button", class: "btn " + cls, disabled: disabled === true, on: { click: onClick } }, label);
  }

  function spinner() {
    return el("p", { class: "msg-quiet", role: "status" }, [el("span", { class: "spinner", "aria-hidden": "true" }), t("edu_opening")]);
  }

  /* The list of trainings for this person. */
  function listScreen() {
    var edu = P.state.edu;
    var items = listItems();
    // What home saved on the phone is the banner alone, so a list is only really here when it
    // carries items. Without this the empty state would claim there is nothing to do while the
    // list was still on its way.
    var ready = !!(edu && Array.isArray(edu.items));
    var parts = [head("h2", "edu_list_head"), el("p", { class: "edu-intro", text: t("edu_intro") })];
    if (!ready && view.busy) return [P.loading(false)];
    // Opening a training is a pack file and a call to the backend, which on a phone is seconds of
    // nothing. The row that is opening says so.
    if (view.busy && view.item) parts.push(spinner());
    if (!items.length) {
      // Only when the list really arrived. Saying there is nothing to do, under a message saying
      // the list could not be loaded, was two wrong things on one screen.
      if (!ready) {
        parts.push(el("div", { class: "btn-row" },
          button("btn-secondary", t("try_again"), function () { loadList(); }, view.busy)));
        return parts;
      }
      parts.push(el("div", { class: "empty" }, [
        el("p", { class: "edu-none-title", text: t("edu_none_title") }),
        el("p", { text: t("edu_none_body") })
      ]));
      return parts;
    }
    var list = el("ul", { class: "edu-list" });
    items.forEach(function (item) {
      list.appendChild(listItem(item));
    });
    parts.push(list);
    return parts;
  }

  function listItem(item) {
    var title = text(item.title);
    var chipKey = "edu_status_" + (STATUS_CHIP[item.status] ? item.status : "todo");
    var meta = [t(item.kind === "notice" ? "edu_notice" : "edu_course")];
    if (item.minutes) meta.push(t("edu_minutes_about", { n: item.minutes }));
    if (item.status === "done" && item.completed_on) meta.push(t("edu_finished_on", { date: shortDate(item.completed_on) }));
    else if (item.due_on) meta.push(t("edu_due", { date: shortDate(item.due_on) }));
    var titleKids = [title];
    if (item.is_new === true) titleKids.push(" ", el("span", { class: "badge", text: t("edu_new") }));
    return el("li", { class: "edu-item" + (item.is_new === true ? " is-new" : "") }, [
      el("div", { class: "edu-item-top" }, [
        el("h3", { class: "edu-item-title" }, titleKids),
        el("span", { class: "chip " + STATUS_CHIP[item.status || "todo"], text: t(chipKey) })
      ]),
      el("p", { class: "edu-item-meta", text: meta.join(" · ") }),
      button("btn-primary edu-open", [
        el("span", { text: t("edu_open") }),
        // The visible word and the title, read once each. Both spans together used to say
        // "Open Open Site safety basics".
        el("span", { class: "sr-only", text: " " + title })
      ], function () { open(item); }, view.busy)
    ]);
  }

  /* One lesson screen at a time, with the steps drawn above it. */
  function lessonScreen() {
    var screens = view.part.screens;
    var total = screens.length;
    var i = Math.min(view.index, total - 1);
    var page = screens[i];
    var last = i === total - 1;
    var course = view.item.kind !== "notice";
    var parts = [
      // A safety notice is often one screen, where "Step 1 of 1" over a full bar says nothing.
      total > 1 ? steps(i, total) : null,
      el("h2", { class: "edu-head", "data-edu-head": "1", text: text(page.title) }),
      blocks(page.blocks)
    ];
    var next = last
      ? button("btn-primary", t(course ? "edu_to_quiz" : "edu_to_ack"), function () {
        view.msg = null;
        if (course) {
          view.index = 0;
          view.answers = {};
          go("quiz");
        } else {
          go("ack");
        }
      })
      : button("btn-primary", t("edu_next"), function () {
        view.index = i + 1;
        go("lesson");
      });
    var row = [next];
    if (i > 0) {
      row.push(button("btn-secondary", t("edu_prev"), function () {
        view.index = i - 1;
        go("lesson");
      }));
    }
    parts.push(el("div", { class: "btn-row" }, row));
    return parts;
  }

  function steps(i, total) {
    var bar = el("div", { class: "edu-steps", "aria-hidden": "true" });
    for (var n = 0; n < total; n++) {
      bar.appendChild(el("span", { class: "edu-step" + (n <= i ? " is-on" : "") }));
    }
    return el("div", { class: "edu-progress" }, [
      // The label introduces the step, so it is read before it and not after.
      el("span", { class: "sr-only", text: t("edu_progress") }),
      el("p", { class: "edu-step-text", text: t("edu_step", { n: i + 1, total: total }) }),
      bar
    ]);
  }

  function blocks(list) {
    var box = el("div", { class: "edu-body" });
    (Array.isArray(list) ? list : []).forEach(function (block) {
      if (!block || typeof block !== "object") return;
      var value = block[lang()] !== undefined ? block[lang()] : block.en;
      if (block.type === "steps" && Array.isArray(value)) {
        var ol = el("ol", { class: "edu-steps-list" });
        value.forEach(function (line) { ol.appendChild(el("li", { text: String(line) })); });
        box.appendChild(ol);
        return;
      }
      if (block.type === "callout") {
        box.appendChild(el("p", { class: "edu-callout", text: String(value) }));
        return;
      }
      if (Array.isArray(value)) {
        var ul = el("ul", { class: "edu-bullets" });
        value.forEach(function (line) { ul.appendChild(el("li", { text: String(line) })); });
        box.appendChild(ul);
        return;
      }
      box.appendChild(el("p", { text: String(value === undefined ? "" : value) }));
    });
    return box;
  }

  /* One question at a time. No choice here is ever marked right or wrong: the server scores it. */
  function quizScreen() {
    var questions = quizQuestions();
    var total = questions.length;
    var i = Math.min(view.index, total - 1);
    var q = questions[i];
    var last = i === total - 1;
    var picked = view.answers[q.id] || "";
    var promptId = "edu-q-" + q.id;
    // The heading carries the question, and the group points at it, so a screen reader reads the
    // question once as the heading and again only as the label of the choices.
    var group = el("fieldset", { class: "edu-choices", "aria-labelledby": promptId });
    (Array.isArray(q.choices) ? q.choices : []).forEach(function (c) {
      group.appendChild(el("label", { class: "choice" }, [
        el("input", {
          type: "radio", name: "edu-" + q.id, value: c.id, checked: picked === c.id,
          on: { change: function () {
            view.answers[q.id] = c.id;
            // Never redraw here: an arrow key moving through the choices fires this, and a redraw
            // would destroy the input that fired it and drop the focus to the top of the page.
            clearMsg();
          } }
        }),
        el("span", { class: "choice-face" }, [P.icon("check"), el("span", { text: text(c) })])
      ]));
    });
    var parts = [
      el("p", { class: "edu-qnum", text: t("edu_question", { n: i + 1, total: total }) }),
      el("h2", { class: "edu-head edu-prompt", id: promptId, "data-edu-head": "1", text: text(q.prompt) }),
      group
    ];
    if (i === 0 && view.quiz && view.quiz.pass_percent) {
      parts.splice(1, 0, el("p", { class: "edu-quiz-intro", text: t("edu_quiz_intro", { n: view.quiz.pass_percent }) }));
    } else if (i === 0 && view.offline) {
      // Offline there is no session, so the pass mark never arrived. Say what can be done here.
      parts.splice(1, 0, el("p", { class: "edu-quiz-intro", text: t("edu_offline_quiz") }));
    }
    var row = [];
    if (last) {
      row.push(button("btn-primary", view.busy ? t("edu_sending") : t("edu_send"), submit, view.busy));
    } else {
      row.push(button("btn-primary", t("edu_next"), function () {
        if (!view.answers[q.id]) {
          showMsg("edu_answer_first");
          return;
        }
        view.msg = null;
        view.index = i + 1;
        go("quiz");
      }));
    }
    row.push(button("btn-secondary", t("edu_prev"), function () {
      view.msg = null;
      if (i === 0) {
        // Back to the lesson screen they were last on, the way the confirmation screen does it,
        // and not to the first one.
        view.index = view.part.screens.length - 1;
        go("lesson");
      } else {
        view.index = i - 1;
        go("quiz");
      }
    }, view.busy));
    parts.push(el("div", { class: "btn-row" }, row));
    return parts;
  }

  /* What the server said. Only the questions that were wrong come back, with no right answer. */
  function resultScreen() {
    var r = view.result || {};
    var passed = r.passed === true;
    // "Almost there" over a score of zero is not true. Anybody who got at least one right is
    // almost there; nobody who got none is.
    var title = passed ? "edu_pass_title" : (r.correct > 0 ? "edu_fail_title" : "edu_fail_title_zero");
    var parts = [
      el("div", { class: "edu-result-mark " + (passed ? "is-pass" : "is-try") }, P.icon(passed ? "check" : "refresh")),
      el("h2", { class: "edu-head edu-result-title", "data-edu-head": "1", text: t(title) }),
      el("p", { class: "edu-score", text: t("edu_score", { correct: r.correct, total: r.total }) }),
      el("p", { class: "edu-result-body", text: t(passed ? "edu_pass_body" : "edu_fail_body") })
    ];
    // Paid time is for taking the training, not for passing it, so the line belongs on both.
    if (r.paid_minutes) {
      parts.push(el("p", { class: "edu-paid" }, [P.icon("clock"),
        el("span", { text: t(passed ? "edu_pass_paid" : "edu_fail_paid", { n: r.paid_minutes }) })]));
    }
    var missed = Array.isArray(r.missed) ? r.missed : [];
    if (missed.length) {
      var list = el("ul", { class: "edu-missed" });
      var questions = quizQuestions();
      missed.forEach(function (m) {
        // The question itself, so "Please look at this again" says what to look at. The server
        // never sends the right answer, and this is the prompt this phone already has.
        var q = questions.filter(function (x) { return x && x.id === m.question_id; })[0];
        list.appendChild(el("li", null, [
          q ? el("p", { class: "edu-missed-q", text: text(q.prompt) }) : null,
          m.must_pass === true ? el("p", { class: "edu-must" }, [P.icon("alert"), el("span", { text: t("edu_must_pass") })]) : null,
          el("p", { class: "edu-why", text: text(m.why) })
        ]));
      });
      parts.push(el("h3", { class: "edu-review-head", text: t("edu_review_head") }), list);
    }
    var row = [];
    if (!passed) {
      row.push(button("btn-primary", t("edu_retake"), function () {
        view.index = 0;
        view.answers = {};
        view.result = null;
        view.msg = null;
        go("quiz");
      }));
      row.push(button("btn-secondary", t("edu_read_again"), function () {
        view.index = 0;
        view.answers = {};
        view.result = null;
        view.msg = null;
        go("lesson");
      }));
    }
    row.push(button(passed ? "btn-primary" : "btn-secondary", t("edu_back_list"), toList));
    parts.push(el("div", { class: "btn-row" }, row));
    return parts;
  }

  /* The acknowledgment a contractor signs. Only the date is stored. */
  function ackScreen() {
    var ack = (view.part && view.part.ack) || {};
    var line = text(ack.text) || t("edu_ack_send");
    return [
      head("h2", "edu_ack_head"),
      el("p", { class: "edu-ack-hint", text: t("edu_ack_hint") }),
      el("p", { class: "edu-ack-text", text: line }),
      el("div", { class: "btn-row" }, [
        button("btn-primary", view.busy ? t("edu_sending") : t("edu_ack_send"), acknowledge, view.busy),
        button("btn-secondary", t("edu_prev"), function () {
          view.msg = null;
          view.index = view.part.screens.length - 1;
          go("lesson");
        }, view.busy)
      ])
    ];
  }

  function thanksScreen() {
    return [
      el("div", { class: "edu-result-mark is-pass" }, P.icon("check")),
      el("h2", { class: "edu-head edu-result-title", "data-edu-head": "1", text: t("edu_ack_done_title") }),
      el("p", { class: "edu-result-body", text: t("edu_ack_done_body", { date: shortDate(view.done_on) }) }),
      el("div", { class: "btn-row" }, button("btn-primary", t("edu_back_list"), toList))
    ];
  }

  var STEPS = { list: listScreen, lesson: lessonScreen, quiz: quizScreen, result: resultScreen, ack: ackScreen, thanks: thanksScreen };
  /* Steps with no button of their own to show that something is happening. */
  var QUIET = { lesson: 1, result: 1, thanks: 1 };

  /* Back from the list leaves Trainings. Anywhere else it goes back one step inside it. */
  function backNode() {
    if (view.step === "list") return P.backButton("home");
    return P.h("button", { type: "button", class: "back-btn", on: { click: toList } },
      [P.icon("chevronLeft"), P.h("span", { text: t("edu_back_list") })]);
  }

  function screen() {
    if (!view) view = blank();
    // A step whose training went away (a language reload, a sign out and back in) starts over.
    if (view.step !== "list" && (!view.item || !view.part)) view = blank();
    var body;
    try {
      body = STEPS[view.step] ? STEPS[view.step]() : listScreen();
    } catch (e) {
      view = blank();
      fail("edu_err_pack");
      body = listScreen();
    }
    var page = P.h("div", { class: "edu edu-" + view.step }, [
      P.h("div", { class: "page-head" }, [backNode(), P.h("h1", { text: t("tile_training_title") })]),
      view.busy && QUIET[view.step] ? spinner() : null,
      message()
    ]);
    // Each step hands back a flat list of nodes.
    body.forEach(function (node) {
      if (node) page.appendChild(node);
    });
    if (view.focus) {
      view.focus = false;
      // A microtask, so the screen is already in the page when the focus moves.
      Promise.resolve().then(focusHead);
    }
    return page;
  }

  /* The screen changed inside Trainings, so a screen reader is put on the new heading. */
  function focusHead() {
    var node = doc.querySelector(".edu [data-edu-head]");
    if (!node) return;
    node.setAttribute("tabindex", "-1");
    try {
      node.focus({ preventScroll: true });
    } catch (e) {
      node.focus();
    }
    try {
      root.scrollTo(0, 0);
    } catch (e) { /* ignore */ }
  }

  root.CCCEdu = {
    screen: function () {
      if (!P) {
        P = root.CCCPortal;
        H = root.CCCHelpers;
      }
      if (!view) {
        view = blank();
        loadList();
      }
      return screen();
    },
    /* Sign out, or a new person on the same phone: nothing about a training stays behind. */
    reset: function () {
      view = null;
    },
    /* For tests: the step and whether an answer is held, never the answers themselves. */
    debug: function () {
      return view ? { step: view.step, index: view.index, answered: Object.keys(view.answers).length, offline: view.offline } : null;
    }
  };
})(window);
