import SwiftUI
import TorixCore
import TorixUI

/// Torix pour iPhone — 100 % local, même cœur que la version Mac (package TorixCore).
@main
struct TorixiOSApp: App {
    @State private var model = AppModel.shared

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
        }
    }
}
