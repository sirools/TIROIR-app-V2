// apps/next/mocks/react-native-safe-area-context.js

// Réimporte tout depuis le vrai package
const real = require('react-native-safe-area-context')

// Ajoute un faux SafeAreaListener si requis
module.exports = {
  ...real,
  SafeAreaListener: () => null,
}