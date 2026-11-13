import Foundation

/// Importe un dossier d'archive (choisi dans Fichiers ou iCloud Drive) à la place de l'archive actuelle.
/// L'ancienne archive n'est jamais supprimée : elle est mise de côté, à côté de la nouvelle.
public enum ArchiveImporter {
    public enum ImportError: LocalizedError {
        case noIndex
        case unreadableIndex(String)

        public var errorDescription: String? {
            switch self {
            case .noIndex:
                return "Ce dossier ne contient pas de fichier index.json : ce n'est pas une archive Torix."
            case .unreadableIndex(let detail):
                return "Le fichier index.json de ce dossier est illisible : \(detail)"
            }
        }
    }

    /// Copie `source` à la place de `destination`. Renvoie l'endroit où l'ancienne archive a été mise de côté, s'il y en avait une.
    @discardableResult
    public static func importFolder(from source: URL, to destination: URL, now: Date = Date()) throws -> URL? {
        let fm = FileManager.default
        let index = source.appendingPathComponent("index.json")
        guard fm.fileExists(atPath: index.path) else { throw ImportError.noIndex }
        do {
            _ = try JSONDecoder().decode(ArchiveIndex.self, from: Data(contentsOf: index))
        } catch {
            throw ImportError.unreadableIndex(error.localizedDescription)
        }

        // On copie d'abord à côté : si la copie échoue, l'archive actuelle n'a pas bougé.
        let parent = destination.deletingLastPathComponent()
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        let staging = parent.appendingPathComponent(".import-\(UUID().uuidString)")
        do {
            try fm.copyItem(at: source, to: staging)
        } catch {
            try? fm.removeItem(at: staging)
            throw error
        }

        var backup: URL?
        if fm.fileExists(atPath: destination.path) {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd HH-mm-ss"
            let aside = parent.appendingPathComponent("\(destination.lastPathComponent) avant import \(formatter.string(from: now))")
            try fm.moveItem(at: destination, to: aside)
            backup = aside
        }
        do {
            try fm.moveItem(at: staging, to: destination)
        } catch {
            // On remet l'ancienne archive en place.
            if let backup { try? fm.moveItem(at: backup, to: destination) }
            try? fm.removeItem(at: staging)
            throw error
        }
        return backup
    }
}
