import SwiftUI
import AppKit

/// Carte d'un élément d'archive dans le fil : lecteur pour les sons, vignette pour les photos.
struct ItemCardView: View {
    let item: ArchiveItem
    var store: ConversationStore
    var compact = false

    private var fileURL: URL? { store.archive.fileURL(for: item) }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            leading
            VStack(alignment: .leading, spacing: 3) {
                Text(item.titre)
                    .font(.system(size: compact ? 13 : 14, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.flame)
                if !compact, !item.description.isEmpty {
                    Text(item.description)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textDim)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if fileURL == nil {
                    Text("Fiche sans fichier média")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textDim)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(compact ? 8 : 12)
        .background(Theme.nightSoft.opacity(compact ? 0.55 : 0.9), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Theme.flame.opacity(store.focusedID == item.id ? 0.7 : 0.18), lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onTapGesture {
            if !item.type.isAudio || fileURL == nil { store.open(item) }
        }
    }

    private var subtitle: String {
        var parts = [item.type.label]
        if item.annee > 0 { parts.append(String(item.annee)) }
        if !item.personnes.isEmpty { parts.append(item.personnes.joined(separator: ", ")) }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private var leading: some View {
        let side: CGFloat = compact ? 36 : 56
        if item.type.isAudio {
            Button {
                if let fileURL {
                    store.media.toggle(item, url: fileURL)
                } else {
                    store.open(item)
                }
            } label: {
                Image(systemName: fileURL == nil ? item.type.symbol : (store.media.isPlaying(item) ? "pause.fill" : "play.fill"))
                    .font(.system(size: compact ? 14 : 20, weight: .semibold))
                    .foregroundStyle(fileURL == nil ? Theme.textDim : Theme.night)
                    .frame(width: side, height: side)
                    .background(fileURL == nil ? Theme.night.opacity(0.6) : Theme.flame, in: Circle())
            }
            .buttonStyle(.plain)
            .help(fileURL == nil ? "Fichier absent de l'archive" : (store.media.isPlaying(item) ? "Mettre en pause" : "Écouter"))
        } else if let fileURL, let image = NSImage(contentsOf: fileURL) {
            Image(nsImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: side, height: side)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        } else {
            Image(systemName: item.type.symbol)
                .font(.system(size: compact ? 14 : 20))
                .foregroundStyle(Theme.textDim)
                .frame(width: side, height: side)
                .background(Theme.night.opacity(0.6), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
    }
}

/// Élément affiché en grand (photo, ou fiche quand le fichier manque).
struct ItemPreviewView: View {
    let item: ArchiveItem
    var store: ConversationStore
    @Environment(\.dismiss) private var dismiss

    private var caption: String {
        var parts = [item.type.label]
        if item.annee > 0 { parts.append(String(item.annee)) }
        parts.append(contentsOf: item.personnes)
        return parts.joined(separator: " · ")
    }

    var body: some View {
        VStack(spacing: 16) {
            if !item.type.isAudio, let url = store.archive.fileURL(for: item), let image = NSImage(contentsOf: url) {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .frame(maxWidth: 900, maxHeight: 600)
            } else {
                VStack(spacing: 10) {
                    Image(systemName: item.type.symbol)
                        .font(.system(size: 44))
                        .foregroundStyle(Theme.flame)
                    Text("Le fichier n'est pas dans l'archive")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Text(item.chemin.isEmpty ? "Aucun chemin n'est indiqué dans index.json." : "Attendu : \(item.chemin)")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textDim)
                        .textSelection(.enabled)
                }
                .frame(width: 420, height: 220)
                .background(Theme.nightSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            VStack(spacing: 4) {
                Text(item.titre)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                Text(caption)
                    .foregroundStyle(Theme.flame)
                if !item.description.isEmpty {
                    Text(item.description)
                        .foregroundStyle(Theme.textDim)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 520)
                }
            }
            Button("Fermer") { dismiss() }
                .keyboardShortcut(.cancelAction)
        }
        .padding(28)
        .background(Theme.night)
        .preferredColorScheme(.dark)
    }
}
