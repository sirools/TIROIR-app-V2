import AVFoundation
import Foundation

/// La voix de Torix, lue sur l'appareil, sans réseau.
///
/// Pour chaque phrase : le fichier `torix_<nom>.m4a` (ou `.wav`) s'il est
/// dans le projet ; sinon la voix française du système dit le texte.
@MainActor
final class VoixTorix {
    private let synthese = AVSpeechSynthesizer()
    private var lecteur: AVAudioPlayer?
    private var lecteurEnPause = false

    func dis(_ phrase: Phrase, volume: Float) {
        tais()
        guard volume > 0 else { return }
        let fichier = Bundle.main.url(forResource: phrase.nomFichier, withExtension: "m4a")
            ?? Bundle.main.url(forResource: phrase.nomFichier, withExtension: "wav")
        if let fichier, let nouveau = try? AVAudioPlayer(contentsOf: fichier) {
            nouveau.volume = volume
            nouveau.play()
            lecteur = nouveau
            return
        }
        let parole = AVSpeechUtterance(string: phrase.texte)
        parole.voice = AVSpeechSynthesisVoice(language: "fr-FR")
        parole.rate = AVSpeechUtteranceDefaultSpeechRate * 0.88
        parole.volume = volume
        synthese.speak(parole)
    }

    func tais() {
        lecteur?.stop()
        lecteur = nil
        lecteurEnPause = false
        if synthese.isSpeaking { synthese.stopSpeaking(at: .immediate) }
    }

    func pause() {
        if let lecteur, lecteur.isPlaying {
            lecteur.pause()
            lecteurEnPause = true
        }
        if synthese.isSpeaking { synthese.pauseSpeaking(at: .word) }
    }

    func reprends() {
        if lecteurEnPause {
            lecteur?.play()
            lecteurEnPause = false
        }
        if synthese.isPaused { synthese.continueSpeaking() }
    }
}
