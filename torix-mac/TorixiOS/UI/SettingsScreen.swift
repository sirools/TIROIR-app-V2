import SwiftUI
import AVFoundation
import AppIntents
import UniformTypeIdentifiers
import TorixCore
import TorixUI

/// Réglages : écoute automatique, voix et vitesse, import d'archive, état d'Apple Intelligence.
struct SettingsScreen: View {
    var model: AppModel

    @State private var voices: [AVSpeechSynthesisVoice] = []
    @State private var showImporter = false

    var body: some View {
        @Bindable var settings = model.settings
        let store = model.store
        NavigationStack {
            Form {
                Section {
                    Toggle("Écouter dès l'ouverture", isOn: $settings.autoListen)
                    Toggle("Répondre à voix haute", isOn: $settings.speakReplies)
                } header: {
                    Text("Écoute")
                } footer: {
                    Text("Avec le bouton Action, Siri ou un raccourci, Torix écoute toujours tout de suite.")
                }

                Section {
                    Picker("Voix", selection: $settings.voiceIdentifier) {
                        Text("Automatique").tag("")
                        ForEach(voices, id: \.identifier) { voice in
                            Text(SpeechSpeaker.label(for: voice)).tag(voice.identifier)
                        }
                    }
                    VStack(alignment: .leading) {
                        Text("Vitesse")
                        Slider(value: $settings.speechRate, in: 0.35...0.65) {
                            Text("Vitesse")
                        } minimumValueLabel: {
                            Image(systemName: "tortoise")
                        } maximumValueLabel: {
                            Image(systemName: "hare")
                        }
                    }
                    Button("Écouter un exemple") {
                        store.speaker.say(
                            "Bonjour, je suis Torix. Je t'aide à retrouver les souvenirs de la famille.",
                            voiceIdentifier: settings.voiceIdentifier,
                            rate: settings.speechRate
                        )
                    }
                } header: {
                    Text("Voix")
                } footer: {
                    Text("« Automatique » prend la meilleure voix française installée. Pour une voix plus naturelle, télécharge-en une « premium » ou « améliorée » dans Réglages › Accessibilité › Contenu énoncé › Voix.")
                }

                Section {
                    LabeledContent("Éléments", value: "\(model.archive.items.count)")
                    Button {
                        showImporter = true
                    } label: {
                        if model.isImporting {
                            HStack {
                                ProgressView()
                                Text("Import en cours…")
                            }
                        } else {
                            Label("Importer un dossier d'archive…", systemImage: "square.and.arrow.down")
                        }
                    }
                    .disabled(model.isImporting)
                    Button("Recharger l'archive") {
                        model.reloadArchive()
                    }
                    .disabled(model.isImporting)
                    if let message = model.importMessage {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let problem = model.archive.problem {
                        Text(problem)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                } header: {
                    Text("Archive")
                } footer: {
                    Text("L'archive est dans Fichiers › Sur mon iPhone › Torix › Archive. Le dossier importé doit contenir un fichier index.json ; il remplace l'archive actuelle, qui est gardée à côté. Depuis iCloud Drive, télécharge d'abord le dossier sur l'iPhone.")
                }

                Section {
                    if let problem = store.brainProblem {
                        Label(problem, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                    } else {
                        Label("Activée et prête", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    LabeledContent("Moteur", value: store.brain.name)
                    Button("Vérifier à nouveau") {
                        store.checkBrain()
                    }
                } header: {
                    Text("Apple Intelligence")
                } footer: {
                    Text("Le modèle, la reconnaissance vocale et la voix tournent sur cet iPhone. Aucune donnée ni requête ne quitte l'appareil.")
                }

                Section {
                    ShortcutsLink()
                } header: {
                    Text("Accès en un geste")
                } footer: {
                    Text("Dis « Dis Siri, parle à Torix ». Pour le bouton Action : Réglages › Bouton Action › Raccourci › Torix › Parler à Torix.")
                }
            }
            .navigationTitle("Réglages")
        }
        .onAppear {
            voices = SpeechSpeaker.frenchVoices()
            store.checkBrain()
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.folder]) { result in
            switch result {
            case .success(let folder):
                Task { await model.importArchive(from: folder) }
            case .failure:
                break   // choix annulé
            }
        }
    }
}
