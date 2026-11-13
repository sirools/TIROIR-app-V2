import SwiftUI
import TorixCore

/// Flamme provisoire, dessinée en attendant le logo officiel (voir RAPPORT.md, « Logo »).
/// `sway` penche la pointe : -1 à gauche, +1 à droite.
public struct FlameShape: Shape {
    public var sway: Double = 0

    public init(sway: Double = 0) {
        self.sway = sway
    }

    public var animatableData: Double {
        get { sway }
        set { sway = newValue }
    }

    public func path(in rect: CGRect) -> Path {
        func point(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: rect.minX + x * rect.width, y: rect.minY + y * rect.height)
        }
        let lean = 0.11 * sway
        var path = Path()
        path.move(to: point(0.5, 1.0))
        path.addCurve(to: point(0.13, 0.62), control1: point(0.27, 1.0), control2: point(0.09, 0.85))
        path.addCurve(to: point(0.5 + lean, 0.02), control1: point(0.18, 0.38), control2: point(0.45 + lean, 0.27))
        path.addCurve(to: point(0.87, 0.62), control1: point(0.57 + lean, 0.27), control2: point(0.83, 0.40))
        path.addCurve(to: point(0.5, 1.0), control1: point(0.91, 0.85), control2: point(0.73, 1.0))
        path.closeSubpath()
        return path
    }
}

/// La flamme bleue de Torix, animée selon son état :
/// repos (respiration lente), écoute (pulsation), réflexion (scintillement), parole (ondulation).
public struct FlameView: View {
    public var state: TorixState
    public var size: CGFloat

    public init(state: TorixState, size: CGFloat = 30) {
        self.state = state
        self.size = size
    }

    /// Le logo officiel, s'il a été déposé dans le catalogue (asset « TorixFlame »).
    private static let officialLogo: PlatformImage? = PlatformImages.named("TorixFlame")

    private struct Motion {
        var scale: Double = 1
        var sway: Double = 0
        var opacity: Double = 1
        var glow: Double = 0.3
    }

    private func motion(at t: Double) -> Motion {
        switch state {
        case .idle:
            return Motion(scale: 1 + 0.02 * sin(t * 1.3), sway: 0.18 * sin(t * 0.9), opacity: 0.95, glow: 0.25)
        case .listening:
            let pulse = sin(t * 5.2)
            return Motion(scale: 1 + 0.10 * pulse, sway: 0.1 * sin(t * 1.7), opacity: 1, glow: 0.55 + 0.3 * pulse)
        case .thinking:
            let flicker = sin(t * 17) * sin(t * 7.3 + 1) * sin(t * 29 + 2)
            return Motion(scale: 1 + 0.04 * sin(t * 13), sway: 0.25 * sin(t * 11), opacity: 0.72 + 0.28 * flicker, glow: 0.35 + 0.25 * flicker)
        case .speaking:
            return Motion(scale: 1 + 0.05 * sin(t * 9), sway: 0.9 * sin(t * 6), opacity: 1, glow: 0.5 + 0.15 * sin(t * 6))
        }
    }

    public var body: some View {
        TimelineView(.animation) { context in
            let m = motion(at: context.date.timeIntervalSinceReferenceDate)
            ZStack {
                Circle()
                    .fill(Theme.flame.opacity(max(0, m.glow) * 0.55))
                    .blur(radius: size * 0.28)
                    .frame(width: size * 1.1, height: size * 1.1)
                flame(sway: m.sway)
                    .frame(width: size * 0.72, height: size)
                    .scaleEffect(m.scale, anchor: .bottom)
                    .opacity(m.opacity)
            }
            .frame(width: size * 1.2, height: size * 1.2)
        }
        .accessibilityLabel("Torix : \(state.label)")
    }

    @ViewBuilder
    private func flame(sway: Double) -> some View {
        if let logo = FlameView.officialLogo {
            Image(platformImage: logo)
                .resizable()
                .scaledToFit()
                .rotationEffect(.degrees(sway * 4), anchor: .bottom)
        } else {
            ZStack(alignment: .bottom) {
                FlameShape(sway: sway)
                    .fill(LinearGradient(colors: [Theme.flameDeep, Theme.flame, Theme.flameCore.opacity(0.9)],
                                         startPoint: .bottom, endPoint: .top))
                FlameShape(sway: sway * 0.6)
                    .fill(LinearGradient(colors: [Color.white.opacity(0.95), Theme.flameCore],
                                         startPoint: .bottom, endPoint: .top))
                    .scaleEffect(x: 0.46, y: 0.52, anchor: .bottom)
            }
        }
    }
}
