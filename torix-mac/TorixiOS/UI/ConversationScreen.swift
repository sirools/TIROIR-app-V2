import SwiftUI
import TorixCore
import TorixUI

/// Écran principal : bleu nuit, la flamme au centre, le fil au-dessus, le champ de texte en bas.
/// Un appui sur la flamme : Torix écoute.
struct ConversationScreen: View {
    @Bindable var store: ConversationStore
    @FocusState private var fieldFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            if let notice = store.notice {
                Label(notice, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Theme.text)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.nightSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }
            if store.messages.isEmpty {
                welcome
            } else {
                thread
                flameButton(size: 68)
                    .padding(.vertical, 6)
            }
            inputRow
        }
        .background(Theme.night.ignoresSafeArea())
    }

    // MARK: Accueil : la flamme au centre

    private var welcome: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 0)
            flameButton(size: 170)
            Text("Touche la flamme et parle-moi d'un souvenir.")
                .font(.body)
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
            VStack(spacing: 8) {
                ForEach(["Qu'est-ce que papa jouait en 1976 ?", "Retrouve l'orgue de Paul Muller.", "Montre-moi les photos de Noël."], id: \.self) { example in
                    Button {
                        fieldFocused = false
                        store.send(example)
                    } label: {
                        Text(example)
                            .font(.subheadline)
                            .foregroundStyle(Theme.flame)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(Theme.nightSoft, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture { fieldFocused = false }
    }

    // MARK: Fil de conversation

    private var thread: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                HStack {
                    Spacer()
                    Button {
                        store.clear()
                    } label: {
                        Label("Nouvelle conversation", systemImage: "arrow.counterclockwise")
                            .font(.caption)
                            .foregroundStyle(Theme.textDim)
                    }
                    .buttonStyle(.plain)
                }
                ForEach(store.messages) { message in
                    MessageRow(message: message, store: store)
                }
            }
            .padding(16)
        }
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: Flamme

    private func flameButton(size: CGFloat) -> some View {
        VStack(spacing: 6) {
            Button {
                fieldFocused = false
                store.toggleListening()
            } label: {
                FlameView(state: store.state, size: size)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(store.state == .listening ? "Arrêter l'écoute et envoyer" : "Parler à Torix")
            Text(store.state == .idle ? "Torix" : store.state.label)
                .font(size > 100 ? .title3.weight(.semibold) : .caption)
                .foregroundStyle(store.state == .idle ? Theme.text : Theme.flame)
        }
    }

    // MARK: Saisie

    private var inputRow: some View {
        HStack(spacing: 10) {
            TextField(store.state == .listening ? "Je t'écoute…" : "Écris à Torix…", text: $store.draft)
                .textFieldStyle(.plain)
                .font(.body)
                .foregroundStyle(Theme.text)
                .focused($fieldFocused)
                .submitLabel(.send)
                .onSubmit { store.sendDraft() }
                .padding(.horizontal, 16)
                .padding(.vertical, 11)
                .background(Theme.nightSoft, in: Capsule())

            if store.state == .thinking || store.state == .speaking {
                roundButton("stop.fill", label: "Arrêter la réponse") {
                    store.stopEverything()
                }
            } else if !store.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                roundButton("arrow.up", label: "Envoyer", filled: true) {
                    fieldFocused = false
                    store.sendDraft()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func roundButton(_ symbol: String, label: String, filled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(filled ? Theme.night : Theme.text)
                .frame(width: 42, height: 42)
                .background(filled ? Theme.flame : Theme.nightSoft, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
