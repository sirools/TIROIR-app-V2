import WidgetKit
import SwiftUI
import AppIntents

// BONUS NON BRANCHÉ — ce fichier n'appartient à aucune cible et n'a jamais été compilé.
// Pour l'activer, suivre A-brancher/TorixWidgets/LISEZ-MOI.md.

@main
struct TorixWidgets: WidgetBundle {
    var body: some Widget {
        TorixLockScreenWidget()
        TorixControl()
    }
}

/// Écran verrouillé : une flamme ronde. Un appui ouvre Torix en mode écoute (lien torix://ecouter).
struct TorixLockScreenWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TorixLockScreen", provider: TorixTimeline()) { _ in
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "flame.fill")
                    .font(.title2)
            }
            .widgetURL(URL(string: "torix://ecouter"))
            .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Parler à Torix")
        .description("Ouvre Torix et démarre l'écoute.")
        .supportedFamilies([.accessoryCircular])
    }
}

struct TorixEntry: TimelineEntry {
    let date: Date
}

struct TorixTimeline: TimelineProvider {
    func placeholder(in context: Context) -> TorixEntry { TorixEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (TorixEntry) -> Void) { completion(TorixEntry(date: .now)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TorixEntry>) -> Void) {
        completion(Timeline(entries: [TorixEntry(date: .now)], policy: .never))
    }
}

/// Centre de contrôle : un bouton « Parler à Torix ».
/// Demande que `ParlerATorix.swift` soit aussi coché pour la cible du widget (voir LISEZ-MOI.md).
struct TorixControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "TorixControl") {
            ControlWidgetButton(action: ParlerATorix()) {
                Label("Parler à Torix", systemImage: "flame.fill")
            }
        }
        .displayName("Parler à Torix")
    }
}
