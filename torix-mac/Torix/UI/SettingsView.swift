import SwiftUI
import TorixCore
import TorixUI
import AppKit
import AVFoundation
import KeyboardShortcuts

/// Réglages : raccourci, écoute automatique, voix et vitesse, dossier d'archive.
struct SettingsView: View {
    @Bindable var settings: TorixSettings
    var store: ConversationStore

    @State private var voices: [AVSpeechSynthesisVoice] = []

    var body: some View {
        Form {
            Section("Raccourci") {
                KeyboardShortcuts.Recorder("Ouvrir ou fermer Torix :", name: .toggleTorix)
                Toggle("Écouter dès que la barre s'ouvre", isOn: $settings.autoListen)
            }

            Section("Voix") {
                Toggle("Répondre à voix haute", isOn: $settings.speakReplies)
                Picker("Voix", selection: $settings.voiceIdentifier) {
                    Text("Automatique (meilleure voix française)").tag("")
                    ForEach(voices, id: \.identifier) { voice in
                        Text(SpeechSpeaker.label(for: voice)).tag(voice.identifier)
                    }
                }
                HStack {
                    Text("Vitesse")
                    Slider(value: $settings.speechRate, in: 0.35...0.65)
                    Button("Écouter") {
                        store.speaker.say(
                            "Bonjour, je suis Torix. Je t'aide à retrouver les souvenirs de la famille.",
                            voiceIdentifier: settings.voiceIdentifier,
                            rate: settings.speechRate
                        )
                    }
                }
                Text("Pour une voix plus naturelle, télécharge une voix française « premium » ou « améliorée » dans Réglages Système › Accessibilité › Contenu énoncé › Voix du système.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Archive") {
                HStack {
                    TextField("Dossier", text: $settings.archivePath)
                        .onSubmit { applyArchivePath() }
                    Button("Choisir…") { chooseFolder() }
                }
                HStack {
                    Button("Recharger l'archive") { applyArchivePath() }
                    Button("Ouvrir dans le Finder") {
                        NSWorkspace.shared.open(store.archive.rootURL)
                    }
                    Spacer()
                    Text("\(store.archive.items.count) élément(s)")
                        .foregroundStyle(.secondary)
                }
                if let problem = store.archive.problem {
                    Text(problem)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }

            Section("Modèle") {
                LabeledContent("Moteur", value: store.brain.name)
                if let problem = store.brainProblem {
                    Text(problem)
                        .font(.caption)
                        .foregroundStyle(.red)
                } else {
                    Text("Le modèle tourne sur ce Mac. Aucune donnée ni requête ne quitte la machine.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 520)
        .fixedSize(horizontal: false, vertical: true)
        .onAppear {
            voices = SpeechSpeaker.frenchVoices()
            store.checkBrain()
        }
    }

    private func applyArchivePath() {
        store.archive.use(path: settings.archivePath)
        store.archiveDidChange()
    }

    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Choisir"
        panel.message = "Choisis le dossier de l'archive Torix"
        panel.directoryURL = store.archive.rootURL
        if panel.runModal() == .OK, let url = panel.url {
            settings.archivePath = (url.path as NSString).abbreviatingWithTildeInPath
            applyArchivePath()
        }
    }
}
