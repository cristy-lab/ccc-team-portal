/* Push strings (0.3.7): key, English, Spanish (usted, for the office's proofread). No dashes. The add to
   home screen card's five lines moved here from web/i18n.js unchanged. */
(function (root) {
  "use strict";

  var ROWS = [
    ["a2hs_title", "Add the portal to your home screen", "Agregue el portal a su pantalla de inicio"],
    ["a2hs_android", "Open it with one tap, like an app.", "Ábralo con un solo toque, como una aplicación."],
    ["a2hs_install", "Install", "Instalar"],
    ["a2hs_ios", "Tap the Share button, then tap Add to Home Screen.", "Toque el botón Compartir y luego toque Agregar a inicio."],
    ["a2hs_dismiss", "Not now", "Ahora no"],
    ["push_head", "Notifications", "Notificaciones"],
    ["push_title", "Turn on notifications", "Active las notificaciones"],
    ["push_body", "Get a notice on this phone when someone writes to you. The notice says who wrote, never the message.",
      "Reciba un aviso en este teléfono cuando alguien le escriba. El aviso dice quién escribió, nunca el mensaje."],
    ["push_btn", "Turn on notifications", "Activar notificaciones"],
    ["push_working", "Turning on", "Activando"],
    ["push_on", "Notifications are on for this phone.", "Las notificaciones están activadas en este teléfono."],
    ["push_off_done", "Notifications are off for this phone.", "Las notificaciones están desactivadas en este teléfono."],
    ["push_off", "Turn off notifications", "Desactivar notificaciones"],
    ["push_test", "Send a test notification", "Enviar una notificación de prueba"],
    ["push_sent", "Sent. It should arrive in a few seconds.", "Enviada. Debería llegar en unos segundos."],
    ["push_again", "Turn on notifications again.", "Active las notificaciones otra vez."],
    ["push_limit", "You can send more tests tomorrow.", "Puede enviar más pruebas mañana."],
    ["push_test_failed", "The test was not sent. Please try again later.", "La prueba no se envió. Por favor, intente de nuevo más tarde."],
    ["push_denied", "Notifications were not turned on.", "Las notificaciones no se activaron."],
    ["push_failed", "Notifications could not be turned on. Check your connection and try again.",
      "No se pudieron activar las notificaciones. Revise su conexión e intente de nuevo."],
    ["push_retry", "Try again", "Intentar de nuevo"],
    ["push_unavailable", "Notifications are not available yet.", "Las notificaciones todavía no están disponibles."],
    ["push_old_ios", "Notifications need iOS 16.4 or later. Update your iPhone in Settings, General, Software Update.",
      "Las notificaciones necesitan iOS 16.4 o posterior. Actualice su iPhone en Configuración, General, Actualización de software."],
    ["push_unsupported", "This browser cannot show notifications. On Android, use Chrome. On iPhone, add the app to your home screen.",
      "Este navegador no puede mostrar notificaciones. En Android, use Chrome. En iPhone, agregue la app a su pantalla de inicio."],
    ["push_blocked", "Notifications are blocked for this app on this phone. To allow them, open your phone's Settings, find CCC Team, and turn on Notifications.",
      "Las notificaciones están bloqueadas para esta app en este teléfono. Para permitirlas, abra la Configuración de su teléfono, busque CCC Team y active las Notificaciones."],
    // 0.4.4: how many of her phones get her notices, and a way to end the ones she is not holding.
    ["push_phones_one", "This is the only phone that gets your notices.",
      "Este es el único teléfono que recibe sus avisos."],
    ["push_phones_many", "{n} phones get your notices. If one of them is not yours, end it here.",
      "{n} teléfonos reciben sus avisos. Si alguno no es suyo, termínelo aquí."],
    ["push_phones_end", "End the other phones", "Terminar los otros teléfonos"],
    ["push_phones_ended", "Only this phone gets your notices now.",
      "Ahora solo este teléfono recibe sus avisos."],
    ["push_inbox", "Inbox notices on this phone", "Avisos de la bandeja de entrada en este teléfono"],
    ["push_groups", "Group chat notices on this phone", "Avisos de los chats de grupo en este teléfono"],
    ["push_ios_title", "Add the app to your home screen first", "Primero agregue la app a su pantalla de inicio"],
    ["push_ios_body", "On iPhone and iPad, notifications work only in the app on your home screen, with iOS 16.4 or later.",
      "En iPhone y iPad, las notificaciones solo funcionan en la app de su pantalla de inicio, con iOS 16.4 o posterior."],
    ["push_ios_1", "Open this page in Safari.", "Abra esta página en Safari."],
    ["push_ios_2", "Tap the Share button. On iOS 26, tap the three dots first, then Share.",
      "Toque el botón Compartir. En iOS 26, toque primero los tres puntos y luego Compartir."],
    ["push_ios_3", "Tap Add to Home Screen. If you see Open as Web App, leave it on. Then tap Add.",
      "Toque Agregar a inicio. Si ve Abrir como app web, déjelo activado. Luego toque Agregar."],
    ["push_ios_4", "Open CCC Team from your home screen, sign in, and tap Turn on notifications.",
      "Abra CCC Team desde su pantalla de inicio, inicie sesión y toque Activar notificaciones."],
    ["push_ios_more", "Show me how", "Muéstreme cómo"]
  ];

  var strings = root.CCC_I18N && root.CCC_I18N.strings;
  if (!strings) return;
  ROWS.forEach(function (r) {
    strings.en[r[0]] = r[1];
    strings.es[r[0]] = r[2];
  });
})(window);
