/* CCC Team Portal: the globe (0.4.1). The Globe bundle, with web/globe.css.
 *
 * Why it exists. "Where we work" went live on September 30, 2026 as a text link low on home, under
 * six tiles and under the message from the CEO, and the owner of the company could not find it. A
 * screen nobody opens is the same as a screen that does not exist. The globe replaces that link.
 *
 * WHY SVG AND NOT CANVAS. The pins have to be real buttons: somebody has to be able to reach Hawaii
 * with a keyboard and hear what it is with a screen reader, and a canvas gives you neither without
 * building both again by hand. SVG also stays crisp at any pixel ratio, which matters at 3x.
 *
 * WHY NO LIBRARY. This project vendors exactly one outside thing, the Firebase SDK. The whole of the
 * orthographic projection is the four lines in project() below.
 *
 * WHAT HOME PAYS FOR IT. Nothing that it has to wait for. web/app.js draws a plain circle in the
 * same pass as the greeting, and that circle is already the link: tapping it opens Where we work
 * before a byte of this file exists. This file and web/img/globe/world.json are asked for after home
 * has drawn, on an idle callback. If either never arrives the circle stays a plain sphere and still
 * opens the screen when tapped. There is no spinner, no error and no empty box.
 *
 * THE MODEL. A view is the point of the Earth at the middle of the disc (lon, lat, in degrees), a
 * radius in pixels, and the middle of the disc in pixels. Nothing else. Zoom is the radius.
 */
