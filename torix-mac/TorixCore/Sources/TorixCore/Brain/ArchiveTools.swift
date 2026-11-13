import Foundation
import FoundationModels

/// Exécute les outils d'archive pour le modèle et prévient l'appli de ce qui a été trouvé ou ouvert.
@MainActor
final class ArchiveToolbox {
    private let archive: ArchiveStore
    /// Reçoit `.found` et `.opened` pendant une réponse.
    var onEvent: ((BrainEvent) -> Void)?

    init(archive: ArchiveStore) {
        self.archive = archive
    }

    func search(_ query: ArchiveQuery) -> String {
        let results = archive.search(query)
        guard !results.isEmpty else {
            return "Aucun élément dans l'archive pour cette recherche. Dis-le simplement, n'invente rien, et propose une piste (autre année, autre personne, autre mot)."
        }
        onEvent?(.found(results))
        let lines = results.map(\.toolLine).joined(separator: "\n")
        return "\(results.count) élément(s) trouvé(s) dans l'archive :\n\(lines)"
    }

    func open(id: String) -> String {
        guard let item = archive.item(id: id) else {
            return "Aucun élément ne porte l'id « \(id) ». Utilise un id renvoyé par searchArchive."
        }
        onEvent?(.opened(item))
        if archive.fileURL(for: item) == nil {
            return "« \(item.titre) » (\(item.annee)) est affiché, mais son fichier n'est pas dans l'archive : c'est une fiche sans média. Dis-le simplement."
        }
        return item.type.isAudio
            ? "« \(item.titre) » (\(item.annee)) est en train de jouer."
            : "« \(item.titre) » (\(item.annee)) est affichée à l'écran."
    }
}

/// Outil `searchArchive(query, person?, yearFrom?, yearTo?, type?)`.
struct SearchArchiveTool: Tool {
    let name = "searchArchive"
    let description = "Cherche des souvenirs dans l'archive familiale (musiques, orgue, photos) et renvoie les éléments correspondants."
    let toolbox: ArchiveToolbox

    @Generable
    struct Arguments {
        @Guide(description: "Mots-clés de la recherche : titre, lieu, instrument, occasion. Peut être vide.")
        var query: String
        @Guide(description: "Personne concernée, par exemple Denis, Paul Muller ou papa.")
        var person: String?
        @Guide(description: "Première année de la période, par exemple 1976.")
        var yearFrom: Int?
        @Guide(description: "Dernière année de la période. Pour une seule année, la même que yearFrom.")
        var yearTo: Int?
        @Guide(description: "Type d'élément : musique, orgue ou photo.")
        var type: String?
    }

    func call(arguments: Arguments) async throws -> String {
        let query = ArchiveQuery(
            query: arguments.query,
            person: arguments.person,
            yearFrom: arguments.yearFrom,
            yearTo: arguments.yearTo,
            type: arguments.type
        )
        return await toolbox.search(query)
    }
}

/// Outil `openItem(id)` : affiche ou joue un élément.
struct OpenItemTool: Tool {
    let name = "openItem"
    let description = "Affiche une photo ou joue un son de l'archive, à partir de l'id renvoyé par searchArchive."
    let toolbox: ArchiveToolbox

    @Generable
    struct Arguments {
        @Guide(description: "L'id exact de l'élément, tel que renvoyé par searchArchive.")
        var id: String
    }

    func call(arguments: Arguments) async throws -> String {
        await toolbox.open(id: arguments.id)
    }
}
