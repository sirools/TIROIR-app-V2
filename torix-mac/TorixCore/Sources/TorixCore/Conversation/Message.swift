import Foundation

/// État de Torix, qui anime la flamme.
public enum TorixState: Equatable {
    case idle       // repos
    case listening  // écoute : pulsation
    case thinking   // réflexion : scintillement
    case speaking   // parole : ondulation

    public var label: String {
        switch self {
        case .idle: return "Prête"
        case .listening: return "Je t'écoute…"
        case .thinking: return "Je cherche…"
        case .speaking: return "Je te réponds"
        }
    }
}

public struct Message: Identifiable, Equatable {
    public enum Role {
        case user
        case torix
        /// Message de l'appli (erreur, indisponibilité) : jamais lu à voix haute comme un souvenir.
        case info
    }

    public let id = UUID()
    public var role: Role
    public var text: String
    /// Éléments d'archive retrouvés pour cette réponse.
    public var items: [ArchiveItem] = []
    public var isStreaming = false
}
