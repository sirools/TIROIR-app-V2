/// Une case du plan. `x` va de gauche à droite, `y` du fond vers l'enfant.
public struct Case: Hashable, Sendable {
    public let x: Int
    public let y: Int

    public init(_ x: Int, _ y: Int) {
        self.x = x
        self.y = y
    }

    public func voisine(_ direction: Direction) -> Case {
        Case(x + direction.dx, y + direction.dy)
    }

    /// Distance à vol d'oiseau, en cases.
    public func ecart(_ autre: Case) -> Double {
        let dx = Double(x - autre.x)
        let dy = Double(y - autre.y)
        return (dx * dx + dy * dy).squareRoot()
    }
}

/// Ordre fixe : nord, est, sud, ouest (le générateur en dépend).
public enum Direction: CaseIterable, Sendable {
    case nord, est, sud, ouest

    public var dx: Int {
        switch self {
        case .est: return 1
        case .ouest: return -1
        default: return 0
        }
    }

    public var dy: Int {
        switch self {
        case .sud: return 1
        case .nord: return -1
        default: return 0
        }
    }
}

/// Grille de cases séparées par des murs.
public struct Labyrinthe: Equatable, Sendable {
    public let colonnes: Int
    public let lignes: Int
    /// `ouvertEst[i]` : pas de mur entre la case i et celle à sa droite.
    private var ouvertEst: [Bool]
    /// `ouvertSud[i]` : pas de mur entre la case i et celle en dessous.
    private var ouvertSud: [Bool]

    public init(colonnes: Int, lignes: Int) {
        self.colonnes = colonnes
        self.lignes = lignes
        ouvertEst = Array(repeating: false, count: colonnes * lignes)
        ouvertSud = Array(repeating: false, count: colonnes * lignes)
    }

    public var cases: [Case] {
        var liste: [Case] = []
        for y in 0..<lignes {
            for x in 0..<colonnes {
                liste.append(Case(x, y))
            }
        }
        return liste
    }

    public func contient(_ c: Case) -> Bool {
        c.x >= 0 && c.y >= 0 && c.x < colonnes && c.y < lignes
    }

    public func indice(_ c: Case) -> Int {
        c.y * colonnes + c.x
    }

    /// Vrai si on peut passer de `c` à sa voisine dans cette direction.
    public func passage(_ c: Case, _ direction: Direction) -> Bool {
        let v = c.voisine(direction)
        guard contient(c), contient(v) else { return false }
        switch direction {
        case .est: return ouvertEst[indice(c)]
        case .ouest: return ouvertEst[indice(v)]
        case .sud: return ouvertSud[indice(c)]
        case .nord: return ouvertSud[indice(v)]
        }
    }

    public mutating func ouvre(_ c: Case, _ direction: Direction) {
        let v = c.voisine(direction)
        guard contient(c), contient(v) else { return }
        switch direction {
        case .est: ouvertEst[indice(c)] = true
        case .ouest: ouvertEst[indice(v)] = true
        case .sud: ouvertSud[indice(c)] = true
        case .nord: ouvertSud[indice(v)] = true
        }
    }

    /// Les cases voisines où l'on peut aller en un pas.
    public func voisinesAccessibles(_ c: Case) -> [Case] {
        Direction.allCases.filter { passage(c, $0) }.map { c.voisine($0) }
    }

    /// Nombre de pas depuis `depart` vers chaque case atteignable.
    public func distances(depuis depart: Case) -> [Case: Int] {
        var distances: [Case: Int] = [depart: 0]
        var file: [Case] = [depart]
        var tete = 0
        while tete < file.count {
            let c = file[tete]
            tete += 1
            let d = distances[c] ?? 0
            for v in voisinesAccessibles(c) where distances[v] == nil {
                distances[v] = d + 1
                file.append(v)
            }
        }
        return distances
    }

    /// Backtracking récursif depuis la case (0, 0).
    public static func genere(colonnes: Int, lignes: Int, graine: UInt32) -> Labyrinthe {
        var labyrinthe = Labyrinthe(colonnes: colonnes, lignes: lignes)
        var hasard = GenerateurAleatoire(graine: graine)
        var vues: Set<Case> = [Case(0, 0)]
        var pile: [Case] = [Case(0, 0)]
        while let c = pile.last {
            let libres = Direction.allCases.filter {
                let v = c.voisine($0)
                return labyrinthe.contient(v) && !vues.contains(v)
            }
            if libres.isEmpty {
                pile.removeLast()
                continue
            }
            let direction = libres[hasard.indice(parmi: libres.count)]
            labyrinthe.ouvre(c, direction)
            let suivante = c.voisine(direction)
            vues.insert(suivante)
            pile.append(suivante)
        }
        return labyrinthe
    }
}
