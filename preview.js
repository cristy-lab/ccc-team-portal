/* CCC Team Portal owner preview (0.4.2), the controls on the Trainings screen that let the owner
 * look at any training as any kind of worker. Contract: docs/API.md 13.14.
 *
 * This file and web/preview.css are the Preview bundle, and only the owner's phone ever fetches
 * them: web/app.js asks for them when the Trainings screen is drawn for somebody the backend
 * called the owner, and for nobody else, so the other 76 phones download no byte of this screen
 * (README, "Size budgets"). The Trainings bundle did not grow to hold any of it.
 *
 * Its words live in this file and not in a preview_i18n.js of their own, the way the Globe bundle
 * keeps its own: the Education bundle pays for every file it has to fetch and that budget has 261
 * bytes left in it. tests/web/preview.html reads window.CCC_PREVIEW_I18N to check that every line
 * has both languages and that none has a dash.
 *
 * What this screen promises is written down once, in docs/API.md 13.14, "The app's side". The
 * three things the code here would not otherwise show:
 *   * It writes nothing real and nothing at all to phone storage, and a preview answer is never
 *     handed to setTrainings. A preview's new_count is 0 and its banner is null, so saving one
 *     would have wiped her real banner off her own phone.
 *   * THE STAND IN BELONGS TO THE ROW SHE OPENED, not to the app: it is stamped on that one row
 *     as op_as, and web/edu.js reads it off the row it has open and off nothing else. Held in one
 *     place for the whole app it was inherited, because the bar stays up after Back so she can
 *     open a second row, by a row she then opened from HER OWN list: a real training of hers went
 *     out as a preview, so it was neither recorded nor paid, and in a held region the screen told
 *     her in red that her own training was not waiting for her any more.
 *   * The gate is the backend's. This block is drawn from dashboard.worker_status.owner, and
 *     owner_preview answers FORBIDDEN to everybody else, so a phone that guessed its way here is
 *     told no by the server and not by this file.
 *
 * Security: like the rest of the app, everything from the API goes into the page with textContent,
 * never as an HTML string. No name, no id, no phone number, no score and no answer is ever drawn.
 */
