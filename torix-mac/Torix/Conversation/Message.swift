import Foundation

/// État de Torix, qui anime la flamme.
enum TorixState: Equatable {
    case idle       // repos
    case listening  // écoute : pulsation
    case thinking   // réflexion : scintillement
    case speaking   // parole : ondulation

    var label: String {
        switch self {
        case .idle: return "Prête"
        case .listening: return "Je t'écoute…"
        case .thinking: return "Je cherche…"
        case .speaking: return "Je te réponds"
        }
    }
}

struct Message: Identifiable, Equatable {
    enum Role {
        case user
        case torix
        /// Message de l'appli (erreur, indisponibilité) : jamais lu à voix haute comme un souvenir.
        case info
    }

    let id = UUID()
    var role: Role
    var text: String
    /// Éléments d'archive retrouvés pour cette réponse.
    var items: [ArchiveItem] = []
    var isStreaming = false
}
