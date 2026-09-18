/* CCC Team Portal Education strings.
 *
 * Part of the Education bundle: this file is fetched the first time someone opens the
 * Trainings tile, never at sign in (README, "Size budgets"). It adds its keys to the
 * tables in web/i18n.js, so CCC_I18N.t finds them like any other string.
 *
 * Copy rules, the same as web/i18n.js: no em dash, no en dash, and no spaced hyphen used
 * as a dash. English stays short and plain. Spanish uses "usted" everywhere.
 * tests/web/edu.html checks that both languages have the same keys and no dashes.
 */
(function (root) {
  "use strict";

  var EDU = {
    en: {
      edu_intro: "Your trainings are here. You can take them in English or in Spanish.",
      edu_none_title: "Nothing to do right now",
      edu_none_body: "You have no trainings waiting. We will let you know here when there is one.",
      edu_list_head: "For you",
      edu_course: "Course",
      edu_notice: "Safety notice",
      edu_status_todo: "Not started",
      edu_status_not_passed: "Try again",
      edu_status_past_due: "Past due",
      edu_status_done: "Finished",
      edu_due: "Due {date}",
      edu_finished_on: "Finished {date}",
      edu_minutes_about: "About {n} minutes",
      edu_open: "Open",
      edu_open_named: "Open {title}",
      edu_opening: "Opening…",

      edu_step: "Step {n} of {total}",
      edu_progress: "Your progress",
      edu_next: "Next",
      edu_prev: "Back",
      edu_to_quiz: "Go to the questions",
      edu_to_ack: "Go to the confirmation",
      edu_quiz_intro: "Answer every question. You need {n} percent to pass, and some of them have to be right whatever your score.",
      edu_question: "Question {n} of {total}",
      edu_answer_first: "Please choose one answer.",
      edu_send: "Send my answers",
      edu_sending: "Sending…",

      edu_pass_title: "You passed",
      edu_fail_title: "Almost there",
      edu_fail_title_zero: "Not yet",
      edu_score: "{correct} of {total} answers were right.",
      edu_pass_body: "Thank you for finishing this training. The office has your record.",
      edu_pass_paid: "{n} minutes of paid training time were saved for you.",
      edu_fail_paid: "{n} minutes of paid training time were saved for you for taking this today.",
      edu_fail_body: "Please read it once more and try the questions again. You can take them as many times as you need.",
      edu_review_head: "Please look at this again",
      edu_must_pass: "This one has to be right to pass",
      edu_retake: "Try the questions again",
      edu_read_again: "Read it again",
      edu_back_list: "Back to trainings",

      edu_ack_head: "Your confirmation",
      edu_ack_hint: "Please confirm that you have read the notice.",
      edu_ack_send: "Confirm",
      edu_ack_done_title: "Thank you",
      edu_ack_done_body: "Your confirmation was saved on {date}. Nothing else is kept for a notice: no score and no minutes.",

      edu_offline_read: "You are offline. You can read this now, and send your answers when you are back online.",
      edu_offline_read_notice: "You are offline. You can read this now, and confirm it when you are back online.",
      edu_offline_quiz: "You are offline. You can read the questions, and send your answers when you are back online.",
      edu_offline_send: "You are offline, so your answers were not sent. Nothing was lost. Please connect and send them again.",
      edu_offline_ack: "You are offline, so your confirmation was not sent. Please connect and confirm again.",
      edu_err_pack: "We could not load this training. Please check your internet and try again.",
      edu_err_list: "We could not load your trainings. Please check your internet and try again.",
      edu_err_changed: "This training was updated. Please open it again.",
      edu_err_gone: "This training is not waiting for you any more.",
      edu_err_already: "This training is already finished.",
      edu_err_session: "You were on this screen for a while. Please open the training again.",
      edu_err_notready: "This training is not ready yet. The office has been told.",
      edu_err_send: "Your answers were not sent. Please try again in a moment."
    },
    es: {
      edu_intro: "Aquí están sus capacitaciones. Puede tomarlas en inglés o en español.",
      edu_none_title: "Nada pendiente por ahora",
      edu_none_body: "No tiene capacitaciones pendientes. Le avisaremos aquí cuando haya una.",
      edu_list_head: "Para usted",
      edu_course: "Curso",
      edu_notice: "Aviso de seguridad",
      edu_status_todo: "Sin empezar",
      edu_status_not_passed: "Inténtelo de nuevo",
      edu_status_past_due: "Vencida",
      edu_status_done: "Terminada",
      edu_due: "Para el {date}",
      edu_finished_on: "Terminada el {date}",
      edu_minutes_about: "Unos {n} minutos",
      edu_open: "Abrir",
      edu_open_named: "Abrir {title}",
      edu_opening: "Abriendo…",

      edu_step: "Paso {n} de {total}",
      edu_progress: "Su avance",
      edu_next: "Siguiente",
      edu_prev: "Atrás",
      edu_to_quiz: "Ir a las preguntas",
      edu_to_ack: "Ir a la confirmación",
      edu_quiz_intro: "Responda todas las preguntas. Necesita {n} por ciento para aprobar, y algunas tienen que estar bien sin importar su calificación.",
      edu_question: "Pregunta {n} de {total}",
      edu_answer_first: "Por favor elija una respuesta.",
      edu_send: "Enviar mis respuestas",
      edu_sending: "Enviando…",

      edu_pass_title: "Aprobó",
      edu_fail_title: "Casi lo logra",
      edu_fail_title_zero: "Todavía no",
      edu_score: "{correct} de {total} respuestas estuvieron bien.",
      edu_pass_body: "Gracias por terminar esta capacitación. La oficina ya tiene su registro.",
      edu_pass_paid: "Se guardaron {n} minutos de capacitación pagada para usted.",
      edu_fail_paid: "Se guardaron {n} minutos de capacitación pagada para usted por tomarla hoy.",
      edu_fail_body: "Por favor léala una vez más y vuelva a intentar las preguntas. Puede intentarlo las veces que necesite.",
      edu_review_head: "Por favor repase esto",
      edu_must_pass: "Esta tiene que estar bien para aprobar",
      edu_retake: "Intentar las preguntas de nuevo",
      edu_read_again: "Leerla de nuevo",
      edu_back_list: "Volver a capacitaciones",

      edu_ack_head: "Su confirmación",
      edu_ack_hint: "Por favor confirme que leyó el aviso.",
      edu_ack_send: "Confirmar",
      edu_ack_done_title: "Gracias",
      edu_ack_done_body: "Su confirmación se guardó el {date}. De un aviso no se guarda nada más: ni calificación ni minutos.",

      edu_offline_read: "Está sin conexión. Puede leerla ahora y enviar sus respuestas cuando vuelva a tener conexión.",
      edu_offline_read_notice: "Está sin conexión. Puede leerlo ahora y confirmarlo cuando vuelva a tener conexión.",
      edu_offline_quiz: "Está sin conexión. Puede leer las preguntas y enviar sus respuestas cuando vuelva a tener conexión.",
      edu_offline_send: "Está sin conexión, así que sus respuestas no se enviaron. No se perdió nada. Por favor conéctese y envíelas de nuevo.",
      edu_offline_ack: "Está sin conexión, así que su confirmación no se envió. Por favor conéctese y confirme de nuevo.",
      edu_err_pack: "No pudimos cargar esta capacitación. Por favor revise su internet e inténtelo de nuevo.",
      edu_err_list: "No pudimos cargar sus capacitaciones. Por favor revise su internet e inténtelo de nuevo.",
      edu_err_changed: "Esta capacitación se actualizó. Por favor ábrala de nuevo.",
      edu_err_gone: "Esta capacitación ya no está pendiente para usted.",
      edu_err_already: "Esta capacitación ya está terminada.",
      edu_err_session: "Pasó un rato en esta pantalla. Por favor abra la capacitación de nuevo.",
      edu_err_notready: "Esta capacitación todavía no está lista. Ya se avisó a la oficina.",
      edu_err_send: "Sus respuestas no se enviaron. Por favor inténtelo de nuevo en un momento."
    }
  };

  var I = root.CCC_I18N;
  if (!I || !I.strings) return;
  ["en", "es"].forEach(function (lang) {
    Object.keys(EDU[lang]).forEach(function (key) {
      I.strings[lang][key] = EDU[lang][key];
    });
  });
  root.CCC_EDU_I18N = EDU; // tests/web/edu.html reads this to check the two tables match
})(window);
