import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import { Colors, fontFamily, TEXT_BAND_TOP } from './theme'

/**
 * Le titre entre sur le premier temps du plan, pas au fondu : c'est ce
 * décalage net qui fait sentir le rythme, même sans écouter la musique.
 * Il vit sous le téléphone, jamais dessus.
 */
export const Caption: React.FC<{ kicker: string; title: string }> = ({ kicker, title }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.5 }, durationInFrames: 16 })
  const y = interpolate(pop, [0, 1], [34, 0])

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <div
        style={{
          position: 'absolute',
          top: TEXT_BAND_TOP,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '0 70px',
          transform: `translateY(${y}px)`,
          opacity: pop,
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: Colors.accent,
            marginBottom: 14,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontSize: 68,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: -1.8,
            color: Colors.surface,
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  )
}
