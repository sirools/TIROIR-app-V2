// Configuration dynamique : reprend app.json tel quel, et n'ajoute Firebase
// (Swift Package Manager) que dans le build hackathon. Sans
// EXPO_PUBLIC_HACKATHON_BUILD=true, le résultat est exactement app.json.
const HACKATHON = process.env.EXPO_PUBLIC_HACKATHON_BUILD === 'true'

module.exports = ({ config }) => {
  if (!HACKATHON) return config
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        './plugins/withFirebaseSpm.js',
        // Mêmes produits et même version que modules/tiroir-hybrid-ai/ios/TiroirHybridAI.podspec.
        { minimumVersion: '13.2.0', products: ['FirebaseCore', 'FirebaseAppCheck', 'FirebaseAILogic'] },
      ],
    ],
  }
}
