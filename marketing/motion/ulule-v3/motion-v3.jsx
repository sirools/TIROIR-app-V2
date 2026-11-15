#target aftereffects
/*
  Motion V3 Ulule — Tiroir
  Script After Effects (ExtendScript). Fichier > Scripts > Exécuter le fichier de script…

  Lit, à côté de ce fichier :
    manifest.json  — scènes, plans vidéo, temps, captures à incruster, musique, rendus
    textes.json    — titres, sous-titres, bulles, signature (modifiable sans toucher au script)

  Premier lancement : construit le montage (une composition par scène, la composition
  principale de 55 s, la version carrée, la file de rendu).
  Lancements suivants : propose de recaler la musique sur le marqueur DROP.
*/
(function motionV3() {

  var ICI = new File($.fileName).parent;
  var manquants = [];
  var notes = [];
  // Liste sans doublon.
  manquants.push = notes.push = function (v) {
    var i;
    for (i = 0; i < this.length; i++) { if (this[i] === v) { return this.length; } }
    this[this.length] = v;
    return this.length;
  };

  // ---------- Fichiers ----------
  function chemin(rel) { return ICI.fsName + "/" + rel; }

  function lireJSON(nom) {
    var f = new File(chemin(nom));
    if (!f.exists) { throw new Error("Fichier introuvable : " + f.fsName); }
    f.encoding = "UTF-8";
    f.open("r");
    var s = f.read();
    f.close();
    if (s.charCodeAt(0) === 0xFEFF) { s = s.substring(1); }
    if (typeof JSON !== "undefined" && JSON.parse) { return JSON.parse(s); }
    return eval("(" + s + ")");
  }

  // Cherche un fichier dans une liste de dossiers (relatifs à ce script, ou absolus).
  function trouver(nom, dossiers) {
    var i, f, d;
    for (i = 0; i < dossiers.length; i++) {
      d = dossiers[i];
      if (d.charAt(0) === "/" || d.charAt(0) === "~" || d.charAt(1) === ":") {
        f = new File(d + "/" + nom);
      } else {
        f = new File(chemin(d === "" ? nom : d + "/" + nom));
      }
      if (f.exists) { return f; }
    }
    return null;
  }

  function trouverAvecExtensions(base, dossiers, exts) {
    var i, f;
    for (i = 0; i < exts.length; i++) {
      f = trouver(base + "." + exts[i], dossiers);
      if (f) { return f; }
    }
    return null;
  }

  var cacheImport = {};
  function importer(fichier, dossierProjet) {
    var cle = fichier.fsName;
    if (cacheImport[cle]) { return cacheImport[cle]; }
    var io = new ImportOptions(fichier);
    if (io.canImportAs(ImportAsType.FOOTAGE)) { io.importAs = ImportAsType.FOOTAGE; }
    var item = app.project.importFile(io);
    item.parentFolder = dossierProjet;
    cacheImport[cle] = item;
    return item;
  }

  // ---------- Petits outils ----------
  function rvb(hex) {
    return [parseInt(hex.substr(1, 2), 16) / 255, parseInt(hex.substr(3, 2), 16) / 255, parseInt(hex.substr(5, 2), 16) / 255];
  }

  function dimensions(prop) {
    var t = prop.propertyValueType;
    if (t === PropertyValueType.ThreeD) { return 3; }
    if (t === PropertyValueType.TwoD) { return 2; }
    return 1;
  }

  // Courbe douce sur toutes les clés d'une propriété.
  function adoucir(prop) {
    var n = dimensions(prop), k, i, e = [];
    for (i = 0; i < n; i++) { e.push(new KeyframeEase(0, 75)); }
    for (k = 1; k <= prop.numKeys; k++) {
      try { prop.setTemporalEaseAtKey(k, e, e); } catch (err) {}
    }
  }

  function cles(prop, temps, valeurs) {
    var i;
    for (i = 0; i < temps.length; i++) { prop.setValueAtTime(temps[i], valeurs[i]); }
    adoucir(prop);
  }

  // Apparition : opacité 0 → 100 et léger glissement vers le haut, puis disparition.
  function apparaitre(calque, debut, fin, glissement) {
    var dIn = 0.4, dOut = 0.3;
    cles(calque.opacity, [debut, debut + dIn, fin - dOut, fin], [0, 100, 100, 0]);
    if (glissement) {
      var p = calque.position.value;
      cles(calque.position, [debut, debut + dIn + 0.1], [[p[0], p[1] + glissement], [p[0], p[1]]]);
    }
  }

  function styleTexte(calque, police, taille, couleur, justification) {
    var prop = calque.property("ADBE Text Properties").property("ADBE Text Document");
    var doc = prop.value;
    doc.resetCharStyle();
    doc.font = police;
    doc.fontSize = taille;
    doc.applyFill = true;
    doc.fillColor = couleur;
    doc.applyStroke = false;
    doc.justification = justification;
    prop.setValue(doc);
  }

  // Place le point d'ancrage au centre du texte réellement affiché.
  function centrerAncre(calque) {
    var r = calque.sourceRectAtTime(0, false);
    calque.anchorPoint.setValue([r.left + r.width / 2, r.top + r.height / 2]);
    return r;
  }

  function texteBloc(comp, texte, largeur, police, taille, couleur, x, y) {
    var c = comp.layers.addBoxText([largeur, taille * 6], texte);
    styleTexte(c, police, taille, couleur, ParagraphJustification.CENTER_JUSTIFY);
    var r = centrerAncre(c);
    c.position.setValue([x, y]);
    return { calque: c, rect: r };
  }

  function texteLigne(comp, texte, police, taille, couleur, x, y) {
    var c = comp.layers.addText(texte);
    styleTexte(c, police, taille, couleur, ParagraphJustification.CENTER_JUSTIFY);
    var r = centrerAncre(c);
    c.position.setValue([x, y]);
    return { calque: c, rect: r };
  }

  // Calque de forme : rectangle arrondi, plus une pointe de bulle facultative.
  function formeArrondie(comp, nom, largeur, hauteur, rayon, couleur, x, y, pointe) {
    var c = comp.layers.addShape();
    c.name = nom;
    var racine = c.property("ADBE Root Vectors Group");
    var groupe = racine.addProperty("ADBE Vector Group");
    var contenu = groupe.property("ADBE Vectors Group");
    var rect = contenu.addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([largeur, hauteur]);
    rect.property("ADBE Vector Rect Roundness").setValue(rayon);
    if (pointe) {
      contenu = c.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
      var chemin2 = contenu.addProperty("ADBE Vector Shape - Group");
      var s = new Shape();
      s.vertices = pointe;
      s.closed = true;
      chemin2.property("ADBE Vector Shape").setValue(s);
    }
    contenu = c.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
    var fond = contenu.addProperty("ADBE Vector Graphic - Fill");
    fond.property("ADBE Vector Fill Color").setValue([couleur[0], couleur[1], couleur[2], 1]);
    c.position.setValue([x, y]);
    return c;
  }

  function marqueurComp(comp, temps, nom) {
    try { comp.markerProperty.setValueAtTime(temps, new MarkerValue(nom)); } catch (err) {
      notes.push("Marqueur de composition « " + nom + " » non posé (version d'After Effects trop ancienne).");
    }
  }

  function trouverComp(nom) {
    var i, it;
    for (i = 1; i <= app.project.numItems; i++) {
      it = app.project.item(i);
      if (it instanceof CompItem && it.name === nom) { return it; }
    }
    return null;
  }

  // ---------- Recalage de la musique ----------
  function recalerMusique(comp) {
    var calque = null, i;
    for (i = 1; i <= comp.numLayers; i++) {
      if (comp.layer(i).name === "musique") { calque = comp.layer(i); }
    }
    if (!calque) { alert("Aucun calque « musique » dans " + comp.name + "."); return; }
    var mk = calque.property("ADBE Marker");
    var tDrop = null, tSig = null;
    for (i = 1; i <= mk.numKeys; i++) {
      if (mk.keyValue(i).comment === "DROP") { tDrop = mk.keyTime(i); }
    }
    try {
      var cm = comp.markerProperty;
      for (i = 1; i <= cm.numKeys; i++) {
        if (cm.keyValue(i).comment === "SIGNATURE") { tSig = cm.keyTime(i); }
      }
    } catch (err) {}
    if (tDrop === null || tSig === null) {
      alert("Il faut un marqueur DROP sur le calque musique et un marqueur SIGNATURE sur la composition.");
      return;
    }
    app.beginUndoGroup("Motion V3 — recaler la musique");
    calque.startTime = calque.startTime + (tSig - tDrop);
    app.endUndoGroup();
    alert("Musique recalée : le DROP tombe sur SIGNATURE (" + tSig.toFixed(2) + " s).");
  }

  // ---------- Construction ----------
  function construire() {
    var M = lireJSON("manifest.json");
    var T = lireJSON("textes.json");
    var W = M.largeur, H = M.hauteur, FPS = M.images_par_seconde, DUREE = M.duree;
    var C = {};
    var k;
    for (k in M.couleurs) { if (M.couleurs.hasOwnProperty(k)) { C[k] = rvb(M.couleurs[k]); } }
    var POLICE_TITRE = T.polices.titre, POLICE_TEXTE = T.polices.texte;

    var racine = app.project.items.addFolder("MOTION V3 — Ulule");
    var dMedias = app.project.items.addFolder("medias"); dMedias.parentFolder = racine;
    var dScenes = app.project.items.addFolder("scenes"); dScenes.parentFolder = racine;
    var dEcrans = app.project.items.addFolder("ecrans a incruster"); dEcrans.parentFolder = racine;

    function fondUni(comp, couleur, nom) {
      var s = comp.layers.addSolid(couleur, nom, W, H, 1, comp.duration);
      return s;
    }

    function ajusterAuCadre(calque, item, largeur, hauteur) {
      if (item.width && item.height && (item.width !== largeur || item.height !== hauteur)) {
        var e = Math.max(largeur / item.width, hauteur / item.height) * 100;
        calque.scale.setValue([e, e, 100]);
      }
    }

    // Logo (fichier facultatif), sinon le mot « Tiroir » en texte.
    function logo(comp, x, y, taille, debut, fin) {
      var f = trouver(M.logo.fichier, M.dossiers.assets);
      var c;
      if (f) {
        var it = importer(f, dMedias);
        c = comp.layers.add(it);
        var e = taille / Math.max(it.width, it.height) * 100;
        c.position.setValue([x, y]);
        cles(c.scale, [debut, debut + 0.6], [[e * 0.82, e * 0.82, 100], [e, e, 100]]);
      } else {
        manquants.push(M.logo.fichier + " (logo ; remplacé par le mot « Tiroir »)");
        c = texteLigne(comp, "Tiroir", POLICE_TITRE, taille * 0.6, C.orange, x, y).calque;
      }
      c.name = "logo_tiroir";
      c.inPoint = debut; c.outPoint = fin;
      cles(c.opacity, [debut, debut + 0.4], [0, 100]);
      var ff = trouver(M.logo.flamme, M.dossiers.assets);
      if (ff) {
        var fl = comp.layers.add(importer(ff, dMedias));
        fl.name = "flamme_bleue";
        var ef = taille * 0.45 / Math.max(fl.source.width, fl.source.height) * 100;
        fl.scale.setValue([ef, ef, 100]);
        fl.position.setValue([x + taille * 0.48, y - taille * 0.48]);
        fl.inPoint = debut; fl.outPoint = fin;
        cles(fl.opacity, [debut + 0.3, debut + 0.8], [0, 100]);
      } else {
        notes.push("Flamme bleue absente (" + M.logo.flamme + ") : le logo est posé sans elle.");
      }
      return c;
    }

    // Précomposition d'écran à incruster, posée masquée au-dessus du plan avec un effet Quatre coins.
    function ecranAIncruster(comp, plan, ecran, rang, debutRel, duree) {
      var pc = app.project.items.addComp(ecran.nom, M.ecran.largeur, M.ecran.hauteur, 1, duree, FPS);
      pc.parentFolder = dEcrans;
      var n = ecran.captures.length, i, pas = n > 0 ? duree / n : duree, trouves = 0;
      for (i = 0; i < n; i++) {
        var base = M.captures[String(ecran.captures[i])];
        var f = base ? trouverAvecExtensions(base, M.dossiers.ecrans, ["png", "jpg", "jpeg", "PNG", "JPG", "mp4", "mov"]) : null;
        if (f) {
          var it = importer(f, dMedias);
          var cl = pc.layers.add(it);
          ajusterAuCadre(cl, it, M.ecran.largeur, M.ecran.hauteur);
          cl.startTime = i * pas;
          cl.inPoint = i * pas;
          cl.outPoint = Math.min(duree, (i + 1) * pas);
          trouves++;
        } else {
          manquants.push("ecrans/" + (base || ("capture " + ecran.captures[i])) + ".png (capture n° " + ecran.captures[i] + ")");
        }
      }
      if (n === 0) {
        var noir = pc.layers.addSolid([0, 0, 0], "ecran eteint", M.ecran.largeur, M.ecran.hauteur, 1, duree);
        noir.name = "ecran eteint";
      } else if (trouves === 0) {
        var rep = pc.layers.addText("Capture n° " + ecran.captures.join(", n° ") + "\r à déposer dans ecrans/");
        styleTexte(rep, POLICE_TEXTE, 70, C.muted, ParagraphJustification.CENTER_JUSTIFY);
        rep.position.setValue([M.ecran.largeur / 2, M.ecran.hauteur / 2]);
        rep.guideLayer = true;
      }
      var c = comp.layers.add(pc);
      c.name = ecran.nom + " [à suivre : Quatre coins]";
      c.startTime = debutRel;
      c.inPoint = debutRel; c.outPoint = debutRel + duree;
      c.scale.setValue([22, 22, 100]);
      c.position.setValue([W / 2 + (rang - 0.5 * (plan.ecrans.length - 1)) * 320, H / 2]);
      try { c.property("ADBE Effect Parade").addProperty("ADBE Corner Pin"); } catch (err) {
        notes.push("Effet Quatre coins non ajouté sur " + ecran.nom + ".");
      }
      c.enabled = false;
      return c;
    }

    function ajouterPlan(comp, scene, plan) {
      var debutRel = plan.debut - scene.debut, duree = plan.fin - plan.debut;
      var f = trouver(plan.fichier, M.dossiers.plans);
      var c, i;
      if (!f) {
        manquants.push(plan.fichier + " (plan " + plan.id + ")");
        c = comp.layers.addSolid(C.ink, plan.id + " MANQUANT", W, H, 1, duree);
        c.startTime = debutRel;
        var av = texteLigne(comp, plan.id + " — " + plan.fichier + " introuvable", POLICE_TEXTE, 44, C.white, W / 2, H / 2).calque;
        av.inPoint = debutRel; av.outPoint = debutRel + duree;
      } else {
        var it = importer(f, dMedias);
        if (M.conformer_la_cadence) {
          try { it.mainSource.conformFrameRate = FPS; } catch (err) {}
        }
        c = comp.layers.add(it);
        var entree = plan.entree || 0;
        var dispo = it.duration - entree;
        if (dispo <= 0) { entree = 0; dispo = it.duration; }
        var etire = 100;
        if (dispo < duree) {
          etire = 100 * duree / dispo;
          notes.push(plan.id + " : source trop courte de " + (duree - dispo).toFixed(2) + " s, ralentie à " + etire.toFixed(1) + " %.");
        }
        c.stretch = etire;
        c.startTime = debutRel - entree * etire / 100;
        c.inPoint = debutRel;
        c.outPoint = debutRel + duree;
        if (etire !== 100) {
          try { c.frameBlendingType = FrameBlendingType.FRAME_MIX; comp.frameBlending = true; } catch (err2) {}
        }
        ajusterAuCadre(c, it, W, H);
        try { c.audioEnabled = false; } catch (err3) {}
      }
      c.name = plan.id;
      if (plan.ecrans) {
        for (i = 0; i < plan.ecrans.length; i++) { ecranAIncruster(comp, plan, plan.ecrans[i], i, debutRel, duree); }
      }
      return c;
    }

    // Titre de scène : pastille orange et texte blanc, apparition décalée.
    function titre(comp, texte, debut, fin) {
      var t = comp.layers.addText(texte);
      styleTexte(t, POLICE_TITRE, 54, C.white, ParagraphJustification.LEFT_JUSTIFY);
      var r = centrerAncre(t);
      var x = M.titre.x + r.width / 2 + 30, y = M.titre.y;
      var p = formeArrondie(comp, "texte_titre_fond", r.width + 60, r.height + 36, (r.height + 36) / 2, C.orange, x, y, null);
      t.moveBefore(p);
      t.name = "texte_titre";
      t.position.setValue([x, y]);
      p.inPoint = debut; p.outPoint = fin; t.inPoint = debut; t.outPoint = fin;
      apparaitre(p, debut, fin, 24);
      apparaitre(t, debut + 0.12, fin, 24);
    }

    function bulle(comp, b, rang) {
      var tx = texteBloc(comp, b.texte, b.largeur - 56, b.gras ? POLICE_TITRE : POLICE_TEXTE, b.taille || 34, C.ink, b.x, b.y);
      var h = tx.rect.height + 52, pointe = null;
      if (b.queue === "haut") { pointe = [[b.queue_x - b.x - 20, -h / 2 + 2], [b.queue_x - b.x, -h / 2 - 34], [b.queue_x - b.x + 20, -h / 2 + 2]]; }
      if (b.queue === "bas") { pointe = [[b.queue_x - b.x - 20, h / 2 - 2], [b.queue_x - b.x, h / 2 + 34], [b.queue_x - b.x + 20, h / 2 - 2]]; }
      var f = formeArrondie(comp, "bulle_0" + rang + "_" + b.qui, b.largeur, h, 26, b.gras ? C.beige : C.white, b.x, b.y, pointe);
      try {
        var ombre = f.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
        ombre.property("ADBE Drop Shadow-0002").setValue(30);
        ombre.property("ADBE Drop Shadow-0004").setValue(8);
        ombre.property("ADBE Drop Shadow-0005").setValue(24);
      } catch (err) {}
      tx.calque.moveBefore(f);
      tx.calque.name = "bulle_0" + rang + "_" + b.qui + "_texte";
      tx.calque.parent = f;
      f.inPoint = b.debut; f.outPoint = b.fin; tx.calque.inPoint = b.debut; tx.calque.outPoint = b.fin;
      cles(f.scale, [b.debut, b.debut + 0.35], [[88, 88, 100], [100, 100, 100]]);
      cles(f.opacity, [b.debut, b.debut + 0.25, b.fin - 0.25, b.fin], [0, 100, 100, 0]);
      cles(tx.calque.opacity, [b.debut + 0.08, b.debut + 0.33, b.fin - 0.25, b.fin], [0, 100, 100, 0]);
    }

    function signature(comp, debut, fin) {
      logo(comp, W / 2, 330, 240, debut, fin);
      var l = texteBloc(comp, T.signature.ligne, 940, POLICE_TITRE, 62, C.ink, W / 2, 580).calque;
      l.name = "texte_signature";
      l.inPoint = debut; l.outPoint = fin;
      apparaitre(l, debut + 0.35, fin + 1, 28);
      var bt = texteLigne(comp, T.signature.bouton, POLICE_TITRE, 40, C.white, W / 2, 760);
      var bf = formeArrondie(comp, "bouton_ulule", bt.rect.width + 96, 92, 46, C.orange, W / 2, 760, null);
      bt.calque.moveBefore(bf);
      bt.calque.name = "bouton_ulule_texte";
      bf.inPoint = debut; bf.outPoint = fin; bt.calque.inPoint = debut; bt.calque.outPoint = fin;
      cles(bf.scale, [debut + 0.7, debut + 1.15], [[90, 90, 100], [100, 100, 100]]);
      cles(bf.opacity, [debut + 0.7, debut + 1.0], [0, 100]);
      cles(bt.calque.opacity, [debut + 0.8, debut + 1.1], [0, 100]);
    }

    // --- Une composition par scène ---
    var compsScenes = [], i, j, s, e, comp;
    for (i = 0; i < M.scenes.length; i++) {
      s = M.scenes[i];
      comp = app.project.items.addComp(s.id, W, H, 1, s.fin - s.debut, FPS);
      comp.parentFolder = dScenes;
      comp.bgColor = C.beige2;
      fondUni(comp, C.beige2, "fond");
      for (j = 0; j < s.elements.length; j++) {
        e = s.elements[j];
        if (e.type === "plan") { ajouterPlan(comp, s, e); }
        if (e.type === "logo") { logo(comp, W / 2, H / 2 - 40, 320, e.debut - s.debut, e.fin - s.debut); }
        if (e.type === "signature") { signature(comp, e.debut - s.debut, e.fin - s.debut); }
      }
      if (T.titres[s.id]) { titre(comp, T.titres[s.id], 0.4, Math.min(s.fin - s.debut - 0.2, 3.6)); }
      var rang = 0;
      for (j = 0; j < T.bulles.length; j++) {
        if (T.bulles[j].scene === s.id) { rang++; bulle(comp, T.bulles[j], rang); }
      }
      compsScenes.push(comp);
    }

    // --- Composition principale ---
    var principale = app.project.items.addComp(M.nom, W, H, 1, DUREE, FPS);
    principale.parentFolder = racine;
    principale.bgColor = C.beige2;

    // Musique, tout en bas.
    var fm = trouver(M.musique.fichier, M.dossiers.musique);
    var tSig = M.musique.signature;
    if (fm) {
      var mus = principale.layers.add(importer(fm, dMedias));
      mus.name = "musique";
      var dropFichier = M.musique.drop_dans_le_fichier;
      mus.startTime = (dropFichier === null || dropFichier === undefined) ? 0 : tSig - dropFichier;
      mus.property("ADBE Marker").setValueAtTime(tSig, new MarkerValue("DROP"));
      if (dropFichier === null || dropFichier === undefined) {
        notes.push("Musique : déplace le marqueur DROP du calque « musique » sur le vrai drop, puis relance le script pour recaler.");
      }
    } else {
      manquants.push(M.musique.fichier + " (musique)");
    }
    marqueurComp(principale, tSig, "SIGNATURE");

    for (i = 0; i < M.scenes.length; i++) {
      s = M.scenes[i];
      var cs = principale.layers.add(compsScenes[i]);
      cs.name = s.id;
      cs.startTime = s.debut;
      if (s.zoom) {
        // Poussée légère sur toute la scène ; le plan reste à 100 % dans sa composition, pour le suivi.
        cles(cs.scale, [s.debut, s.fin], [[100, 100, 100], [100 + s.zoom, 100 + s.zoom, 100]]);
      }
      if (s.fondu) { cles(cs.opacity, [s.debut, s.debut + s.fondu], [0, 100]); }
      marqueurComp(principale, s.debut, s.id);
    }

    // Sous-titres : texte blanc sur cartouche sombre, dans la zone de sécurité.
    for (i = 0; i < T.sous_titres.length; i++) {
      var st = T.sous_titres[i];
      var cart = formeArrondie(principale, "sous_titre_" + (i + 1) + "_fond", 100, 100, 18, C.ink, 0, 0, null);
      var tx = texteBloc(principale, st.texte, M.sous_titres.largeur, POLICE_TEXTE, M.sous_titres.taille, C.white, W / 2, M.sous_titres.y).calque;
      tx.name = "sous_titre_" + (i + 1);
      tx.moveBefore(cart);
      cart.anchorPoint.setValue([0, 0]);
      cart.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").expression =
        "var r = thisComp.layer(index - 1).sourceRectAtTime(time, false);\n[r.width + 64, r.height + 36]";
      cart.position.expression =
        "var L = thisComp.layer(index - 1);\nvar r = L.sourceRectAtTime(time, false);\nL.toComp([r.left + r.width / 2, r.top + r.height / 2])";
      cart.opacity.expression = "thisComp.layer(index - 1).transform.opacity * 0.78";
      tx.inPoint = st.debut; tx.outPoint = st.fin; cart.inPoint = st.debut; cart.outPoint = st.fin;
      cles(tx.opacity, [st.debut, st.debut + 0.2, st.fin - 0.2, st.fin], [0, 100, 100, 0]);
    }

    // --- Version carrée ---
    var carre = app.project.items.addComp(M.rendus.carre.nom, M.rendus.carre.cote, M.rendus.carre.cote, 1, DUREE, FPS);
    carre.parentFolder = racine;
    var cc = carre.layers.add(principale);
    cc.position.setValue([M.rendus.carre.cote / 2, M.rendus.carre.cote / 2]);

    // --- File de rendu ---
    var dossierRendus = new Folder(chemin(M.rendus.dossier));
    if (!dossierRendus.exists) { dossierRendus.create(); }
    function enFile(c, nomFichier) {
      var rq = app.project.renderQueue.items.add(c);
      var om = rq.outputModule(1);
      var modeles = om.templates, choisi = null, n;
      for (n = 0; n < modeles.length; n++) {
        if (modeles[n].indexOf("_HIDDEN") === 0) { continue; }
        if (/H\.?264/i.test(modeles[n])) {
          if (choisi === null || /15 ?Mbps/i.test(modeles[n])) { choisi = modeles[n]; }
        }
      }
      if (choisi) {
        om.applyTemplate(choisi);
        om.file = new File(dossierRendus.fsName + "/" + nomFichier + ".mp4");
      } else {
        om.file = new File(dossierRendus.fsName + "/" + nomFichier);
        notes.push("Aucun modèle de sortie H.264 dans cette version d'After Effects pour « " + c.name + " » : envoie la composition dans Media Encoder (Fichier > Exporter > Ajouter à la file d'attente Adobe Media Encoder).");
      }
    }
    enFile(principale, M.rendus.principal.fichier);
    enFile(carre, M.rendus.carre.fichier);

    principale.openInViewer();
  }

  // ---------- Lancement ----------
  if (!app.project) { app.newProject(); }
  var existante = trouverComp("MOTION_V3_55s");
  if (existante && confirm("Le montage existe déjà dans ce projet.\n\nOui : recaler la musique sur le marqueur DROP.\nNon : construire un nouveau montage à côté.")) {
    recalerMusique(existante);
    return;
  }

  app.beginUndoGroup("Motion V3 — construire le montage");
  try {
    construire();
  } catch (erreur) {
    app.endUndoGroup();
    alert("Motion V3 — arrêt sur une erreur :\n" + erreur.toString() + (erreur.line ? "\nLigne " + erreur.line : ""));
    return;
  }
  app.endUndoGroup();

  var bilan = "Motion V3 — montage construit.";
  if (manquants.length) { bilan += "\n\nFichiers introuvables (" + manquants.length + ") :\n- " + manquants.join("\n- "); }
  if (notes.length) { bilan += "\n\nÀ savoir :\n- " + notes.join("\n- "); }
  alert(bilan);

})();
