/// Mulberry32 : petit générateur déterministe, le même que `outils/plan.mjs`.
/// Une même graine donne toujours le même labyrinthe.
public struct GenerateurAleatoire {
    private var etat: UInt32

    public init(graine: UInt32) {
        etat = graine
    }

    /// Nombre dans [0, 1).
    public mutating func suivant() -> Double {
        etat = etat &+ 0x6D2B_79F5
        var t = etat
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return Double(t ^ (t >> 14)) / 4_294_967_296
    }

    /// Indice dans 0..<nombre.
    public mutating func indice(parmi nombre: Int) -> Int {
        min(nombre - 1, Int(suivant() * Double(nombre)))
    }
}
