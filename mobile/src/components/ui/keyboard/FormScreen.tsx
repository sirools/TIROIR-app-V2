/**
 * Clavier — la seule gestion du clavier de l'app.
 *
 * Tout écran, modale ou bottom sheet qui contient un champ passe par un des
 * composants de ce dossier. Aucun écran ne gère le clavier lui-même
 * (`KeyboardAvoidingView` de react-native, `keyboardVerticalOffset`,
 * `Keyboard.addListener`…) : `npm run check:keyboard` le refuse.
 *
 * Règles tenues ici, une fois pour toutes :
 * - le champ actif reste visible au-dessus du clavier, avec `FIELD_GAP`
 *   d'espace ;
 * - le bouton principal (`footer`) reste collé au-dessus du clavier ;
 * - un tap hors d'un champ ferme le clavier ;
 * - « Suivant » passe au champ suivant (`focusNextField`, branché par
 *   défaut dans `Input`), « OK » sur le dernier valide (`onSubmitEditing`).
 *
 * Moteur : react-native-keyboard-controller (même comportement iOS et
 * Android, y compris dans les `Modal` Android et en edge-to-edge).
 */
import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  ScrollView,
  TextInput,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ModalProps,
  type ViewStyle,
  type StyleProp,
  type FlatListProps,
  type ScrollViewProps,
} from 'react-native'
import {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
  KeyboardStickyView,
  KeyboardController,
  KeyboardEvents,
} from 'react-native-keyboard-controller'
import { Screen } from '../Screen'
import { Colors, Spacing } from '../tokens'

/** Espace laissé entre le bas du champ actif et le haut du clavier. */
export const FIELD_GAP = Spacing.lg

/** Hauteur d'un bouton principal (`Button`) et de sa marge au-dessus. */
export const PRIMARY_BUTTON_SPACE = 52 + Spacing.lg

/** Passe au champ suivant de l'écran (touche « Suivant »). */
export function focusNextField() {
  KeyboardController.setFocusTo('next')
}

/** Ferme le clavier. */
export function dismissKeyboard() {
  KeyboardController.dismiss()
}

// ─── Défilement ──────────────────────────────────────────────────────────────

/**
 * Hauteur que le `FormScreen` englobant demande de garder libre sous le
 * champ actif (son pied collé au clavier, `keepVisibleBelow`).
 */
const KeepBelowContext = createContext(0)

type FormScrollViewProps = ScrollViewProps & {
  /** Espace à garder sous le champ actif, en plus de `FIELD_GAP` (ex. un pied collé). */
  extraBottomOffset?: number
  children?: React.ReactNode
}

/**
 * ScrollView qui fait remonter le champ actif au-dessus du clavier. À
 * utiliser partout où un formulaire défile — écran, sheet ou section.
 */
export const FormScrollView = forwardRef<React.ElementRef<typeof KeyboardAwareScrollView>, FormScrollViewProps>(
  function FormScrollView({ extraBottomOffset = 0, children, ...props }, ref) {
    const keepBelow = useContext(KeepBelowContext)
    return (
      <KeyboardAwareScrollView
        ref={ref}
        bottomOffset={FIELD_GAP + keepBelow + extraBottomOffset}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </KeyboardAwareScrollView>
    )
  },
)

/**
 * Dans une `FormSheet`, la feuille entière remonte au-dessus du clavier et
 * se réduit d'autant : un champ placé bas dans la liste peut alors sortir
 * de la partie visible. Une fois le clavier ouvert (feuille en place), on
 * mesure le champ actif et la liste défile juste assez pour le montrer.
 */
function useKeepFocusedInputVisible(
  listRef: React.RefObject<{ measureInWindow: View['measureInWindow'] } | null>,
  scrollTo: (y: number) => void,
) {
  const offsetY = useRef(0)
  useEffect(() => {
    const sub = KeyboardEvents.addListener('keyboardDidShow', () => {
      const focused = TextInput.State.currentlyFocusedInput() as unknown as View | null
      const list = listRef.current
      if (!focused?.measureInWindow || !list) return
      list.measureInWindow((_lx, listY, _lw, listH) => {
        focused.measureInWindow((_x, y, _w, h) => {
          const below = y + h + FIELD_GAP - (listY + listH)
          const above = listY - (y - FIELD_GAP)
          if (below > 0) scrollTo(offsetY.current + below)
          else if (above > 0) scrollTo(Math.max(0, offsetY.current - above))
        })
      })
    })
    return () => sub.remove()
  }, [listRef, scrollTo])
  return offsetY
}

