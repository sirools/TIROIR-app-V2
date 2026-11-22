/// Les 4 pièces du sous-sol, aux endroits marqués sur le plan Figma.
/// Entre les pièces, ce sont des couloirs.
public enum Piece: CaseIterable, Sendable {
    case chaufferie, atelier, caveAVin, localServeur

    public var nom: String {
        switch self {
        case .chaufferie: return "la Chaufferie"
        case .atelier: return "l'Atelier"
        case .caveAVin: return "la Cave à vin"
        case .localServeur: return "le Local serveur"
        }
    }

    /// Colonnes et lignes couvertes par la pièce.
    var etendue: (x: ClosedRange<Int>, y: ClosedRange<Int>) {
        switch self {
        case .chaufferie: return (9...11, 0...1)
        case .atelier: return (5...7, 3...4)
        case .caveAVin: return (0...2, 6...7)
        case .localServeur: return (10...12, 6...8)
        }
    }
}

/// Un niveau : le labyrinthe et ce qu'on y a posé.
public struct Niveau: Sendable {
    public let labyrinthe: Labyrinthe
    /// L'escalier de départ.
    public let depart: Case
    public let enceintes: [Case]
    public let bornes: [Case]

    /// Plan du niveau 1, « Le sous-sol englouti ».
    ///
    /// `#` mur, `.` passage, `D` escalier de départ, `E` enceinte, `B` borne.
    /// Une case du jeu est un caractère sur deux (lignes et colonnes impaires).
    ///
    /// Ce plan est relevé sur la planche Figma « Scan — Plan du sous-sol de
    /// papa » (page « MLP - V1 ») : murs, escalier, 5 enceintes, 3 bornes.
    /// Il fait foi. `node outils/verifie-plan.mjs` contrôle qu'il est jouable.
    public static let planNiveau1: [String] = [
        "###########################",
        "#D..#....B......#E#.......#",
        "###.#########.#.#.#.#.#.#.#",
        "#E#.#.........#.#.......#.#",
        "#.#.#.#########.#.###.#.#.#",
        "#.#...#.....#.#.#.#...#.#.#",
        "#.#####.###.#.#.###.###.#.#",
        "#.........#.........#...#.#",
        "#.#######.#.#.#.#####.###.#",
        "#...#.....#.......#B..#...#",
        "#.###.#######.#.#.#.#.#.###",
        "#.#...#B....#.#.#...#...#E#",
        "#.#.###.###.###.#########.#",
        "#.....#...#.....#E........#",
        "#.#.#.###.#########.#.#.#.#",
        "#.....#...#...#...#.#.....#",
        "#.#.###.###.#.#.#.###.#.#.#",
        "#E#.........#...#.........#",
        "###########################",
    ]

    public static let niveau1 = Niveau(plan: planNiveau1)

    public init(plan: [String]) {
        let lignesPlan = plan.map { Array($0) }
        let lignes = (lignesPlan.count - 1) / 2
        let colonnes = ((lignesPlan.first?.count ?? 1) - 1) / 2
        var labyrinthe = Labyrinthe(colonnes: colonnes, lignes: lignes)
        var depart = Case(0, 0)
        var enceintes: [Case] = []
        var bornes: [Case] = []
        for y in 0..<lignes {
            for x in 0..<colonnes {
                let c = Case(x, y)
                switch lignesPlan[y * 2 + 1][x * 2 + 1] {
                case "D": depart = c
                case "E": enceintes.append(c)
                case "B": bornes.append(c)
                default: break
                }
                if x + 1 < colonnes, lignesPlan[y * 2 + 1][x * 2 + 2] != "#" {
                    labyrinthe.ouvre(c, .est)
                }
                if y + 1 < lignes, lignesPlan[y * 2 + 2][x * 2 + 1] != "#" {
                    labyrinthe.ouvre(c, .sud)
                }
            }
        }
        self.labyrinthe = labyrinthe
        self.depart = depart
        self.enceintes = enceintes
        self.bornes = bornes
    }

    /// La pièce où se trouve la case, ou `nil` dans un couloir.
    public func piece(de c: Case) -> Piece? {
        Piece.allCases.first { $0.etendue.x.contains(c.x) && $0.etendue.y.contains(c.y) }
    }
}
