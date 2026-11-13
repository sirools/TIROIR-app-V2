import Foundation
import Observation

/// L'archive locale : un dossier (par défaut `~/Torix/Archive/`) et son `index.json`.
@MainActor
@Observable
final class ArchiveStore {
    private(set) var items: [ArchiveItem] = []
    private(set) var alias: [String: String] = [:]
    private(set) var rootURL: URL
    /// Message à afficher si l'archive n'a pas pu être lue.
    private(set) var problem: String?

    init(path: String) {
        rootURL = ArchiveStore.url(for: path)
    }

    static let defaultPath = "~/Torix/Archive"

    static func url(for path: String) -> URL {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        let expanded = ((trimmed.isEmpty ? defaultPath : trimmed) as NSString).expandingTildeInPath
        return URL(fileURLWithPath: expanded, isDirectory: true)
    }

    var indexURL: URL { rootURL.appendingPathComponent("index.json") }

    /// Change de dossier (réglages) puis recharge.
    func use(path: String) {
        rootURL = ArchiveStore.url(for: path)
        prepareAndLoad()
    }

    /// Crée le dossier, ses sous-dossiers et un index d'exemple s'ils manquent, puis lit l'index.
    /// Un `index.json` existant n'est jamais écrasé.
    func prepareAndLoad() {
        let fm = FileManager.default
        do {
            try fm.createDirectory(at: rootURL, withIntermediateDirectories: true)
            for name in SampleArchive.subfolders {
                try fm.createDirectory(at: rootURL.appendingPathComponent(name), withIntermediateDirectories: true)
            }
            if !fm.fileExists(atPath: indexURL.path) {
                try SampleArchive.encodedIndex().write(to: indexURL, options: .atomic)
            }
        } catch {
            problem = "Impossible de préparer le dossier d'archive (\(rootURL.path)) : \(error.localizedDescription)"
            items = []
            alias = [:]
            return
        }
        load()
    }

    func load() {
        do {
            let data = try Data(contentsOf: indexURL)
            let index = try JSONDecoder().decode(ArchiveIndex.self, from: data)
            items = index.elements
            alias = index.alias
            problem = nil
        } catch {
            items = []
            alias = [:]
            problem = "Le fichier index.json de l'archive est illisible : \(error.localizedDescription)"
        }
    }

    func item(id: String) -> ArchiveItem? {
        let wanted = id.trimmingCharacters(in: .whitespacesAndNewlines)
        return items.first { $0.id == wanted } ?? items.first { $0.id.caseInsensitiveCompare(wanted) == .orderedSame }
    }

    func search(_ query: ArchiveQuery) -> [ArchiveItem] {
        ArchiveSearch.run(query, items: items, alias: alias)
    }

    /// URL du fichier média s'il existe vraiment (les exemples n'en ont pas).
    func fileURL(for item: ArchiveItem) -> URL? {
        guard !item.chemin.isEmpty else { return nil }
        let url = item.chemin.hasPrefix("/")
            ? URL(fileURLWithPath: item.chemin)
            : rootURL.appendingPathComponent(item.chemin)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    /// Quelques lignes de contexte pour les instructions du modèle.
    var summaryForModel: String {
        guard !items.isEmpty else { return "L'archive est vide pour l'instant." }
        let years = items.map(\.annee).filter { $0 > 0 }
        var lines: [String] = []
        if let lo = years.min(), let hi = years.max() {
            lines.append("L'archive contient \(items.count) éléments, de \(lo) à \(hi).")
        } else {
            lines.append("L'archive contient \(items.count) éléments.")
        }
        var people: [String] = []
        for person in items.flatMap(\.personnes) where !people.contains(person) { people.append(person) }
        if !people.isEmpty {
            lines.append("Personnes présentes : \(people.prefix(12).joined(separator: ", ")).")
        }
        if !alias.isEmpty {
            let pairs = alias.sorted { $0.key < $1.key }.map { "« \($0.key) » désigne \($0.value)" }
            lines.append("Surnoms : \(pairs.joined(separator: " ; ")).")
        }
        return lines.joined(separator: " ")
    }
}
