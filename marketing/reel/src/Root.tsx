import React from 'react'
import { Composition } from 'remotion'
import { Reel, REEL_DURATION } from './Reel'
import { FPS } from './theme'

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    durationInFrames={REEL_DURATION}
    fps={FPS}
    width={1080}
    height={1920}
  />
)
