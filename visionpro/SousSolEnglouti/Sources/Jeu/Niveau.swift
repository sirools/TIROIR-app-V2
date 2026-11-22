/// Les 4 pièces du sous-sol : les 4 quarts du plan.
public enum Piece: Sendable {
    case chaufferie, atelier, caveAVin, localServeur

    public var nom: String {
        switch self {
        case .chaufferie: return "la Chaufferie"
        case .atelier: return "l'Atelier"
        case .caveAVin: return "la Cave à vin"
        case .localServeur: return "le Local serveur"
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
    /// Ce plan sort de `outils/plan.mjs` (graine 20261119). Si le plan Figma
    /// diffère, c'est ici qu'on le colle : rien d'autre n'est à changer.
    public static let planNiveau1: [String] = [
        "###########################",
        "#D#.....#E...B#.....#.....#",
        "#.#.###.###.#.#.###.#.###.#",
        "#...#...#...#.#...#...#.#.#",
        "#####.###.###.#####.###.#.#",
        "#E#...#...#E#.....#.#...#.#",
        "#.#.###.###.#####.#.###.#.#",
        "#...#...#...#...#.#.....#.#",
        "#.###.###.###.#.#.#####.#.#",
        "#...#.#.....#.#...#.....#.#",
        "###.#.#####.#.###########.#",
        "#...#.....#...#E......#...#",
        "#.#######.#.#####.###.#.###",
        "#.#.....#.#B#.....#...#...#",
        "#.#.###.#.#.#.#####.#####.#",
        "#..B#.#...#.#...#...#.....#",
        "#####.#####.###.#.###.###.#",
        "#E..............#.....#...#",
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

    public func piece(de c: Case) -> Piece {
        let haut = c.y * 2 < labyrinthe.lignes
        let gauche = c.x * 2 <= labyrinthe.colonnes
        switch (haut, gauche) {
        case (true, true): return .chaufferie
        case (true, false): return .atelier
        case (false, true): return .caveAVin
        case (false, false): return .localServeur
        }
    }
}
