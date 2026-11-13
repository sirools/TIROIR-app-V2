import Foundation

/// Paramètres de l'outil `searchArchive`.
public struct ArchiveQuery: Sendable {
    public var query: String = ""
    public var person: String?
    public var yearFrom: Int?
    public var yearTo: Int?
    public var type: String?

    public init(query: String = "", person: String? = nil, yearFrom: Int? = nil, yearTo: Int? = nil, type: String? = nil) {
        self.query = query
        self.person = person
        self.yearFrom = yearFrom
        self.yearTo = yearTo
        self.type = type
    }
}

/// Recherche dans l'archive : volontairement simple (mots-clés), mais tolérante,
/// parce que le modèle sur l'appareil remplit ses arguments de façon approximative.
public enum ArchiveSearch {
    public static let maxResults = 8

    /// Mots trop courants pour aider à trouver quoi que ce soit.
    private static let stopWords: Set<String> = [
        "a", "au", "aux", "avec", "ce", "ces", "cet", "cette", "dans", "de", "des", "du", "elle", "en", "est",
        "et", "il", "ils", "elles", "je", "la", "le", "les", "leur", "lui", "ma", "mes", "moi", "mon", "ne", "nos", "notre",
        "on", "ou", "par", "pas", "pour", "qu", "que", "quel", "quelle", "quels", "quelles", "qui", "quoi", "sa", "se", "ses", "son", "sur",
        "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vos", "votre", "y", "d", "l", "j", "m", "n", "s", "t", "c",
        "annee", "annees", "an", "ans", "souvenir", "souvenirs", "archive", "archives", "element", "elements",
        "jouait", "jouer", "joue", "jouaient", "faisait", "etait", "avait", "ai", "as", "ont",
        "retrouve", "retrouver", "cherche", "chercher", "montre", "montrer", "trouve", "trouver", "veux", "voudrais",
        "peux", "sais", "dis", "donne", "quand", "comment", "vers", "entre", "depuis", "tout", "tous", "toute", "toutes",
    ]

    public static func run(_ q: ArchiveQuery, items: [ArchiveItem], alias: [String: String]) -> [ArchiveItem] {
        let aliasMap = Dictionary(alias.map { (TextTools.normalize($0.key), TextTools.normalize($0.value)) },
                                  uniquingKeysWith: { first, _ in first })

        // Années : celles passées en argument, sinon celles écrites dans la question.
        var yearFrom = clean(q.yearFrom)
        var yearTo = clean(q.yearTo)
        // Une borne donnée mais absurde (0…) à côté d'une borne valable : on vise cette seule année.
        if yearFrom != nil, yearTo == nil, q.yearTo != nil { yearTo = yearFrom }
        if yearTo != nil, yearFrom == nil, q.yearFrom != nil { yearFrom = yearTo }
        var tokens: [String] = []
        var yearsInQuery: [Int] = []
        for word in TextTools.words(q.query) {
            if let year = Int(word), (1800...2100).contains(year) {
                yearsInQuery.append(year)
            } else {
                tokens.append(word)
            }
        }
        if yearFrom == nil, yearTo == nil, let lo = yearsInQuery.min(), let hi = yearsInQuery.max() {
            yearFrom = lo
            yearTo = hi
        }
        if let from = yearFrom, let to = yearTo, from > to {
            yearFrom = to
            yearTo = from
        }

        // Type : argument explicite, sinon rien d'imposé (les mots « photo », « orgue » comptent au score).
        let type = q.type.flatMap { ItemType(loose: $0) }

        // Personne : surnoms résolus (« papa » → « denis »).
        let personWords: [String] = TextTools.words(q.person ?? "").flatMap { word -> [String] in
            TextTools.words(aliasMap[word] ?? word)
        }.filter { !stopWords.contains($0) }

        // Mots-clés utiles, surnoms résolus.
        let keywords: [String] = tokens
            .filter { !stopWords.contains($0) && $0.count > 1 }
            .flatMap { word -> [String] in TextTools.words(aliasMap[word] ?? word) }

        struct Scored {
            let item: ArchiveItem
            let score: Int
        }

        var passing: [Scored] = []
        for item in items {
            if let from = yearFrom, item.annee < from { continue }
            if let to = yearTo, item.annee > to { continue }
            if let type, item.type != type { continue }

            let title = TextTools.words(item.titre)
            let people = item.personnes.flatMap { TextTools.words($0) }
            let rest = TextTools.words(item.description) + TextTools.words(item.type.rawValue) + TextTools.words(item.id)

            if !personWords.isEmpty {
                let everywhere = Set(people + title + rest)
                if !personWords.contains(where: { matches($0, in: everywhere) }) { continue }
            }

            var score = 0
            for word in keywords {
                if matches(word, in: Set(people)) { score += 3 }
                else if matches(word, in: Set(title)) { score += 2 }
                else if matches(word, in: Set(rest)) { score += 1 }
            }
            passing.append(Scored(item: item, score: score))
        }

        let hasFilter = yearFrom != nil || yearTo != nil || type != nil || !personWords.isEmpty
        var kept = passing.filter { $0.score > 0 }
        if kept.isEmpty {
            // Aucun mot-clé ne porte : si un filtre précis (année, personne, type) a été donné,
            // ou si la question ne contient aucun mot-clé (« qu'as-tu dans l'archive ? »),
            // on rend ce que les filtres laissent passer ; sinon, rien — Torix ne doit pas inventer.
            kept = (hasFilter || keywords.isEmpty) ? passing : []
        }
        return kept
            .sorted { a, b in
                if a.score != b.score { return a.score > b.score }
                if a.item.annee != b.item.annee { return a.item.annee < b.item.annee }
                return a.item.titre < b.item.titre
            }
            .prefix(maxResults)
            .map(\.item)
    }

    /// Le modèle met parfois 0 ou une valeur absurde pour « pas d'année ».
    private static func clean(_ year: Int?) -> Int? {
        guard let year, (1800...2100).contains(year) else { return nil }
        return year
    }

    /// Égalité, ou même début pour tolérer pluriels et petites variantes (« photos » / « photo »).
    private static func matches(_ word: String, in words: Set<String>) -> Bool {
        if words.contains(word) { return true }
        guard word.count >= 4 else { return false }
        return words.contains { other in
            other.count >= 4 && (other.hasPrefix(word) || word.hasPrefix(other))
        }
    }
}
