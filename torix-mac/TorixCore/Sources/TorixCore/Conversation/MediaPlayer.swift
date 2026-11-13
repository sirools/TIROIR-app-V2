import AVFoundation
import Observation

/// Lecteur audio partagé : un seul son à la fois.
@MainActor
@Observable
public final class MediaPlayer {
    /// Id de l'élément en cours de lecture.
    public private(set) var playingID: String?

    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private let relay = PlayerDelegate()
    /// Lecture mise en pause parce que Torix écoute ou parle ; à reprendre ensuite.
    @ObservationIgnored private var pausedForTorix = false

    public func isPlaying(_ item: ArchiveItem) -> Bool {
        playingID == item.id
    }

    public func toggle(_ item: ArchiveItem, url: URL) {
        if playingID == item.id {
            stop()
        } else {
            play(item, url: url)
        }
    }

    public func play(_ item: ArchiveItem, url: URL) {
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
        AudioSession.activate()
        if fresh.play() {
            playingID = id
        }
    }

    public func stop() {
        player?.stop()
        player = nil
        playingID = nil
        pausedForTorix = false
    }

    /// Torix va écouter ou parler : on met le morceau en pause.
    public func pauseForTorix() {
        guard let player, player.isPlaying else { return }
        player.pause()
        pausedForTorix = true
    }

    /// Torix a fini : le morceau reprend là où il s'était arrêté.
    public func resumeAfterTorix() {
        guard pausedForTorix else { return }
        pausedForTorix = false
        guard let player else { return }
        AudioSession.activate()
        player.play()
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
