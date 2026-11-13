import SwiftUI

/// Carte stellaire : un point lumineux par élément d'archive, sur fond bleu nuit.
/// Les éléments cités par Torix s'allument ; ceux d'une même réponse sont reliés par des lignes.
/// Disposition : le temps va de gauche à droite, une bande par type (musique, orgue, photo).
struct StarMapView: View {
    var store: ConversationStore
    @State private var hoveredID: String?

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let layout = StarLayout(items: store.archive.items)
            ZStack(alignment: .topLeading) {
                background(size: size)
                constellationLines(layout: layout, size: size)
                ForEach(store.archive.items) { item in
                    star(item, at: layout.position(of: item, in: size))
                }
                legend(layout: layout)
                    .padding(20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            }
        }
        .background(Theme.nightDeep)
        .clipped()
    }

    // MARK: Fond

    private func background(size: CGSize) -> some View {
        Canvas { context, canvasSize in
            let rect = CGRect(origin: .zero, size: canvasSize)
            context.fill(
                Path(rect),
                with: .radialGradient(
                    Gradient(colors: [Theme.nightSoft, Theme.night, Theme.nightDeep]),
                    center: CGPoint(x: canvasSize.width * 0.55, y: canvasSize.height * 0.4),
                    startRadius: 0,
                    endRadius: max(canvasSize.width, canvasSize.height) * 0.8
                )
            )
            // Poussière d'étoiles, toujours au même endroit d'un lancement à l'autre.
            for index in 0..<160 {
                let key = "poussiere-\(index)"
                let x = TextTools.stableUnit(key, salt: 1) * canvasSize.width
                let y = TextTools.stableUnit(key, salt: 2) * canvasSize.height
                let radius = 0.4 + TextTools.stableUnit(key, salt: 3) * 0.9
                let alpha = 0.10 + TextTools.stableUnit(key, salt: 4) * 0.30
                let dot = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
                context.fill(Path(ellipseIn: dot), with: .color(Color.white.opacity(alpha)))
            }
        }
        .frame(width: size.width, height: size.height)
    }

    // MARK: Lignes

    private func constellationLines(layout: StarLayout, size: CGSize) -> some View {
        let byID = Dictionary(store.archive.items.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        // Lu ici, hors du dessin, pour que la carte se redessine quand les constellations changent.
        let constellations = store.constellations
        let last = constellations.count - 1
        return Canvas { context, _ in
            for (index, group) in constellations.enumerated() {
                let points = group.compactMap { byID[$0] }.map { layout.position(of: $0, in: size) }
                guard points.count > 1 else { continue }
                var path = Path()
                path.move(to: points[0])
                for point in points.dropFirst() {
                    path.addLine(to: point)
                }
                let current = index == last
                context.stroke(
                    path,
                    with: .color(Theme.flame.opacity(current ? 0.75 : 0.28)),
                    style: StrokeStyle(lineWidth: current ? 1.4 : 1, lineCap: .round, lineJoin: .round)
                )
            }
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }

    // MARK: Étoiles

    private func star(_ item: ArchiveItem, at point: CGPoint) -> some View {
        let lit = store.litIDs.contains(item.id)
        let focused = store.focusedID == item.id
        let hovered = hoveredID == item.id
        let core: CGFloat = lit ? 9 : 5
        return ZStack {
            if lit {
                Circle()
                    .fill(Theme.flame.opacity(focused ? 0.55 : 0.35))
                    .frame(width: core * 4.5, height: core * 4.5)
                    .blur(radius: 9)
            }
            Circle()
                .fill(lit ? Theme.flameCore : Theme.text.opacity(0.45))
                .frame(width: core, height: core)
                .shadow(color: lit ? Theme.flame : .clear, radius: 6)
            if lit || hovered {
                VStack(spacing: 1) {
                    Text(item.titre)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.text)
                    Text(item.annee > 0 ? "\(item.type.label) · \(String(item.annee))" : item.type.label)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.flame)
                }
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Theme.night.opacity(0.75), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .offset(y: 30)
                .allowsHitTesting(false)
            }
        }
        .frame(width: 34, height: 34)
        .contentShape(Circle())
        .onHover { inside in
            hoveredID = inside ? item.id : (hoveredID == item.id ? nil : hoveredID)
        }
        .onTapGesture { store.open(item) }
        .animation(.easeInOut(duration: 0.5), value: lit)
        .position(point)
        .zIndex(lit ? 2 : 1)
        .help("\(item.titre) — \(item.type.label)")
    }

    private func legend(layout: StarLayout) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(layout.caption)
                .font(.system(size: 11))
                .foregroundStyle(Theme.textDim)
            Text(store.litIDs.isEmpty
                 ? "Pose une question à Torix : les souvenirs qu'elle retrouve s'allument ici."
                 : "\(store.litIDs.count) souvenir(s) allumé(s). Clique sur une étoile pour l'ouvrir.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.textDim)
        }
    }
}

/// Place chaque élément sur la carte, de façon stable.
struct StarLayout {
    private let minYear: Int
    private let maxYear: Int
    let caption: String

    init(items: [ArchiveItem]) {
        let years = items.map(\.annee).filter { $0 > 0 }
        minYear = years.min() ?? 0
        maxYear = years.max() ?? 0
        if items.isEmpty {
            caption = "L'archive est vide."
        } else if minYear > 0 {
            caption = "\(items.count) éléments · \(minYear) à gauche, \(maxYear) à droite · musique en haut, orgue au milieu, photos en bas"
        } else {
            caption = "\(items.count) éléments"
        }
    }

    func position(of item: ArchiveItem, in size: CGSize) -> CGPoint {
        let span = Double(max(1, maxYear - minYear))
        let time = item.annee > 0 ? Double(item.annee - minYear) / span : TextTools.stableUnit(item.id, salt: 7)
        let band: Double
        switch item.type {
        case .musique: band = 0.24
        case .orgue: band = 0.50
        case .photo: band = 0.76
        }
        let x = 0.09 + 0.82 * time + (TextTools.stableUnit(item.id, salt: 11) - 0.5) * 0.05
        let y = band + (TextTools.stableUnit(item.id, salt: 13) - 0.5) * 0.20
        return CGPoint(x: min(max(x, 0.05), 0.95) * size.width, y: min(max(y, 0.08), 0.90) * size.height)
    }
}
