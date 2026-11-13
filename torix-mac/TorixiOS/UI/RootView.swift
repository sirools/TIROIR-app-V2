import SwiftUI
import TorixCore
import TorixUI

/// Trois onglets : la conversation, la carte stellaire, les réglages.
struct RootView: View {
    @Bindable var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        @Bindable var store = model.store
        TabView(selection: $model.selectedTab) {
            Tab("Torix", systemImage: "flame.fill", value: AppTab.conversation) {
                ConversationScreen(store: model.store)
            }
            Tab("Étoiles", systemImage: "sparkles", value: AppTab.stars) {
                StarsScreen(store: model.store)
            }
            Tab("Réglages", systemImage: "gearshape", value: AppTab.settings) {
                SettingsScreen(model: model)
            }
        }
        .tint(Theme.flame)
        .preferredColorScheme(.dark)
        .sheet(item: $store.previewItem) { item in
            ItemPreviewView(item: item, store: model.store)
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            switch phase {
            case .active:
                model.sceneBecameActive()
            case .background:
                model.sceneLeftForeground()
            default:
                break
            }
        }
        .onOpenURL { url in
            // torix://ecouter — utilisé par le widget d'écran verrouillé.
            if url.scheme == "torix", url.host == "ecouter" {
                model.requestListening()
            }
        }
    }
}

/// La carte stellaire, en plein écran.
struct StarsScreen: View {
    var store: ConversationStore

    var body: some View {
        StarMapView(store: store)
            .ignoresSafeArea(edges: .top)
            .background(Theme.nightDeep)
    }
}
