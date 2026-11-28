// Tiroir — vidéo de démo du hackathon Google (anglais, 16/9).
//
// À lancer dans After Effects : Fichier › Scripts › Exécuter le fichier de script…
// Le script doit rester dans le dossier marketing/demo-hackathon/, à côté
// des dossiers 01_VO … 06_Exports : c'est là qu'il cherche les médias.
//
// Ce qu'il fait :
//  1. crée un projet neuf, rangé comme les dossiers du disque ;
//  2. importe ce qu'il trouve (voir les préfixes de noms dans README.md) ;
//  3. met à la place de chaque fichier absent une doublure nommée
//     « MISSING — … » (Fichier › Remplacer le métrage pour la remplacer) ;
//  4. construit les précompositions (écran iPhone, mockup, schéma Firebase),
//     les six parties et la composition principale avec ses marqueurs ;
//  5. enregistre le projet à côté du script, sans écraser un projet existant.
//
// Couleurs et police : lues dans design/tokens.json (seule source de vérité).
// Si le dossier a été copié hors du dépôt, les valeurs de secours ci-dessous
// sont celles de tokens.json au 2026-11-28.
//
// ExtendScript = ES3 : ni JSON, ni Array.indexOf, ni forEach, ni trim.
// Les textes à l'écran sont en anglais. Fichier en UTF-8 avec BOM : sans le
// BOM, After Effects lirait mal les accents et les tirets.

