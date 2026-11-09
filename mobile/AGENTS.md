# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Clavier

Toute la gestion du clavier passe par `src/components/ui/keyboard/`
(react-native-keyboard-controller) : `FormScreen` pour un écran avec champ,
`FormSheet` à la place d'une `Modal` qui contient un champ, `FormScrollView`
/ `FormFlatList` pour une liste avec champs, `SheetScrollView` /
`SheetFlatList` à l'intérieur d'une `FormSheet`. « Suivant » :
`focusNextField` (déjà branché dans `Input`). Jamais de
`KeyboardAvoidingView` ni de `Keyboard` de react-native.
`npm run check:keyboard` le vérifie (lancé aussi avant chaque build EAS).
