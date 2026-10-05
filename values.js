/* CCC Team Portal "Core values" screen (0.4.5), lazily loaded with values_i18n.js and values.css.
 *
 * What this screen is: the five values Cristy wrote, as real text in the reader's own language, with
 * the poster underneath. What it is NOT: anything that asks for a tap, sends anything, or remembers
 * anything. It is the simplest screen in the app on purpose.
 *
 * The rules this screen keeps:
 *   * It needs nothing from the backend and nothing from the dashboard. "values" is not in
 *     DATA_ROUTES, so a dashboard that fails cannot stop it, and it never shows the loading
 *     placeholder. A phone with no signal that has the bundle already shows the whole screen.
 *   * It writes nothing to phone storage and holds nothing about the person, so there is nothing to
 *     clear when the next person signs in on the same phone. That is why app.js does not call a
 *     reset() here, and why there is not one to call.
 *   * The poster is one picture per language and it is the LAST thing on the screen, below all five
 *     values in words. It goes through the core bundle's img(), so a picture that never arrives
 *     changes nothing: the box keeps its place and carries the same description. With the picture
 *     missing the screen still does its whole job.
 *   * Every word comes from values_i18n.js. There are no strings in this file.
 */
(function (root) {
  "use strict";

  var P = null;

  /* The five, in Cristy's own order, with the colour each one carries on her poster. The tone is a
     class in values.css, never an inline colour, so dark mode can answer for itself. */
  var VALUES = [
    { n: "1", tone: "cv-blue" },
    { n: "2", tone: "cv-green" },
    { n: "3", tone: "cv-gold" },
    { n: "4", tone: "cv-peach" },
    { n: "5", tone: "cv-violet" }
  ];

  function card(v) {
    var h = P.h, t = P.t;
    return h("li", { class: "cv-card " + v.tone }, [
      h("div", { class: "cv-head" }, [
        // The number is decoration: a screen reader hears the name, not "zero one".
        h("span", { class: "cv-num", "aria-hidden": "true", text: "0" + v.n }),
        h("h2", { class: "cv-name", text: t("cv_" + v.n + "_name") })
      ]),
      h("p", { class: "cv-body", text: t("cv_" + v.n + "_body") })
    ]);
  }

  function poster() {
    var h = P.h, t = P.t;
    var lang = P.state.lang === "es" ? "es" : "en";
    var alt = t("cv_poster_alt");
    return h("section", { class: "cv-poster-wrap" }, [
      h("h2", { class: "cv-poster-head", text: t("cv_poster_head") }),
      h("p", { class: "cv-poster-note", text: t("cv_poster_note") }),
      // The box that holds the picture's place carries the same description, so a screen reader
      // hears it whether or not the picture has been fetched.
      h("div", { class: "cv-poster" },
        P.img("img/values/poster-" + lang + ".webp", alt, "cv-poster-img",
          h("span", { class: "cv-poster-missing", role: "img", "aria-label": alt })))
    ]);
  }

  function screen() {
    var h = P.h, t = P.t;
    var list = h("ul", { class: "cv-list" });
    VALUES.forEach(function (v) { list.appendChild(card(v)); });
    return h("div", { class: "cv" }, [
      h("div", { class: "page-head" }, [P.backButton("home"), h("h1", { text: t("cv_title") })]),
      h("p", { class: "cv-tagline", text: t("cv_tagline") }),
      list,
      poster()
    ]);
  }

  root.CCCValues = {
    screen: function () {
      P = P || root.CCCPortal;
      return screen();
    },
    /* The tests read this. It carries no words and no person, only what the screen drew. */
    debug: function () {
      return {
        values: doc_count("cv-card"),
        poster: doc_count("cv-poster-img") + doc_count("cv-poster-missing")
      };
    }
  };

  function doc_count(cls) {
    return root.document.querySelectorAll("." + cls).length;
  }
})(window);
