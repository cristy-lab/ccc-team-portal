/* CCC Team Portal strings and date formatting.
 *
 * NOTE: Spanish copy is pending proofread by the office.
 *
 * Copy rules: no em dash, no en dash, and no spaced hyphen used as a dash between words or numbers.
 * English stays short and plain. Spanish uses "usted" everywhere.
 * tests/web/index.html checks that both languages have the same keys and no dashes.
 */
(function (root) {
  "use strict";

  var STRINGS = {
    en: {
      app_name: "CCC Team Portal",
      tagline: "Harder Than Diamonds",
      logo_alt: "Cristal Clear Cleaning",
      language: "Language",
      loading: "Loading…",
      back: "Back",
      close: "Close",
      try_again: "Try again",
      opens_new_tab: "(opens in a new tab)",
      version: "Version {v}",

      login_title: "Welcome to the CCC Team Portal",
      login_instruction: "Enter the last 4 digits of your phone number",
      login_progress: "{n} of 4 digits entered",
      login_checking: "Checking…",
      login_no_match: "That number did not match. Please try again, or ask your supervisor for help.",
      login_locked: "Too many tries. For your safety, please wait {time}.",
      login_unlocked: "You can try again now.",
      login_help: "Need help? Ask your supervisor.",
      key_delete: "Delete",
      time_minute_one: "1 minute",
      time_minutes: "{n} minutes",
      time_hour_one: "1 hour",
      signin_again: "Please sign in again.",
      signed_out: "You are signed out.",

      error_network: "We could not connect. Please check your internet and try again.",
      error_server: "Something went wrong on our side. Please try again in a moment.",

      choose_title: "Which one is you?",
      choose_sub: "More than one person uses this number. Tap your name.",

      greet_morning: "Good morning, {name}",
      greet_afternoon: "Good afternoon, {name}",
      greet_evening: "Good evening, {name}",
      greet_aloha: "Aloha, {name}",
      home_loading: "Getting your info…",
      next_payday: "Next payday",
      today_excl: "Today!",
      tomorrow: "Tomorrow",
      in_days: "in {n} days",
      to_be_confirmed: "Date to be confirmed",
      for_work: "For work from {range}",
      no_payday: "Pay dates are coming soon.",
      notice_label: "Notice",

      tile_dayoff_title: "Request a day off",
      tile_dayoff_sub: "Please ask at least 2 weeks ahead",
      tile_survey_title: "Supervisor survey",
      tile_survey_sub: "Once a month, tell us how it is going",
      tile_calendar_title: "Pay calendar",
      tile_calendar_sub: "See all your paydays",
      tile_change_title: "Request a change",
      tile_change_sub: "Schedule, pay, your info, anything",
      tile_training_title: "Trainings",
      tile_training_sub: "Trainings and safety notices for the team",
      edu_new: "New",
      edu_new_training: "New training available",
      edu_new_notice: "New safety notice",
      edu_past_due: "Training past due",

      // The message from the CEO. {motto} is "Harder Than Diamonds" (the tagline), in bold.
      ceo_link: "Message from the CEO",
      ceo_title: "A message from our CEO",
      ceo_lead: "Welcome to Cristal Clear Cleaning!",
      ceo_p1: "I am so grateful you chose to join our team. Every home you clean, every guest who walks into a spotless space, and every owner who trusts us starts with you. You are the heart of this company.",
      ceo_p2: "Here you will always be treated with respect, and you will always have people behind you. If you ever need anything, talk to your supervisor or reach out to our office. Your voice matters to me.",
      ceo_p3: "Thank you for bringing your best every day. Together, we are {motto}.",
      ceo_with: "With gratitude,",
      ceo_role: "Founder and CEO",
      ceo_go: "Let’s get started",

      my_requests: "My requests",
      see_all: "See all",
      no_requests: "You have not sent any requests yet.",
      request_number: "Request {id}",
      sent_on: "Sent {date}",
      office_reply: "Office reply",
      req_details_hidden: "Details hidden for privacy. The office can see them.",
      req_reply_hidden: "The office replied. Ask your supervisor or check WhatsApp for details.",

      status_new: "New",
      status_in_progress: "In progress",
      status_done: "Done",

      support_default: "Questions? Talk to your supervisor.",
      not_you: "Not you?",
      sign_out: "Sign out",
      offline_banner: "You are offline. This is your saved info.",

      cal_title: "Pay calendar",
      cal_rule: "You get paid every other Friday for the two weeks of work that ended the Monday before.",
      cal_pdf: "Download the PDF calendar",
      cal_payday: "Payday",
      cal_work: "Work days: {range}",
      cal_closes: "Payroll closes {date}",
      chip_this_period: "This period",
      chip_pending: "To be confirmed",
      chip_passed: "Payday passed",
      cal_empty: "The pay calendar is not ready yet.",

      req_title: "Request a change",
      req_intro: "Tell the office what you need. We will get back to you.",
      req_topic: "What is it about?",
      cat_schedule: "Schedule",
      cat_pay: "Pay",
      cat_my_info: "My info",
      cat_property: "A property or supplies",
      cat_other: "Something else",
      req_details: "Tell us more",
      req_privacy: "Please do not write bank numbers or Social Security numbers here.",
      req_counter: "{n} of 1000",
      req_min_hint: "Write at least 10 letters or numbers.",
      req_contact: "Best way to reach you",
      contact_whatsapp: "WhatsApp",
      contact_call: "Call",
      contact_text: "Text",
      contact_none: "No need",
      req_submit: "Send request",
      req_sending: "Sending…",
      req_offline: "You are offline. You can send this when you are back online.",
      err_topic: "Please choose a topic.",
      err_details_short: "Please write a little more, at least 10 letters or numbers.",
      err_details_long: "Please make it shorter, 1000 letters or numbers at most.",
      err_contact: "Please choose how we can reach you.",
      err_rate: "You sent a lot of requests today. Please try again later, or talk to your supervisor.",
      err_unsure: "We are not sure your request was sent. Please check My requests before you send it again.",

      done_title: "Request sent",
      done_number: "Your request number is {id}",
      done_body: "The office will get back to you soon.",
      back_home: "Back to home",
      see_my_requests: "See my requests",

      a2hs_title: "Add the portal to your home screen",
      a2hs_android: "Open it with one tap, like an app.",
      a2hs_install: "Install",
      a2hs_ios: "Tap the Share button, then tap Add to Home Screen.",
      a2hs_dismiss: "Not now",

      party_title: "Happy Birthday",
      party_title_you: "Happy Birthday, {name}!",
      party_from: "Happy birthday from {company}",
      party_again: "Celebrate again",
      party_continue: "Continue",
      party_wishes_title: "Birthday wishes for you",
      party_wishes_title_n: "Birthday wishes for you ({n})",
      party_wishes_empty: "No wishes yet. Your team can send them from the home screen today.",
      party_also: "Today we also celebrate {names}",
      party_and: "and",
      party_and_i: "and",
      demo_label: "Demo",
      demo_note: "Only you can see this demo.",
      bday_title: "Today is {name}'s birthday!",
      bday_title_you: "Happy birthday, {name}!",
      bday_sub: "Send a birthday wish",
      bday_count: "{n} birthday wishes so far",
      bday_count_one: "1 birthday wish so far",
      bday_count_zero: "Be the first to send a wish",
      bday_you_count: "You have {n} birthday wishes",
      bday_you_count_one: "You have 1 birthday wish",
      bday_you_count_zero: "Your team can send you wishes today",
      bday_see: "See wishes",
      bday_cake: "Celebrate {name}",
      wish_send: "Send {emoji}",
      wish_err_network: "Your wish was not sent. Check your internet and try again.",
      wish_err_server: "Your wish was not sent. Please try again in a moment.",
      wish_err_rate: "You sent a lot of wishes today. Thank you!",
      wish_err_over: "This birthday is over. Thank you!"
    },

    es: {
      app_name: "Portal del Equipo CCC",
      tagline: "Harder Than Diamonds",
      logo_alt: "Cristal Clear Cleaning",
      language: "Idioma",
      loading: "Cargando…",
      back: "Atrás",
      close: "Cerrar",
      try_again: "Intentar otra vez",
      opens_new_tab: "(se abre en otra pestaña)",
      version: "Versión {v}",

      login_title: "Le damos la bienvenida al Portal del Equipo CCC",
      login_instruction: "Escriba los últimos 4 números de su teléfono",
      login_progress: "{n} de 4 números escritos",
      login_checking: "Revisando…",
      login_no_match: "Ese número no coincide. Intente otra vez o pídale ayuda a su supervisor.",
      login_locked: "Demasiados intentos. Por su seguridad, espere {time}.",
      login_unlocked: "Ya puede intentar otra vez.",
      login_help: "¿Necesita ayuda? Pregúntele a su supervisor.",
      key_delete: "Borrar",
      time_minute_one: "1 minuto",
      time_minutes: "{n} minutos",
      time_hour_one: "1 hora",
      signin_again: "Por favor, inicie sesión otra vez.",
      signed_out: "Cerró su sesión.",

      error_network: "No pudimos conectarnos. Revise su internet e intente otra vez.",
      error_server: "Algo salió mal de nuestro lado. Intente otra vez en un momento.",

      choose_title: "¿Quién es usted?",
      choose_sub: "Más de una persona usa este número. Toque su nombre.",

      greet_morning: "Buenos días, {name}",
      greet_afternoon: "Buenas tardes, {name}",
      greet_evening: "Buenas noches, {name}",
      greet_aloha: "Aloha, {name}",
      home_loading: "Buscando su información…",
      next_payday: "Próximo día de pago",
      today_excl: "¡Hoy!",
      tomorrow: "Mañana",
      in_days: "en {n} días",
      to_be_confirmed: "Fecha por confirmar",
      for_work: "Por el trabajo del {range}",
      no_payday: "Las fechas de pago estarán listas pronto.",
      notice_label: "Aviso",

      tile_dayoff_title: "Pedir un día libre",
      tile_dayoff_sub: "Pídalo por lo menos 2 semanas antes",
      tile_survey_title: "Encuesta del supervisor",
      tile_survey_sub: "Una vez al mes, cuéntenos cómo le va",
      tile_calendar_title: "Calendario de pagos",
      tile_calendar_sub: "Vea todos sus días de pago",
      tile_change_title: "Pedir un cambio",
      tile_change_sub: "Horario, pago, sus datos u otra cosa",
      tile_training_title: "Capacitaciones",
      tile_training_sub: "Capacitaciones y avisos de seguridad para el equipo",
      edu_new: "Nueva",
      edu_new_training: "Nueva capacitación disponible",
      edu_new_notice: "Nuevo aviso de seguridad",
      edu_past_due: "Capacitación vencida",

      ceo_link: "Mensaje de la CEO",
      ceo_title: "Un mensaje de nuestra CEO",
      ceo_lead: "¡Le damos la bienvenida a Cristal Clear Cleaning!",
      ceo_p1: "Estoy muy agradecida de que haya decidido unirse a nuestro equipo. Cada casa que usted limpia, cada huésped que llega a un espacio impecable y cada cliente que confía en nosotros comienza con usted. Usted es el corazón de esta compañía.",
      ceo_p2: "Aquí siempre recibirá respeto y siempre tendrá personas que le apoyan. Si alguna vez necesita algo, hable con su supervisor o comuníquese con nuestra oficina. Su voz es importante para mí.",
      // {motto} stays in English, marked lang="en" by the app.
      ceo_p3: "Gracias por dar lo mejor de usted cada día. En equipo somos {motto}.",
      ceo_with: "Con gratitud,",
      ceo_role: "Fundadora y CEO",
      ceo_go: "Comencemos",

      my_requests: "Mis solicitudes",
      see_all: "Ver todas",
      no_requests: "Todavía no ha enviado ninguna solicitud.",
      request_number: "Solicitud {id}",
      sent_on: "Enviada el {date}",
      office_reply: "Respuesta de la oficina",
      req_details_hidden: "Detalles ocultos por privacidad. La oficina sí los puede ver.",
      req_reply_hidden: "La oficina respondió. Pregunte a su supervisor o revise WhatsApp para ver los detalles.",

      status_new: "Nueva",
      status_in_progress: "En proceso",
      status_done: "Resuelta",

      support_default: "¿Tiene preguntas? Hable con su supervisor.",
      not_you: "¿No es usted?",
      sign_out: "Cerrar sesión",
      offline_banner: "Está sin conexión. Le mostramos la información guardada.",

      cal_title: "Calendario de pagos",
      cal_rule: "Le pagamos cada dos viernes por las dos semanas de trabajo que terminaron el lunes anterior.",
      cal_pdf: "Descargar el calendario en PDF",
      cal_payday: "Día de pago",
      cal_work: "Días de trabajo: del {range}",
      cal_closes: "La nómina cierra el {date}",
      chip_this_period: "Período actual",
      chip_pending: "Por confirmar",
      chip_passed: "Ya pasó",
      cal_empty: "El calendario de pagos todavía no está listo.",

      req_title: "Pedir un cambio",
      req_intro: "Cuéntele a la oficina qué necesita. Le vamos a responder.",
      req_topic: "¿De qué se trata?",
      cat_schedule: "Horario",
      cat_pay: "Pago",
      cat_my_info: "Mis datos",
      cat_property: "Una propiedad o materiales",
      cat_other: "Otra cosa",
      req_details: "Cuéntenos más",
      req_privacy: "Por favor, no escriba números de banco ni de Seguro Social aquí.",
      req_counter: "{n} de 1000",
      req_min_hint: "Escriba por lo menos 10 letras o números.",
      req_contact: "La mejor forma de contactarle",
      contact_whatsapp: "WhatsApp",
      contact_call: "Llamada",
      contact_text: "Mensaje de texto",
      contact_none: "No hace falta",
      req_submit: "Enviar solicitud",
      req_sending: "Enviando…",
      req_offline: "Está sin conexión. Podrá enviarlo cuando vuelva a tener internet.",
      err_topic: "Por favor, elija un tema.",
      err_details_short: "Por favor, escriba un poco más, por lo menos 10 letras o números.",
      err_details_long: "Por favor, escríbalo más corto, máximo 1000 letras o números.",
      err_contact: "Por favor, elija cómo podemos contactarle.",
      err_rate: "Hoy envió muchas solicitudes. Intente más tarde o hable con su supervisor.",
      err_unsure: "No sabemos si su solicitud se envió. Revise Mis solicitudes antes de enviarla otra vez.",

      done_title: "Solicitud enviada",
      done_number: "Su número de solicitud es {id}",
      done_body: "La oficina le va a responder pronto.",
      back_home: "Volver al inicio",
      see_my_requests: "Ver mis solicitudes",

      a2hs_title: "Agregue el portal a su pantalla de inicio",
      a2hs_android: "Ábralo con un solo toque, como una aplicación.",
      a2hs_install: "Instalar",
      a2hs_ios: "Toque el botón Compartir y luego toque Agregar a inicio.",
      a2hs_dismiss: "Ahora no",

      party_title: "¡Feliz cumpleaños!",
      party_title_you: "¡Feliz cumpleaños, {name}!",
      party_from: "¡Feliz cumpleaños de parte de {company}!",
      party_again: "Celebrar otra vez",
      party_continue: "Continuar",
      party_wishes_title: "Saludos de cumpleaños para usted",
      party_wishes_title_n: "Saludos de cumpleaños para usted ({n})",
      party_wishes_empty: "Todavía no hay saludos. Su equipo se los puede enviar hoy desde la pantalla de inicio.",
      party_also: "Hoy también celebramos a {names}",
      party_and: "y",
      // "e" in place of "y" before a name that starts with the sound i (Isabel, Hilda).
      party_and_i: "e",
      demo_label: "Demo",
      demo_note: "Solo usted puede ver esta demostración.",
      bday_title: "¡Hoy es el cumpleaños de {name}!",
      bday_title_you: "¡Feliz cumpleaños, {name}!",
      bday_sub: "Envíe un saludo de cumpleaños",
      bday_count: "{n} saludos de cumpleaños",
      bday_count_one: "1 saludo de cumpleaños",
      bday_count_zero: "Envíe el primer saludo",
      bday_you_count: "Tiene {n} saludos de cumpleaños",
      bday_you_count_one: "Tiene 1 saludo de cumpleaños",
      bday_you_count_zero: "Su equipo le puede enviar saludos hoy",
      bday_see: "Ver saludos",
      bday_cake: "Celebrar a {name}",
      wish_send: "Enviar {emoji}",
      wish_err_network: "Su saludo no se envió. Revise su internet e intente otra vez.",
      wish_err_server: "Su saludo no se envió. Intente otra vez en un momento.",
      wish_err_rate: "Hoy envió muchos saludos. ¡Gracias!",
      wish_err_over: "Este cumpleaños ya pasó. ¡Gracias!"
    }
  };

  var LOCALES = { en: "en-US", es: "es-US" };

  function normLang(lang) {
    return lang === "es" ? "es" : "en";
  }

  /* t("es", "in_days", {n: 3}) -> "en 3 días". Falls back to English, then to the key. */
  function t(lang, key, vars) {
    var table = STRINGS[normLang(lang)];
    var s = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : STRINGS.en[key];
    if (s === undefined) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, name) {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m;
      });
    }
    return s;
  }

  /* Parse "YYYY-MM-DD" as a LOCAL calendar date. Never use new Date("YYYY-MM-DD"),
     which is read as UTC midnight and shows the day before in US time zones. */
  function parseYMD(s) {
    if (typeof s !== "string") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function toYMD(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  var fmtCache = {};
  function parts(date, lang, opts, optsKey) {
    var k = normLang(lang) + "|" + optsKey;
    if (!fmtCache[k]) fmtCache[k] = new Intl.DateTimeFormat(LOCALES[normLang(lang)], opts);
    var out = {};
    fmtCache[k].formatToParts(date).forEach(function (p) {
      if (p.type !== "literal") out[p.type] = p.value.replace(/\.$/, "");
    });
    return out;
  }

  function capFirst(s) {
    return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s;
  }

  /* Long date. en: "Friday, October 2"  es: "viernes, 2 de octubre" */
  function formatLong(ymd, lang) {
    var d = parseYMD(ymd);
    if (!d) return "";
    var p = parts(d, lang, { weekday: "long", month: "long", day: "numeric" }, "wld");
    return normLang(lang) === "es"
      ? p.weekday + ", " + p.day + " de " + p.month
      : p.weekday + ", " + p.month + " " + p.day;
  }

  /* Short date. en: "Sep 15"  es: "15 de septiembre" (no abbreviations in Spanish) */
  function formatShort(ymd, lang) {
    var d = parseYMD(ymd);
    if (!d) return "";
    if (normLang(lang) === "es") {
      var pe = parts(d, lang, { month: "long", day: "numeric" }, "ld");
      return pe.day + " de " + pe.month;
    }
    var p = parts(d, lang, { month: "short", day: "numeric" }, "sd");
    return p.month + " " + p.day;
  }

  /* Weekday plus short date. en: "Monday, Sep 28"  es: "lunes 28 de septiembre" */
  function formatWeekdayShort(ymd, lang) {
    var d = parseYMD(ymd);
    if (!d) return "";
    if (normLang(lang) === "es") {
      var pe = parts(d, lang, { weekday: "long", month: "long", day: "numeric" }, "wld");
      return pe.weekday + " " + pe.day + " de " + pe.month;
    }
    var p = parts(d, lang, { weekday: "long", month: "short", day: "numeric" }, "wsd");
    return p.weekday + ", " + p.month + " " + p.day;
  }

  /* Date range. en: "Sep 15 to Sep 28"
     es: "15 al 28 de septiembre" or "29 de septiembre al 12 de octubre"
     (Spanish strings put "del" in front of the range themselves.) */
  function formatRange(startYmd, endYmd, lang) {
    var a = parseYMD(startYmd), b = parseYMD(endYmd);
    if (!a || !b) return "";
    if (normLang(lang) === "es") {
      if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
        return a.getDate() + " al " + formatShort(endYmd, "es");
      }
      return formatShort(startYmd, "es") + " al " + formatShort(endYmd, "es");
    }
    return formatShort(startYmd, "en") + " to " + formatShort(endYmd, "en");
  }

  function formatYear(ymd) {
    var d = parseYMD(ymd);
    return d ? String(d.getFullYear()) : "";
  }

  root.CCC_I18N = {
    strings: STRINGS,
    locales: LOCALES,
    normLang: normLang,
    t: t,
    parseYMD: parseYMD,
    toYMD: toYMD,
    capFirst: capFirst,
    formatLong: formatLong,
    formatShort: formatShort,
    formatWeekdayShort: formatWeekdayShort,
    formatRange: formatRange,
    formatYear: formatYear
  };
})(window);
