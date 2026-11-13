import KeyboardShortcuts

extension KeyboardShortcuts.Name {
    /// Ouvre ou ferme la barre flottante. Par défaut : Option + Espace.
    static let toggleTorix = Self("toggleTorix", default: .init(.space, modifiers: [.option]))
}
