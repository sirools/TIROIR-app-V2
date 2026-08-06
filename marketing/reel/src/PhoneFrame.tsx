import React from 'react'
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { Colors, PHONE } from './theme'

/**
 * Les captures du simulateur sont en 1290×2796, plus étroites que le 9:16
 * d'Instagram. Plutôt que de recadrer et de perdre le haut ou le bas de
 * l'écran, on assume le téléphone comme objet : cadre, ombre portée, fond.
 */
export const PhoneFrame: React.FC<{
  src: string
  /** Seconde de départ dans la capture. */
  from?: number
  /**
   * Vitesse de lecture. Calculée par plan pour que le rush tienne
   * entièrement dans sa durée : un plan qui s'arrête au milieu du geste
   * donne l'impression que la vidéo est figée.
   */
  playbackRate?: number
  /** Léger zoom pendant le plan : le figement tue le rythme. */
  drift?: number
}> = ({ src, from = 0, playbackRate = 1, drift = 0.03 }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 12 })
  const scale = interpolate(frame, [0, durationInFrames], [1, 1 + drift]) * interpolate(enter, [0, 1], [0.96, 1])

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: PHONE.top,
          left: '50%',
          marginLeft: -PHONE.width / 2,
          width: PHONE.width,
          height: PHONE.height,
          borderRadius: 66,
          overflow: 'hidden',
          background: Colors.dark,
          border: `8px solid ${Colors.dark}`,
          boxShadow: '0 50px 100px rgba(0,0,0,0.5), 0 6px 20px rgba(0,0,0,0.35)',
          transform: `scale(${scale})`,
          opacity: enter,
        }}
      >
        <OffthreadVideo
          src={staticFile(src)}
          trimBefore={Math.round(from * 30)}
          playbackRate={playbackRate}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
        />
      </div>
    </AbsoluteFill>
  )
}