(function (root) {
  "use strict";

  var doc = root.document;
  var P = null; // window.CCCPortal, the app shell

  /* ------------------------------------------------------------------ */
  /* The words. English and Spanish, usted, no dashes.                   */
  /* ------------------------------------------------------------------ */

  var ROWS = [
    ["op_head", "Owner preview", "Vista previa de la dueña"],
    ["op_only_you", "Only you can open this. Nobody else sees it, on any phone.",
      "Solo usted puede abrir esto. Nadie más lo ve, en ningún teléfono."],
    ["op_intro",
      "Look at any training as any kind of worker, in any region. Nothing is saved, nobody is paid and nobody is told.",
      "Vea cualquier capacitación como cualquier tipo de trabajador, en cualquier región. No se guarda nada, no se paga a nadie y no se avisa a nadie."],

    // Her own empty list, which is the question that started this (docs/API.md 13.14).
    ["op_why_head", "Why the team's trainings are not on your own list",
      "Por qué las capacitaciones del equipo no están en su propia lista"],
    ["op_why_unmapped",
      "Your own row says {region}, and the portal cannot place {region} in a state, so nobody there is shown a training.",
      "Su propia fila dice {region}, y el portal no puede ubicar {region} en un estado, así que a nadie de ahí se le muestra una capacitación."],
    ["op_why_state",
      "Your own row says {region}, and {region} is on hold, so nobody there is shown a training.",
      "Su propia fila dice {region}, y {region} está en pausa, así que a nadie de ahí se le muestra una capacitación."],
    ["op_why_audience",
      "Your own row says {region}, and no live training reaches that region with your role.",
      "Su propia fila dice {region}, y ninguna capacitación en vivo llega a esa región con su puesto."],

    // The picker.
    ["op_track_label", "Which track", "Qué vía"],
    ["op_track_full", "Employee course (W2)", "Curso de empleado (W2)"],
    ["op_track_notice", "Contractor notice (1099)", "Aviso de contratista (1099)"],
    ["op_region_label", "Which region", "Qué región"],
    ["op_region_blank", "No region", "Sin región"],
    ["op_region_people", "{n} active people", "{n} personas activas"],
    ["op_region_person", "1 active person", "1 persona activa"],
    ["op_hold_state", "On hold. Nobody there is shown a training.",
      "En pausa. A nadie de ahí se le muestra una capacitación."],
    ["op_hold_unmapped", "The portal cannot place this in a state, so nobody there is shown a training.",
      "El portal no puede ubicar esto en un estado, así que a nadie de ahí se le muestra una capacitación."],

    // The catalogue.
    ["op_list_head", "Every training on the sheet", "Todas las capacitaciones de la hoja"],
    ["op_live", "Live", "En vivo"],
    ["op_draft", "Draft", "Borrador"],
    ["op_newest", "newest version", "versión más reciente"],
    ["op_older", "older version", "versión anterior"],
    ["op_reaches", "reaches {n} people", "llega a {n} personas"],
    ["op_reaches_one", "reaches 1 person", "llega a 1 persona"],
    ["op_reaches_none", "reaches nobody", "no llega a nadie"],
    ["op_minutes", "about {n} minutes", "unos {n} minutos"],
    ["op_key_yes", "answer key in place", "clave de respuestas lista"],
    ["op_key_no", "no answer key yet", "aún sin clave de respuestas"],
    ["op_named", "{n} named to preview it", "{n} personas nombradas para verla en vista previa"],
    ["op_named_one", "1 person named to preview it", "1 persona nombrada para verla en vista previa"],
    // The roles. Regions go through state_ca and its family, which web/i18n.js already ships.
    ["op_role_cleaner", "cleaner", "personal de limpieza"],
    ["op_role_supervisor", "supervisor", "supervisores"],
    ["op_role_office", "office", "personal de oficina"],
    ["op_targets", "For {audience}", "Para {audience}"],
    ["op_targets_regions", "In {regions}", "En {regions}"],
    ["op_targets_everywhere", "In every region", "En todas las regiones"],
    ["op_open", "Open as a preview", "Abrir como vista previa"],
    ["op_opening", "Opening the preview", "Abriendo la vista previa"],
    ["op_loading", "Loading the trainings", "Cargando las capacitaciones"],
    ["op_none", "The trainings sheet has no rows yet.", "La hoja de capacitaciones aún no tiene filas."],
    ["op_truncated", "Only the first {n} rows are shown.", "Solo se muestran las primeras {n} filas."],

    // A preview that is running.
    ["op_now", "Preview. {track}, {region}.", "Vista previa. {track}, {region}."],
    ["op_now_note", "Nothing is saved, nobody is paid and nobody is told.",
      "No se guarda nada, no se paga a nadie y no se avisa a nadie."],
    ["op_end", "End the preview", "Terminar la vista previa"],
    ["op_started", "The preview started. {track}, {region}.",
      "La vista previa comenzó. {track}, {region}."],
    ["op_ended", "The preview ended.", "La vista previa terminó."],
    ["op_empty_head", "This is the whole screen in {region}.", "Esta es toda la pantalla en {region}."],
    ["op_empty_body", "Somebody on the {track} in {region} is shown no training at all.",
      "A alguien del {track} en {region} no se le muestra ninguna capacitación."],

    // Refusals. The two FORBIDDEN answers are the ones the W2 and 1099 screen already gives.
    ["op_err_load", "The list of trainings could not be loaded.",
      "No se pudo cargar la lista de capacitaciones."],
    ["op_err_open", "The preview could not be opened.", "No se pudo abrir la vista previa."],
    // edu_err_notready says the office has been told, which in a preview is the one line on the
    // screen that contradicts the banner above it. Here, not in the file every phone downloads.
    ["op_err_notready",
      "This training is not ready yet. Its answer key is missing, and the office has not been told, because this is a preview.",
      "Esta capacitación aún no está lista. Le falta la clave de respuestas, y no se avisó a la oficina, porque esto es una vista previa."],
    ["op_err_owner", "Only the person who owns the company can open this.",
      "Solo la persona dueña de la compañía puede abrir esto."],
    ["op_err_setup", "This is not set up yet. Run setup in the Apps Script editor.",
      "Esto aún no está configurado. Ejecute la configuración en el editor de Apps Script."]
  ];

  (function () {
    var strings = root.CCC_I18N && root.CCC_I18N.strings;
    if (!strings) return;
    ROWS.forEach(function (r) {
      strings.en[r[0]] = r[1];
      strings.es[r[0]] = r[2];
    });
  })();
  root.CCC_PREVIEW_I18N = ROWS; // tests/web/preview.html reads this to check both languages

  /* ------------------------------------------------------------------ */
  /* State. Memory only: never stored, and dropped on sign out.          */
  /* ------------------------------------------------------------------ */

  var V = null;

  function blank() {
    return {
      cat: null,      // the owner_preview answer
      busy: false,    // the catalogue is on its way
      err: null,      // the string key of a refusal, or null
      track: "full",  // the kind of worker she is standing in as
      region: null,   // the region she is standing in, null until the catalogue names one
      as: null,       // the stand in now in use, {track, region}, or null
      list: null,     // the trainings answer for that stand in, in memory and never saved
      opening: false, // a training is being opened
      live: ""        // the one line a screen reader is told when a preview starts or ends
    };
  }

  function t(key, vars) { return P.t(key, vars); }
  function el(tag, attrs, kids) { return P.h(tag, attrs, kids); }
  function arr(a) { return Array.isArray(a) ? a : []; }

  /* The words for a track, which the bar and the empty screen both say. */
  function trackText(track) {
    return t(track === "notice" ? "op_track_notice" : "op_track_full");
  }

  /* One region entry of the catalogue, by name. */
  function regionAt(name) {
    var found = null;
    arr(V.cat && V.cat.regions).forEach(function (r) {
      if (r.region === name) found = r;
    });
    return found;
  }

  /* Why nobody in this region is shown a training, or "". The backend works it out and sends it, so
     the rule is never written a second time here (docs/API.md 13.14). */
  function holdText(entry) {
    var hold = entry && entry.hold;
    if (hold === "state") return t("op_hold_state");
    if (hold === "unmapped") return t("op_hold_unmapped");
    return "";
  }

  /* ------------------------------------------------------------------ */
  /* Talking to the backend                                              */
  /* ------------------------------------------------------------------ */

  /* The refusals of docs/API.md 13.14, mapped to what she reads. */
  function errKey(res) {
    var e = (res && res.error) || {};
    if (e.code === "FORBIDDEN") return e.reason === "SETUP_INCOMPLETE" ? "op_err_setup" : "op_err_owner";
    if (e.code === "RATE_LIMITED") return "err_rate";
    if (e.code === "NETWORK") return "error_network";
    return "op_err_load";
  }

  /* The catalogue. owner_preview is a read that writes nothing, not even an alert, so asking again
     after a failure costs nothing and the button below is the only retry it needs: web/api.js is
     left alone, because a retry rule there is bytes in the bundle every phone downloads. */
  function loadCatalog() {
    var token = P.state.token;
    if (!token) return;
    V.busy = true;
    V.err = null;
    P.api("owner_preview", { token: token }).then(function (res) {
      if (!V || token !== P.state.token) return;
      V.busy = false;
      if (res.ok === true) {
        V.cat = res;
        if (V.region === null) V.region = firstRegion(res);
      } else {
        V.err = errKey(res);
      }
      P.render();
    });
  }

  /* The region the picker starts on: the first one nothing holds, so the first thing she sees is a
     screen that works. Her own region is held, which is the whole reason this screen exists, and
     opening on it would show her an empty screen again. Falls back to the first region of all when
     every region is held, and to "" when the roster has none. */
  function firstRegion(cat) {
    var regions = arr(cat && cat.regions);
    for (var i = 0; i < regions.length; i++) {
      if (!regions[i].hold) return regions[i].region;
    }
    return regions.length ? regions[0].region : "";
  }

  /* Open one row of the catalogue as the chosen kind of worker.

     It asks for the stand in's OWN Trainings list first, with preview_as, and opens the row out of
     that answer. That is what makes the hold visible instead of turning it into an error: in a held
     region the answer is the empty screen the team gets, and this screen then shows exactly that.
     It is also the same list the team's phone reads, so there is one way in and not two. */
  function openRow(row) {
    if (V.opening) return;
    var token = P.state.token;
    var as = { track: V.track, region: V.region || "" };
    V.opening = true;
    V.err = null;
    V.as = as;
    V.list = null;
    P.render();
    P.api("trainings", { token: token, preview_as: as }).then(function (res) {
      if (!V || token !== P.state.token) return;
      V.opening = false;
      if (res.ok !== true) {
        // The stand in is dropped, so nothing else in the app carries a preview it could not open.
        V.as = null;
        V.err = errKey(res);
        P.render();
        return;
      }
      // NEVER P.setTrainings: a preview must not reach phone storage, the home banner or the badge.
      V.list = res;
      var item = itemIn(res, row);
      if (!item) {
        // Held, or the row went away while she was looking at it. Either way the honest answer is
        // the screen the team gets, which draw() shows from V.list.
        V.live = t("op_started", { track: trackText(as.track), region: regionName(as.region) });
        P.render();
        return;
      }
      V.live = t("op_started", { track: trackText(as.track), region: regionName(as.region) });
      // On THIS row and nothing else, so no other row inherits it (the header). web/edu.js reads
      // op_as off the row it has open.
      item.op_as = as;
      root.CCCEdu.open(item);
    });
  }

  /* The row of the stand in's own list that matches the one she picked: the same training and the
     same version, because an owner preview reaches every version of a training. */
  function itemIn(res, row) {
    var found = null;
    arr(res && res.items).forEach(function (item) {
      if (item.training_id === row.training_id && item.version === row.version) found = item;
    });
    return found;
  }

  /* A region name as it is read out: the cell, or the words for a blank one. */
  function regionName(name) {
    return name || t("op_region_blank");
  }

  /* Put the focus back on a control this panel has just rebuilt. Every change redraws the whole
     block, so the control she used is a different element and the focus falls to the page: the next
     Tab starts again at the brand link, and arrow keys, the only way to move inside a radio group,
     stop working. One microtask later the new node is in the page and can take it. */
  function refocus(id) {
    Promise.resolve().then(function () {
      var n = doc.getElementById(id);
      if (!n) return;
      if (n.tagName === "H2") n.setAttribute("tabindex", "-1");
      try {
        n.focus({ preventScroll: true });
      } catch (e) {
        n.focus();
      }
    });
  }

  function endPreview() {
    V.as = null;
    V.list = null;
    V.err = null;
    V.live = t("op_ended");
    P.render();
    // The button that was just tapped is gone with the bar, so the focus would fall to the top of
    // the page. It goes to this panel's own heading instead, which says where she is.
    refocus("op-head");
  }

  /* ------------------------------------------------------------------ */
  /* Drawing                                                             */
  /* ------------------------------------------------------------------ */

  function line(cls, text) {
    return el("p", { class: cls, text: text });
  }

  /* Something is on its way. The spinner is the app's own, and the words beside it are read out,
     because a spinner alone tells a screen reader nothing. */
  function spinner(key) {
    return el("p", { class: "msg-quiet", role: "status" },
      [el("span", { class: "spinner", "aria-hidden": "true" }), t(key)]);
  }

  /* The one line a screen reader is told when a preview starts or ends. The words go in one
     microtask AFTER the node is in the page: a live region inserted with its words already inside
     it is not reliably read out, and this is the only announcement this screen makes. */
  function liveLine() {
    var node = el("p", { class: "sr-only", id: "op-live", role: "status", "aria-live": "polite" });
    // Taken, not read: the node closes over the words, so the one real announcement still fires
    // and no later render repeats it. Left in place, picking the notice announced that a course
    // preview had started, and picking a region announced the one she had just left.
    var said = V.live;
    V.live = "";
    if (said) {
      Promise.resolve().then(function () {
        if (node.parentNode) node.textContent = said;
      });
    }
    return node;
  }

  /* Why the team's trainings are not on her own list, from her own Roster region and the hold the
     backend sent for it. It is drawn while no LIVE training is on her list, not only while the list
     is bare: on September 30, 2026 her list held exactly one row, the firearms draft that names her
     in its preview_ids, and "I am not seeing any of the trainings just one" is the sentence this
     screen exists to answer. A row she can only see because she was named in it is not the team's
     training reaching her. Once a live one does, the answer is on the screen and this goes. */
  function whyEmpty() {
    var mine = (P.state.person && P.state.person.region) || "";
    var items = P.state.edu && P.state.edu.items;
    if (!Array.isArray(items)) return null;
    var live = items.filter(function (it) { return it.preview !== true; });
    if (live.length) return null;
    var entry = regionAt(mine);
    if (!entry) return null;
    var key = entry.hold === "state" ? "op_why_state" : entry.hold === "unmapped" ? "op_why_unmapped" : "op_why_audience";
    return el("div", { class: "op-why" }, [
      line("op-why-head", t("op_why_head")),
      line(null, t(key, { region: regionName(mine) }))
    ]);
  }

  /* The bar that says a preview is running. It is the first thing in the block and it never goes
     away while a stand in is in use, so the screen below it can never be read as the real thing. */
  function nowBar() {
    var as = V.as;
    return el("div", { class: "op-now" }, [
      el("p", { class: "op-now-line" }, [P.icon("info"),
        el("span", { text: t("op_now", { track: trackText(as.track), region: regionName(as.region) }) })]),
      line("op-now-note", t("op_now_note")),
      el("button", { type: "button", class: "btn btn-secondary op-end", on: { click: endPreview } },
        t("op_end"))
    ]);
  }

  /* The team's own empty screen for the region she picked, with the hold named. This is the answer
     to "what does somebody in California see", and it is the same nothing they see. */
  function heldScreen() {
    var as = V.as;
    var entry = regionAt(as.region);
    var hold = holdText(entry);
    return el("div", { class: "op-empty" }, [
      line("op-empty-head", t("op_empty_head", { region: regionName(as.region) })),
      line(null, t("op_empty_body", { track: trackText(as.track), region: regionName(as.region) })),
      hold ? line("op-hold", hold) : null
    ]);
  }

  function trackPicker() {
    var kids = [el("legend", { class: "op-label", text: t("op_track_label") })];
    ["full", "notice"].forEach(function (track) {
      var id = "op-track-" + track;
      kids.push(el("label", { class: "op-choice" + (V.track === track ? " is-on" : ""), for: id }, [
        el("input", {
          type: "radio", id: id, name: "op-track", value: track, checked: V.track === track,
          on: { change: function () { V.track = track; P.render(); refocus(id); } }
        }),
        el("span", { text: trackText(track) })
      ]));
    });
    return el("fieldset", { class: "op-fs" }, kids);
  }

  function regionPicker() {
    var regions = arr(V.cat && V.cat.regions);
    var select = el("select", {
      id: "op-region", class: "op-select",
      on: { change: function (e) {
        V.region = e.target.value;
        // The hold is the one thing a region reveals that the select does not say itself, and it
        // was drawn and never spoken. Through the live line, so she hears it as well as sees it.
        V.live = holdText(regionAt(V.region));
        P.render();
        refocus("op-region");
      } }
    }, regions.map(function (r) {
      return el("option", { value: r.region, text: regionName(r.region) });
    }));
    // The value, not a selected attribute: the option she is on is then right however the list
    // came, and a region cell that is blank still selects rather than falling to the first.
    select.value = V.region || "";
    var entry = regionAt(V.region);
    var hold = holdText(entry);
    return el("div", { class: "op-field" }, [
      el("label", { class: "op-label", for: "op-region", text: t("op_region_label") }),
      select,
      entry ? line("op-region-note", entry.people === 1 ? t("op_region_person")
        : t("op_region_people", { n: String(entry.people) })) : null,
      hold ? line("op-hold", hold) : null
    ]);
  }

  /* One lower case English key from the sheet, in her language. An unknown one is capitalised
     rather than left bare: it still has to read as a word in the middle of a sentence. */
  function word(prefix, raw) {
    var k = prefix + String(raw).replace(/[^a-z]/g, "");
    var s = t(k);
    return s === k ? String(raw).charAt(0).toUpperCase() + String(raw).slice(1) : s;
  }

  /* One row of the catalogue: what it is, who it really reaches, and one button. A preview reaches
     EVERY version, so the same title is regularly on the screen twice: the version and which is
     newest go in the heading and in the button's own name, or the two rows are one word to a
     screen reader and she has to guess which she is opening. */
  function catalogRow(row) {
    var title = (P.state.lang === "es" && row.title.es) || row.title.en || "";
    var live = row.status === "live";
    var which = row.version + ", " + t(row.newest ? "op_newest" : "op_older");
    var meta = [row.version, t(row.newest ? "op_newest" : "op_older")];
    if (row.minutes) meta.push(t("op_minutes", { n: String(row.minutes) }));
    meta.push(!row.reaches ? t("op_reaches_none") : row.reaches === 1 ? t("op_reaches_one")
      : t("op_reaches", { n: String(row.reaches) }));
    var facts = [t(row.has_key ? "op_key_yes" : "op_key_no")];
    if (row.preview_named) {
      facts.push(row.preview_named === 1 ? t("op_named_one")
        : t("op_named", { n: String(row.preview_named) }));
    }
    var audience = arr(row.audience).map(function (a) { return word("op_role_", a); }).join(", ");
    var where = arr(row.regions).map(function (r) { return word("state_", r); }).join(", ");
    return el("li", { class: "op-row" }, [
      el("div", { class: "op-row-top" }, [
        el("h4", { class: "op-row-title" }, [el("span", { class: "op-row-name", text: title }),
          el("span", { class: "sr-only", text: ", " + which })]),
        el("span", { class: "chip " + (live ? "chip-done" : "chip-new"), text: t(live ? "op_live" : "op_draft") })
      ]),
      line("op-row-meta", meta.join(" · ")),
      line("op-row-meta", facts.join(" · ")),
      audience ? line("op-row-meta", t("op_targets", { audience: audience })) : null,
      line("op-row-meta", where ? t("op_targets_regions", { regions: where }) : t("op_targets_everywhere")),
      el("button", {
        type: "button", class: "btn btn-primary op-open", disabled: V.opening === true,
        "data-op-open": row.training_id + "@" + row.version,
        on: { click: function () { openRow(row); } }
      }, [el("span", { text: t("op_open") }),
        el("span", { class: "sr-only", text: " " + title + ", " + which })])
    ]);
  }

  function catalogList() {
    var rows = arr(V.cat && V.cat.trainings);
    if (!rows.length) return [line("op-none", t("op_none"))];
    var list = el("ul", { class: "op-list" });
    rows.forEach(function (row) { list.appendChild(catalogRow(row)); });
    var out = [el("h3", { class: "op-list-head", text: t("op_list_head") }), list];
    if (V.cat.truncated === true) {
      out.push(line("op-row-meta", t("op_truncated", { n: String(rows.length) })));
    }
    return out;
  }

  function draw() {
    var kids = [
      el("div", { class: "op-top" }, [
        el("h2", { class: "op-head", id: "op-head" }, [P.icon("cap"), el("span", { text: t("op_head") })]),
        line("op-only", t("op_only_you"))
      ]),
      line("op-intro", t("op_intro")),
      liveLine()
    ];
    if (V.err) kids.push(el("div", { class: "op-msg" }, P.msgBox("error", "alert", t(V.err))));
    if (V.as) {
      kids.push(nowBar());
      // Held, so the honest answer is the team's own empty screen. An answer with items in it means
      // she is reading the training itself, and this block is not on that screen at all.
      if (V.list && !arr(V.list.items).length) kids.push(heldScreen());
    }
    if (V.opening) kids.push(spinner("op_opening"));
    if (!V.cat) {
      if (V.busy) kids.push(spinner("op_loading"));
      else if (V.err) kids.push(P.retry(function () { loadCatalog(); }));
      return kids;
    }
    kids.push(whyEmpty());
    kids.push(trackPicker());
    kids.push(regionPicker());
    catalogList().forEach(function (node) { kids.push(node); });
    return kids;
  }

  root.CCCPreview = {
    /* The block web/edu.js puts under her own list, or null when there is nothing to draw yet. */
    block: function () {
      P = P || root.CCCPortal;
      if (!V) {
        V = blank();
        loadCatalog();
      }
      return el("section", { class: "op", "aria-labelledby": "op-head" }, draw());
    },

    /* The stand in this PANEL holds: what the bar shows and what the next row she opens is given,
       in memory only. web/edu.js never reads it. The stand in a CALL carries comes off the row that
       call is about (openRow, and the header), or a row of her own would inherit one. */
    as: function () {
      return (V && V.as) || null;
    },

    /* The label every screen of a preview wears, in place of the plainer one of 0.3.4: it names the
       track and the region, because a preview she chose is only honest if it says what she chose.
       The stand in is passed in, off the row on the screen, so the label can never name a track or
       a region that is not the one this screen was really opened as.

       data-edu-head puts the FOCUS here at every step: web/edu.js focuses the first marked node
       when the screen changes, and this sits above the heading, so reading forward starts here and
       runs on into it. Without it she heard this once, as the preview started, and then every
       slide, question and result was read to her exactly as a real training would be. The mark is
       set here, in the one bundle her phone alone fetches, so the Trainings bundle pays nothing. */
    tag: function (as) {
      if (!as) return null;
      P = P || root.CCCPortal;
      return el("p", { class: "edu-preview op-tag", "data-edu-head": "1" },
        [P.icon("info"), el("span", {
          text: t("op_now", { track: trackText(as.track), region: regionName(as.region) }) + " " +
            t("op_now_note")
        })]);
    },

    /* Sign out, or a new person on the same phone: the catalogue, the choice and the stand in go. */
    reset: function () {
      V = null;
    },

    /* For tests: what she picked and whether a preview is running, never a name or an answer. */
    debug: function () {
      return V && { track: V.track, region: V.region, as: V.as, busy: V.busy, err: V.err,
        opening: V.opening, live: V.live, rows: arr(V.cat && V.cat.trainings).length,
        items: V.list ? arr(V.list.items).length : null };
    }
  };
})(window);
