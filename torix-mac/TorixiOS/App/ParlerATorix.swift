import AppIntents

/// « Parler à Torix » : ouvre l'appli et démarre l'écoute tout de suite.
/// Disponible pour le bouton Action, Siri et l'appli Raccourcis (voir `TorixShortcuts`).
///
/// Le brief l'appelle `ParlerÀTorix` ; le nom du type est écrit sans accent (voir DECISIONS-IOS.md),
/// le titre affiché garde le sien.
struct ParlerATorix: AppIntent {
    static let title: LocalizedStringResource = "Parler à Torix"
    static let description = IntentDescription("Ouvre Torix et démarre l'écoute immédiatement.")
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppModel.shared.requestListening()
        return .result()
    }
}

/// Déclare le raccourci au système, sans rien avoir à configurer :
/// il apparaît dans Raccourcis, dans les réglages du bouton Action, et Siri comprend les phrases ci-dessous.
struct TorixShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ParlerATorix(),
            phrases: [
                "Parle à \(.applicationName)",
                "Parler à \(.applicationName)",
                "Demande à \(.applicationName)",
                "Je veux parler à \(.applicationName)",
            ],
            shortTitle: "Parler à Torix",
            systemImageName: "flame.fill"
        )
    }
}