(function (root) {
  "use strict";

  var doc = root.document;
  var SVGNS = "http://www.w3.org/2000/svg";
  var D2R = Math.PI / 180, R2D = 180 / Math.PI, TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ */
  /* The data file                                                       */
  /* ------------------------------------------------------------------ */

  /* web/img/globe/world.json holds rings as delta encoded integers in quarter degrees, because that
     measured a third of the size of the same outlines as GeoJSON. Points come back as one flat
     array of lon, lat, lon, lat: one allocation per ring instead of one per point, and this runs on
     every frame of a drag. */
  function ring(a, unit) {
    var out = new Array(a.length), lon = a[0], lat = a[1], i;
    out[0] = lon / unit;
    out[1] = lat / unit;
    for (i = 2; i < a.length; i += 2) {
      lon += a[i];
      lat += a[i + 1];
      out[i] = lon / unit;
      out[i + 1] = lat / unit;
    }
    return out;
  }

  /* A world, or null when the file is not the one this code was written for. A globe with no world
     is still a globe: the caller draws a plain sphere and the link still works. */
  function decode(raw) {
    if (!raw || raw.f !== "ccc-globe-1" || !raw.u || !raw.land) return null;
    var u = raw.u, i;
    var out = { land: [], lake: [], pin: {} };
    for (i = 0; i < raw.land.length; i++) out.land.push(ring(raw.land[i], u));
    for (i = 0; raw.lake && i < raw.lake.length; i++) out.lake.push(ring(raw.lake[i], u));
    for (var k in raw.pin) {
      if (Object.prototype.hasOwnProperty.call(raw.pin, k)) out.pin[k] = raw.pin[k];
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* The projection                                                      */
  /* ------------------------------------------------------------------ */

  /* A view with the two numbers that do not change while a ring is drawn worked out once. */
  function view(lon, lat, r, cx, cy) {
    var p0 = lat * D2R;
    return { lon: lon, lat: lat, r: r, cx: cx, cy: cy, sin0: Math.sin(p0), cos0: Math.cos(p0) };
  }

  /* The whole of the orthographic projection. Returns cos(c), the cosine of the angle from the
     middle of the disc to this point: 1 at the middle, 0 exactly on the edge, below 0 on the back of
     the sphere, which is how the back is hidden. x and y are written into out. */
  function project(v, lon, lat, out) {
    var p = lat * D2R, L = (lon - v.lon) * D2R;
    var cp = Math.cos(p), sp = Math.sin(p), cL = Math.cos(L);
    out[0] = v.cx + v.r * cp * Math.sin(L);
    out[1] = v.cy - v.r * (v.cos0 * sp - v.sin0 * cp * cL);
    return v.sin0 * sp + v.cos0 * cp * cL;
  }

  /* cos(c) alone, for deciding whether a pin is on the front of the sphere. */
  function facing(v, lon, lat) {
    var p = lat * D2R, L = (lon - v.lon) * D2R;
    return v.sin0 * Math.sin(p) + v.cos0 * Math.cos(p) * Math.cos(L);
  }

  /* A pixel back to a place on Earth, for a tap that has to land somewhere. False when the pixel is
     off the disc, which is the sky and not the Earth. */
  function unproject(v, x, y, out) {
    var px = (x - v.cx) / v.r, py = -(y - v.cy) / v.r;
    var rho2 = px * px + py * py;
    if (rho2 > 1) return false;
    var cosc = Math.sqrt(1 - rho2);
    out[1] = Math.asin(cosc * v.sin0 + py * v.cos0) * R2D;
    out[0] = v.lon + Math.atan2(px, cosc * v.cos0 - py * v.sin0) * R2D;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Rings to an SVG path                                                */
  /* ------------------------------------------------------------------ */

  /* Where on the segment from a to b the sphere's edge is, as a fraction. cos(c) is very nearly
     straight over one segment of this data, so one step of interpolation plus two of halving is
     inside a third of a pixel, and this runs a few dozen times a frame, not thousands. */
  function crossing(v, lon1, lat1, c1, lon2, lat2, c2) {
    var t = c1 / (c1 - c2), lo = 0, hi = 1, i, c;
    for (i = 0; i < 2; i++) {
      c = facing(v, lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t);
      if (c >= 0) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  /* The point where the coast meets the edge of the sphere, put exactly on the edge. Exactly
     matters: an SVG arc whose end is a whisker outside its own radius is not drawn as asked, it is
     quietly given bigger radii, and the coast bulges. */
  function limbPoint(v, lonIn, latIn, cIn, lonOut, latOut, cOut, pt) {
    var t = crossing(v, lonIn, latIn, cIn, lonOut, latOut, cOut);
    project(v, lonIn + (lonOut - lonIn) * t, latIn + (latOut - latIn) * t, pt);
    var dx = pt[0] - v.cx, dy = pt[1] - v.cy, m = Math.sqrt(dx * dx + dy * dy) || 1;
    pt[0] = v.cx + dx / m * v.r;
    pt[1] = v.cy + dy / m * v.r;
    return Math.atan2(dy, dx);
  }

  function xy(pt) { return pt[0].toFixed(1) + " " + pt[1].toFixed(1); }

  /* How far you travel going one way round the screen from one angle to another, always positive
     and below one whole turn. */
  function roundTo(from, to) {
    var d = (from - to) % TAU;
    return d < 0 ? d + TAU : d;
  }

  /* One ring as SVG path text, with the back of the sphere left out.
   *
   * A coast that runs off the edge of the sphere is cut there, and the gap is closed along the edge
   * itself, never with a straight line across the disc: a straight line would put a flat chord
   * through the middle of Asia every time the globe turned past it.
   *
   * The part that is easy to get wrong, and did get wrong twice before it was measured, is which
   * piece of the edge closes which gap. It is NOT the piece between where this coast went out of
   * sight and where this same coast came back: a landmass can dip behind the sphere several times,
   * and pairing each dip with itself makes one of the arcs take the long way round the whole disc
   * and fill the ocean instead of the land. The rule that works is to treat every crossing as a
   * point on the edge and join each place the coast leaves to the next place any part of it comes
   * back, going round the edge one way. So a ring can come out as more than one closed shape, which
   * is right: North America seen from Africa really is two separate slivers.
   */
  function ringPath(v, flat) {
    var n = flat.length / 2;
    if (n > 2 && flat[0] === flat[(n - 1) * 2] && flat[1] === flat[(n - 1) * 2 + 1]) n -= 1;
    if (n < 3) return "";

    var pt = [0, 0], i, j, d = "";
    var cos = new Array(n);
    var anyFront = false, anyBack = false;
    for (i = 0; i < n; i++) {
      cos[i] = facing(v, flat[i * 2], flat[i * 2 + 1]);
      if (cos[i] >= 0) anyFront = true; else anyBack = true;
    }
    if (!anyFront) return "";

    if (!anyBack) {
      // Wholly in front: the simple case, and the common one for a small island.
      for (i = 0; i < n; i++) {
        project(v, flat[i * 2], flat[i * 2 + 1], pt);
        d += (i ? "L" : "M") + xy(pt);
      }
      return d + "Z";
    }

    // Start the walk on a point that is behind the sphere whose neighbour before it is in front, so
    // the walk begins in the dark and every piece it opens is closed inside one lap.
    var start = -1;
    for (i = 0; i < n; i++) {
      if (cos[i] < 0 && cos[(i + n - 1) % n] >= 0) { start = i; break; }
    }
    if (start < 0) return "";

    // Every run of coast that is in sight, with the angle on the edge where it starts and ends.
    var segs = [], cur = null;
    for (var k = 0; k < n; k++) {
      i = (start + k) % n;
      j = (start + k + 1) % n;
      if (cos[i] >= 0 && cur) {
        project(v, flat[i * 2], flat[i * 2 + 1], pt);
        cur.d += "L" + xy(pt);
      }
      if (cos[i] >= 0 && cos[j] < 0) {
        cur.out = limbPoint(v, flat[i * 2], flat[i * 2 + 1], cos[i],
          flat[j * 2], flat[j * 2 + 1], cos[j], pt);
        cur.d += "L" + xy(pt);
        segs.push(cur);
        cur = null;
      } else if (cos[i] < 0 && cos[j] >= 0) {
        var a = limbPoint(v, flat[j * 2], flat[j * 2 + 1], cos[j],
          flat[i * 2], flat[i * 2 + 1], cos[i], pt);
        cur = { "in": a, out: 0, d: "M" + xy(pt) };
      }
    }
    if (!segs.length) return "";

    // Join each end to the next beginning round the edge, and close each shape that makes.
    var used = new Array(segs.length), s, from, best, bestD, m, x, y;
    for (s = 0; s < segs.length; s++) {
      if (used[s]) continue;
      var at = s;
      d += segs[s].d;
      while (true) {
        used[at] = true;
        from = segs[at].out;
        best = -1;
        bestD = TAU + 1;
        for (m = 0; m < segs.length; m++) {
          if (used[m] && m !== s) continue;
          var gap = roundTo(from, segs[m]["in"]);
          if (gap < bestD) { bestD = gap; best = m; }
        }
        if (best < 0) break;
        x = v.cx + Math.cos(segs[best]["in"]) * v.r;
        y = v.cy + Math.sin(segs[best]["in"]) * v.r;
        d += "A" + v.r + " " + v.r + " 0 " + (bestD > Math.PI ? 1 : 0) + " 0 " +
          x.toFixed(1) + " " + y.toFixed(1);
        if (best === s) break;
        at = best;
        d += segs[best].d.replace("M", "L");
      }
      d += "Z";
    }
    return d;
  }

  /* Every ring of a list as one path, which is one SVG node for a whole continent set. */
  function ringsPath(v, rings) {
    var d = "";
    for (var i = 0; i < rings.length; i++) d += ringPath(v, rings[i]);
    return d;
  }

  /* ------------------------------------------------------------------ */
  /* Hit testing and the finger                                          */
  /* ------------------------------------------------------------------ */

  /* Which pins are on the front of the sphere right now, and where, so the caller can move the five
     buttons. A pin within a small margin of the edge counts as behind, so it does not flicker in and
     out while the globe drifts. */
  function pinPlaces(v, pins, margin) {
    var pt = [0, 0], out = [], m = margin === undefined ? 0.04 : margin;
    for (var code in pins) {
      if (!Object.prototype.hasOwnProperty.call(pins, code)) continue;
      var c = project(v, pins[code][0], pins[code][1], pt);
      out.push({ code: code, x: pt[0], y: pt[1], front: c > m, depth: c });
    }
    return out;
  }

  /* The pin nearest a pixel, inside a radius, or "". A finger is about 9 mm wide, so a caller passes
     at least 22 px: seen from over the United States, Georgia, Tennessee and Florida are within a
     few pixels of each other, and a tap between them has to pick one instead of picking none. */
  function pinAt(v, pins, x, y, radius) {
    var places = pinPlaces(v, pins), best = "", bestD = radius * radius;
    for (var i = 0; i < places.length; i++) {
      var p = places[i];
      if (!p.front) continue;
      var dx = p.x - x, dy = p.y - y, d = dx * dx + dy * dy;
      if (d <= bestD) { bestD = d; best = p.code; }
    }
    return best;
  }

  /* How far the globe turns for one pixel of drag. At the middle of the disc a pixel is (90 / r)
     degrees, so the land under the finger keeps up with the finger. */
  function degPerPx(r) { return 90 / r; }

  /* Drag right and the land goes right, which means the middle of the disc moves west. Drag down and
     the land goes down, which means the middle moves north. Latitude stops at the poles, because
     past the pole the globe would turn over and nobody asked it to. */
  function dragged(v, dx, dy) {
    var k = degPerPx(v.r);
    var lat = v.lat + dy * k;
    if (lat > 90) lat = 90;
    if (lat < -90) lat = -90;
    var lon = wrapLon(v.lon - dx * k);
    return view(lon, lat, v.r, v.cx, v.cy);
  }

  /* Kept inside one turn, so the number does not grow without end while somebody spins it. */
  function wrapLon(lon) {
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return lon;
  }

  /* The short way round from one longitude to another, so turning from Hawaii to Florida goes over
     the United States and not the long way round the back of the Earth. */
  function shortWay(from, to) {
    var d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  var CORE = {
    decode: decode, ring: ring, view: view, project: project, facing: facing, unproject: unproject,
    ringPath: ringPath, ringsPath: ringsPath, pinPlaces: pinPlaces, pinAt: pinAt,
    degPerPx: degPerPx, dragged: dragged, wrapLon: wrapLon, shortWay: shortWay
  };

  /* ------------------------------------------------------------------ */
  /* The words                                                           */
  /* ------------------------------------------------------------------ */

  /* The Globe bundle carries its own lines. The five state names are NOT here: they are state_ca to
     state_tn in web/i18n.js, because My requests and the Where we work list need them too, so the
     name of a state is written once in the whole app. */
  var ROWS = [
    ["gl_label", "The globe of the states where we work",
      "El globo de los estados donde trabajamos"],
    // Every way in, because the hint is the only place any of them is written down: a finger, the
    // two buttons for fingers that do not pinch and for a mouse, and the pins.
    ["gl_hint", "Slide the globe to turn it, or use the plus and the minus. Tap a pin to open that state.",
      "Deslice el globo para girarlo, o use el más y el menos. Toque un punto para abrir ese estado."],
    ["gl_pin", "Open {state} on the globe", "Abrir {state} en el globo"],
    ["gl_in", "Zoom in", "Acercar"],
    ["gl_out", "Zoom out", "Alejar"],
    // Added to the home link's name once this file is here, which is the only moment it is true:
    // until then the link holds a plain ball with nothing on it, and ww_globe_name in web/i18n.js
    // already says the whole of what that ball does.
    ["gl_states", "A globe that turns, with a pin on each of them: {states}.",
      "Un globo que gira, con un punto en cada uno: {states}."]
  ];

  var strings = root.CCC_I18N && root.CCC_I18N.strings;
  if (strings) {
    ROWS.forEach(function (r) { strings.en[r[0]] = r[1]; strings.es[r[0]] = r[2]; });
  }
  root.CCC_GLOBE_I18N = ROWS; // tests/web/globe.html reads this to check both languages

  function P() { return root.CCCPortal; }
  function t(key, vars) { var p = P(); return p ? p.t(key, vars) : key; }
  function reduced() { var p = P(); return p ? p.reduced() : false; }

  /* ------------------------------------------------------------------ */
  /* world.json                                                          */
  /* ------------------------------------------------------------------ */

  /* Where this file was served from, so the data file is found whatever page the app runs on. The
     Apps Script build has no img folder at all, so tools/build_gas_html.py puts the same data in
     window.CCC_GLOBE_WORLD instead and nothing is ever fetched there. */
  var HERE = ((doc.currentScript && doc.currentScript.src) || "").replace(/[^/]*$/, "");
  var world = null, asked = false, waiting = [];

  /* The world, once, to everybody who asks. A caller that asks before it arrives is called back with
     it; a caller that asks after is called back at once. It is never fetched twice, and a fetch that
     fails is not tried again in this app session: the globe is a second way in to a screen that
     works without it, and a phone on a bad signal has better things to spend its radio on. */
  function getWorld(cb) {
    if (world) { cb(world); return; }
    if (root.CCC_GLOBE_WORLD) { world = decode(root.CCC_GLOBE_WORLD); if (world) { cb(world); return; } }
    waiting.push(cb);
    if (asked) return;
    asked = true;
    var done = function (w) {
      world = w;
      var list = waiting.splice(0);
      if (w) list.forEach(function (fn) { fn(w); });
    };
    try {
      root.fetch(HERE + "img/globe/world.json", { credentials: "omit" }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (raw) {
        done(raw ? decode(raw) : null);
      })["catch"](function () { done(null); });
    } catch (e) {
      done(null);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Drawing one globe                                                   */
  /* ------------------------------------------------------------------ */

  function svg(tag, attrs, kids) {
    var n = doc.createElementNS(SVGNS, tag), k;
    if (attrs) for (k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (kids) kids.forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  var seq = 0;

  /* ---- the light ---- */

  /* 0.4.1 shipped a flat blue disc with green shapes lying on it. A circle reads as a ball when
     four things are true at once, and all four are gradients: a lit side falling away through a
     soft terminator, a rim darkened all the way round, a small soft highlight, and air outside it.
     Five radial gradients and four circles: no library, no raster texture, no filter.
     ONE LIGHT, FIXED TO THE SCREEN, because a light source does not turn with the Earth. So none of
     it is touched again after mount and the drift costs what it always cost. The direction is the
     34% 30% of the plain CSS ball home draws first (web/app.css, .ww-globe), so nothing jumps when
     the real globe lands in it. */
  var LIGHT_X = 0.34, LIGHT_Y = 0.30;   // of the box, the same 34% 30% as the CSS ball on home
  var SHADE_R = 1.25;                   // of the radius: the ramp finishes on the disc, not past it
  var GLOW_R = 0.80;                    // of the radius: a small bright core, then a wide soft wash
  var AIR_R = 1.045;                    // of the radius: how far the halo stands off the rim

  /* One radial gradient in real pixels, from [offset, class] stops: the class carries the colour
     and the opacity, so web/globe.css owns both themes and this file owns only the geometry. In
     user space, because a globe is 92 px on one screen and 272 on another. */
  function grad(gid, cx, cy, r, stops) {
    return svg("radialGradient",
      { id: gid, cx: cx, cy: cy, r: r, gradientUnits: "userSpaceOnUse" },
      stops.map(function (s) { return svg("stop", { offset: s[0], "class": s[1] }); }));
  }

  /* Inline style and not a class, because the id belongs to this one globe and a page can hold
     two. If the defs ever fail, the CSS class is what is left: a plain blue ball, not a black one. */
  function paintWith(node, gid) { node.style.fill = "url(#" + gid + ")"; }

  /* MILLISECONDS AND NOT FRAMES. The first version counted 0.05 degrees of drift and a momentum
     decay of 0.9 per frame, so a 120 Hz phone turned the Earth twice as fast as a 60 Hz one and a
     30 Hz phone half as fast: 3.01 degrees a second with the frame rate held to 60, and 52.72 with
     it let go. Every rate below is per second, so every phone gets the same Earth. */
  var clock = (root.performance && root.performance.now)
    ? function () { return root.performance.now(); }
    : function () { return Date.now(); };
  var DRIFT_DPS = 3;      // degrees a second: a whole turn in two minutes
  var DRIFT_MS = 50;      // and redrawn twenty times a second, which is the next comment
  var TURN_MS = 208;      // how long the turn to a pressed state takes
  var DECAY_MS = 16.7;    // the momentum halves in this many of these, as it always has

  /* Once anybody has spun ANY globe in this session, no globe drifts again. Module level and not
     per globe on purpose: web/app.js builds a new globe every time it draws home, which is every
     return to home and every dashboard refresh, so a flag on one mount was undone by tapping
     Trainings and pressing back. An invitation is offered once. */
  var handled = false;

  /* The starting view: over the United States, so four of the five pins are in sight at once and
     Hawaii is out at the western edge where it belongs. Nobody has to hunt for the company. */
  var HOME_LON = -112, HOME_LAT = 34;
  var MIN_ZOOM = 1, MAX_ZOOM = 4;
  /* Past about 4x the coastlines start to read as angular blobs: this data is recognisable at
     120 px and was never meant to be accurate (Education_private/state_pages/PHOTO_CREDITS.md). */

  /* One globe inside one box.
   *
   * opts.size      the width in pixels
   * opts.spin      a gentle drift, honoured only when the phone has not asked for less motion
   * opts.zoom      pinch, double tap and the two buttons
   * opts.pins      true for five real <button> elements, false for five drawn dots
   * opts.onPin     what a pin press does, called with the state code
   * opts.names     a state code to the name to say, for the pin buttons
   */
  function mount(host, opts) {
    opts = opts || {};
    var size = opts.size || 120;
    var mid = size / 2, rBase = mid - 1;
    var v = view(HOME_LON, HOME_LAT, rBase, mid, mid);
    var zoom = 1, id = "gl" + (++seq) + "-" + Math.random().toString(36).slice(2, 7);
    var g = { pins: {}, dots: {} };
    var CODES = ["CA", "FL", "GA", "HI", "TN"];
    var frame = 0, timer = 0, dirty = true, dead = false;
    var drift = 0, vel = 0, velLat = 0, turn = null, tPrev = 0, driftAt = 0;

    while (host.firstChild) host.removeChild(host.firstChild);
    host.classList.add("gl-box");
    host.style.setProperty("--gl-size", size + "px");

    /* The light on this globe in its own pixels, and how far the land stands off the water: the
       lift is the coastline again, offset AWAY from the light, so a continent casts a shadow on the
       sea instead of reading as a cutout lying on it. 1.6 px here, 0.9 px on the ball on home. */
    var lx = size * LIGHT_X, ly = size * LIGHT_Y;
    var liftX = Math.max(0.7, rBase * 0.013), liftY = Math.max(0.8, rBase * 0.016);

    var sea = svg("circle", { cx: mid, cy: mid, r: rBase, class: "gl-sea" });
    /* The land twice, same path, both written in paint(). A second <path> and not a <use>, because
       a <use> clone keeps the class it came from and would be land coloured, and because the tests,
       the cost measurement and the QA shots all read the d attribute off .gl-land itself. */
    var lift = svg("path", { class: "gl-lift", d: "" });
    var land = svg("path", { class: "gl-land", d: "" });
    var lake = svg("path", { class: "gl-lake", d: "" });
    var dots = svg("g", { class: "gl-dots" });
    /* The coats of light, in the order they go on, all set once and never touched again.
         glow    the highlight, and UNDER the land on purpose: a sheen is what water does, not what
                 a continent does, and with it over the land the gold night pin fell to 2.35 to 1
                 against the ground it stands on (qa/op_globe3d/check_shading.py)
         shade   one side lit, the other falling away through a soft terminator
         limb    the rim darkened all the way round, and the blue air just inside it */
    var glow = svg("circle", { cx: mid, cy: mid, r: rBase, class: "gl-glow" });
    var shade = svg("circle", { cx: mid, cy: mid, r: rBase, class: "gl-shade" });
    var limb = svg("circle", { cx: mid, cy: mid, r: rBase, class: "gl-limb" });
    /* And the air OUTSIDE the rim, drawn first so the sphere covers all but the thin halo. */
    var air = svg("circle", { cx: mid, cy: mid, r: rBase * AIR_R, class: "gl-air" });
    var clip = svg("clipPath", { id: id }, [svg("circle", { cx: mid, cy: mid, r: rBase })]);
    var gid = function (suffix) { return id + suffix; };
    var shell = svg("svg", {
      class: "gl-svg", viewBox: "0 0 " + size + " " + size, width: size, height: size,
      "aria-hidden": "true", focusable: "false"
    }, [
      svg("defs", null, [
        clip,
        // The terminator: almost nothing across the lit half, so daylight keeps the colours the
        // coastline was measured on, then away into night.
        grad(gid("s"), lx, ly, rBase * SHADE_R,
          [[0, "gl-d0"], [0.42, "gl-d1"], [0.7, "gl-d5"], [1, "gl-d2"]]),
        // The light side: a bright core inside the first third, then a wash out to nothing. ONE
        // gradient and not two, and the water is otherwise the flat --gl-sea it always was. The
        // first draft also ran a --gl-hi to --gl-lo gradient on the water itself, and both ends of
        // it were too far: --gl-lo is 2.19 to 1 against --gl-coast before any light at all, so the
        // shade then took the coastline against open water to 1.63, and --gl-hi is 1.24 to 1
        // against --gl-land, so near the light the sea and the ground were the same lightness.
        grad(gid("g"), lx, ly, rBase * GLOW_R,
          [[0, "gl-w0"], [0.3, "gl-w1"], [1, "gl-w2"]]),
        // Limb darkening, then the blue air seen edge on: one gradient does both, and does
        // nothing until 0.7 of the way out, so it never reaches the middle where everything is.
        grad(gid("b"), mid, mid, rBase,
          [[0.7, "gl-d0"], [0.9, "gl-d3"], [0.968, "gl-d4"], [0.988, "gl-a1"], [1, "gl-a2"]]),
        // The halo outside, transparent until the sphere edge, so only the ring beyond the rim
        // is ever seen.
        grad(gid("h"), mid, mid, rBase * AIR_R,
          [[0.9, "gl-a0"], [1 / AIR_R, "gl-a2"], [1, "gl-a0"]])
      ]),
      air,
      svg("g", { "clip-path": "url(#" + id + ")" },
        [sea, glow, lift, land, lake, shade, limb, dots]),
      svg("circle", { cx: mid, cy: mid, r: rBase, class: "gl-rim" })
    ]);
    // The sea and the lakes keep the one flat --gl-sea they have always had, so a lake is the
    // same blue as the ocean round it and the coastline was measured on the colour it really has.
    paintWith(shade, gid("s"));
    paintWith(glow, gid("g"));
    paintWith(limb, gid("b"));
    paintWith(air, gid("h"));
    lift.setAttribute("transform", "translate(" + liftX.toFixed(2) + " " + liftY.toFixed(2) + ")");
    host.appendChild(shell);

    /* The five buttons, when this globe has them. They are always in the DOM and always in the tab
       order, including the ones round the back: a keyboard has no way to spin the globe to find a
       state first, so every state has to be reachable from where it stands. A pin that is behind the
       Earth is parked on the rim in its own direction and dimmed, so it is visible as well as
       reachable, and pressing it turns the globe to it like a tap does. */
    var layer = null;
    if (!opts.pins) {
      CODES.forEach(function (code) {
        var c = svg("circle", { r: 0, cx: mid, cy: mid, class: "gl-dot" });
        g.dots[code] = c;
        dots.appendChild(c);
      });
    } else {
      layer = doc.createElement("ul");
      layer.className = "gl-pins";
      // Said out loud, because the CSS takes it away. Safari with VoiceOver strips list semantics
      // from a <ul> styled list-style: none, which is every browser most of these 76 phones run,
      // and without this there is no list anywhere on the screen.
      layer.setAttribute("role", "list");
      CODES.forEach(function (code) {
        var name = (opts.names && opts.names(code)) || code;
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "gl-pin";
        b.setAttribute("data-state", code);
        b.setAttribute("aria-label", t("gl_pin", { state: name }));
        b.appendChild(doc.createElement("i"));
        // A KEYBOARD press. A finger never gets here: web/globe.css takes this layer out of the
        // pointer's way, because it swallowed every drag and because three of these buttons overlap
        // so badly that the one on top answered for all three. A tap reaches the sphere instead.
        b.addEventListener("click", function () { pick(code); });
        var li = doc.createElement("li");
        li.appendChild(b);
        layer.appendChild(li);
        g.pins[code] = b;
      });
      host.appendChild(layer);
    }

    function pinData() { return (world && world.pin) || {}; }

    /* ---- drawing ---- */

    /* A pin's place on the disc, and whether it is one of the ones that is not really in sight.
       Two ways that happens, and BOTH have to be caught. The obvious one is a pin on the back of
       the Earth. The other one is a pin that is on the front but has been zoomed off the edge: the
       drawing is clipped to the disc, but the pin is a button outside the SVG, so at 1.7x three of
       them walked out of the globe's box and sat at the left edge of the phone.
       Either way the pin is parked on the rim, in the direction it lies, small and quiet, and
       pressing it still turns the globe to it. */
    function at(p, out) {
      var dx = p.x - v.cx, dy = p.y - v.cy;
      var m = Math.sqrt(dx * dx + dy * dy);
      if (p.front && m <= rBase) { out[0] = p.x; out[1] = p.y; return true; }
      if (m < 0.5) { dx = 0; dy = -1; m = 1; }
      out[0] = v.cx + dx / m * rBase;
      out[1] = v.cy + dy / m * rBase;
      return false;
    }

    /* Three of the five states are on top of each other and the globe exists to show five. At
       390 px, Florida to Georgia is 8.9 px and Georgia to Tennessee 11.9, against a mark that is
       17 px of ink inside a 23 px halo, so two sat half over each other and the three read as one
       smudge; on home the dots are 3.2 px and 4.4, 6.0 and 9.2 px apart, so they read as one dot.
       So push any two marks closer than they can be told apart just far enough apart, three rounds,
       which settles a cluster of three. Nothing moves more than a few pixels, which is well inside
       what this data claims to be, the pin a finger lands on is still worked out from where the
       state really is (pinAt), and a cleaner in Athens can see Georgia. */
    var SEP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], keep = [];
    function separate(n, gap) {
      var i, j, dx, dy, d, push, r;
      for (r = 0; r < 3; r++) {
        for (i = 0; i < n; i++) {
          for (j = i + 1; j < n; j++) {
            dx = SEP[j * 2] - SEP[i * 2];
            dy = SEP[j * 2 + 1] - SEP[i * 2 + 1];
            d = Math.sqrt(dx * dx + dy * dy);
            if (d >= gap) continue;
            if (d < 0.01) { dx = 1; dy = 0; d = 1; } // exactly on top: any direction will do
            push = (gap - d) / 2 / d;
            SEP[i * 2] -= dx * push;
            SEP[i * 2 + 1] -= dy * push;
            SEP[j * 2] += dx * push;
            SEP[j * 2 + 1] += dy * push;
          }
        }
        // And back onto the disc, every round, so pushing two apart near the edge can never walk
        // one of them out of the globe's box and onto the left edge of the phone.
        for (i = 0; i < n; i++) {
          dx = SEP[i * 2] - mid;
          dy = SEP[i * 2 + 1] - mid;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d <= rBase || d < 0.01) continue;
          SEP[i * 2] = mid + dx / d * rBase;
          SEP[i * 2 + 1] = mid + dy / d * rBase;
        }
      }
    }

    function place() {
      var places = pinPlaces(v, pinData(), 0.06), i, p, b, pt = [0, 0], here, n = 0;
      // The ones really in sight are the only ones that can clump: a pin round the back is parked
      // on the rim, small and quiet, and moving it would be a lie about where it lies.
      keep.length = 0;
      for (i = 0; i < places.length; i++) {
        p = places[i];
        b = opts.pins ? g.pins[p.code] : g.dots[p.code];
        if (!b) continue;
        here = at(p, pt);
        if (!here) { park(b, pt); continue; }
        SEP[n * 2] = pt[0];
        SEP[n * 2 + 1] = pt[1];
        keep.push(b);
        n++;
      }
      separate(n, opts.pins ? 20 : 9);
      for (i = 0; i < n; i++) put(keep[i], SEP[i * 2], SEP[i * 2 + 1], true);
    }

    function park(b, pt) { put(b, pt[0], pt[1], false); }

    // Made once and moved, never rebuilt: this runs on every frame of a drag and nothing here
    // should allocate.
    function put(b, x, y, here) {
      if (opts.pins) {
        b.style.left = x.toFixed(1) + "px";
        b.style.top = y.toFixed(1) + "px";
        b.classList.toggle("is-back", !here);
        return;
      }
      if (here) {
        b.setAttribute("cx", x.toFixed(1));
        b.setAttribute("cy", y.toFixed(1));
      }
      b.setAttribute("r", here ? (size > 200 ? 4.5 : 3.2) : 0);
    }

    function paint() {
      if (world) {
        // Written once, used twice: the shadow carries the same outline, moved by the transform.
        var d = ringsPath(v, world.land);
        land.setAttribute("d", d);
        lift.setAttribute("d", d);
        lake.setAttribute("d", ringsPath(v, world.lake));
      }
      place();
      dirty = false;
    }

    function need() {
      dirty = true;
      if (frame || dead) return;
      if (timer) { root.clearTimeout(timer); timer = 0; }
      tPrev = 0; // a loop that had stopped starts its clock again on its first frame
      frame = root.requestAnimationFrame(step);
    }

    /* Anything a person did with their hands. It stops the drift, once and for all, on every globe
       in the app and not only on this one. */
    function hand() {
      if (handled) return;
      handled = true;
      retune();
    }

    function setView(lon, lat, z) {
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z === undefined ? zoom : z));
      v = view(wrapLon(lon), Math.max(-90, Math.min(90, lat)), rBase * zoom, mid, mid);
      need();
    }

    /* One frame: the drift, whatever a finger left behind, and a turn to a state that is under way.
       Nothing here allocates, so a phone six times slower than a desktop still spends about 1.3 ms
       of its 16.7 on the whole thing, paint included (qa/globe_ground/measure_cost.py).
       EXACTLY ONE FRAME IS EVER IN FLIGHT. Every path out of here goes through need(), which asks
       for a frame only when there is not one already. The first version asked at the end of the
       frame AND again from setView inside it, which is two frames for one, then four, then eight:
       the browser tab ran out of memory and died in about ten seconds.
       TIME, NOT FRAMES. dt is real milliseconds, capped so a frame that arrives after the phone
       stalled does not make the Earth jump. tPrev is written at the END, because setView inside
       this frame calls need(), and need() starts a fresh clock for a loop that had stopped. */
    function step() {
      frame = 0;
      if (dead) return;
      // A globe that is no longer on the page stops, and takes its listeners with it. Home draws a
      // new one every time it is drawn again, and the old ones must not pile up behind it.
      if (!doc.contains(host)) { handle.destroy(); return; }
      var now = clock(), dt = tPrev ? Math.min(100, now - tPrev) : DECAY_MS, f = dt / DECAY_MS;
      var moved = false;
      if (turn) {
        turn.at = Math.min(1, turn.at + dt / TURN_MS);
        // Slow in and slow out, so it reads as the Earth turning and not as a jump.
        var e = turn.at < 0.5 ? 2 * turn.at * turn.at : 1 - Math.pow(-2 * turn.at + 2, 2) / 2;
        setView(turn.lon0 + turn.dLon * e, turn.lat0 + turn.dLat * e, turn.z0 + turn.dZ * e);
        if (turn.at >= 1) { var end = turn.done; turn = null; if (end) end(); }
        moved = true;
      } else if (!count && (vel || velLat)) {
        // What the finger LEFT BEHIND, running down to nothing in about two thirds of a second.
        // Only once it has gone: while the finger is still down, onMove is already turning the
        // globe, and this ran as well, so a drag moved the Earth about two and a half times as far
        // as the finger did.
        v = dragged(v, vel * f, velLat * f);
        var k = Math.pow(0.9, f);
        vel *= k;
        velLat *= k;
        if (Math.abs(vel) < 0.8 && Math.abs(velLat) < 0.8) { vel = 0; velLat = 0; }
        moved = true;
      } else if (drift) {
        /* TWENTY REDRAWS A SECOND, NOT SIXTY, and this was the most expensive line on home: 887 ms
           of a 6 second main thread at 390 px, 14.8 percent, with 360 layouts, and 24.5 percent on
           a phone six times slower. Each of those frames bought 0.058 px of movement, a sixth of a
           device pixel, for a full rebuild of a 3,588 character coastline. Every 50 ms it moves
           0.17 px a time, still reads as a turn, and measures 7.2 percent with 100 layouts
           (qa/measure_globe_cost.py). */
        driftAt += dt;
        if (driftAt >= DRIFT_MS) {
          setView(v.lon - DRIFT_DPS * driftAt / 1000, v.lat, zoom);
          driftAt = 0;
          moved = true;
        }
      }
      if (moved || dirty) paint();
      tPrev = now;
      // A finger, and what it left behind, gets every frame the phone will give it. THE DRIFT DOES
      // NOT: on its own it comes back on a timer, so the 40 frames a second with nothing to do stop
      // being asked for. Safe for the same reason a frame was, because a tab that goes away and a
      // globe scrolled out of sight both turn the drift off before this line is reached.
      var busy = turn || (!count && (vel || velLat));
      if (busy || dirty) {
        if (!frame) frame = root.requestAnimationFrame(step);
      } else if (drift && !timer) {
        timer = root.setTimeout(function () { timer = 0; step(); }, Math.max(0, DRIFT_MS - driftAt));
      }
    }

    /* ---- the drift ---- */

    /* A phone that asked for less motion gets none of this, and neither does a globe nobody can see:
       a tab in the background, or a globe scrolled off the screen, costs no frames at all. */
    var seen = true, showing = true, io = null;
    function retune() {
      // Three degrees a second: a whole turn in two minutes. It has to read as alive and never as
      // busy, and it must never pull the eye off the greeting beside it. Once somebody has spun
      // any globe the drift stops for good, on home and here. The drift is an invitation, and a
      // globe that goes on turning after the invitation was accepted is a globe arguing with the
      // person holding it: whatever they put in the middle stays in the middle.
      var on = opts.spin && !handled && !reduced() && seen && showing && !dead;
      drift = on ? 1 : 0;
      if (on) need();
    }
    function visible() { showing = !doc.hidden; retune(); }
    doc.addEventListener("visibilitychange", visible);
    if (root.IntersectionObserver) {
      io = new root.IntersectionObserver(function (es) {
        seen = es[es.length - 1].isIntersecting;
        retune();
      });
      io.observe(host);
    }
    if (root.matchMedia) {
      try {
        var mq = root.matchMedia("(prefers-reduced-motion: reduce)");
        if (mq.addEventListener) mq.addEventListener("change", retune);
      } catch (e) { /* an old browser keeps whatever it started with */ }
    }

    /* ---- turning to a state ---- */

    /* Turn the globe so a state is in the middle, then do whatever the caller asked for. A phone
       that asked for less motion is taken there at once: the point is to arrive, not to travel. */
    function turnTo(code, z, done) {
      var at = pinData()[code];
      if (!at) { if (done) done(); return; }
      var want = z === undefined ? zoom : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
      vel = 0;
      velLat = 0;
      if (reduced()) {
        turn = null;
        setView(at[0], at[1], want);
        paint();
        if (done) done();
        return;
      }
      turn = {
        at: 0, lon0: v.lon, lat0: v.lat, z0: zoom,
        dLon: shortWay(v.lon, at[0]), dLat: at[1] - v.lat, dZ: want - zoom, done: done
      };
      need();
    }

    function pick(code) {
      hand();
      turnTo(code, Math.max(zoom, 1.8), function () { if (opts.onPin) opts.onPin(code); });
    }

    /* ---- the finger ---- */

    var down = {}, count = 0, last = null, pinch = 0, moved2 = 0, tapAt = 0, sank = false;

    function local(e) {
      var box = shell.getBoundingClientRect();
      return { x: (e.clientX - box.left) * size / box.width, y: (e.clientY - box.top) * size / box.height };
    }
    function spread() {
      var ks = Object.keys(down);
      if (ks.length < 2) return 0;
      var a = down[ks[0]], b = down[ks[1]];
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }

    function onDown(e) {
      if (count >= 2) return;
      var p = local(e);
      down[e.pointerId] = p;
      count = Object.keys(down).length;
      hand();
      if (count === 1) {
        last = p;
        moved2 = 0;
        sank = false;
        vel = 0;
        velLat = 0;
        turn = null;
        try { shell.setPointerCapture(e.pointerId); } catch (err) { /* a mouse without capture */ }
      } else if (opts.zoom) {
        pinch = spread();
      }
    }

    function onMove(e) {
      var p = down[e.pointerId];
      if (!p) return;
      var now = local(e);
      down[e.pointerId] = now;
      if (count === 2 && opts.zoom) {
        var wide = spread();
        if (pinch > 4 && wide > 4) setView(v.lon, v.lat, zoom * (wide / pinch));
        pinch = wide;
        moved2 = 99;
        return;
      }
      if (count !== 1 || !last) return;
      var dx = now.x - last.x, dy = now.y - last.y;
      moved2 += dx * dx + dy * dy;
      if (!sank && moved2 < 9) return; // a tap wobbles; it is not a drag until it has gone somewhere
      sank = true;
      last = now;
      v = dragged(v, dx, dy);
      vel = dx;
      velLat = dy;
      need();
    }

    function onUp(e) {
      var had = !!down[e.pointerId];
      delete down[e.pointerId];
      count = Object.keys(down).length;
      try { shell.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      if (!had) return;
      if (count) { last = down[Object.keys(down)[0]]; pinch = 0; return; }
      if (sank) {
        // Momentum, but only what the finger really asked for, and never for less motion. It is
        // capped, and it runs down in about two thirds of a second, so the hardest flick anybody
        // can give it turns the Earth about a third of the way round and stops. Without the cap one
        // flick spun it one and a half times and nobody could see where it had gone.
        if (reduced() || e.type === "pointercancel") { vel = 0; velLat = 0; }
        else {
          vel = Math.max(-18, Math.min(18, vel));
          velLat = Math.max(-12, Math.min(12, velLat));
        }
        need();
        last = null;
        return;
      }
      vel = 0;
      velLat = 0;
      last = null;
      if (e.type === "pointercancel") return;
      tap(e);
    }

    /* A tap. On the Where we work screen a tap near a pin opens that state, and a double tap zooms:
       one step in, and back to the whole Earth once it is as close as it goes. Home has neither, so
       a tap there falls through to the link the globe sits inside. */
    function tap(e) {
      var p = local(e), now = Date.now();
      if (opts.pins) {
        var hit = pinAt(v, pinData(), p.x, p.y, Math.max(22, size * 0.09));
        if (hit) { pick(hit); tapAt = 0; return; }
      }
      if (!opts.zoom) return;
      if (now - tapAt < 400) {
        tapAt = 0;
        var pt = [0, 0];
        if (zoom >= MAX_ZOOM - 0.01) {
          setView(v.lon, v.lat, MIN_ZOOM);
        } else if (unproject(v, p.x, p.y, pt)) {
          // Zoom in on what was tapped, so a double tap on Florida lands on Florida.
          if (reduced()) setView(pt[0], pt[1], zoom * 1.7);
          else {
            turn = { at: 0, lon0: v.lon, lat0: v.lat, z0: zoom, dLon: shortWay(v.lon, pt[0]),
              dLat: pt[1] - v.lat, dZ: Math.min(MAX_ZOOM, zoom * 1.7) - zoom, done: null };
            need();
          }
        } else {
          setView(v.lon, v.lat, zoom * 1.7);
        }
        return;
      }
      tapAt = now;
    }

    if (opts.drag !== false) {
      shell.addEventListener("pointerdown", onDown);
      shell.addEventListener("pointermove", onMove);
      shell.addEventListener("pointerup", onUp);
      shell.addEventListener("pointercancel", onUp);
    }

    var handle = {
      el: host,
      svg: shell,
      size: size,
      pins: g.pins,
      view: function () { return v; },
      zoom: function () { return zoom; },
      setZoom: function (z) { turn = null; setView(v.lon, v.lat, z); },
      step: function (by) { hand(); turn = null; setView(v.lon, v.lat, zoom * by); },
      turnTo: turnTo,
      /* A drag that did not stay still: home asks this so a spin never follows the link. */
      moved: function () { return sank; },
      paint: function () { paint(); },
      world: function (w) { world = world || w; dirty = true; retune(); need(); paint(); },
      destroy: function () {
        dead = true;
        drift = 0;
        if (frame) root.cancelAnimationFrame(frame);
        if (timer) root.clearTimeout(timer);
        frame = 0;
        timer = 0;
        if (io) io.disconnect();
        doc.removeEventListener("visibilitychange", visible);
      }
    };

    paint();
    retune();
    getWorld(function (w) { if (!dead && w) handle.world(w); });
    return handle;
  }

  /* ------------------------------------------------------------------ */
  /* The two places it is used                                           */
  /* ------------------------------------------------------------------ */

  /* HOME. web/app.js has already drawn a plain circle inside the link, and that circle is already
     the link. This turns it into the Earth. Nothing here is allowed to make the link stop working:
     if it throws, the circle stays and the link is untouched. */
  function home(host) {
    var size = host.clientWidth || 132;
    var h = mount(host, { size: size, spin: true, zoom: false, pins: false });
    host.__globe = h; // so qa/ can read what this globe is really doing, as the other one can be
    // A spin is not a tap. Without this, every drag on home would also open the screen.
    host.addEventListener("click", function (e) {
      if (h.moved()) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    // Once there really is a globe with five pins on it, the link's name can say so, and NOT
    // before: the words promise a globe that turns with a pin on each state, and until the world
    // arrives there is neither. A phone whose world.json never comes keeps ww_globe_name from
    // web/i18n.js, which says the whole of what the plain ball does. The five names come from
    // web/i18n.js too, so a state is named once in the whole app.
    getWorld(function (w) {
      var link = host.parentNode;
      if (!w || !link || !link.getAttribute || !link.getAttribute("aria-label")) return;
      link.setAttribute("aria-label", link.getAttribute("aria-label") + " " + t("gl_states", {
        states: ["state_ca", "state_fl", "state_ga", "state_hi", "state_tn"]
          .map(function (k) { return t(k); }).join(", ")
      }));
    });
    return h;
  }

  /* THE WHERE WE WORK SCREEN. The globe above the list of five states: drag to turn it, pinch or
     double tap to zoom, two buttons for fingers that do not pinch and for a mouse, and five pins
     that turn the globe, open that state and take the screen there.
     It is a second way in and never the only way. Everything it does is still doable by reading the
     list underneath, which does not change, so a screen reader hears five named buttons here and the
     same five states as a list below. */
  function block(opts) {
    opts = opts || {};
    var box = doc.createElement("div");
    box.className = "gl-wrap";
    var stage = doc.createElement("div");
    var h = mount(stage, {
      size: opts.size || 260, spin: true, zoom: true, pins: true,
      onPin: opts.onPin, names: opts.names
    });
    var group = doc.createElement("div");
    group.className = "gl-stage";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", t("gl_label"));
    group.appendChild(stage);

    function zbtn(key, cls, d) {
      var b = doc.createElement("button");
      b.type = "button";
      b.className = "gl-zoom " + cls;
      b.setAttribute("aria-label", t(key));
      b.appendChild(svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
        [svg("path", { d: d })]));
      b.addEventListener("click", function () { h.step(cls === "gl-in" ? 1.6 : 1 / 1.6); });
      return b;
    }
    var keys = doc.createElement("div");
    keys.className = "gl-keys";
    keys.appendChild(zbtn("gl_out", "gl-out", "M5 12h14"));
    keys.appendChild(zbtn("gl_in", "gl-in", "M12 5v14M5 12h14"));
    group.appendChild(keys);
    box.appendChild(group);

    var hint = doc.createElement("p");
    hint.className = "gl-hint";
    hint.textContent = t("gl_hint");
    box.appendChild(hint);
    box.__globe = h;
    return box;
  }

  /* The whole of the Where we work globe, put into the empty slot web/states.js leaves for it, so
     that screen holds nine lines about the globe and this file holds the rest.
     The size is measured after the browser has laid the page out, so 320 px gets a globe that fits
     320 px. Above 400 px the two zoom buttons stand beside the globe; below it they go underneath,
     which is what web/globe.css does at that width. */
  function states(slot) {
    // The zoom buttons stand beside the globe or under it, and web/globe.css decides that on the
    // width of the WINDOW. So this has to ask the window the same question: asking the slot instead
    // let the globe be sized for buttons underneath while the buttons were really beside it, and
    // the screen scrolled sideways at 320 px.
    var wide = slot.clientWidth || 320;
    var beside = (root.innerWidth || 0) > 400 ? 66 : 0;
    var node = block({
      size: Math.max(92, Math.min(272, wide - 24 - beside)),
      names: function (code) { return t("state_" + code.toLowerCase()); },
      onPin: openState
    });
    slot.appendChild(node);
    return node.__globe;
  }

  /* A pin was pressed and the globe has already turned to that state. This is the rest of the
     promise. The panel is opened through its own button, so one piece of code opens a panel however
     somebody asked for it, and then the screen and the keyboard focus both go to the state's name.
     A tap on Hawaii has to leave the person looking at Hawaii and not at the globe they tapped. */
  function openState(code) {
    var sec = doc.querySelector('.ww-state[data-state="' + code + '"]');
    if (!sec) return;
    var btn = sec.querySelector(".ww-toggle");
    if (btn && btn.getAttribute("aria-expanded") !== "true") btn.click();
    var name = sec.querySelector(".ww-name");
    if (!name) return;
    try { name.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" }); }
    catch (e) { name.scrollIntoView(true); }
    try { name.focus({ preventScroll: true }); } catch (e) { name.focus(); }
  }

  root.CCCGlobe = {
    core: CORE,
    world: getWorld,
    mount: mount,
    home: home,
    block: block,
    states: states,
    open: openState,
    /* The tests read this. It carries no words, only what the globe is doing. */
    debug: function (h) {
      var v = h.view();
      return { lon: Math.round(v.lon * 10) / 10, lat: Math.round(v.lat * 10) / 10,
        zoom: Math.round(h.zoom() * 100) / 100, world: !!world };
    }
  };
})(window);
