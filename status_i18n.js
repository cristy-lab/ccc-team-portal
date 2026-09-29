/* CCC Team Portal W2 and 1099 strings (0.3.9), lazily loaded with status.js and status.css.
 *
 * Part of the Status bundle: these three files are fetched only when the owner opens the
 * W2 and 1099 tile, never at sign in, so the 76 phones that can never open that screen never
 * download them (README, "Size budgets").
 *
 * Copy rules, the same as web/i18n.js: no em dash, no en dash, and no hyphen used as a dash.
 * English stays short and plain. Spanish uses "usted" everywhere.
 *
 * The Spanish here avoids calling a person "empleado" or "empleada": the Roster holds no gender,
 * and "el curso de empleado" is the name of the course, not a description of the person. It is
 * waiting for the proofread of README pending item 44.
 *
 * tests/web/status.html checks that every row has both languages and that none of them has a dash.
 */
(function (root) {
  "use strict";

  var ROWS = [
    ["st_title", "W2 and 1099", "W2 y 1099"],

    // The warning. Always on the screen, never dismissible, read before anything is tapped.
    ["st_warning",
      "This switch tells the portal which training a person gets. It does not decide what anybody is under the law. In California the ABC test decides it, Labor Code 2775, and a written agreement does not change the answer. Ask counsel before you change anybody here.",
      "Este interruptor le dice al portal cuál capacitación recibe una persona. No decide lo que alguien es ante la ley. En California lo decide la prueba ABC, Labor Code 2775, y un acuerdo por escrito no cambia la respuesta. Consulte a su abogado antes de cambiar a alguien aquí."],
    ["st_nochange",
      "Changing this does not touch ADP, pay rates, the pay calendar, workers compensation, the onboarding paperwork, Breezeway or monday. Those are still done by a person.",
      "Cambiar esto no toca ADP, ni las tarifas de pago, ni el calendario de pago, ni el seguro de compensación laboral, ni los documentos de ingreso, ni Breezeway ni monday. Eso lo sigue haciendo una persona."],

    // The counts, the search and the groups.
    ["st_counts_label", "The company right now", "La compañía ahora mismo"],
    ["st_count_1099", "1099", "1099"],
    ["st_count_w2", "W2", "W2"],
    ["st_count_blank", "No answer", "Sin respuesta"],
    ["st_people", "{n} active people", "{n} personas activas"],
    ["st_switch_help", "The switch turns W2 on. Off is 1099.",
      "El interruptor activa W2. Apagado es 1099."],
    ["st_inactive_note", "People whose Roster row is not active are not shown here and are not counted.",
      "Las personas cuya fila no está activa no se muestran aquí y no se cuentan."],
    ["st_truncated", "Only the first {n} people are shown. The counts above count everybody.",
      "Solo se muestran las primeras {n} personas. Los números de arriba cuentan a todas."],
    ["st_search_label", "Search by name or region", "Buscar por nombre o región"],
    ["st_search_clear", "Clear the search", "Borrar la búsqueda"],
    ["st_results", "Results: {n}", "Resultados: {n}"],
    ["st_no_results", "Nobody matches that.", "Nadie coincide con eso."],
    ["st_nobody", "Nobody is active right now.", "Ahora mismo no hay nadie activo."],
    ["st_region_count", "{region} ({n})", "{region} ({n})"],
    // True of a state on hold and of a region the portal cannot place, which are two different
    // reasons and read the same here. The read action sends one boolean, so the words say what is
    // happening rather than guessing why.
    ["st_region_held",
      "Nobody in this region is shown a training right now, whatever this says.",
      "Ahora mismo nadie en esta región ve una capacitación, sin importar lo que diga esto."],

    // One person's row.
    // The chips read the same two words as the counts, the records and the buttons. Contractor and
    // Employee made four vocabularies for two states on one screen, and "Empleado" was the one
    // gendered word on it: the Roster holds no gender, and most of the company is women.
    ["st_chip_1099", "1099", "1099"],
    ["st_chip_w2", "W2", "W2"],
    ["st_chip_blank", "No answer", "Sin respuesta"],
    ["st_not_recorded", "Typed in the sheet, not recorded here", "Escrito en la hoja, no registrado aquí"],
    ["st_switch_to_w2", "{name}, 1099. Change to W2.", "{name}, 1099. Cambiar a W2."],
    ["st_switch_to_1099", "{name}, W2. Change to 1099.", "{name}, W2. Cambiar a 1099."],
    ["st_switch_blank", "{name}, no answer yet. Change to W2.",
      "{name}, sin respuesta todavía. Cambiar a W2."],
    ["st_set_1099", "Record as 1099", "Registrar como 1099"],
    // The words on the button, so the accessible name contains the visible label (WCAG 2.5.3) and
    // voice control finds it by what it says.
    ["st_set_1099_named", "{name}, no answer yet. Record as 1099.",
      "{name}, sin respuesta todavía. Registrar como 1099."],
    ["st_switch_self", "This is your own row. Change it in the sheet.",
      "Esta es su propia fila. Cámbiela en la hoja."],

    // The confirmation. It names the person and the date, because this is a payroll event.
    ["st_confirm_w2_title", "Change {name} to W2?", "¿Cambiar a {name} a W2?"],
    ["st_confirm_1099_title", "Change {name} to 1099?", "¿Cambiar a {name} a 1099?"],
    ["st_confirm_w2_body",
      "From {date}, the portal gives {name} the employee course instead of the contractor notice, and counts paid training minutes from that date forward. Trainings they confirmed as a contractor stay what they are, so they take the course fresh. Nothing outside the portal changes. This is a payroll event and it is recorded with your name.",
      "Desde el {date}, el portal le da a {name} el curso de empleado en lugar del aviso para contratistas, y cuenta minutos de capacitación pagados desde esa fecha en adelante. Las capacitaciones que confirmó como contratista siguen siendo lo que son, así que toma el curso desde el principio. Nada fuera del portal cambia. Esto es un evento de nómina y queda registrado con su nombre."],
    ["st_confirm_1099_body",
      "From {date}, the portal gives {name} the contractor notice instead of the employee course, and stops counting paid training minutes. Minutes already recorded stay recorded. Nothing outside the portal changes. This is a payroll event and it is recorded with your name.",
      "Desde el {date}, el portal le da a {name} el aviso para contratistas en lugar del curso de empleado, y deja de contar minutos de capacitación pagados. Los minutos ya registrados siguen registrados. Nada fuera del portal cambia. Esto es un evento de nómina y queda registrado con su nombre."],
    ["st_change_date", "Change the date", "Cambiar la fecha"],
    ["st_date_label", "It started on", "Empezó el"],
    ["st_date_help",
      "Leave this empty for today where that person lives, which can be one day behind yours. Otherwise pick a day from {first} to {last}.",
      "Deje esto vacío para hoy donde vive esa persona, que puede ir un día atrás del suyo. Si no, elija un día entre el {first} y el {last}."],
    ["st_date_help_open",
      "Leave this empty for today where that person lives, which can be one day behind yours. Otherwise pick {last} or an earlier day.",
      "Deje esto vacío para hoy donde vive esa persona, que puede ir un día atrás del suyo. Si no, elija el {last} o un día anterior."],
    ["st_date_clear", "Use the day where they live", "Usar el día donde vive esa persona"],
    ["st_note_label", "Note for the record (optional)", "Nota para el registro (opcional)"],
    ["st_note_left", "{n} characters left", "Quedan {n} caracteres"],
    ["st_confirm_yes", "Yes, change it", "Sí, cambiarlo"],
    ["st_cancel", "Cancel", "Cancelar"],
    ["st_saving", "Saving…", "Guardando…"],

    // After the change, and the errors.
    ["st_done_w2", "{name} is now W2, effective {date}.", "{name} ahora es W2, desde el {date}."],
    ["st_done_1099", "{name} is now 1099, effective {date}.", "{name} ahora es 1099, desde el {date}."],
    ["st_err_changed", "Somebody changed this in the sheet while you were looking. Here is what it says now.",
      "Alguien cambió esto en la hoja mientras usted miraba. Esto es lo que dice ahora."],
    ["st_err_future", "That day has not come yet. Pick today or an earlier day.",
      "Ese día todavía no llega. Elija hoy o un día anterior."],
    ["st_err_old", "That is more than a year ago. The earliest day for this person is {date}. Record anything older in the sheet, with a note.",
      "Eso fue hace más de un año. El día más antiguo para esta persona es el {date}. Registre algo anterior en la hoja, con una nota."],
    ["st_err_inactive", "That person's row is not active. Turn it back on first.",
      "La fila de esa persona no está activa. Actívela primero."],
    ["st_err_before_last", "This person already has a change recorded on {date}. Pick {date} or a later day.",
      "Esta persona ya tiene un cambio registrado el {date}. Elija el {date} o un día posterior."],
    ["st_err_reused", "Something went wrong with this change. Close this and open it again.",
      "Algo salió mal con este cambio. Cierre esto y ábralo de nuevo."],
    ["st_err_notfound", "That person is not on the Roster, or their id is on two rows.",
      "Esa persona no está en la lista, o su id está en dos filas."],
    ["st_err_limit", "That is enough changes for now. Try again later.",
      "Son suficientes cambios por ahora. Intente más tarde."],
    ["st_err_setup", "This screen is not set up yet. Run setup in the Apps Script editor.",
      "Esta pantalla todavía no está lista. Ejecute setup en el editor de Apps Script."],
    ["st_err_not_owner", "Only the person who owns the company can open this screen.",
      "Solo la persona dueña de la compañía puede abrir esta pantalla."],

    // The last ten records.
    ["st_recent", "Recent changes", "Cambios recientes"],
    ["st_recent_line", "{name}, {from} to {to}, effective {date}",
      "{name}, de {from} a {to}, desde el {date}"],
    ["st_recent_start_line", "{name}, {to}, effective {date}", "{name}, {to}, desde el {date}"],
    ["st_recent_start_note",
      "A starting position is where somebody's cell stood on the day the record was opened. It is not a change of what that person is.",
      "Una posición inicial es lo que decía la celda de alguien el día en que se abrió el registro. No es un cambio de lo que esa persona es."],
    ["st_recent_by", "by {name}", "por {name}"],
    ["st_recent_start", "Starting position", "Posición inicial"],
    ["st_recent_none", "No changes yet.", "Todavía no hay cambios."],
    ["st_recent_unsealed", "This row was edited in the sheet. Check it.",
      "Esta fila fue editada en la hoja. Revísela."]
  ];

  var strings = root.CCC_I18N && root.CCC_I18N.strings;
  if (!strings) return;
  ROWS.forEach(function (r) {
    strings.en[r[0]] = r[1];
    strings.es[r[0]] = r[2];
  });
  root.CCC_STATUS_I18N = ROWS; // tests/web/status.html reads this to check both languages
})(window);
