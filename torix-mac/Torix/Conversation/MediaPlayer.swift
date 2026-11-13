import AVFoundation
import Observation

/// Lecteur audio partagé : un seul son à la fois.
@MainActor
@Observable
final class MediaPlayer {
    /// Id de l'élément en cours de lecture.
    private(set) var playingID: String?

    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private let relay = PlayerDelegate()

    func isPlaying(_ item: ArchiveItem) -> Bool {
        playingID == item.id
    }

    func toggle(_ item: ArchiveItem, url: URL) {
        if playingID == item.id {
            stop()
        } else {
            play(item, url: url)
        }
    }

    func play(_ item: ArchiveItem, url: URL) {
        stop()
        guard let fresh = try? AVAudioPlayer(contentsOf: url) else { return }
        let id = item.id
        relay.onFinish = { [weak self] in
            Task { @MainActor in
                if self?.playingID == id { self?.playingID = nil }
            }
        }
        fresh.delegate = relay
        player = fresh
        if fresh.play() {
            playingID = id
        }
    }

    func stop() {
        player?.stop()
        player = nil
        playingID = nil
    }
}

private final class PlayerDelegate: NSObject, AVAudioPlayerDelegate, @unchecked Sendable {
    private let lock = NSLock()
    private var handler: (@Sendable () -> Void)?

    var onFinish: (@Sendable () -> Void)? {
        get { lock.lock(); defer { lock.unlock() }; return handler }
        set { lock.lock(); handler = newValue; lock.unlock() }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish?()
    }
}
