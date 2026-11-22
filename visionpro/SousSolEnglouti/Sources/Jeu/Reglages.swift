/// Les nombres du jeu, au même endroit pour les régler après un essai.
public enum Reglages {
    public static let piles = 4
    public static let casesParPile = 6
    public static var autonomie: Int { piles * casesParPile }

    /// Rayon du cercle éclairé autour du Messager, en cases.
    public static let rayonLampe = 1.5

    /// La lampe éclaire à travers les murs, mais une enceinte ne se montre
    /// que si le Messager peut la rejoindre en ce nombre de pas au plus.
    public static let pasPourVoirUneEnceinte = 2

    /// Torix donne un indice après ce temps sans déplacement.
    public static let secondesAvantIndice = 30.0
}