/**
 * ScrollView d'une `FormSheet` : la feuille remonte déjà au-dessus du
 * clavier (pas de second décalage, qui ferait sauter le champ trop haut) ;
 * la liste se contente de garder le champ actif dans sa partie visible.
 */
export function SheetScrollView({ children, onScroll, ...props }: ScrollViewProps & { children?: React.ReactNode }) {
  const ref = useRef<ScrollView>(null)
  const scrollTo = useCallback((y: number) => ref.current?.scrollTo({ y, animated: true }), [])
  const offsetY = useKeepFocusedInputVisible(ref as React.RefObject<View | null>, scrollTo)
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      {...props}
      onScroll={e => { offsetY.current = e.nativeEvent.contentOffset.y; onScroll?.(e) }}
    >
      {children}
    </ScrollView>
  )
}

/** FlatList d'une `FormSheet` (même règle que `SheetScrollView`). */
function SheetFlatListInner<T>({ onScroll, ...props }: FlatListProps<T>, ref: React.ForwardedRef<FlatList<T> | null>) {
  const listRef = useRef<FlatList<T>>(null)
  useImperativeHandle(ref, () => listRef.current as FlatList<T>)
  const scrollTo = useCallback((y: number) => listRef.current?.scrollToOffset({ offset: y, animated: true }), [])
  const nativeRef = useRef<View | null>(null)
  useEffect(() => {
    nativeRef.current = (listRef.current?.getNativeScrollRef() as unknown as View) ?? null
  })
  const offsetY = useKeepFocusedInputVisible(nativeRef, scrollTo)
  return (
    <FlatList
      ref={listRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      scrollEventThrottle={16}
      {...props}
      onScroll={e => { offsetY.current = e.nativeEvent.contentOffset.y; onScroll?.(e) }}
    />
  )
}
export const SheetFlatList = forwardRef(SheetFlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement

/**
 * FlatList dont le champ actif (dans une cellule ou l'en-tête) remonte
 * au-dessus du clavier.
 */
function FormFlatListInner<T>(props: FlatListProps<T>, ref: React.ForwardedRef<FlatList<T>>) {
  return (
    <FlatList
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      {...props}
      renderScrollComponent={scrollProps => <FormScrollView {...scrollProps} />}
    />
  )
}
export const FormFlatList = forwardRef(FormFlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement

// ─── Écran ───────────────────────────────────────────────────────────────────

interface FormScreenProps {
  children: React.ReactNode
  /** Bandeau fixe au-dessus du contenu (barre de titre, retour). */
  header?: React.ReactNode
  /**
   * Bouton principal (Valider, Se connecter…), collé au-dessus du clavier
   * quand il est ouvert, en bas de l'écran sinon.
   */
  footer?: React.ReactNode
  /**
   * `scroll` (défaut) : le contenu défile et le champ actif remonte.
   * `list` : le contenu porte sa propre liste, qui doit être une
   * `FormFlatList` ou une `FormScrollView` (champs dans les cellules).
   * `fixed` : le champ est fixe (barre de chat, recherche en haut) ; la
   * zone se réduit de la hauteur du clavier, pied compris.
   */
  mode?: 'scroll' | 'list' | 'fixed'
  /** Style du contenu défilant (mode `scroll`). */
  contentContainerStyle?: StyleProp<ViewStyle>
  /** Centre verticalement le formulaire quand il tient dans l'écran. */
  centered?: boolean
  /**
   * Hauteur à garder visible sous le champ actif, en plus de `FIELD_GAP` :
   * typiquement le bouton principal posé juste sous le dernier champ.
   */
  keepVisibleBelow?: number
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
  topColor?: string
  style?: ViewStyle
}

/**
 * Écran avec au moins un champ de saisie. Remplace `Screen` sur ces écrans.
 */
export function FormScreen({
  children,
  header,
  footer,
  mode = 'scroll',
  contentContainerStyle,
  centered = false,
  keepVisibleBelow = 0,
  edges = ['top', 'bottom'],
  topColor,
  style,
}: FormScreenProps) {
  // Le pied est collé au clavier : on mesure ce qui le sépare du bas de la
  // fenêtre (zone sûre, barre d'onglets…) pour qu'il se pose pile sur le
  // clavier, et le champ actif garde sa hauteur en plus de FIELD_GAP.
  const footerRef = useRef<View>(null)
  const { height: windowHeight } = useWindowDimensions()
  const [footerHeight, setFooterHeight] = useState(0)
  const [footerGap, setFooterGap] = useState(0)
  const onFooterLayout = useCallback((e: LayoutChangeEvent) => {
    setFooterHeight(e.nativeEvent.layout.height)
    footerRef.current?.measureInWindow((_x, y, _w, h) => {
      setFooterGap(Math.max(0, windowHeight - (y + h)))
    })
  }, [windowHeight])

  if (mode === 'fixed') {
    return (
      <Screen edges={edges} topColor={topColor} style={style}>
        {header}
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </Screen>
    )
  }

  return (
    <Screen edges={edges} topColor={topColor} style={style}>
      {header}
      <KeepBelowContext.Provider value={(footer ? footerHeight : 0) + keepVisibleBelow}>
        {mode === 'scroll' ? (
          <FormScrollView
            style={styles.flex}
            contentContainerStyle={[centered && styles.centered, contentContainerStyle]}
          >
            {children}
          </FormScrollView>
        ) : (
          <View style={styles.flex}>{children}</View>
        )}
      </KeepBelowContext.Provider>
      {footer ? (
        <KeyboardStickyView offset={{ opened: footerGap }}>
          <View ref={footerRef} onLayout={onFooterLayout} style={styles.footer}>
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </Screen>
  )
}

// ─── Modales et bottom sheets ───────────────────────────────────────────────

type FormSheetProps = Omit<ModalProps, 'transparent'> & {
  children: React.ReactNode
  /** Où se pose la feuille : en bas (bottom sheet) ou au centre (dialogue). */
  placement?: 'bottom' | 'center'
  /** Style du conteneur plein écran (rarement utile). */
  containerStyle?: StyleProp<ViewStyle>
}

/**
 * `Modal` transparente qui remonte son contenu au-dessus du clavier. Les
 * enfants gardent leur fond (backdrop) et leur feuille ; un tap sur une
 * zone non interactive de la feuille ferme le clavier. `containerStyle`
 * reçoit le style plein écran (fond assombri, marges) qui était posé sur
 * l'ancien `KeyboardAvoidingView`.
 */
export function FormSheet({
  children,
  placement = 'bottom',
  containerStyle,
  ...modalProps
}: FormSheetProps) {
  return (
    <Modal transparent {...modalProps}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {/* Un tap qui n'est pris par aucun enfant (fond de la feuille, texte)
            ferme le clavier ; le backdrop des enfants garde son rôle. */}
        <Pressable
          style={[styles.flex, placement === 'center' ? styles.sheetCenter : styles.sheetBottom, containerStyle]}
          onPress={dismissKeyboard}
          accessible={false}
        >
          {children}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/**
 * Pour un panneau qui n'est pas une `Modal` (feuille animée posée en
 * absolu, par exemple) : se réduit de la hauteur du clavier.
 */
export function FormKeyboardArea({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, style]}>
      {children}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flexGrow: 1, justifyContent: 'center' },
  // Le pied garde le style que l'écran lui donne (marges, filet) ; seul
  // le fond est posé ici, pour ne pas laisser voir la liste derrière.
  footer: { backgroundColor: Colors.background },
  sheetBottom: { justifyContent: 'flex-end' },
  sheetCenter: { justifyContent: 'center' },
})
