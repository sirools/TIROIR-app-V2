import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { PhoneFrame } from './PhoneFrame'
import { Caption } from './Caption'
import { Colors, beat, fontFamily, FPS } from './theme'

/**
 * Le parcours, bout à bout.
 *
 * `rush` = durée réelle du fichier après densify.sh. On s'en sert pour
 * calculer la vitesse de lecture, afin que chaque plan joue son rush en
 * entier : sinon on s'arrête au milieu du geste et l'image paraît figée.
 */
export const SHOTS = [
  { file: 'captures/01-photo-cut.mp4',     rush: 4.07, kicker: '01', title: 'Une photo suffit.' },
  { file: 'captures/02-analyse-cut.mp4',   rush: 3.33, kicker: '02', title: 'L’IA lit l’objet.' },
  { file: 'captures/03-fiche-cut.mp4',     rush: 4.07, kicker: '03', title: 'La fiche s’écrit seule.' },
  { file: 'captures/04-selection-cut.mp4', rush: 4.07, kicker: '04', title: 'Range par lots.' },
  { file: 'captures/05-partage-cut.mp4',   rush: 4.00, kicker: '05', title: 'Un lien. C’est tout.' },
]

const SHOT = beat(6)
const INTRO = beat(3)
const OUTRO = beat(5)

export const REEL_DURATION = INTRO + SHOTS.length * SHOT + OUTRO

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  // Le fond respire lentement : sans ça, les coupes paraissent plates.
  const shift = interpolate(frame, [0, REEL_DURATION], [0, 14])
  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(70% 45% at ${20 + shift}% 0%, rgba(242,105,0,0.32), transparent 62%),
          radial-gradient(60% 45% at ${85 - shift}% 100%, rgba(45,80,22,0.38), transparent 62%),
          ${Colors.dark}`,
      }}
    />
  )
}

const Title: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.5 } })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily }}>
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.86, 1])})`, opacity: pop, textAlign: 'center' }}>
        <div style={{ fontSize: 128, fontWeight: 800, letterSpacing: -5, color: Colors.surface }}>Tiroir</div>
        <div style={{ fontSize: 40, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginTop: 14 }}>
          Photographiez. C’est rangé.
        </div>
      </div>
    </AbsoluteFill>
  )
}

const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 15, mass: 0.6 } })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily }}>
      <div style={{ opacity: pop, textAlign: 'center' }}>
        <div style={{ fontSize: 136, fontWeight: 800, letterSpacing: -6, color: Colors.surface }}>Tiroir</div>
        <div style={{ fontSize: 38, fontWeight: 700, color: Colors.accent, marginTop: 18, letterSpacing: 1 }}>
          tiroir.app
        </div>
        <div
          style={{
            marginTop: 44,
            display: 'inline-block',
            padding: '22px 52px',
            borderRadius: 999,
            background: Colors.surface,
            color: Colors.ink,
            fontSize: 36,
            fontWeight: 800,
          }}
        >
          Gratuit sur iOS et Android
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const Reel: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Backdrop />

    <Sequence durationInFrames={INTRO}>
      <Title />
    </Sequence>

    {SHOTS.map((shot, i) => (
      <Sequence key={shot.kicker} from={INTRO + i * SHOT} durationInFrames={SHOT}>
        <PhoneFrame src={shot.file} playbackRate={shot.rush / (SHOT / FPS)} />
        <Caption kicker={shot.kicker} title={shot.title} />
      </Sequence>
    ))}

    <Sequence from={INTRO + SHOTS.length * SHOT} durationInFrames={OUTRO}>
      <Outro />
    </Sequence>
  </AbsoluteFill>
)
