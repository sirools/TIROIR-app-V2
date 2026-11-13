import Foundation

/// Archive d'exemple, écrite au premier lancement si `index.json` n'existe pas.
/// Tout y est fictif et marqué « exemple » ; aucun fichier média n'est fourni.
enum SampleArchive {
    static let subfolders = ["Musique", "Orgue", "Photos"]

    static let index = ArchiveIndex(
        version: 1,
        note: "EXEMPLE — ces six éléments sont fictifs et sans fichier média. Remplace-les par les vrais souvenirs, et dépose les fichiers dans Musique, Orgue et Photos.",
        alias: ["papa": "Denis"],
        elements: [
            ArchiveItem(
                id: "exemple-denis-1976-ballade",
                type: .musique,
                titre: "Ballade du grenier (exemple)",
                annee: 1976,
                personnes: ["Denis"],
                description: "Exemple fictif. Denis à la guitare, enregistré sur cassette dans le grenier.",
                chemin: "Musique/exemple-denis-1976-ballade-du-grenier.m4a"
            ),
            ArchiveItem(
                id: "exemple-denis-1976-blues",
                type: .musique,
                titre: "Blues du dimanche (exemple)",
                annee: 1976,
                personnes: ["Denis"],
                description: "Exemple fictif. Un blues lent joué par Denis un dimanche d'hiver.",
                chemin: "Musique/exemple-denis-1976-blues-du-dimanche.m4a"
            ),
            ArchiveItem(
                id: "exemple-paul-1982-toccata",
                type: .orgue,
                titre: "Toccata de la Toussaint (exemple)",
                annee: 1982,
                personnes: ["Paul Muller"],
                description: "Exemple fictif. Paul Muller à l'orgue, pendant l'office de la Toussaint.",
                chemin: "Orgue/exemple-paul-muller-1982-toccata.m4a"
            ),
            ArchiveItem(
                id: "exemple-paul-1991-choral",
                type: .orgue,
                titre: "Choral du soir (exemple)",
                annee: 1991,
                personnes: ["Paul Muller"],
                description: "Exemple fictif. Improvisation de Paul Muller sur un choral, un soir de répétition.",
                chemin: "Orgue/exemple-paul-muller-1991-choral-du-soir.m4a"
            ),
            ArchiveItem(
                id: "exemple-photo-2011-noel",
                type: .photo,
                titre: "Noël à la maison (exemple)",
                annee: 2011,
                personnes: ["Denis", "la famille"],
                description: "Exemple fictif. Denis sort sa guitare après le repas de Noël, toute la famille autour.",
                chemin: "Photos/exemple-2011-noel-a-la-maison.jpg"
            ),
            ArchiveItem(
                id: "exemple-photo-2024-jardin",
                type: .photo,
                titre: "Été au jardin (exemple)",
                annee: 2024,
                personnes: ["la famille"],
                description: "Exemple fictif. Un repas d'été sous le tilleul, trois générations à table.",
                chemin: "Photos/exemple-2024-ete-au-jardin.jpg"
            ),
        ]
    )

    static func encodedIndex() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(index)
    }
}
