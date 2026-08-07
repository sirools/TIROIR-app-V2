#!/usr/bin/env python3
"""
Génère TOUS les visuels de marque Tiroir à partir d'une seule géométrie.

    python3 scripts/build-brand-assets.py

Le mannequin : une commode à deux tiroirs. Un bloc blanc fendu une fois,
deux poignées. C'est tout, et c'est voulu — l'icône doit survivre à 29 pt
(Réglages, Spotlight), taille à laquelle un trait de 30 px sur 1024 fait
0,85 pixel.

Deux règles gouvernent le dessin :

  - Tout tient dans le CERCLE INSCRIT, pas dans le carré. Android découpe
    en rond, watchOS aussi, le Play Store aussi. Ce qui dépasse du cercle
    est perdu quelque part.

  - La fente entre les deux tiroirs est un VIDE laissant voir le fond, et
    non un trait posé dessus. Un trait fin disparaît à la réduction ; un
    vide, jamais — il ronge ses voisins et reste lisible jusqu'au bout.

Pourquoi deux tiroirs et pas trois : à petite taille, trois barres
horizontales redeviennent le pictogramme « menu », ou celui d'une base de
données. Deux blocs inégaux séparés par une fente n'appartiennent qu'au
meuble.

Ce fichier est la SOURCE DE VÉRITÉ du mannequin. Modifier une icône à la
main la désynchronise des dix autres : rejouer le script à la place.
"""
import os
import xml.sax.saxutils as esc
from PIL import Image, ImageDraw

ICI = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.dirname(ICI)
WEB = os.path.join(os.path.dirname(MOBILE), 'web')

# `theme-color` du site vaut déjà #F26900 : l'icône s'aligne dessus plutôt
# que l'inverse. Le #FB6B14 d'origine était trop clair — le blanc posé
# dessus vibrait au lieu de trancher.
ORANGE = (242, 105, 0)
BLANC = (255, 255, 255)
VERT_SPLASH = (45, 80, 22)      # relevé au pixel sur le splash existant
CREME_SPLASH = (247, 243, 238)

SS = 4                          # suréchantillonnage : Pillow ne lisse pas les arrondis


# ── Le mannequin ─────────────────────────────────────────────────────
# Toutes les mesures sont exprimées en fraction de son côté, pour qu'un
# seul jeu de nombres serve du favicon 16 px au splash 1284 px.
COTE_RATIO = 520 / 1024         # part du côté occupée dans une icône carrée
RAYON = 0.200                   # arrondi des façades
FENTE_Y, FENTE_H = -0.0346, 0.050
HAUT, BAS = -0.500, 0.500
POIGNEE_DEMI, POIGNEE_EP = 0.1827, 0.0365


def mannequin(d, cx, cy, cote, encre, creux, ss=1):
    """Dessine la commode centrée sur (cx, cy), de côté `cote`.

    `encre`  : la couleur des façades.
    `creux`  : celle des poignées et de la fente — le fond, ou une
               transparence si l'on veut de vrais trous.
    """
    def u(v):
        return v * cote

    def rr(x0, y0, x1, y1, rad, fill):
        d.rounded_rectangle([(cx + u(x0)) * ss, (cy + u(y0)) * ss,
                             (cx + u(x1)) * ss, (cy + u(y1)) * ss],
                            radius=u(rad) * ss, fill=fill)

    demi = 0.5
    bas_fente = FENTE_Y + FENTE_H

    # Chaque façade est un rectangle arrondi dont on redresse le bord
    # intérieur : sans ça, la fente aurait quatre coins ronds et se
    # lirait comme un espacement, pas comme une séparation de meuble.
    rr(-demi, HAUT, demi, FENTE_Y, RAYON, encre)
    d.rectangle([(cx + u(-demi)) * ss, (cy + u(FENTE_Y - RAYON)) * ss,
                 (cx + u(demi)) * ss, (cy + u(FENTE_Y)) * ss], fill=encre)
    rr(-demi, bas_fente, demi, BAS, RAYON, encre)
    d.rectangle([(cx + u(-demi)) * ss, (cy + u(bas_fente)) * ss,
                 (cx + u(demi)) * ss, (cy + u(bas_fente + RAYON)) * ss], fill=encre)

    # La fente, en dernier : elle recreuse ce que les deux redressements
    # ci-dessus ont rempli.
    d.rectangle([(cx + u(-demi)) * ss, (cy + u(FENTE_Y)) * ss,
                 (cx + u(demi)) * ss, (cy + u(bas_fente)) * ss], fill=creux)

    # Chaque poignée est centrée dans SA façade. Décalée, même de 2 %,
    # elle casse le rythme vertical que l'œil lit en premier.
    for centre in ((HAUT + FENTE_Y) / 2, (bas_fente + BAS) / 2):
        rr(-POIGNEE_DEMI, centre - POIGNEE_EP,
           POIGNEE_DEMI, centre + POIGNEE_EP, POIGNEE_EP, creux)