(function () {

  // ---------------------------------------------------------------------
  // Réglages
  // ---------------------------------------------------------------------

  var W = 1920, H = 1080;
  var DEFAULT_FPS = 30;        // remplacée par la cadence du premier rush trouvé
  var IPHONE_W = 1179, IPHONE_H = 2556;   // capture d'écran iPhone 15 / 16 Pro
  var PROJECT_NAME = "Tiroir_Demo_Hackathon_EN";

  // Six parties, 2 min 30 au total. À recaler sur la VO une fois importée.
  var SECTIONS = [
    { key: "S1_Hook",          dur: 12, marker: "1 — Hook: the problem" },
    { key: "S2_RealLife",      dur: 28, marker: "2 — Tiroir for real (Stephane's footage)" },
    { key: "S3_iPhone",        dur: 30, marker: "3 — Adding an item from the iPhone" },
    { key: "S4_Web",           dur: 30, marker: "4 — Browsing collections on the web" },
    { key: "S5_UnderTheHood",  dur: 35, marker: "5 — Under the hood: Firebase AI Logic" },
    { key: "S6_End",           dur: 15, marker: "6 — Logo, call to action, credits" }
  ];

  var MEDIA_EXT = /\.(mov|mp4|m4v|mxf|avi|wav|aif|aiff|mp3|m4a|aac|png|jpg|jpeg|tif|tiff|psd|ai|pdf)$/i;

  // ---------------------------------------------------------------------
  // Chemins
  // ---------------------------------------------------------------------

  var HERE = File($.fileName).parent;
  function sub(name) { return Folder(HERE.fsName + "/" + name); }

  // ---------------------------------------------------------------------
  // Charte : design/tokens.json
  // ---------------------------------------------------------------------

  var T = {
    orange: "#F26900", orange700: "#D85E00", beige: "#FFF4E6", beige2: "#FFF8EF",
    ink: "#121212", muted: "#5b5b5b", white: "#FFFFFF", success: "#2D5016",
    tertiary: "#A89F96"
  };
  var tokensSource = "valeurs de secours (tokens.json introuvable)";
  (function loadTokens() {
    var f = File(HERE.fsName + "/../../design/tokens.json");
    if (!f.exists) return;
    try {
      f.encoding = "UTF-8";
      f.open("r");
      var txt = f.read();
      f.close();
      var j = eval("(" + txt + ")");   // pas de JSON en ES3 ; fichier du dépôt
      var c = j.color;
      if (c["orange"]) T.orange = c["orange"].value;
      if (c["orange-700"]) T.orange700 = c["orange-700"].value;
      if (c["beige"]) T.beige = c["beige"].value;
      if (c["beige-2"]) T.beige2 = c["beige-2"].value;
      if (c["ink"]) T.ink = c["ink"].value;
      if (c["muted"]) T.muted = c["muted"].value;
      if (c["white"]) T.white = c["white"].value;
      if (c["success"]) T.success = c["success"].value;
      if (c["text-tertiary"]) T.tertiary = c["text-tertiary"].value;
      tokensSource = "design/tokens.json";
    } catch (e) { /* on garde les valeurs de secours */ }
  })();

  // Inter (tokens.json › font.body). Si elle n'est pas installée, AE la remplace.
  var FONT_BOLD = "Inter-Bold", FONT_REG = "Inter-Regular", FONT_SEMI = "Inter-SemiBold";

  function rgb(hex) {
    hex = hex.replace("#", "");
    return [parseInt(hex.substr(0, 2), 16) / 255, parseInt(hex.substr(2, 2), 16) / 255, parseInt(hex.substr(4, 2), 16) / 255];
  }

  // ---------------------------------------------------------------------
  // Fichiers : recherche par préfixe, sinon doublure nommée
  // ---------------------------------------------------------------------

  var missing = [];   // ce qu'il reste à fournir, affiché à la fin

  function findMedia(folderName, prefix) {
    var dir = sub(folderName);
    if (!dir.exists) return null;
    var files = dir.getFiles();
    var best = null;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!(f instanceof File)) continue;
      var n = decodeURI(f.name).toLowerCase();
      if (n.indexOf(prefix.toLowerCase()) === 0 && MEDIA_EXT.test(n)) {
        if (!best || n < decodeURI(best.name).toLowerCase()) best = f;
      }
    }
    return best;
  }

  function importFile(f, binFolder) {
    var io = new ImportOptions(f);
    var item = app.project.importFile(io);
    item.parentFolder = binFolder;
    return item;
  }

  // label : nom lisible ; expect : ce qu'il faut déposer (pour le bilan).
  function importOr(folderName, prefix, label, w, h, dur, binFolder, expect) {
    var f = findMedia(folderName, prefix);
    if (f) return { item: importFile(f, binFolder), found: true };
    var ph = app.project.importPlaceholder("MISSING — " + label, w, h, FPS, dur);
    ph.parentFolder = binFolder;
    missing.push(folderName + "/" + prefix + "…  →  " + expect);
    return { item: ph, found: false };
  }

  // ---------------------------------------------------------------------
  // Aides de mise en page et d'animation
  // ---------------------------------------------------------------------

  function easeKeys(prop) {
    var e = new KeyframeEase(0, 80);
    for (var k = 1; k <= prop.numKeys; k++) {
      var dims = prop.value instanceof Array ? prop.value.length : 1;
      // Position spatiale : une seule KeyframeEase ; échelle : une par dimension.
      if (prop.propertyValueType === PropertyValueType.TwoD_SPATIAL ||
          prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL ||
          prop.propertyValueType === PropertyValueType.OneD) dims = 1;
      var arr = [];
      for (var d = 0; d < dims; d++) arr.push(e);
      try { prop.setTemporalEaseAtKey(k, arr, arr); } catch (err) {}
    }
  }

  // Apparition : fondu + petite montée (dy px), à t secondes.
  function reveal(layer, t, dy) {
    if (dy === undefined) dy = 30;
    var op = layer.property("ADBE Transform Group").property("ADBE Opacity");
    op.setValueAtTime(t, 0);
    op.setValueAtTime(t + 0.5, 100);
    easeKeys(op);
    if (dy) {
      var pos = layer.property("ADBE Transform Group").property("ADBE Position");
      var p = pos.value;
      pos.setValueAtTime(t, [p[0], p[1] + dy]);
      pos.setValueAtTime(t + 0.6, [p[0], p[1]]);
      easeKeys(pos);
    }
  }

  function hide(layer, t) {
    var op = layer.property("ADBE Transform Group").property("ADBE Opacity");
    op.setValueAtTime(t - 0.4, op.valueAtTime(t - 0.4, false));
    op.setValueAtTime(t, 0);
  }

  function popScale(layer, t, to) {
    if (!to) to = 100;
    var sc = layer.property("ADBE Transform Group").property("ADBE Scale");
    sc.setValueAtTime(t, [to * 0.85, to * 0.85]);
    sc.setValueAtTime(t + 0.5, [to, to]);
    easeKeys(sc);
  }

  // Texte ponctuel. align : "left" | "center" | "right".
  function addText(comp, str, size, hex, x, y, font, align) {
    var layer = comp.layers.addText(str);
    var st = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = st.value;
    try { doc.resetCharStyle(); } catch (e) {}
    doc.fontSize = size;
    doc.fillColor = rgb(hex);
    doc.applyFill = true;
    doc.applyStroke = false;
    try { doc.font = font || FONT_BOLD; } catch (e) {}
    doc.justification = align === "left" ? ParagraphJustification.LEFT_JUSTIFY
      : align === "right" ? ParagraphJustification.RIGHT_JUSTIFY
      : ParagraphJustification.CENTER_JUSTIFY;
    doc.leading = Math.round(size * 1.2);
    st.setValue(doc);
    layer.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);
    layer.name = "TXT — " + str.split("\r")[0].substr(0, 40);
    return layer;
  }

  // Rectangle arrondi plein (calque de forme).
  function addRect(comp, name, w, h, radius, hex, x, y) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var grp = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    grp.name = name;
    var c = grp.property("ADBE Vectors Group");
    var r = c.addProperty("ADBE Vector Shape - Rect");
    r.property("ADBE Vector Rect Size").setValue([w, h]);
    r.property("ADBE Vector Rect Roundness").setValue(radius);
    var fill = c.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(rgb(hex));
    layer.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);
    return layer;
  }

  function addShadow(layer, opacity) {
    try {
      var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
      fx.property("ADBE Drop Shadow-0002").setValue(opacity || 60); // opacité (0-255)
      fx.property("ADBE Drop Shadow-0003").setValue(180);           // direction
      fx.property("ADBE Drop Shadow-0004").setValue(18);            // distance
      fx.property("ADBE Drop Shadow-0005").setValue(60);            // adoucissement
    } catch (e) {}
  }

  // Trait (flèche) de a vers b, dessiné de 0 à 100 % à partir de t.
  function addArrow(comp, name, a, b, hex, t, dashed) {
    var layer = comp.layers.addShape();
    layer.name = name;
    var grp = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var c = grp.property("ADBE Vectors Group");
    var pathGrp = c.addProperty("ADBE Vector Shape - Group");
    var s = new Shape();
    s.vertices = [a, b];
    s.closed = false;
    pathGrp.property("ADBE Vector Shape").setValue(s);
    // pointe
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
    var head = c.addProperty("ADBE Vector Shape - Group");
    var hs = new Shape();
    hs.vertices = [
      [b[0] - ux * 26 - uy * 14, b[1] - uy * 26 + ux * 14],
      b,
      [b[0] - ux * 26 + uy * 14, b[1] - uy * 26 - ux * 14]
    ];
    hs.closed = false;
    head.property("ADBE Vector Shape").setValue(hs);
    var stroke = c.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue(rgb(hex));
    stroke.property("ADBE Vector Stroke Width").setValue(6);
    stroke.property("ADBE Vector Stroke Line Cap").setValue(2); // arrondi
    if (dashed) {
      try {
        var dashes = stroke.property("ADBE Vector Stroke Dashes");
        dashes.addProperty("ADBE Vector Stroke Dash 1").setValue(18);
        dashes.addProperty("ADBE Vector Stroke Gap 1").setValue(16);
      } catch (e) {}
    }
    var trim = c.addProperty("ADBE Vector Filter - Trim");
    var end = trim.property("ADBE Vector Trim End");
    end.setValueAtTime(t, 0);
    end.setValueAtTime(t + 0.8, 100);
    easeKeys(end);
    return layer;
  }

  // Le calque `layer` prend `matte` (posé juste au-dessus) comme cache alpha.
  function setAlphaMatte(layer, matte) {
    if (typeof layer.setTrackMatte === "function") {
      layer.setTrackMatte(matte, TrackMatteType.ALPHA);       // AE 2023 et +
      matte.enabled = false;                                   // le cache ne s'affiche pas lui-même
    } else {
      matte.moveBefore(layer);
      layer.trackMatteType = TrackMatteType.ALPHA;            // versions plus anciennes
    }
  }

  // Calque qui couvre la compo (comme « Ajuster à la composition », en remplissant).
  function fill(layer, compW, compH, itemW, itemH) {
    var s = Math.max(compW / itemW, compH / itemH) * 100;
    layer.property("ADBE Transform Group").property("ADBE Scale").setValue([s, s]);
    layer.property("ADBE Transform Group").property("ADBE Position").setValue([compW / 2, compH / 2]);
  }

  function solidBg(comp, hex, name) {
    var l = comp.layers.addSolid(rgb(hex), name || "BG", comp.width, comp.height, 1, comp.duration);
    return l;
  }

  // Logo Tiroir (web/public/logo-tiroir.svg) redessiné en formes : net à toute taille.
  // Repère 1024 x 1024, centré sur (x, y), taille `size` px.
  function addLogo(comp, x, y, size) {
    var k = size / 1024;
    var layer = comp.layers.addShape();
    layer.name = "LOGO Tiroir";
    var root = layer.property("ADBE Root Vectors Group");
    function rr(name, rx, ry, rw, rh, rad, hex) {
      var g = root.addProperty("ADBE Vector Group");
      g.name = name;
      var c = g.property("ADBE Vectors Group");
      var r = c.addProperty("ADBE Vector Shape - Rect");
      r.property("ADBE Vector Rect Size").setValue([rw * k, rh * k]);
      r.property("ADBE Vector Rect Position").setValue([(rx + rw / 2 - 512) * k, (ry + rh / 2 - 512) * k]);
      r.property("ADBE Vector Rect Roundness").setValue(rad * k);
      c.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(rgb(hex));
    }
    // L'ordre AE : le premier groupe ajouté est dessiné au-dessus.
    rr("Poignee bas", 417, 627.02, 190.01, 37.96, 18.98, T.orange);
    rr("Poignee haut", 417, 354.02, 190.01, 37.96, 18.98, T.orange);
    rr("Tiroir bas (carre)", 252, 520.01, 520, 104, 0, T.white);
    rr("Tiroir haut (carre)", 252, 390.01, 520, 104, 0, T.white);
    rr("Tiroir bas", 252, 520.01, 520, 251.99, 104, T.white);
    rr("Tiroir haut", 252, 252, 520, 242.01, 104, T.white);
    rr("Fond", 0, 0, 1024, 1024, 220, T.orange);
    layer.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);
    return layer;
  }

  // ---------------------------------------------------------------------
  // Projet
  // ---------------------------------------------------------------------

  if (!sub("02_Rushes").exists) {
    alert("Dossiers introuvables à côté du script :\n" + HERE.fsName +
          "\n\nLaisse creer_projet_demo.jsx dans marketing/demo-hackathon/.");
    return;
  }

  app.newProject();
  app.beginUndoGroup("Tiroir demo");

  var P = app.project;
  function bin(name, parent) { var f = P.items.addFolder(name); if (parent) f.parentFolder = parent; return f; }
  var B = {
    vo: bin("01_VO"), rushes: bin("02_Rushes"), web: bin("03_Captures_web"),
    iphone: bin("04_Captures_iPhone"), mockup: bin("05_Mockup"),
    comps: bin("10_Comps"), pre: null
  };
  B.pre = bin("Precomps", B.comps);
  B.parts = bin("Parties", B.comps);

  // Cadence : celle des rushes de Stéphane (le brief demande de la garder).
  var FPS = DEFAULT_FPS;
  var firstRush = findMedia("02_Rushes", "rush_");
  var fpsNote = "30 i/s par défaut (aucun rush trouvé)";
  if (firstRush) {
    var probe = importFile(firstRush, B.rushes);
    if (probe.frameRate && probe.frameRate > 0) {
      FPS = probe.frameRate;
      fpsNote = FPS + " i/s, lue sur " + decodeURI(firstRush.name);
    }
    probe.remove();   // réimporté plus bas, à sa place
  }

  function comp(name, w, h, dur, binFolder) {
    var c = P.items.addComp(name, w, h, 1, dur, FPS);
    c.parentFolder = binFolder;
    c.bgColor = rgb(T.beige);
    return c;
  }

  // ---------------------------------------------------------------------
  // Médias
  // ---------------------------------------------------------------------

  var RUSHES = [
    { prefix: "rush_dessin_1",    label: "Rush — drawing 1 put away",    caption: "One drawing…",          fr: "le 1er dessin" },
    { prefix: "rush_dessin_2",    label: "Rush — drawing 2 put away",    caption: "…then another.",        fr: "le 2e dessin" },
    { prefix: "rush_pantalon_1",  label: "Rush — trousers 1 put away",   caption: "A pair of trousers…",  fr: "le 1er pantalon" },
    { prefix: "rush_pantalon_2",  label: "Rush — trousers 2 put away",   caption: "…and a second one.",   fr: "le 2e pantalon" }
  ];
  for (var r = 0; r < RUSHES.length; r++) {
    RUSHES[r].m = importOr("02_Rushes", RUSHES[r].prefix, RUSHES[r].label, W, H, 7, B.rushes,
      "rush de Stéphane : Clément range " + RUSHES[r].fr);
  }

  var webCollections = importOr("03_Captures_web", "web_collections", "Web capture — browsing collections",
    W, H, 15, B.web, "capture 16/9 du site : navigation entre les collections");
  var webFiche = importOr("03_Captures_web", "web_fiche", "Web capture — opening an item",
    W, H, 15, B.web, "capture 16/9 du site : ouverture d'un objet et lecture de sa fiche");

  var iphoneAdd = importOr("04_Captures_iPhone", "iphone_ajout", "iPhone capture — adding an item (photo, then card)",
    IPHONE_W, IPHONE_H, 26, B.iphone, "capture verticale de l'iPhone : photo, puis fiche");

  // Mockup externe facultatif : PNG d'iPhone à l'écran transparent, à la même
  // proportion que la capture. Sans lui, l'iPhone est dessiné en formes (aucune licence).
  var mockFile = findMedia("05_Mockup", "iphone_mockup");
  var mockItem = mockFile ? importFile(mockFile, B.mockup) : null;

  // VO : un seul fichier (vo_full…) ou un par partie (vo_1… à vo_6…).
  var voFull = findMedia("01_VO", "vo_full");
  var voParts = [];
  var voFullItem = null;
  if (voFull) {
    voFullItem = importFile(voFull, B.vo);
  } else {
    for (var v = 0; v < SECTIONS.length; v++) {
      var vf = findMedia("01_VO", "vo_" + (v + 1));
      voParts.push(vf ? importFile(vf, B.vo) : null);
    }
  }
  var voFoundParts = 0;
  for (var vp = 0; vp < voParts.length; vp++) if (voParts[vp]) voFoundParts++;
  if (!voFullItem && voFoundParts === 0) missing.push("01_VO/vo_full… (ou vo_1… à vo_6…)  →  voix off anglaise déjà enregistrée");
  else if (!voFullItem && voFoundParts < SECTIONS.length) {
    for (var vm = 0; vm < voParts.length; vm++) if (!voParts[vm]) missing.push("01_VO/vo_" + (vm + 1) + "…  →  VO de la partie " + (vm + 1));
  }

  var musicFile = findMedia("01_VO", "music");
  var musicItem = musicFile ? importFile(musicFile, B.vo) : null;
  if (!musicItem) missing.push("01_VO/music…  →  musique (avec sa source et sa licence pour les crédits)");

  // ---------------------------------------------------------------------
  // PRE — écran iPhone (la capture verticale, à la taille native de l'écran)
  // ---------------------------------------------------------------------

  var DUR3 = SECTIONS[2].dur;
  var preScreen = comp("PRE_iPhone_Screen", IPHONE_W, IPHONE_H, DUR3, B.pre);
  var cap = preScreen.layers.add(iphoneAdd.item);
  fill(cap, IPHONE_W, IPHONE_H, iphoneAdd.item.width, iphoneAdd.item.height);
  cap.startTime = 2;   // l'iPhone arrive d'abord, puis la capture démarre
  solidBg(preScreen, T.beige2, "Ecran au repos").moveToEnd();

  // ---------------------------------------------------------------------
  // PRE — mockup iPhone : coque, écran aux coins arrondis, Dynamic Island
  // ---------------------------------------------------------------------

  var BEZEL = 44, BODY_W = IPHONE_W + 2 * BEZEL, BODY_H = IPHONE_H + 2 * BEZEL;
  var MW = BODY_W + 80, MH = BODY_H + 80;
  var preMock = comp("PRE_iPhone_Mockup", MW, MH, DUR3, B.pre);
  preMock.bgColor = [0, 0, 0];

  if (mockItem) {
    // Mockup fourni : la capture passe dessous, cadrée sur l'écran.
    var sl = preMock.layers.add(preScreen);
    sl.name = "ECRAN (capture)";
    var ml = preMock.layers.add(mockItem);
    ml.name = "MOCKUP (" + decodeURI(mockFile.name) + ")";
    fill(ml, MW, MH, mockItem.width, mockItem.height);
    sl.property("ADBE Transform Group").property("ADBE Position").setValue([MW / 2, MH / 2]);
  } else {
    var body = addRect(preMock, "Coque", BODY_W, BODY_H, 190, "#1B1B1D", MW / 2, MH / 2);
    var frame = addRect(preMock, "Cadre", BODY_W - 10, BODY_H - 10, 186, "#3A3A3D", MW / 2, MH / 2);
    var glass = addRect(preMock, "Verre", IPHONE_W + 8, IPHONE_H + 8, 152, "#000000", MW / 2, MH / 2);
    var screenL = preMock.layers.add(preScreen);
    screenL.name = "ECRAN (capture)";
    screenL.property("ADBE Transform Group").property("ADBE Position").setValue([MW / 2, MH / 2]);
    var matte = addRect(preMock, "Cache ecran (coins arrondis)", IPHONE_W, IPHONE_H, 148, "#FFFFFF", MW / 2, MH / 2);
    setAlphaMatte(screenL, matte);
    addRect(preMock, "Dynamic Island", 372, 110, 55, "#000000", MW / 2, MH / 2 - IPHONE_H / 2 + 36 + 55);
    // boutons latéraux
    addRect(preMock, "Bouton marche", 14, 300, 6, "#2A2A2D", MW / 2 + BODY_W / 2 + 4, MH / 2 - 520);
    addRect(preMock, "Volume +", 14, 200, 6, "#2A2A2D", MW / 2 - BODY_W / 2 - 4, MH / 2 - 600);
    addRect(preMock, "Volume -", 14, 200, 6, "#2A2A2D", MW / 2 - BODY_W / 2 - 4, MH / 2 - 360);
    // Ordre obtenu (haut → bas) : boutons, île, cache, écran, verre, cadre, coque.
  }

  // ---------------------------------------------------------------------
  // PRE — schéma « sous le capot » (fidèle au code : web/lib/hybridAI,
  // mobile/src/services/hybridAI). Firebase ne stocke pas les objets :
  // il sert l'IA de la Fiche express, modèle embarqué d'abord, Gemini ensuite.
  // ---------------------------------------------------------------------

  var DUR5 = SECTIONS[4].dur;
  var preSchema = comp("PRE_Schema_Firebase", W, H, DUR5, B.pre);
  solidBg(preSchema, T.beige, "BG beige");

  function node(c, title, subtitle, x, y, w, h, bg, fg, t) {
    var box = addRect(c, "BOX — " + title, w, h, 28, bg, x, y);
    addShadow(box, 40);
    var tt = addText(c, title, 40, fg, x, subtitle ? y - 10 : y + 14, FONT_BOLD);
    var layers = [box, tt];
    if (subtitle) layers.push(addText(c, subtitle, 24, fg === T.white ? T.beige : T.muted, x, y + 36, FONT_REG));
    for (var i = 0; i < layers.length; i++) reveal(layers[i], t, 20);
    popScale(box, t);
    return layers;
  }

  var title5 = addText(preSchema, "Under the hood", 64, T.ink, W / 2, 130, FONT_BOLD);
  reveal(title5, 0.3);
  var kicker5 = addText(preSchema, "Fiche express — powered by Firebase AI Logic", 32, T.orange, W / 2, 190, FONT_SEMI);
  reveal(kicker5, 0.8);

  node(preSchema, "iPhone", "photo → Apple Vision", 260, 420, 300, 150, T.white, T.ink, 2);
  node(preSchema, "Web", "photo in Chrome", 260, 740, 300, 150, T.white, T.ink, 2.6);
  addArrow(preSchema, "ARROW iPhone > on-device", [410, 420], [565, 420], T.ink, 5);
  addArrow(preSchema, "ARROW Web > on-device", [410, 740], [565, 470], T.ink, 5.3);

  node(preSchema, "On-device AI", "Apple Foundation Models · Chrome built-in AI", 760, 420, 390, 170, T.orange, T.white, 6.5);
  addArrow(preSchema, "ARROW on-device > card", [955, 420], [1145, 420], T.ink, 10);

  var fallbackLbl = addText(preSchema, "not available on this device?", 26, T.muted, 760, 590, FONT_REG);
  reveal(fallbackLbl, 13);
  addArrow(preSchema, "ARROW on-device > Firebase (fallback)", [760, 505], [760, 655], T.muted, 13, true);
  node(preSchema, "Firebase AI Logic", "App Check · Gemini in the cloud", 760, 760, 390, 170, T.ink, T.white, 14.5);
  addArrow(preSchema, "ARROW Firebase > card", [955, 740], [1150, 480], T.ink, 18);

  node(preSchema, "Item card", "name · category · description", 1320, 420, 340, 170, T.white, T.ink, 11);
  var promise = addText(preSchema, "Same code path.\rOn device first.\rCloud only when needed.", 34, T.ink, 1180, 700, FONT_SEMI, "left");
  reveal(promise, 20);

  var privacy = addText(preSchema,
    "On device, the photo never leaves your browser. In the cloud, it is sent to Gemini through Firebase AI Logic.",
    26, T.muted, W / 2, 1000, FONT_REG);
  reveal(privacy, 24);

  // ---------------------------------------------------------------------
  // Les six parties
  // ---------------------------------------------------------------------

  var parts = [];

  // 1 — Accroche
  var s1 = comp("S1_Hook", W, H, SECTIONS[0].dur, B.parts);
  solidBg(s1, T.ink, "BG ink");
  var h1 = addText(s1, "Where did I put it?", 110, T.white, W / 2, 480, FONT_BOLD);
  reveal(h1, 0.6); hide(h1, 5);
  var h2 = addText(s1, "What do I even own?", 110, T.white, W / 2, 480, FONT_BOLD);
  reveal(h2, 5.2); hide(h2, 9);
  var h3 = addText(s1, "Most of us have no idea.", 54, T.tertiary, W / 2, 620, FONT_REG);
  reveal(h3, 6.5); hide(h3, 9);
  var l1 = addLogo(s1, W / 2, 470, 240);
  reveal(l1, 9.3, 0); popScale(l1, 9.3);
  var n1 = addText(s1, "Tiroir", 96, T.white, W / 2, 700, FONT_BOLD);
  reveal(n1, 9.8);
  parts.push(s1);

  // 2 — Tiroir en vrai (rushes de Stéphane)
  var s2 = comp("S2_RealLife", W, H, SECTIONS[1].dur, B.parts);
  solidBg(s2, T.ink, "BG ink");
  var slot = SECTIONS[1].dur / RUSHES.length;
  for (var q = 0; q < RUSHES.length; q++) {
    var rl = s2.layers.add(RUSHES[q].m.item);
    rl.startTime = q * slot;
    rl.outPoint = (q + 1) * slot;
    fill(rl, W, H, RUSHES[q].m.item.width, RUSHES[q].m.item.height);
    var capL = addText(s2, RUSHES[q].caption, 56, T.white, W / 2, 960, FONT_BOLD);
    capL.startTime = 0;
    capL.inPoint = q * slot; capL.outPoint = (q + 1) * slot;
    addShadow(capL, 120);
    reveal(capL, q * slot + 0.5);
  }
  parts.push(s2);

  // 3 — Ajout depuis l'iPhone : téléphone à gauche, explications à droite
  var s3 = comp("S3_iPhone", W, H, DUR3, B.parts);
  solidBg(s3, T.beige, "BG beige");
  var phone = s3.layers.add(preMock);
  phone.name = "iPhone (mockup)";
  var phoneScale = (H * 0.9) / MH * 100;
  phone.property("ADBE Transform Group").property("ADBE Scale").setValue([phoneScale, phoneScale]);
  phone.property("ADBE Transform Group").property("ADBE Position").setValue([620, H / 2]);
  addShadow(phone, 70);
  var ph = phone.property("ADBE Transform Group").property("ADBE Position");
  ph.setValueAtTime(0, [620, H + MH * phoneScale / 200]);
  ph.setValueAtTime(1.4, [620, H / 2]);
  easeKeys(ph);
  var steps = [
    { t: 2.5,  big: "Snap a photo.",                small: "Straight from the iPhone." },
    { t: 10,   big: "Tiroir reads the item.",       small: "Name, category, description." },
    { t: 18,   big: "Check the card. Done.",        small: "Filed in the right collection." }
  ];
  for (var st = 0; st < steps.length; st++) {
    var y0 = 360 + st * 170;
    var num = addText(s3, "0" + (st + 1), 40, T.orange, 1120, y0, FONT_BOLD, "left");
    var big = addText(s3, steps[st].big, 60, T.ink, 1200, y0, FONT_BOLD, "left");
    var small = addText(s3, steps[st].small, 34, T.muted, 1200, y0 + 56, FONT_REG, "left");
    reveal(num, steps[st].t); reveal(big, steps[st].t + 0.1); reveal(small, steps[st].t + 0.3);
  }
  parts.push(s3);

  // 4 — Web : captures 16/9 dans une fenêtre de navigateur
  var s4 = comp("S4_Web", W, H, SECTIONS[3].dur, B.parts);
  solidBg(s4, T.beige, "BG beige");
  var half = SECTIONS[3].dur / 2;
  var WIN_W = 1600, WIN_H = 900 + 56;
  var win = addRect(s4, "Fenetre navigateur", WIN_W + 16, WIN_H + 16, 24, T.white, W / 2, 560);
  addShadow(win, 60);
  addRect(s4, "Barre d'adresse", 900, 30, 15, T.beige2, W / 2, 560 - WIN_H / 2 + 30);
  addText(s4, "tiroir.app", 20, T.muted, W / 2, 560 - WIN_H / 2 + 37, FONT_REG);
  var webShots = [
    { m: webCollections, big: "Every collection, at a glance." },
    { m: webFiche,       big: "Open an item. Everything is there." }
  ];
  for (var ws = 0; ws < webShots.length; ws++) {
    var wl = s4.layers.add(webShots[ws].m.item);
    wl.startTime = ws * half;
    wl.inPoint = ws * half; wl.outPoint = (ws + 1) * half;
    var sc = Math.min(WIN_W / webShots[ws].m.item.width, 900 / webShots[ws].m.item.height) * 100;
    wl.property("ADBE Transform Group").property("ADBE Scale").setValue([sc, sc]);
    wl.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, 560 + 28]);
    var wt = addText(s4, webShots[ws].big, 48, T.ink, W / 2, 66, FONT_BOLD);
    wt.inPoint = ws * half; wt.outPoint = (ws + 1) * half;
    reveal(wt, ws * half + 0.4, 16);
  }
  win.moveToEnd(); s4.layer("BG beige").moveToEnd();
  parts.push(s4);

  // 5 — Sous le capot
  var s5 = comp("S5_UnderTheHood", W, H, DUR5, B.parts);
  s5.layers.add(preSchema);
  parts.push(s5);

  // 6 — Fin : logo, appel à l'action, crédits
  var s6 = comp("S6_End", W, H, SECTIONS[5].dur, B.parts);
  solidBg(s6, T.orange, "BG orange");
  var l6 = addLogo(s6, W / 2, 330, 220);
  popScale(l6, 0.3); reveal(l6, 0.3, 0);
  var cta = addText(s6, "Know what you own.\rFind it in seconds.", 72, T.white, W / 2, 560, FONT_BOLD);
  reveal(cta, 1);
  var site = addText(s6, "tiroir.app", 48, T.ink, W / 2, 770, FONT_SEMI);
  reveal(site, 2);
  hide(l6, 7); hide(cta, 7); hide(site, 7);

  var mockCredit = mockItem
    ? "iPhone mockup: [SOURCE — LICENSE]"
    : "iPhone mockup drawn in After Effects (no third-party asset)";
  var musicCredit = "Music: [TITLE — ARTIST — SOURCE — LICENSE]";
  var credits = addText(s6,
    "Designed and made by Clément Ougier\r" +
    "Filmed by Stéphane\r" +
    "AI on device and in the cloud with Firebase AI Logic & Gemini\r" +
    "Made with the help of Claude Opus 5 (Anthropic)\r" +
    musicCredit + "\r" + mockCredit,
    38, T.white, W / 2, 340, FONT_REG);
  credits.inPoint = 7;
  reveal(credits, 7.3);
  parts.push(s6);

  // ---------------------------------------------------------------------
  // Composition principale
  // ---------------------------------------------------------------------

  var total = 0;
  for (var i = 0; i < SECTIONS.length; i++) total += SECTIONS[i].dur;
  var voDur = voFullItem ? voFullItem.duration : 0;
  var main = comp("MAIN_Tiroir_Demo_EN_16x9", W, H, Math.max(total, voDur), B.comps);

  var tAt = 0, starts = [];
  for (var k = 0; k < parts.length; k++) {
    var pl = main.layers.add(parts[k]);
    pl.startTime = tAt;
    starts.push(tAt);
    tAt += SECTIONS[k].dur;
  }
  // Marqueurs des six parties (avec leur durée).
  for (var m = 0; m < SECTIONS.length; m++) {
    var mv = new MarkerValue(SECTIONS[m].marker);
    mv.duration = SECTIONS[m].dur;
    try { main.markerProperty.setValueAtTime(starts[m], mv); } catch (e) {
      // AE < 14.1 : pas de marqueurs de compo ; on les pose sur le calque de la partie.
      main.layer(parts[m].name).property("ADBE Marker").setValueAtTime(starts[m], mv);
    }
  }

  if (voFullItem) {
    var vl = main.layers.add(voFullItem); vl.name = "VO (EN)"; vl.moveToEnd();
  } else {
    for (var vq = 0; vq < voParts.length; vq++) {
      if (!voParts[vq]) continue;
      var vpl = main.layers.add(voParts[vq]);
      vpl.name = "VO " + (vq + 1) + " (EN)";
      vpl.startTime = starts[vq];
      vpl.moveToEnd();
    }
    if (voFoundParts === 0) {
      // Doublure guide : visible au montage, jamais au rendu.
      var vph = P.importPlaceholder("MISSING — English voice-over", W, H, FPS, main.duration);
      vph.parentFolder = B.vo;
      var vgl = main.layers.add(vph);
      vgl.guideLayer = true; vgl.enabled = false;
      try { vgl.audioEnabled = false; } catch (e) {}
      vgl.moveToEnd();
    }
  }
  if (musicItem) {
    var mu = main.layers.add(musicItem);
    mu.name = "Music";
    var lv = mu.property("ADBE Audio Group").property("ADBE Audio Levels");
    lv.setValue([-14, -14]);   // sous la voix ; à régler à l'oreille
    mu.moveToEnd();
  }

  // ---------------------------------------------------------------------
  // File de rendu → 06_Exports, puis enregistrement
  // ---------------------------------------------------------------------

  try {
    var rq = P.renderQueue.items.add(main);
    rq.outputModule(1).file = File(sub("06_Exports").fsName + "/Tiroir_Demo_EN_16x9.mov");
  } catch (e) {}

  var aep = File(HERE.fsName + "/" + PROJECT_NAME + ".aep");
  if (aep.exists) {
    var d = new Date();
    var stamp = d.getFullYear() + "" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + (d.getDate() < 10 ? "0" : "") + d.getDate() +
      "_" + (d.getHours() < 10 ? "0" : "") + d.getHours() + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
    aep = File(HERE.fsName + "/" + PROJECT_NAME + "_" + stamp + ".aep");
  }
  P.save(aep);
  main.openInViewer();
  app.endUndoGroup();

  // ---------------------------------------------------------------------
  // Bilan
  // ---------------------------------------------------------------------

  var msg = "Projet enregistré :\n" + decodeURI(aep.name) +
    "\n\nCadence : " + fpsNote +
    "\nCharte : " + tokensSource +
    "\nDurée : " + Math.round(main.duration) + " s (cible 2 à 3 min, à vérifier dans le règlement)";
  if (missing.length) {
    msg += "\n\nIl reste à fournir (" + missing.length + ") :\n• " + missing.join("\n• ") +
      "\n\nDépose les fichiers sous ces noms puis relance le script,\nou remplace chaque doublure MISSING (Fichier › Remplacer le métrage).";
  } else {
    msg += "\n\nTous les médias attendus ont été trouvés.";
  }
  msg += "\n\nCrédits à compléter dans S6_End : musique" + (mockItem ? " et mockup." : ".");
  alert(msg);

})();
