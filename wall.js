/* CCC Team Portal "Team wall" screen (0.5.0), lazily loaded with wall_i18n.js and wall.css.
 * Contract: CleanerPortal_design/wall/WALL_SPEC.md.
 *
 * What this screen is: one feed the whole company sees, newest first, with a region filter and
 * tappable hashtags. Barbecues, gatherings, a team at the end of a hard week.
 *
 * The rules it keeps:
 *   * NO SOCIAL GRAPH. Nothing here asks who may see a post, because everyone may. The region
 *     chips are a filter, not a permission. That is Cristy's decision and it is also why this file
 *     has no follow, no friend and no private anything.
 *   * The rules screen is read once before a person's first post, and it is kept on the phone by
 *     person id, so a shared phone asks the next person too.
 *   * Photos go through the Messages bundle's own pipeline (CCCMsg.preparePhoto), asked for only
 *     when somebody actually attaches one. One pipeline, one set of size caps, one thing to fix.
 *   * Nothing about a post is written to phone storage. These phones are shared.
 *   * It needs no dashboard, so a failing dashboard cannot stop it.
 */
(function (root) {
  "use strict";

  var P = null, V = null;
  var doc = root.document;
  var SEEN_RULES = "ccc.wall.rules";          // the only thing kept, and it holds person ids only

  var EMOJI = [
    { e: "❤️", k: "wall_react_heart" },
    { e: "👏", k: "wall_react_clap" },
    { e: "🎉", k: "wall_react_party" },
    { e: "😂", k: "wall_react_laugh" },
    { e: "🔥", k: "wall_react_fire" },
    { e: "💪", k: "wall_react_strong" }
  ];

  function blank() {
    return {
      step: "list",        // list, rules, compose
      items: [],
      more: false,
      busy: false,
      ready: false,
      msg: null,
      region: "",          // "" is everything
      tag: "",
      canHide: false,
      photosOn: false,
      draft: { text: "", photo: null, id: "" },
      photoBusy: false
    };
  }

  /* ---- who has read the rules, on this phone, by person id ---- */
  function hasReadRules() {
    try {
      var raw = root.localStorage.getItem(SEEN_RULES) || "";
      return raw.split(",").indexOf(P.state.person.id) >= 0;
    } catch (e) {
      return false;                           // storage blocked: ask again, which is the safe way
    }
  }
  function rememberRules() {
    try {
      var raw = root.localStorage.getItem(SEEN_RULES) || "";
      var ids = raw.split(",").filter(function (s) { return s; });
      if (ids.indexOf(P.state.person.id) < 0) ids.push(P.state.person.id);
      root.localStorage.setItem(SEEN_RULES, ids.slice(-40).join(","));
    } catch (e) { /* storage blocked, they read it again next time */ }
  }

  /* ---- loading ---- */
  function load(more) {
    if (V.busy) return;
    V.busy = true;
    var body = { token: P.state.token };
    if (V.region) body.region = V.region;
    if (V.tag) body.tag = V.tag;
    if (more && V.items.length) body.before_seq = V.items[V.items.length - 1].seq;
    P.api("feed_list", body).then(function (res) {
      V.busy = false;
      if (res.ok === true) {
        V.items = more ? V.items.concat(res.items || []) : (res.items || []);
        V.more = !!res.more;
        V.canHide = !!res.can_hide;
        V.photosOn = !!res.photos_on;
        V.ready = true;
        if (V.msg && V.msg.key === "wall_err_list") V.msg = null;
        thumbs();
      } else {
        V.msg = { key: "wall_err_list", kind: "error" };
      }
      P.render();
    });
  }

  /* The thumbnails of whatever is on screen, in one call, after the words are already readable.
     A post is worth reading before its picture arrives, so this never blocks the list. */
  function thumbs() {
    var want = V.items.filter(function (it) { return it.photo && !it.photo.data_url; })
                      .slice(0, 12).map(function (it) { return it.seq; });
    if (!want.length) return;
    P.api("feed_photo", { token: P.state.token, size: "thumb", seqs: want }).then(function (res) {
      if (res.ok !== true || !res.photos) return;
      var by = {};
      res.photos.forEach(function (ph) { by[ph.seq] = ph; });
      var changed = false;
      V.items.forEach(function (it) {
        if (it.photo && by[it.seq]) { it.photo.data_url = by[it.seq].data_url; changed = true; }
      });
      if (changed) P.render();
    });
  }

  /* ---- the list ---- */
  function regionChips() {
    var t = P.t, h = P.h;
    // The regions people have actually posted from, plus the reader's own, so the row is never
    // a list of places with nothing in them.
    var seen = {};
    V.items.forEach(function (it) { if (it.region) seen[it.region] = true; });
    if (P.state.person.region) seen[P.state.person.region] = true;
    if (V.region) seen[V.region] = true;
    var names = Object.keys(seen).sort();
    var row = h("div", { class: "wl-chips", role: "group", "aria-label": t("wall_filter_label") });
    row.appendChild(chip("", t("wall_all")));
    names.forEach(function (n) { row.appendChild(chip(n, n)); });
    return row;
  }

  function chip(value, label) {
    var on = V.region === value;
    return P.h("button", {
      type: "button", class: "wl-chip" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
      text: label,
      on: { click: function () { V.region = value; V.items = []; V.ready = false; load(false); P.render(); } }
    });
  }

  function tagBar() {
    if (!V.tag) return null;
    var t = P.t, h = P.h;
    return h("div", { class: "wl-tagbar" }, [
      h("span", { text: t("wall_showing_tag", { tag: V.tag }) }),
      h("button", {
        type: "button", class: "wl-linkbtn", text: t("wall_tag_clear"),
        on: { click: function () { V.tag = ""; V.items = []; V.ready = false; load(false); P.render(); } }
      })
    ]);
  }

  /* A post's words, with its hashtags made tappable. */
  function words(text) {
    var h = P.h;
    var out = h("p", { class: "wl-text" });
    var re = /#([0-9A-Za-z\u00C0-\u024F_]{1,30})/g;
    var at = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > at) out.appendChild(doc.createTextNode(text.slice(at, m.index)));
      (function (tag) {
        out.appendChild(P.h("button", {
          type: "button", class: "wl-tag", text: "#" + tag,
          on: { click: function () { V.tag = tag.toLowerCase(); V.items = []; V.ready = false; load(false); P.render(); } }
        }));
      })(m[1]);
      at = m.index + m[0].length;
    }
    if (at < text.length) out.appendChild(doc.createTextNode(text.slice(at)));
    return out;
  }

  /* The translation without the hashtags the post already shows above it, tappable and in colour.
     Repeating them underneath in grey read like a mistake. Only tags that are on the post are
     taken out, matched case insensitively, so a word the translator invented is never dropped and
     a tag written inside a sentence leaves no double space behind it. */
  function withoutTags(text, tags) {
    if (!tags || !tags.length) return text;
    var have = {};
    tags.forEach(function (t) { have[String(t).toLowerCase()] = true; });
    var out = String(text).replace(/#([0-9A-Za-z\u00C0-\u024F_]{1,30})/g, function (whole, tag) {
      return have[tag.toLowerCase()] ? "" : whole;
    });
    return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  }

  function reactions(item) {
    var h = P.h, t = P.t;
    var row = h("div", { class: "wl-reacts" });
    EMOJI.forEach(function (x) {
      var mine = (item.mine || []).indexOf(x.e) >= 0;
      var n = (item.counts || {})[x.e] || 0;
      row.appendChild(h("button", {
        type: "button",
        class: "wl-react" + (mine ? " on" : ""),
        "aria-pressed": mine ? "true" : "false",
        "aria-label": t(x.k),
        on: { click: function () { react(item, x.e); } }
      }, [
        h("span", { class: "wl-emoji", "aria-hidden": "true", text: x.e }),
        n ? h("span", { class: "wl-n", text: String(n) }) : null
      ]));
    });
    return row;
  }

  function react(item, emoji) {
    // Shown at once, then corrected by the answer. A reaction that does not land is not worth a
    // spinner, and the next load puts it right.
    var mine = item.mine || (item.mine = []);
    var i = mine.indexOf(emoji);
    item.counts = item.counts || {};
    if (i >= 0) {
      mine.splice(i, 1);
      item.counts[emoji] = Math.max(0, (item.counts[emoji] || 1) - 1);
    } else {
      mine.push(emoji);
      item.counts[emoji] = (item.counts[emoji] || 0) + 1;
    }
    P.render();
    P.api("feed_react", { token: P.state.token, seq: item.seq, emoji: emoji });
  }

  function card(item) {
    var h = P.h, t = P.t;
    var lang = P.state.lang === "es" ? "es" : "en";
    var other = item.tr_text && item.tr_lang && item.tr_lang === lang
      ? withoutTags(item.tr_text, item.tags) : null;
    var body = [
      h("div", { class: "wl-who" }, [
        h("span", { class: "wl-name", text: item.display_name }),
        item.region ? h("span", { class: "wl-region", text: item.region }) : null
      ]),
      item.text ? words(item.text) : null,
      other ? h("p", { class: "wl-tr", text: other }) : null
    ];
    if (item.photo) {
      body.push(h("div", { class: "wl-shot" },
        item.photo.data_url
          ? P.img(item.photo.data_url, t("wall_photo_alt", { name: item.display_name }), "wl-img",
              h("span", { class: "wl-gone", text: t("wall_photo_gone") }))
          : h("span", { class: "wl-gone wl-wait", role: "img",
                        "aria-label": t("wall_photo_alt", { name: item.display_name }) })));
    }
    body.push(reactions(item));
    if (V.canHide) {
      body.push(h("div", { class: "wl-admin" }, [
        h("button", {
          type: "button", class: "wl-linkbtn wl-danger", text: t("wall_hide"),
          on: { click: function () { hide(item); } }
        })
      ]));
    }
    return h("li", { class: "wl-card" }, body);
  }

  function hide(item) {
    if (!root.confirm(P.t("wall_hide_sure"))) return;
    P.api("feed_hide", { token: P.state.token, seq: item.seq }).then(function (res) {
      if (res.ok === true) {
        V.items = V.items.filter(function (x) { return x.seq !== item.seq; });
        V.msg = { key: "wall_hidden", kind: "info" };
      } else {
        V.msg = { key: "wall_err_send", kind: "error" };
      }
      P.render();
    });
  }

  function listScreen() {
    var h = P.h, t = P.t;
    var parts = [
      h("p", { class: "wl-intro", text: t("wall_intro") }),
      h("div", { class: "btn-row" }, [
        h("button", {
          type: "button", class: "btn-primary", text: t("wall_post_open"),
          on: { click: function () { V.step = hasReadRules() ? "compose" : "rules"; P.render(); } }
        })
      ]),
      regionChips(),
      tagBar()
    ];
    if (!V.ready && V.busy) {
      parts.push(P.loading(false));
      return parts;
    }
    if (!V.items.length) {
      parts.push(h("div", { class: "empty" }, [
        h("p", { class: "wl-none-title", text: t("wall_none_title") }),
        h("p", { text: V.tag ? t("wall_none_tag") : (V.region ? t("wall_none_region") : t("wall_none_body")) })
      ]));
      return parts;
    }
    var list = h("ul", { class: "wl-list" });
    V.items.forEach(function (it) { list.appendChild(card(it)); });
    parts.push(list);
    if (V.more) {
      parts.push(h("div", { class: "btn-row" }, [
        h("button", {
          type: "button", class: "btn-secondary", text: t("wall_more"),
          on: { click: function () { load(true); } }
        })
      ]));
    }
    return parts;
  }

  /* ---- the rules, once per person per phone ---- */
  function rulesScreen() {
    var h = P.h, t = P.t;
    var blocks = [1, 2, 3, 4].map(function (n) {
      return h("section", { class: "wl-rule" + (n === 1 ? " first" : "") }, [
        h("h3", { text: t("wall_rules_" + n + "_head") }),
        h("p", { text: t("wall_rules_" + n + "_body") })
      ]);
    });
    return [
      h("h2", { class: "wl-rules-head", text: t("wall_rules_head") }),
      h("p", { class: "wl-intro", text: t("wall_rules_intro") })
    ].concat(blocks).concat([
      h("p", { class: "wl-kept", text: t("wall_rules_kept") }),
      h("div", { class: "btn-row" }, [
        h("button", {
          type: "button", class: "btn-primary", text: t("wall_rules_ok"),
          on: { click: function () { rememberRules(); V.step = "compose"; P.render(); } }
        })
      ])
    ]);
  }

  /* ---- writing a post ---- */
  function composeScreen() {
    var h = P.h, t = P.t;
    var left = 1000 - V.draft.text.length;
    var box = h("textarea", {
      class: "wl-write", rows: "5", maxlength: "1000",
      placeholder: t("wall_post_hint"), "aria-label": t("wall_post_hint"),
      on: { input: function (e) { V.draft.text = e.target.value; P.render(); } }
    });
    box.value = V.draft.text;

    var photoRow = [];
    if (V.photosOn) {
      var file = h("input", {
        type: "file", accept: "image/jpeg,image/png,image/heic,image/webp",
        class: "wl-file", id: "wl_file",
        on: { change: function (e) { pickPhoto(e.target.files && e.target.files[0]); } }
      });
      photoRow.push(file);
      photoRow.push(h("label", {
        class: "btn-secondary wl-filelabel", for: "wl_file",
        text: V.draft.photo ? t("wall_post_photo_change") : t("wall_post_photo")
      }));
      if (V.draft.photo) {
        photoRow.push(h("button", {
          type: "button", class: "wl-linkbtn", text: t("wall_post_photo_remove"),
          on: { click: function () { V.draft.photo = null; P.render(); } }
        }));
      }
    }

    return [
      h("h2", { class: "wl-rules-head", text: t("wall_post_head") }),
      box,
      h("p", { class: "wl-left", text: t("wall_post_left", { n: left }) }),
      photoRow.length ? h("div", { class: "wl-photorow" }, photoRow) : null,
      V.photoBusy ? P.loading(false) : null,
      h("div", { class: "btn-row" }, [
        h("button", {
          type: "button", class: "btn-primary", disabled: V.busy ? "" : null,
          text: V.busy ? t("wall_post_sending") : t("wall_post_send"),
          on: { click: send }
        }),
        h("button", {
          type: "button", class: "btn-secondary", text: t("wall_post_cancel"),
          on: { click: function () { V.draft = { text: "", photo: null, id: "" }; V.step = "list"; P.render(); } }
        })
      ])
    ];
  }

  /* The Messages bundle owns the one photo pipeline. Asked for only when a photo is attached. */
  function pickPhoto(file) {
    if (!file) return;
    V.photoBusy = true;
    P.render();
    var done = function (ok) { V.photoBusy = false; if (!ok) V.msg = { key: "wall_err_send", kind: "error" }; P.render(); };
    if (root.CCCMsg && root.CCCMsg.preparePhoto) {
      root.CCCMsg.preparePhoto(file).then(function (pair) {
        V.draft.photo = pair; done(true);
      }).catch(function () { done(false); });
      return;
    }
    // Not loaded yet: ask for it, then try once more.
    P.withMessages(function () {
      if (root.CCCMsg && root.CCCMsg.preparePhoto) {
        root.CCCMsg.preparePhoto(file).then(function (pair) {
          V.draft.photo = pair; done(true);
        }).catch(function () { done(false); });
      } else {
        done(false);
      }
    });
  }

  function send() {
    if (V.busy) return;
    if (!V.draft.text.trim() && !V.draft.photo) {
      V.msg = { key: "wall_err_empty", kind: "error" };
      P.render();
      return;
    }
    V.busy = true;
    V.msg = null;
    P.render();
    if (!V.draft.id) V.draft.id = P.randomId();
    var body = { token: P.state.token, text: V.draft.text.trim(), client_post_id: V.draft.id };
    if (V.draft.photo) body.photo = { full: V.draft.photo.full, thumb: V.draft.photo.thumb };
    P.api("feed_post", body).then(function (res) {
      V.busy = false;
      if (res.ok === true) {
        V.draft = { text: "", photo: null, id: "" };
        V.step = "list";
        V.items = [];
        V.ready = false;
        load(false);
      } else {
        var reason = res.error && res.error.reason;
        V.msg = {
          key: reason === "TOO_LONG" ? "wall_err_long"
            : reason === "POSTS" ? "wall_err_posts"
            : reason === "PHOTOS" ? "wall_err_photos"
            : reason === "PHOTOS_OFF" ? "wall_err_photo_off"
            : reason === "NO_TEXT" ? "wall_err_empty"
            : "wall_err_send",
          kind: "error"
        };
      }
      P.render();
    });
  }

  /* ---- the screen ---- */
  function screen() {
    if (!V) {
      V = blank();
      load(false);
    }
    var h = P.h, t = P.t;
    var body = V.step === "rules" ? rulesScreen() : V.step === "compose" ? composeScreen() : listScreen();
    var back = V.step === "list"
      ? P.backButton("home")
      : h("button", {
          type: "button", class: "back-btn",
          on: { click: function () { V.step = "list"; P.render(); } }
        }, [P.icon("chevronLeft"), h("span", { text: t("back") })]);

    var page = h("div", { class: "wl wl-" + V.step }, [
      h("div", { class: "page-head" }, [back, h("h1", { text: t("wall_title") })]),
      /* The message, announced. P.msgBox takes (kind, icon, words), not an object: passing it the
         object drew an empty grey box with nothing in it, which told the person nothing at all
         (found by the browser harness before the wall ever went live, 0.5.0). role=alert so a
         screen reader says it without being asked, the same as Messages does. */
      V.msg ? h("div", { role: "alert" }, P.msgBox(
                V.msg.kind === "error" ? "error" : "info",
                V.msg.kind !== "error" ? "info" : P.isOnline() ? "alert" : "wifiOff",
                t(V.msg.key))) : null
    ]);
    body.forEach(function (n) { if (n) page.appendChild(n); });
    return page;
  }

  root.CCCWall = {
    screen: function () {
      P = P || root.CCCPortal;
      return screen();
    },
    /* The tests read this. No words and no person, only what the screen is doing. */
    debug: function () {
      if (!V) return null;
      return {
        step: V.step, items: V.items.length, region: V.region, tag: V.tag,
        canHide: V.canHide, photosOn: V.photosOn, more: V.more
      };
    },
    /* Sign out, or a new person on this shared phone: nothing about the wall stays behind. */
    reset: function () { V = null; }
  };
})(window);
