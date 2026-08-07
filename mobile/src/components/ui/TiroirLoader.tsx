import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Colors, Typography, Spacing } from './tokens'

/**
 * Palette propre au chargement : trois oranges plutôt que le vert
 * d'accentuation.
 *
 * Le vert est la couleur de l'action validée dans l'app — l'employer pour
 * une attente lui ferait dire deux choses. L'orange est déjà celle de la
 * capture, donc du geste en cours.
 *
 * Du plus foncé en bas au plus clair en haut : le meuble paraît lesté par
 * sa base, posé, plutôt qu'en équilibre.
 */
const DRAWER_TINTS = ['#FF9448', '#F26900', '#C24E00']

/**
 * Course de chaque tiroir, en fraction du débattement maximal.
 *
 * Des ouvertures inégales — un tiers, trois quarts, plein — donnent
 * l'image d'un meuble qu'on fouille. Trois tiroirs sortis d'autant se
 * liraient comme un accordéon.
 */
const DRAWER_OPENING = [1 / 3, 0.75, 1]

/** Largeur fermée (la façade visible) et largeur pleinement ouverte. */
const W_CLOSED = 26
const W_MAX = 58
const HANDLE_W = 7
const HANDLE_INSET = 3

const OPEN_MS = 340
const CLOSE_MS = 280

const widthOf = (i: number) => W_CLOSED + (W_MAX - W_CLOSED) * DRAWER_OPENING[i]

/**
 * Attente courte, à l'image du produit : trois tiroirs qui s'ouvrent vers
 * la droite, l'un après l'autre.
 *
 * Elle existe pour une raison précise — sans elle, l'accueil affichait
 * pendant une seconde « aucune collection » à quelqu'un qui en a dix. Un
 * état vide affiché à tort est pire qu'une attente : il annonce une perte.
 *
 * Les tiroirs S'ALLONGENT depuis leur bord gauche au lieu de glisser :
 * une barre qui se déplace quitte l'axe commun et se lit comme un objet
 * qui tombe. Trois façades qui s'étirent depuis un même bord dessinent le
 * meuble sans qu'on ait besoin de le tracer.
 *
 * `transformOrigin` fixe ce bord gauche, ce qui permet de garder scaleX —
 * donc `useNativeDriver`. Animer la largeur repasserait par le fil JS,
 * celui-là même qui est occupé à charger les données qu'on attend.
 */
export function TiroirLoader({ label }: { label?: string }) {
  const drawers = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ]

  useEffect(() => {
    // inOut aux deux bouts : un tiroir tiré à la main démarre doucement,
    // prend de la vitesse et s'arrête sans butée. Une courbe qui n'est
    // adoucie qu'à une extrémité laisse toujours un départ ou une fin
    // mécanique.
    const open = (v: Animated.Value) =>
      Animated.timing(v, {
        toValue: 1, duration: OPEN_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
      })
    const close = (v: Animated.Value) =>
      Animated.timing(v, {
        toValue: 0, duration: CLOSE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
      })

    // Une seule séquence pilote les trois : elle garantit l'ordre, ce que
    // trois boucles indépendantes ne feraient pas.
    const loop = Animated.loop(
      Animated.sequence([
        open(drawers[2]),   // bas
        open(drawers[1]),   // milieu
        open(drawers[0]),   // haut
        Animated.delay(420),
        close(drawers[0]),  // on referme dans l'ordre inverse
        close(drawers[1]),
        close(drawers[2]),
        Animated.delay(240),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <View style={s.wrap}>
      <View style={s.cabinet}>
        {drawers.map((v, i) => (
          <View key={i} style={s.slot}>
            {/* La façade : largeur de base W_MAX, comprimée puis étirée
                depuis son bord gauche. */}
            <Animated.View
              style={[
                s.front,
                {
                  backgroundColor: DRAWER_TINTS[i],
                  opacity: v.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
                  transform: [{
                    scaleX: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [W_CLOSED / W_MAX, widthOf(i) / W_MAX],
                    }),
                  }],
                },
              ]}
            />
            {/* La poignée voyage à part : incluse dans la façade, le scaleX
                l'étirerait avec elle et elle se déformerait. */}
            <Animated.View
              style={[
                s.handle,
                {
                  opacity: v.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
                  transform: [{
                    translateX: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        W_CLOSED - HANDLE_W - HANDLE_INSET,
                        widthOf(i) - HANDLE_W - HANDLE_INSET,
                      ],
                    }),
                  }],
                },
              ]}
            />
          </View>
        ))}
      </View>
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },

  // Plus de caisson dessiné : ni fond ni contour. Le meuble se devine à
  // l'alignement des façades sur leur bord gauche — le trait blanc ne
  // tenait de toute façon que sur un fond sur trois.
  //
  // La largeur reste fixée à W_MAX pour que le bloc ait une emprise
  // stable : sans elle, le conteneur se redimensionnerait au fil de
  // l'animation et le centrage sauterait.
  cabinet: {
    width: W_MAX,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
  },
  // Hauteur d'une façade ; sa largeur est portée par la transformation.
  slot: { height: 10, justifyContent: 'center' },
  front: {
    position: 'absolute',
    left: 0,
    width: W_MAX,
    height: 10,
    borderRadius: 2.5,
    transformOrigin: 'left center',
  },
  handle: {
    position: 'absolute',
    left: 0,
    width: HANDLE_W, height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },

  label: { fontSize: Typography.sm, color: Colors.textTertiary },
})
