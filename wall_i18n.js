/* CCC Team Portal "Team wall" strings (0.5.0), lazily loaded with wall.js and wall.css.
 * Contract: CleanerPortal_design/wall/WALL_SPEC.md.
 *
 * Part of the Wall bundle: these three files are fetched only when somebody opens the tile on home,
 * never at sign in. The two tile strings are the exception and live in web/i18n.js, because home
 * draws the tile before this file exists.
 *
 * Copy rules, the same as web/i18n.js: no em dash, no en dash, and no hyphen used as a dash.
 * Spanish never names a gender.
 *
 * THE RULES SCREEN IS THE MOST IMPORTANT COPY IN THIS FILE, and it is worth saying why. The backend
 * cannot see inside a photograph, so no code anywhere can stop somebody posting a picture taken in
 * a client's kitchen. These words and the office's take down button are the whole of that rule.
 * They are written to be read by somebody standing in a hallway holding a phone, which is why they
 * are short, concrete, and say what to do rather than what not to be.
 */
(function (root) {
  "use strict";

  var ROWS = [
    ["wall_title", "Team wall", "Muro del equipo"],
    ["wall_intro",
      "What the team is up to, across every region.",
      "Lo que está haciendo el equipo, en todas las regiones."],

    /* The region filter. "All" first, then the regions, which come from the backend. */
    ["wall_all", "All", "Todas"],
    ["wall_filter_label", "Show", "Mostrar"],
    ["wall_tag_clear", "Clear", "Quitar"],
    ["wall_showing_tag", "Showing #{tag}", "Mostrando #{tag}"],

    /* Posting. */
    ["wall_post_open", "Post something", "Publicar algo"],
    ["wall_post_head", "Post to the wall", "Publicar en el muro"],
    ["wall_post_hint",
      "A line about your day, your team, or something worth showing.",
      "Una línea sobre su día, su equipo, o algo que valga la pena mostrar."],
    ["wall_post_photo", "Add a photo", "Agregar una foto"],
    ["wall_post_photo_change", "Change the photo", "Cambiar la foto"],
    ["wall_post_photo_remove", "Remove the photo", "Quitar la foto"],
    ["wall_post_send", "Post", "Publicar"],
    ["wall_post_cancel", "Cancel", "Cancelar"],
    ["wall_post_sending", "Posting", "Publicando"],
    ["wall_post_left", "{n} left", "quedan {n}"],

    /* What the wall says when there is nothing to show. */
    ["wall_none_title", "Nothing here yet", "Todavía no hay nada"],
    ["wall_none_body",
      "Be the first. A photo of your team at the end of a hard week does more than you think.",
      "Sea la primera persona. Una foto de su equipo al final de una semana dura hace más de lo que parece."],
    ["wall_none_region", "Nothing from here yet.", "Todavía no hay nada de aquí."],
    ["wall_none_tag", "No posts with that tag.", "No hay publicaciones con esa etiqueta."],
    ["wall_more", "Show older", "Ver más antiguas"],

    /* Reactions. The six, named for a screen reader. */
    ["wall_react_heart", "Love this", "Me encanta"],
    ["wall_react_clap", "Well done", "Bien hecho"],
    ["wall_react_party", "Celebrate", "Celebrar"],
    ["wall_react_laugh", "Funny", "Divertido"],
    ["wall_react_fire", "Amazing", "Increíble"],
    ["wall_react_strong", "Strong work", "Qué fuerza"],
    ["wall_react_count", "{n} reacted", "{n} reaccionaron"],

    /* The office only control. */
    ["wall_hide", "Take this down", "Quitar esto"],
    ["wall_hide_sure",
      "Take this down for everybody? It stays in the office record.",
      "¿Quitar esto para todos? Queda en el registro de la oficina."],
    ["wall_hidden", "Taken down", "Se quitó"],

    /* Errors, in the plain words of the rest of the app. */
    ["wall_err_send", "That did not send. Try again.", "No se pudo enviar. Intente otra vez."],
    ["wall_err_list", "The wall could not be loaded.", "No se pudo cargar el muro."],
    ["wall_err_long", "That is too long for one post.", "Eso es muy largo para una publicación."],
    ["wall_err_empty", "Write something, or add a photo.", "Escriba algo, o agregue una foto."],
    ["wall_err_posts",
      "That is enough posts for one day. Try again tomorrow.",
      "Son suficientes publicaciones por hoy. Intente mañana."],
    ["wall_err_photos",
      "That is enough photos for one day. Try again tomorrow.",
      "Son suficientes fotos por hoy. Intente mañana."],
    ["wall_err_photo_off",
      "Photos are off for the wall right now.",
      "Las fotos están apagadas en el muro por ahora."],

    /* ---- The rules, read once before the first post ---- */
    ["wall_rules_head", "Before you post", "Antes de publicar"],
    ["wall_rules_intro",
      "The wall is for the team. Four rules, and the first one matters most.",
      "El muro es para el equipo. Cuatro reglas, y la primera es la que más importa."],

    ["wall_rules_1_head", "Nothing from inside a home you clean", "Nada de adentro de una casa que limpia"],
    ["wall_rules_1_body",
      "No photo taken inside a client's property. Not the kitchen you just finished, not the view from the window, not the dog. The people who hire us trust us with their homes, and a photo of one on 86 phones is the kind of thing that ends a contract.",
      "Ninguna foto tomada dentro de la propiedad de un cliente. Ni la cocina que acaba de terminar, ni la vista desde la ventana, ni el perro. Las personas que nos contratan nos confían sus casas, y una foto de una de ellas en 86 teléfonos es de las cosas que terminan un contrato."],

    ["wall_rules_2_head", "People who said yes", "Personas que dijeron que sí"],
    ["wall_rules_2_body",
      "Post photos of teammates who are happy to be in them. Never a guest, never a client, never a child, and never somebody who has not agreed.",
      "Publique fotos de compañeras y compañeros que están contentos de salir en ellas. Nunca un huésped, nunca un cliente, nunca un niño, y nunca alguien que no haya dado permiso."],

    ["wall_rules_3_head", "No addresses, no codes, no names of clients", "Sin direcciones, sin códigos, sin nombres de clientes"],
    ["wall_rules_3_body",
      "The same rule as messages. No address, no door code, no lock code, no client name, no guest name.",
      "La misma regla que en los mensajes. Sin dirección, sin código de puerta, sin código de cerradura, sin nombre de cliente, sin nombre de huésped."],

    ["wall_rules_4_head", "This is not work", "Esto no es trabajo"],
    ["wall_rules_4_body",
      "Posting is yours to do or not do. Nobody is counted, nobody is measured, and nobody has to look. It is here because six states is a lot of distance and this makes it smaller.",
      "Publicar es cosa suya. A nadie se le cuenta, a nadie se le mide, y nadie tiene que mirar. Está aquí porque seis estados son mucha distancia y esto la hace más corta."],

    ["wall_rules_kept",
      "The office reads the wall and can take anything down. Nothing is ever really deleted.",
      "La oficina lee el muro y puede quitar cualquier cosa. Nada se borra de verdad."],
    ["wall_rules_ok", "I understand", "Entiendo"],

    /* Descriptions for a screen reader. */
    ["wall_photo_alt", "A photo posted by {name}", "Una foto publicada por {name}"],
    ["wall_photo_gone", "The photo could not be loaded.", "No se pudo cargar la foto."],
    ["wall_photo_open", "Open the photo", "Abrir la foto"],
    ["wall_photo_close", "Close the photo", "Cerrar la foto"],
    ["wall_photo_big", "The photo, full size", "La foto, en tamaño completo"]
  ];

  var strings = root.CCC_I18N && root.CCC_I18N.strings;
  if (!strings) return;
  ROWS.forEach(function (r) {
    strings.en[r[0]] = r[1];
    strings.es[r[0]] = r[2];
  });
  root.CCC_WALL_I18N = ROWS; // tests/web/wall.html reads this to check both languages
})(window);
