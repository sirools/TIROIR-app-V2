import SwiftUI
import TorixCore

/// Un message du fil, avec les cartes des éléments retrouvés.
public struct MessageRow: View {
    let message: Message
    var store: ConversationStore

    public init(message: Message, store: ConversationStore) {
        self.message = message
        self.store = store
    }

    public var body: some View {
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
