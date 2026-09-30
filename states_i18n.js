/* CCC Team Portal "Where we work" strings (0.4.0), lazily loaded with states.js and states.css.
 *
 * Part of the States bundle: these three files are fetched only when somebody opens the link on
 * home, never at sign in (README, "Size budgets").
 *
 * The five state names are NOT here. They live in web/i18n.js as state_ca to state_tn, because
 * My requests needs them too, so the name of a state is written once in the whole app.
 *
 * Copy rules, the same as web/i18n.js: no em dash, no en dash, and no hyphen used as a dash.
 * English stays short and plain. Spanish uses "usted" everywhere and never names a gender.
 *
 * Why the ladder is written out in words. The ladder pictures are the company's own art and
 * cannot be edited, and every word inside them is English. Most of this team reads Spanish. So the
 * picture is decoration and the six steps, the line above them and the line below them are all real
 * text on the screen, in both languages. A Spanish reader loses nothing to the picture.
 *
 * tests/web/states.html checks that every row has both languages and that none of them has a dash.
 */
(function (root) {
  "use strict";

  var ROWS = [
    ["ww_title", "Where we work", "Dónde trabajamos"],

    // The invitation. These three are the whole point of the screen: they are warm, they name the
    // people Cristy named, and they promise nothing. Do not shorten them in a size squeeze without
    // saying so in the release notes.
    ["ww_intro_head", "The states where we work today", "Los estados donde trabajamos hoy"],
    ["ww_intro_1",
      "These are the five states where Cristal Clear Cleaning works today.",
      "Estos son los cinco estados donde Cristal Clear Cleaning trabaja hoy."],
    ["ww_intro_2",
      "If you clean our clients' properties and you have been thinking about a different state, you can tell us. Telling us means one thing only: the office knows, so when work opens in that state we can think of you.",
      "Si usted limpia las propiedades de nuestros clientes y ha estado pensando en otro estado, nos lo puede decir. Decirlo significa una sola cosa: la oficina lo sabe, y cuando se abra trabajo en ese estado podemos pensar en usted."],
    ["ww_intro_3",
      "This is not an offer of work and it changes nothing about your pay, your hours or where you work now. Nothing happens until someone from the office talks with you.",
      "Esto no es una oferta de trabajo y no cambia nada de su pago, sus horas ni el lugar donde trabaja ahora. No pasa nada hasta que alguien de la oficina hable con usted."],

    // The panels.
    ["ww_open", "Open", "Abrir"],
    ["ww_close", "Close", "Cerrar"],
    ["ww_open_state", "Open {state}", "Abrir {state}"],
    ["ww_close_state", "Close {state}", "Cerrar {state}"],
    ["ww_your_state", "This is where you work now", "Aquí es donde usted trabaja ahora"],
    ["ww_photos", "Pictures of {state}", "Fotos de {state}"],
    ["ww_photo_missing", "Picture of {state}", "Foto de {state}"],
    // The strip shows one picture at a time on a phone and nothing moves by itself, so this line is
    // how a person learns the other four are there.
    ["ww_photo_count", "Five pictures. Slide sideways to see the rest.",
      "Cinco fotos. Deslice de lado para ver las demás."],
    // Only the photographs come from Pexels. The ladder pictures are the company's own art, and a
    // credit under all of them would say something untrue about those five.
    ["ww_credits", "The state photographs are from Pexels. The career ladder pictures are our own.",
      "Las fotografías de los estados son de Pexels. Las imágenes de la escalera de carrera son nuestras."],

    // The ladder. ww_ladder_same and ww_ladder_club are the other two lines the picture carries, so
    // a Spanish reader gets everything the picture says, not only the six steps.
    ["ww_ladder_head", "Grow your career with us", "Crezca en su carrera con nosotros"],
    ["ww_ladder_same",
      "The same team, with bigger chances. Everybody starts at the bottom and can keep going up.",
      "El mismo equipo, con más oportunidades. Todos empiezan abajo y pueden seguir subiendo."],
    ["ww_ladder_club",
      "Welcome to the Diamond Club, where excellence shines.",
      "Le damos la bienvenida al Club del Diamante, donde brilla la excelencia."],
    ["ww_ladder_note",
      "The words in this picture are in English. Here are the six steps.",
      "Las palabras de esta imagen están en inglés. Aquí están los seis pasos."],
    // Only a Spanish reader sees this line, and only where the picture is actually on the screen.
    // In English it repeated the step's own name word for word, six times in every panel.
    ["ww_ladder_in_image", "in the picture: {name}", "en la imagen: {name}"],
    ["ww_ladder_foot",
      "These are the steps in the picture. They show how the work can grow here. This is not a list of open positions.",
      "Estos son los pasos de la imagen. Muestran cómo puede crecer el trabajo aquí. No es una lista de puestos disponibles."],

    // The six steps. The Spanish name is the level and not the person ("Supervisión", not
    // "Supervisor o supervisora"), for the same reason web/status_i18n.js avoids "empleado": the
    // Roster holds no gender and most of this company is women. The picture's own English name is
    // never translated, so a Spanish reader can match the row to the picture.
    ["ww_step1_name", "Cleaner", "Limpieza"],
    ["ww_step1_image", "Cleaner", "Cleaner"],
    ["ww_step1_line",
      "You clean the properties the company looks after and leave each one ready for the next guest.",
      "Usted limpia las propiedades que la compañía atiende y deja cada una lista para el próximo huésped."],
    ["ww_step2_name", "Inspector", "Inspección"],
    ["ww_step2_image", "Inspector", "Inspector"],
    ["ww_step2_line",
      "You check a property after the clean and report what still needs attention before the guest arrives.",
      "Usted revisa la propiedad después de la limpieza y reporta lo que todavía falta antes de que llegue el huésped."],
    ["ww_step3_name", "Supervisor", "Supervisión"],
    ["ww_step3_image", "Supervisor", "Supervisor"],
    ["ww_step3_line",
      "You lead the team of a region and answer their questions during the day.",
      "Usted guía al equipo de una región y responde sus preguntas durante el día."],
    ["ww_step4_name", "Director of Supervisors", "Dirección de supervisión"],
    ["ww_step4_image", "Director of Supervisors", "Director of Supervisors"],
    ["ww_step4_line",
      "You lead the supervisors of more than one region and keep the way they work the same.",
      "Usted guía a la supervisión de varias regiones y mantiene igual la forma de trabajar."],
    ["ww_step5_name", "Operation Manager", "Gerencia de operaciones"],
    ["ww_step5_image", "Operation Manager", "Operation Manager"],
    ["ww_step5_line",
      "You run the day to day of a whole region, the schedules, the people and the supplies.",
      "Usted maneja el día a día de toda una región, los horarios, las personas y los materiales."],
    ["ww_step6_name", "Portfolio Manager", "Gerencia de portafolio"],
    ["ww_step6_image", "Portfolio Manager", "Portfolio Manager"],
    ["ww_step6_line",
      "You look after a group of clients and their properties, and the office plans the work with you.",
      "Usted cuida un grupo de clientes y sus propiedades, y la oficina planea el trabajo con usted."],

    // The button and its answers. ww_sent_note is not decoration: it is the line that keeps a "yes"
    // from reading as a yes from the company. It shows under ww_sent and under ww_already.
    // The button names the state it is about: at 320 px it sits more than three screens below the
    // heading that names it, and a screen reader would otherwise read five identical buttons.
    ["ww_send_state", "Tell the office I would consider {state}",
      "Decirle a la oficina que consideraría {state}"],
    ["ww_sending", "Sending…", "Enviando…"],
    // The request number came OUT of these two sentences in 0.4.1, and nothing else about them
    // changed. It is drawn on its own line above them now, because the owner of the company read
    // "Noted. The office has this. Your request number is R10004." and reported that the screen
    // was not giving her a request number.
    ["ww_sent", "Noted. The office has this.", "Anotado. La oficina lo tiene."],
    ["ww_already", "The office already has this for {state}.",
      "La oficina ya tiene esto para {state}."],
    // The state this person already works in gets no button: there is nothing to tell the office.
    ["ww_your_state_note",
      "You already work here, so there is nothing to tell the office about this one.",
      "Usted ya trabaja aquí, así que no hay nada que decirle a la oficina sobre este estado."],
    ["ww_sent_note",
      "Nothing changes for you today. If work opens there, someone from the office will write or call.",
      "Hoy no cambia nada para usted. Si se abre trabajo allá, alguien de la oficina le va a escribir o llamar."],
    ["ww_offline", "You are offline. You can send this when you are back online.",
      "Está sin internet. Puede enviar esto cuando vuelva a tener internet."],
    ["ww_err_state", "We could not read which state that was. Please try again.",
      "No pudimos leer cuál estado era. Intente otra vez."],
    ["ww_err_rate", "You sent a lot of these today. Please try again later.",
      "Hoy envió muchos de estos. Intente más tarde."],
    ["ww_err_setup", "This is not ready yet. Please tell the office.",
      "Esto todavía no está listo. Avísele a la oficina."],

    // What the work is like, per state. Written from what the company actually does, with no
    // invented detail, and with no client, property, address, building, rate or person's name.
    // Every one of these ten sentences is waiting for Cristy to confirm (README, pending items).
    ["ww_ca_work",
      "In California the team works in Santa Barbara, in short stay homes near the coast and in co living buildings where rooms and shared areas are cleaned through the week. Inspections are part of the work here.",
      "En California el equipo trabaja en Santa Barbara, en casas de estancia corta cerca de la costa y en edificios de vivienda compartida donde se limpian los cuartos y las áreas comunes durante la semana. Las inspecciones son parte del trabajo aquí."],
    ["ww_fl_work",
      "Florida is the largest part of the company. The team works in Jacksonville and St. Augustine in the north and in the Miami and Fort Lauderdale area in the south. The work is mostly cleaning between guests.",
      "Florida es la parte más grande de la compañía. El equipo trabaja en Jacksonville y St. Augustine en el norte, y en el área de Miami y Fort Lauderdale en el sur. El trabajo es sobre todo la limpieza entre huéspedes."],
    ["ww_ga_work",
      "In Georgia the team works in Athens, a university town in the north of the state. It is a small team and the work is cleaning between guests.",
      "En Georgia el equipo trabaja en Athens, una ciudad universitaria en el norte del estado. Es un equipo pequeño y el trabajo es la limpieza entre huéspedes."],
    ["ww_hi_work",
      "In Hawaii the team works in Honolulu, on Oahu, in short stay units. There are daily checks there as well as cleans between guests.",
      "En Hawái el equipo trabaja en Honolulu, en Oahu, en unidades de estancia corta. Allá hay revisiones diarias además de las limpiezas entre huéspedes."],
    ["ww_tn_work",
      "In Tennessee the team works in Memphis, on the Mississippi river. It is a small team and the work is cleaning between guests.",
      "En Tennessee el equipo trabaja en Memphis, a orillas del río Mississippi. Es un equipo pequeño y el trabajo es la limpieza entre huéspedes."],

    // What each photograph shows, in a short sentence. It never repeats a caption and never says
    // "photo of". The record of where every one of them came from is a business record and is kept
    // outside this project, because everything in web/ is served to anybody who asks for it.
    ["ww_ca_alt1", "The Santa Barbara waterfront with the mountains behind it at sunset.",
      "La costa de Santa Barbara con las montañas detrás al atardecer."],
    ["ww_ca_alt2", "A Santa Barbara beach with a long row of palms and the mountains behind.",
      "Una playa de Santa Barbara con una fila larga de palmas y las montañas detrás."],
    ["ww_ca_alt3", "Palm trees standing against the hills in soft light.",
      "Palmas altas frente a las colinas con luz suave."],
    ["ww_ca_alt4", "A boat crossing the water off Santa Barbara at sunset.",
      "Un barco cruzando el agua frente a Santa Barbara al atardecer."],
    ["ww_ca_alt5", "The sun going down over the shoreline at Santa Barbara.",
      "El sol bajando sobre la orilla del mar en Santa Barbara."],
    ["ww_fl_alt1", "The Jacksonville skyline and the Main Street Bridge over the St. Johns river.",
      "El horizonte de Jacksonville y el puente Main Street sobre el río St. Johns."],
    ["ww_fl_alt2", "The old stone fort at St. Augustine looking out over the water.",
      "El antiguo fuerte de piedra de St. Augustine frente al agua."],
    ["ww_fl_alt3", "The Atlantic surf and the pier at Jacksonville Beach under a storm sky.",
      "Las olas del Atlántico y el muelle de Jacksonville Beach bajo un cielo de tormenta."],
    ["ww_fl_alt4", "The Miami skyline seen across the bay.",
      "El horizonte de Miami visto desde el otro lado de la bahía."],
    ["ww_fl_alt5", "Open Everglades wetland under a wide blue sky.",
      "Los humedales abiertos de los Everglades bajo un cielo azul y amplio."],
    ["ww_ga_alt1", "Forested ridges rolling away in the north Georgia mountains.",
      "Cerros cubiertos de bosque en las montañas del norte de Georgia."],
    ["ww_ga_alt2", "A waterfall dropping into the pool below it at Tallulah Falls.",
      "Una cascada cayendo en la poza de abajo en Tallulah Falls."],
    ["ww_ga_alt3", "A wind bent pine on a rock ledge above a north Georgia valley.",
      "Un pino doblado por el viento sobre una roca encima de un valle del norte de Georgia."],
    ["ww_ga_alt4", "Autumn trees reflected in still water at Blue Ridge.",
      "Árboles de otoño reflejados en el agua quieta en Blue Ridge."],
    ["ww_ga_alt5", "A quiet lake below a forested hill in north Georgia.",
      "Un lago tranquilo al pie de un cerro con bosque en el norte de Georgia."],
    ["ww_hi_alt1", "Diamond Head and the reef water along the Honolulu shoreline.",
      "Diamond Head y el agua del arrecife a lo largo de la costa de Honolulu."],
    ["ww_hi_alt2", "Diamond Head from above with the ocean beyond it.",
      "Diamond Head desde arriba con el océano detrás."],
    ["ww_hi_alt3", "The windward coast of Oahu where the cliffs meet the sea.",
      "La costa de barlovento de Oahu donde los acantilados llegan al mar."],
    ["ww_hi_alt4", "A turquoise bay curving in under a green headland.",
      "Una bahía turquesa que se curva bajo un cerro verde."],
    ["ww_hi_alt5", "Honolulu and the coast seen from the top of the Diamond Head crater.",
      "Honolulu y la costa vistas desde lo alto del cráter de Diamond Head."],
    ["ww_tn_alt1", "Downtown Memphis with the Mississippi river behind it.",
      "El centro de Memphis con el río Mississippi detrás."],
    ["ww_tn_alt2", "The bridge over the Mississippi at Memphis in evening light.",
      "El puente sobre el Mississippi en Memphis con la luz de la tarde."],
    ["ww_tn_alt3", "A river running through green mountains in east Tennessee.",
      "Un río corriendo entre montañas verdes en el este de Tennessee."],
    ["ww_tn_alt4", "Mist lying over forested ridges at sunrise.",
      "Neblina sobre cerros con bosque al amanecer."],
    ["ww_tn_alt5", "Cloud in the valleys of the Smoky Mountains over autumn forest.",
      "Nubes en los valles de las Smoky Mountains sobre el bosque de otoño."],

    // The ladder picture's own alt text is short on purpose: the same information is written out as
    // real text right below it, and a long alt would be read twice. The picture is decoration and
    // the list is the information. Each one names what makes that state's version different.
    // Georgia's line was missing until September 29, 2026, because its picture was held back: the
    // flag in that artwork was the University of Georgia's mark and this site is public. Cristy
    // chose the plain gold flag the other ladders fly, the picture was repainted and it ships, so
    // the alt text is here like everybody else's.
    ["ww_ca_ladder_alt",
      "The Cristal Clear Cleaning career ladder, drawn as a path up a hill above a palm coast. The six steps are written out below.",
      "La escalera de carrera de Cristal Clear Cleaning, dibujada como un camino que sube un cerro sobre una costa de palmas. Los seis pasos están escritos abajo."],
    ["ww_fl_ladder_alt",
      "The Cristal Clear Cleaning career ladder, drawn as a path up a hill above a long beach. The six steps are written out below.",
      "La escalera de carrera de Cristal Clear Cleaning, dibujada como un camino que sube un cerro sobre una playa larga. Los seis pasos están escritos abajo."],
    ["ww_ga_ladder_alt",
      "The Cristal Clear Cleaning career ladder, drawn as a path up a hill beside the Athens arch and a town in flower. The six steps are written out below.",
      "La escalera de carrera de Cristal Clear Cleaning, dibujada como un camino que sube un cerro junto al arco de Athens y un pueblo en flor. Los seis pasos están escritos abajo."],
    ["ww_hi_ladder_alt",
      "The Cristal Clear Cleaning career ladder, drawn as a path up a hill above an island shore. The six steps are written out below.",
      "La escalera de carrera de Cristal Clear Cleaning, dibujada como un camino que sube un cerro sobre una orilla isleña. Los seis pasos están escritos abajo."],
    ["ww_tn_ladder_alt",
      "The Cristal Clear Cleaning career ladder, drawn as a path up a hill with a Tennessee signpost and the state flag. The six steps are written out below.",
      "La escalera de carrera de Cristal Clear Cleaning, dibujada como un camino que sube un cerro con un letrero de Tennessee y la bandera del estado. Los seis pasos están escritos abajo."]
  ];

  var strings = root.CCC_I18N && root.CCC_I18N.strings;
  if (!strings) return;
  ROWS.forEach(function (r) {
    strings.en[r[0]] = r[1];
    strings.es[r[0]] = r[2];
  });
  root.CCC_STATES_I18N = ROWS; // tests/web/states.html reads this to check both languages
})(window);
