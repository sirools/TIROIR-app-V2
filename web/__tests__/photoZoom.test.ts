import { describe, expect, it } from 'vitest'
import { IDENTITY, MAX_SCALE, clampView, fitSize, hasPhotoZoom, lensBackground, zoomAt, zoomUrls } from '../lib/photoZoom'

const b = { stageW: 1000, stageH: 800, fitW: 1000, fitH: 500 }

describe('photoZoom', () => {
  it('réserve le zoom aux abonnés', () => {
    expect(hasPhotoZoom('free')).toBe(false)
    expect(hasPhotoZoom(null)).toBe(false)
    expect(hasPhotoZoom('premium')).toBe(true)
    expect(hasPhotoZoom('pro')).toBe(true)
    expect(hasPhotoZoom('business')).toBe(true)
    expect(hasPhotoZoom('pro', '2000-01-01')).toBe(false)
    expect(hasPhotoZoom('pro', '2999-01-01')).toBe(true)
  })

  it('retombe sur la photo courante si la copie manque', () => {
    const rows = [
      { storage_path: 'a.jpg', zoom_path: 'a_hd.jpg' },
      { storage_path: 'b.jpg', zoom_path: 'b_hd.jpg' },
      { storage_path: 'c.jpg', zoom_path: null },
    ]
    const signed = [
      { path: 'a.jpg', signedUrl: 'A' }, { path: 'b.jpg', signedUrl: 'B' }, { path: 'c.jpg', signedUrl: 'C' },
      { path: 'a_hd.jpg', signedUrl: 'A-HD' }, { path: 'b_hd.jpg', signedUrl: null },
    ]
    expect(zoomUrls(rows, signed)).toEqual(['A-HD', 'B', 'C'])
  })

  it('ajuste la photo à la scène sans la déformer', () => {
    expect(fitSize(2000, 1000, 1000, 800)).toEqual({ fitW: 1000, fitH: 500 })
    expect(fitSize(1000, 2000, 1000, 800)).toEqual({ fitW: 400, fitH: 800 })
  })

  it('garde immobile le point sous le curseur', () => {
    const fx = 200
    const fy = 100
    const before = { u: (fx - IDENTITY.x) / IDENTITY.s, v: (fy - IDENTITY.y) / IDENTITY.s }
    const next = zoomAt(IDENTITY, 3, fx, fy, b)
    expect((fx - next.x) / next.s).toBeCloseTo(before.u)
    expect((fy - next.y) / next.s).toBeCloseTo(before.v)
  })

  it('ne dépasse jamais le zoom maximum ni la taille normale', () => {
    expect(zoomAt(IDENTITY, 50, 0, 0, b).s).toBe(MAX_SCALE)
    expect(zoomAt({ s: 2, x: 100, y: 0 }, 0.2, 0, 0, b)).toEqual(IDENTITY)
  })

  it("empêche de sortir la photo de l'écran", () => {
    // À 2x : photo de 2000 × 1000 dans une scène de 1000 × 800.
    expect(clampView({ s: 2, x: 9999, y: -9999 }, b)).toEqual({ s: 2, x: 500, y: -100 })
  })

  it('centre la loupe sur le point visé', () => {
    const lens = lensBackground(IDENTITY, b, 0, 0, 90, 2)
    expect(lens.width).toBe(2000)
    expect(lens.left).toBe(90 - 1000)
    expect(lens.top).toBe(90 - 500)
  })
})