def icone(taille, fond, encre=BLANC, part=COTE_RATIO, mode='RGB'):
    """Une icône carrée complète, mannequin centré."""
    W = taille * SS
    img = Image.new(mode, (W, W), fond)
    d = ImageDraw.Draw(img)
    mannequin(d, taille / 2, taille / 2, taille * part, encre, fond, ss=SS)
    return img.resize((taille, taille), Image.LANCZOS)


def ecrire(img, *chemin):
    p = os.path.join(*chemin)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p)
    print(f'  {os.path.relpath(p, os.path.dirname(MOBILE))}  ({img.width}×{img.height})')


# ── iOS et l'icône racine ────────────────────────────────────────────
# Sans canal alpha : l'App Store refuse une icône transparente, et c'est
# une erreur de soumission, pas un avertissement.
print('iOS / racine')
ecrire(icone(1024, ORANGE), MOBILE, 'assets', 'icon.png')
ecrire(icone(48, ORANGE), MOBILE, 'assets', 'favicon.png')

# ── Android, icône adaptative ────────────────────────────────────────
# Le premier plan fait 108 dp, mais seuls les 72 dp centraux sont
# garantis visibles : le lanceur rogne le reste, et les masques ronds
# rognent encore. Dessiner le mannequin à sa taille iOS le ferait
# déborder.
#
# Le facteur 72/108 n'est pas une marge de sécurité arbitraire : c'est
# exactement le rapport qui donne à l'icône Android la MÊME taille
# apparente qu'à l'iOS une fois le masque appliqué.
ANDROID_PART = COTE_RATIO * 72 / 108
print('Android')
ecrire(icone(1024, (0, 0, 0, 0), BLANC, ANDROID_PART, mode='RGBA'),
       MOBILE, 'assets', 'android-icon-foreground.png')

# Pas de fichier de fond : `adaptiveIcon.backgroundColor` suffit, et une
# image d'aplat orange ne ferait que dire deux fois la même chose — avec
# le risque qu'une des deux dérive un jour. (Si un fond dégradé devenait
# nécessaire, la clé à remplir serait `backgroundImage`.)

# Monochrome (Android 13+, icônes teintées) : le système ne lit QUE le
# canal alpha et applique sa propre couleur. Les poignées et la fente
# doivent donc être de vrais trous — remplies de noir, elles
# disparaîtraient sous la teinte.
ecrire(icone(1024, (0, 0, 0, 0), (0, 0, 0, 255), ANDROID_PART, mode='RGBA'),
       MOBILE, 'assets', 'android-icon-monochrome.png')

# ── Splash ───────────────────────────────────────────────────────────
# Le splash s'affiche juste après l'appui sur l'icône. Si le mannequin y
# diffère, la transition casse — d'où la reprise de la nouvelle forme.
#
# On REPEINT la zone du meuble plutôt que de régénérer l'image : un point
# vert isolé vit plus bas dans la composition, et le redessiner de
# mémoire le décalerait. La couleur reste le vert d'origine : passer le
# splash à l'orange est une décision de marque, pas une mise à jour
# d'icône.
print('Splash')
SPLASH_CX, SPLASH_CY, SPLASH_COTE = 642, 1328, 152

splash = Image.open(os.path.join(MOBILE, 'assets', 'splash-icon.png')).convert('RGB')
ImageDraw.Draw(splash).rectangle([520, 1220, 764, 1425], fill=CREME_SPLASH)

# Le tampon est TRANSPARENT, pas rempli de crème : un carré opaque de la
# taille du mannequin déborderait sur le point vert qui vit une centaine
# de pixels plus bas et l'effacerait sans bruit. Les poignées et la fente
# deviennent de vrais trous, à travers lesquels le fond d'origine
# reparaît — ce qui donne exactement le même rendu, sans rien recouvrir.
zone, marge = 4, 40
n = SPLASH_COTE + 2 * marge
tampon = Image.new('RGBA', (n * zone, n * zone), (0, 0, 0, 0))
mannequin(ImageDraw.Draw(tampon), n / 2, n / 2, SPLASH_COTE,
          VERT_SPLASH + (255,), (0, 0, 0, 0), ss=zone)
