import SwiftUI

/// La barre flottante (mode rapide) : flamme, champ de texte, micro, bouton « agrandir »,
/// et la réponse qui s'écrit dessous.
struct BarView: View {
    @Bindable var store: ConversationStore
    var onClose: () -> Void
    var onExpand: () -> Void
    /// Hauteur réelle du contenu, pour que le panneau grandisse avec la réponse.
    var onHeightChange: (CGFloat) -> Void

    @FocusState private var fieldFocused: Bool

    static let width: CGFloat = 680
    private let corner: CGFloat = 22

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            inputRow
            if let notice = store.notice {
                Divider().overlay(Theme.flame.opacity(0.2))
                Label(notice, systemImage: "exclamationmark.triangle")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.text)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let reply = store.lastReply {
                Divider().overlay(Theme.flame.opacity(0.2))
                replyArea(reply)
            }
        }
        .frame(width: BarView.width)
        .background(VisualEffectBackground())
        .background(Theme.night.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .strokeBorder(Theme.flame.opacity(0.28), lineWidth: 1)
        )
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.height
        } action: { height in
            onHeightChange(height)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .onExitCommand(perform: onClose)
        .onAppear { fieldFocused = true }
        .preferredColorScheme(.dark)
    }

    private var inputRow: some View {
        HStack(spacing: 12) {
            FlameView(state: store.state, size: 30)

            TextField(store.state == .listening ? "Je t'écoute…" : "Parle à Torix, ou écris ici…", text: $store.draft)
                .textFieldStyle(.plain)
                .font(.system(size: 19))
                .foregroundStyle(Theme.text)
                .focused($fieldFocused)
                .onSubmit { store.sendDraft() }

            Button {
                store.toggleListening()
            } label: {
                Image(systemName: store.state == .listening ? "mic.fill" : "mic")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(store.state == .listening ? Theme.night : Theme.text)
                    .frame(width: 32, height: 32)
                    .background(store.state == .listening ? Theme.flame : Color.white.opacity(0.08), in: Circle())
            }
            .buttonStyle(.plain)
            .help(store.state == .listening ? "Arrêter l'écoute et envoyer" : "Parler à Torix")

            Button(action: onExpand) {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.text)
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.08), in: Circle())
            }
            .buttonStyle(.plain)
            .help("Agrandir : ouvrir l'exploration en plein écran")
        }
        .padding(.horizontal, 16)
        .frame(height: 60)
    }

    private func replyArea(_ reply: Message) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                if let question = store.lastQuestion {
                    Text(question.text)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textDim)
                        .lineLimit(2)
                }
                if reply.text.isEmpty && reply.isStreaming {
                    Text("Je cherche…")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.textDim)
                } else {
                    Text(reply.text)
                        .font(.system(size: 15))
                        .foregroundStyle(reply.role == .info ? Theme.textDim : Theme.text)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                ForEach(reply.items) { item in
                    ItemCardView(item: item, store: store, compact: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .defaultScrollAnchor(.bottom)
        .frame(maxHeight: 360)
    }
}
