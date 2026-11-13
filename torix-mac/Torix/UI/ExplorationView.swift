import SwiftUI

/// Fenêtre d'exploration : le fil de discussion à gauche, la carte stellaire à droite.
/// Même conversation que la barre flottante (même `ConversationStore`).
struct ExplorationView: View {
    @Bindable var store: ConversationStore
    @FocusState private var fieldFocused: Bool

    var body: some View {
        HStack(spacing: 0) {
            thread
                .frame(width: 430)
                .background(Theme.night)
            Rectangle()
                .fill(Theme.flame.opacity(0.15))
                .frame(width: 1)
            StarMapView(store: store)
        }
        .frame(minWidth: 980, minHeight: 620)
        .background(Theme.night)
        .preferredColorScheme(.dark)
        .tint(Theme.flame)
        .sheet(item: $store.previewItem) { item in
            ItemPreviewView(item: item, store: store)
        }
    }

    private var thread: some View {
        VStack(spacing: 0) {
            header
            if let notice = store.notice {
                Label(notice, systemImage: "exclamationmark.triangle")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.text)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.nightSoft, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    if store.messages.isEmpty {
                        welcome
                    }
                    ForEach(store.messages) { message in
                        MessageRow(message: message, store: store)
                    }
                }
                .padding(16)
            }
            .defaultScrollAnchor(.bottom)
            inputRow
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            FlameView(state: store.state, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text("Torix")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.text)
                Text(store.state.label)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textDim)
            }
            Spacer()
            if !store.messages.isEmpty {
                Button {
                    store.clear()
                } label: {
                    Image(systemName: "arrow.counterclockwise")
                        .foregroundStyle(Theme.textDim)
                }
                .buttonStyle(.plain)
                .help("Nouvelle conversation")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 34)   // sous la barre de titre transparente
        .padding(.bottom, 12)
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Bonjour. Je suis Torix.")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.text)
            Text("Je t'aide à retrouver les souvenirs de la famille et à les relier. Essaie par exemple :")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textDim)
            ForEach(["Qu'est-ce que papa jouait en 1976 ?", "Retrouve l'orgue de Paul Muller.", "Montre-moi les photos de Noël."], id: \.self) { example in
                Button {
                    store.send(example)
                } label: {
                    Text(example)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.flame)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Theme.nightSoft, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 8)
    }

    private var inputRow: some View {
        HStack(spacing: 10) {
            TextField(store.state == .listening ? "Je t'écoute…" : "Écris à Torix…", text: $store.draft)
                .textFieldStyle(.plain)
                .font(.system(size: 15))
                .foregroundStyle(Theme.text)
                .focused($fieldFocused)
                .onSubmit { store.sendDraft() }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.nightSoft, in: Capsule())

            Button {
                store.toggleListening()
            } label: {
                Image(systemName: store.state == .listening ? "mic.fill" : "mic")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(store.state == .listening ? Theme.night : Theme.text)
                    .frame(width: 36, height: 36)
                    .background(store.state == .listening ? Theme.flame : Theme.nightSoft, in: Circle())
            }
            .buttonStyle(.plain)
            .help(store.state == .listening ? "Arrêter l'écoute et envoyer" : "Parler à Torix")

            if store.state == .thinking || store.state == .speaking {
                Button {
                    store.stopEverything()
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.text)
                        .frame(width: 36, height: 36)
                        .background(Theme.nightSoft, in: Circle())
                }
                .buttonStyle(.plain)
                .help("Arrêter la réponse")
            }
        }
        .padding(16)
        .onAppear { fieldFocused = true }
    }
}

/// Un message du fil, avec les cartes des éléments retrouvés.
struct MessageRow: View {
    let message: Message
    var store: ConversationStore

    var body: some View {
        switch message.role {
        case .user:
            HStack {
                Spacer(minLength: 50)
                Text(message.text)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.night)
                    .textSelection(.enabled)
                    .padding(.horizontal, 13)
                    .padding(.vertical, 9)
                    .background(Theme.flame, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
        case .torix, .info:
            VStack(alignment: .leading, spacing: 10) {
                if message.text.isEmpty && message.isStreaming {
                    Text("Je cherche…")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.textDim)
                } else {
                    Text(message.text)
                        .font(.system(size: 14))
                        .foregroundStyle(message.role == .info ? Theme.textDim : Theme.text)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                ForEach(message.items) { item in
                    ItemCardView(item: item, store: store)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