tampon = tampon.resize((n, n), Image.LANCZOS)
splash.paste(tampon, (SPLASH_CX - n // 2, SPLASH_CY - n // 2), tampon)
ecrire(splash, MOBILE, 'assets', 'splash-icon.png')

# ── Visuel de mise en avant Google Play ──────────────────────────────
# La composition marketing est conservée telle quelle : on n'y remplace
# que la vignette d'icône, relevée au pixel (92 × 92 en (96, 120)).
#
# Le fond derrière la vignette est un dégradé. Le combler d'une couleur
# unie laisserait une tache rectangulaire visible ; on interpole donc
# chaque ligne entre les deux pixels sains qui l'encadrent — le dégradé
# étant lisse et surtout horizontal, la reprise est invisible.
print('Store Android')
FG_X, FG_Y, FG_N, FG_RAD = 96, 120, 92, 22
fg_path = os.path.join(MOBILE, 'assets', 'store', 'feature-graphic.png')
feat = Image.open(fg_path).convert('RGB')
fpx = feat.load()
gauche, droite = FG_X - 4, FG_X + FG_N + 3
for y in range(FG_Y - 4, FG_Y + FG_N + 4):
    a, b = fpx[gauche, y], fpx[droite, y]
    for x in range(gauche + 1, droite):
        t = (x - gauche) / (droite - gauche)
        fpx[x, y] = tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3))

z = 8
vign = Image.new('RGBA', (FG_N * z, FG_N * z), (0, 0, 0, 0))
dv = ImageDraw.Draw(vign)
dv.rounded_rectangle([0, 0, FG_N * z, FG_N * z], radius=FG_RAD * z, fill=ORANGE + (255,))
mannequin(dv, FG_N / 2, FG_N / 2, FG_N * COTE_RATIO, BLANC + (255,), ORANGE + (255,), ss=z)
vign = vign.resize((FG_N, FG_N), Image.LANCZOS)
feat.paste(vign, (FG_X, FG_Y), vign)
ecrire(feat, MOBILE, 'assets', 'store', 'feature-graphic.png')

# ── Web ──────────────────────────────────────────────────────────────
print('Web')
ecrire(icone(256, ORANGE), WEB, 'public', 'icons', 'app-icon.png')
ecrire(icone(180, ORANGE), WEB, 'public', 'apple-touch-icon.png')

# Le .ico embarque plusieurs résolutions : Windows, les onglets et les
# raccourcis ne piochent pas la même. Un .ico à une seule taille se fait
# redimensionner par le système, qui le fait mal.
ico = icone(256, ORANGE)
ico.save(os.path.join(WEB, 'public', 'favicon.ico'), format='ICO',
         sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('  web/public/favicon.ico  (16 → 256)')


def svg():
    """Le master vectoriel : mêmes nombres, exprimés en SVG.

    Les poignées et la fente sont peintes en orange plutôt que découpées
    par un masque — un masque SVG se comporte mal dans les clients mail
    et les vieux moteurs, et le fond est de toute façon plein.
    """
    S = 1024
    c, cote = S / 2, S * COTE_RATIO

    def u(v):
        return round(c + v * cote, 2)

    o = f'rgb{ORANGE}'.replace(' ', '')
    b = f'rgb{BLANC}'.replace(' ', '')
    rad = round(RAYON * cote, 2)
    ep = round(POIGNEE_EP * cote, 2)
    bas_fente = FENTE_Y + FENTE_H
    parts = [
        f'<rect width="{S}" height="{S}" fill="{o}"/>',
        f'<rect x="{u(-0.5)}" y="{u(HAUT)}" width="{round(cote, 2)}" '
        f'height="{round((FENTE_Y - HAUT) * cote, 2)}" rx="{rad}" fill="{b}"/>',
        f'<rect x="{u(-0.5)}" y="{u(bas_fente)}" width="{round(cote, 2)}" '
        f'height="{round((BAS - bas_fente) * cote, 2)}" rx="{rad}" fill="{b}"/>',
    ]
    # Les bords intérieurs, redressés : deux bandeaux qui remplissent les
    # arrondis tournés vers la fente.
    for y0, y1 in ((FENTE_Y - RAYON, FENTE_Y), (bas_fente, bas_fente + RAYON)):
        parts.append(f'<rect x="{u(-0.5)}" y="{u(y0)}" width="{round(cote, 2)}" '
                     f'height="{round((y1 - y0) * cote, 2)}" fill="{b}"/>')
    for centre in ((HAUT + FENTE_Y) / 2, (bas_fente + BAS) / 2):
        parts.append(
            f'<rect x="{u(-POIGNEE_DEMI)}" y="{u(centre - POIGNEE_EP)}" '
            f'width="{round(2 * POIGNEE_DEMI * cote, 2)}" height="{round(2 * ep, 2)}" '
            f'rx="{ep}" fill="{o}"/>')
    # Ni width ni height : seul le viewBox. Le fichier sert à la fois de
    # favicon et de logo dans les pages ; une taille intrinsèque de
    # 1024 px obligerait chaque usage à la contredire en CSS.
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" '
            f'role="img" aria-label={esc.quoteattr("Tiroir")}>\n  '
            + '\n  '.join(parts) + '\n</svg>\n')


chemin_svg = os.path.join(WEB, 'public', 'logo-tiroir.svg')
with open(chemin_svg, 'w') as f:
    f.write(svg())
print('  web/public/logo-tiroir.svg  (vectoriel)')
