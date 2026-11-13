import Foundation
#if os(iOS)
import AVFoundation
#endif

/// Mots qui changent selon l'appareil, pour les messages affichés.
public enum Platform {
    #if os(iOS)
    public static let thisDevice = "cet iPhone"
    public static let onThisDevice = "sur cet iPhone"
    public static let systemSettings = "Réglages"
    #else
    public static let thisDevice = "ce Mac"
    public static let onThisDevice = "sur ce Mac"
    public static let systemSettings = "Réglages Système"
    #endif
}

/// Session audio. Sur iPhone, une appli doit dire au système qu'elle écoute et qu'elle parle ;
/// sur Mac, il n'y a rien à faire.
enum AudioSession {
    /// À appeler avant d'écouter, de parler ou de jouer un son.
    static func activate() {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        // Une seule catégorie pour tout : micro + haut-parleur. La changer en cours de route coupe le son.
        try? session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP])
        try? session.setActive(true)
        #endif
    }
}
