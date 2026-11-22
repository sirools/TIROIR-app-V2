/// Les nombres du jeu, au même endroit pour les régler après un essai.
public enum Reglages {
    public static let graine: UInt32 = 20_261_119
    public static let colonnes = 13
    public static let lignes = 9

    public static let piles = 4
    public static let casesParPile = 6
    public static var autonomie: Int { piles * casesParPile }

    /// Rayon du cercle éclairé autour du Messager, en cases.
    public static let rayonLampe = 1.5

    /// Torix donne un indice après ce temps sans déplacement.
    public static let secondesAvantIndice = 30.0
}
