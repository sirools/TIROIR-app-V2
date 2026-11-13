import Foundation

/// Nature d'un élément d'archive. Les sons (musique, orgue) se jouent, les photos s'affichent.
enum ItemType: String, Codable, CaseIterable, Sendable {
    case musique
    case orgue
    case photo

    /// Reconnaît un type écrit librement (« Photos », « audio », « music »…). `nil` si inconnu.
    init?(loose raw: String) {
        switch TextTools.normalize(raw) {
        case "musique", "musiques", "music", "morceau", "morceaux", "chanson", "chansons", "audio", "son", "sons":
            self = .musique
        case "orgue", "orgues", "organ":
            self = .orgue
        case "photo", "photos", "image", "images", "picture", "pictures":
            self = .photo
        default:
            return nil
        }
    }

    var isAudio: Bool { self != .photo }

    var label: String {
        switch self {
        case .musique: return "Musique"
        case .orgue: return "Orgue"
        case .photo: return "Photo"
        }
    }

    var symbol: String {
        switch self {
        case .musique: return "music.note"
        case .orgue: return "pianokeys"
        case .photo: return "photo"
        }
    }
}

/// Un élément de l'archive, tel que décrit dans `index.json`.
struct ArchiveItem: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var type: ItemType
    var titre: String
    var annee: Int
    var personnes: [String]
    var description: String
    /// Chemin du fichier, relatif au dossier d'archive (ex. « Musique/ballade.m4a »).
    var chemin: String

    enum CodingKeys: String, CodingKey {
        case id, type, titre, annee, personnes, description, chemin
    }

    init(id: String, type: ItemType, titre: String, annee: Int, personnes: [String], description: String, chemin: String) {
        self.id = id
        self.type = type
        self.titre = titre
        self.annee = annee
        self.personnes = personnes
        self.description = description
        self.chemin = chemin
    }

    /// Lecture tolérante : seuls `id` et `titre` sont obligatoires.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        titre = try c.decode(String.self, forKey: .titre)
        let rawType = try c.decodeIfPresent(String.self, forKey: .type) ?? ""
        type = ItemType(loose: rawType) ?? .photo
        annee = try c.decodeIfPresent(Int.self, forKey: .annee) ?? 0
        personnes = try c.decodeIfPresent([String].self, forKey: .personnes) ?? []
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        chemin = try c.decodeIfPresent(String.self, forKey: .chemin) ?? ""
    }

    /// Ligne compacte donnée au modèle comme résultat d'outil.
    var toolLine: String {
        var parts = ["id=\(id)", "type=\(type.rawValue)", "titre=« \(titre) »", "année=\(annee)"]
        if !personnes.isEmpty { parts.append("personnes=\(personnes.joined(separator: ", "))") }
        if !description.isEmpty { parts.append("description=\(description)") }
        return parts.joined(separator: " | ")
    }
}

/// Contenu de `index.json`. La racine peut aussi être un simple tableau d'éléments.
struct ArchiveIndex: Codable, Sendable {
    var version: Int
    var note: String?
    /// Surnoms → personne (ex. « papa » → « Denis »), pour comprendre les questions.
    var alias: [String: String]
    var elements: [ArchiveItem]

    enum CodingKeys: String, CodingKey {
        case version, note, alias, elements
    }

    init(version: Int = 1, note: String? = nil, alias: [String: String] = [:], elements: [ArchiveItem]) {
        self.version = version
        self.note = note
        self.alias = alias
        self.elements = elements
    }

    init(from decoder: Decoder) throws {
        if let bare = try? decoder.singleValueContainer().decode([ArchiveItem].self) {
            self.init(elements: bare)
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            version: try c.decodeIfPresent(Int.self, forKey: .version) ?? 1,
            note: try c.decodeIfPresent(String.self, forKey: .note),
            alias: try c.decodeIfPresent([String: String].self, forKey: .alias) ?? [:],
            elements: try c.decodeIfPresent([ArchiveItem].self, forKey: .elements) ?? []
        )
    }
}

enum TextTools {
    /// Minuscules, sans accents : « Noël » → « noel ».
    static func normalize(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "fr_FR"))
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Mots d'un texte, normalisés.
    static func words(_ text: String) -> [String] {
        normalize(text)
            .split(whereSeparator: { !($0.isLetter || $0.isNumber) })
            .map(String.init)
    }

    /// Nombre pseudo-aléatoire stable dans [0, 1[ tiré d'une chaîne (FNV-1a).
    /// `String.hashValue` change à chaque lancement : inutilisable pour placer les étoiles.
    static func stableUnit(_ text: String, salt: UInt64 = 0) -> Double {
        var hash: UInt64 = 14695981039346656037 &+ salt
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 1099511628211
        }
        return Double(hash % 10_000) / 10_000
    }
}
