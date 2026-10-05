/* CCC Team Portal "Core values" strings (0.4.5), lazily loaded with values.js and values.css.
 *
 * Part of the Values bundle: these three files are fetched only when somebody opens the tile on
 * home, never at sign in (README, "Size budgets"). The two tile strings are the exception and live
 * in web/i18n.js, because home draws the tile before this file exists.
 *
 * Copy rules, the same as web/i18n.js: no em dash, no en dash, and no hyphen used as a dash.
 * Spanish never names a gender.
 *
 * THE ENGLISH IS CRISTY'S OWN, FROM HER APRIL 2026 POSTER, WITH ONE KIND OF CHANGE. Her poster
 * writes four of these lines with em dashes: "dignity—clients", "actions—especially",
 * "consistent—even" and "us—but". An em dash is an error in this project, by her own rule that
 * dashes read as AI (tools/lint_copy.py), so the app cannot carry her text as typed. Three became
 * commas, which read identically. The first became a colon, because "dignity, clients, teammates"
 * would read as a list that dignity belongs to. Nothing else about her words was touched.
 *
 * WHY THE VALUES ARE REAL TEXT AND NOT ONLY THE POSTER, the same reason as the career ladder in
 * web/states_i18n.js: the poster is the company's own artwork and every word inside it is English.
 * Most of this team reads Spanish. So each language gets its own poster picture AND the five values
 * as real text, and a Spanish reader loses nothing to a picture.
 *
 * THE SPANISH IS NOT A TRANSLATION OF THE POSTER. The Canva poster's Spanish had eight problems
 * and they are corrected here. Five mattered: "Atendemos" is what you do for a client at a service
 * desk, not how you treat a teammate, so it is "Tratamos"; "consecuente" is a false friend and
 * means true to one's own principles, not steady, so "consistent" is "constantes"; "nos reflejan a
 * nosotros" is a mirror in Spanish, so it is "se reflejan en"; and "preparados", "concentrados" and
 * "SER UN PRO" are masculine words describing the reader, on a screen read mostly by women, so they
 * are nouns and "SER PROFESIONAL", which is the same in both genders. "Parejas" is Cristy's own
 * word and is correct: she means working in pairs, partners at work. It stays.
 *
 * tests/web/values.html checks that every row has both languages and that none of them has a dash.
 */
(function (root) {
  "use strict";

  var ROWS = [
    ["cv_title", "Our Core Values", "Nuestros Valores Fundamentales"],
    ["cv_tagline",
      "How we show up. How we work. Who we are.",
      "Cómo nos presentamos. Cómo trabajamos. Quiénes somos."],

    ["cv_1_name", "Respect", "Respeto"],
    ["cv_1_body",
      "We treat everyone with dignity: clients, teammates, and partners. We listen, communicate professionally, and value each person's role. Respect is shown in our words, tone, and actions, especially under pressure.",
      "Tratamos con dignidad a todas las personas: clientes, compañeras y compañeros de equipo y parejas. Escuchamos, nos comunicamos con profesionalismo y valoramos el papel de cada persona. El respeto se demuestra en nuestras palabras, nuestro tono y nuestras acciones, especialmente bajo presión."],

    ["cv_2_name", "Loyalty", "Lealtad"],
    ["cv_2_body",
      "We stand by our team and our company. We protect the company's reputation and support one another. We handle issues internally and take pride in being part of this team.",
      "Respaldamos a nuestro equipo y a nuestra empresa. Protegemos la reputación de la empresa y nos apoyamos mutuamente. Gestionamos los problemas internamente y nos enorgullecemos de formar parte de este equipo."],

    ["cv_3_name", "Trust", "Confianza"],
    ["cv_3_body",
      "We do what we say we will do. We are reliable, accountable, and consistent, even when no one is watching. Trust is built through follow-through and responsibility.",
      "Cumplimos lo que prometemos. Somos confiables, responsables y constantes, incluso cuando nadie nos observa. La confianza se construye a través del cumplimiento de los compromisos y la responsabilidad."],

    ["cv_4_name", "Honesty", "Honestidad"],
    ["cv_4_body",
      "We tell the truth and act with integrity. We admit mistakes, communicate clearly, and learn from challenges. Honesty is non-negotiable in everything we do.",
      "Decimos la verdad y actuamos con integridad. Reconocemos nuestros errores, nos comunicamos con claridad y aprendemos de los desafíos. La honestidad es innegociable en todo lo que hacemos."],

    ["cv_5_name", "Be a Pro", "Ser profesional"],
    ["cv_5_body",
      "We show up prepared, presentable, and focused every day. We follow standards, manage our behavior, and represent the company with pride. Our actions reflect not just on us, but on the entire team.",
      "Cada día llegamos con preparación, buena presencia y concentración. Seguimos las normas, cuidamos nuestra conducta y representamos a la empresa con orgullo. Nuestras acciones se reflejan no solo en cada persona, sino en todo el equipo."],

    // The poster. One picture per language, because the words inside it are part of the artwork.
    ["cv_poster_head", "The poster", "El afiche"],
    ["cv_poster_note",
      "This is the poster that hangs in the office. The five values are written out above it, so nothing here depends on reading the picture.",
      "Este es el afiche que está en la oficina. Los cinco valores están escritos arriba, así que nada aquí depende de leer la imagen."],
    ["cv_poster_alt",
      "The Cristal Clear Cleaning Core Values poster: Respect, Loyalty, Trust, Honesty and Be a Pro, with the company logo at the bottom. All five are written out above this picture.",
      "El afiche de Valores Fundamentales de Cristal Clear Cleaning: Respeto, Lealtad, Confianza, Honestidad y Ser profesional, con el logotipo de la empresa abajo. Los cinco están escritos arriba de esta imagen."]
  ];

  var strings = root.CCC_I18N && root.CCC_I18N.strings;
  if (!strings) return;
  ROWS.forEach(function (r) {
    strings.en[r[0]] = r[1];
    strings.es[r[0]] = r[2];
  });
  root.CCC_VALUES_I18N = ROWS; // tests/web/values.html reads this to check both languages
})(window);
