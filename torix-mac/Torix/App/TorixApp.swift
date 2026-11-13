import SwiftUI
import TorixCore
import TorixUI
import AppKit

/// Torix pour Mac — prototype 100 % local.
/// Icône dans le Dock (ouvre l'exploration), flamme dans la barre des menus (ouvre la barre flottante).
@main
struct TorixApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra("Torix", systemImage: "flame.fill") {
            Button("Ouvrir Torix") {
                AppController.shared.showBar()
            }
            Button("Exploration") {
                AppController.shared.showExploration(fullScreen: false)
            }
            Divider()
            SettingsLink {
                Text("Réglages…")
            }
            Divider()
            Button("Quitter Torix") {
                NSApp.terminate(nil)
            }
            .keyboardShortcut("q")
        }

        Settings {
            SettingsView(settings: AppController.shared.settings, store: AppController.shared.store)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        AppController.shared.start()
    }

    /// Clic sur l'icône du Dock : ouvrir l'exploration.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        AppController.shared.showExploration(fullScreen: false)
        return false
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}
