// Archive ZIP sans compression (méthode « stored »), pour télécharger les
// photos d'une annonce en un seul fichier depuis le navigateur. Les photos
// sont déjà compressées (JPEG, WebP) : les recompresser ne gagnerait rien.
// Sans dépendance ; limite du format simple : 4 Go et 65 535 fichiers.

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export type ZipEntry = { name: string; data: Uint8Array }

/** Deux fichiers du même nom s'écraseraient à l'extraction : « a.jpg », « a-2.jpg »… */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map(name => {
    const n = (seen.get(name) ?? 0) + 1
    seen.set(name, n)
    if (n === 1) return name
    const dot = name.lastIndexOf('.')
    return dot > name.lastIndexOf('/') ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`
  })
}

export function zipStore(entries: ZipEntry[], date = new Date()): Uint8Array {
  const encoder = new TextEncoder()
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()

  const files = entries.map(e => ({ name: encoder.encode(e.name), data: e.data, crc: crc32(e.data) }))
  const size = files.reduce((n, f) => n + 30 + 46 + 2 * f.name.length + f.data.length, 22)
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  let p = 0
  const u16 = (v: number) => { view.setUint16(p, v, true); p += 2 }
  const u32 = (v: number) => { view.setUint32(p, v, true); p += 4 }
  const bytes = (b: Uint8Array) => { out.set(b, p); p += b.length }
  // Champs communs aux deux en-têtes. Bit 11 : noms en UTF-8.
  const common = (f: (typeof files)[number]) => {
    u16(20); u16(0x0800); u16(0); u16(time); u16(day)
    u32(f.crc); u32(f.data.length); u32(f.data.length); u16(f.name.length); u16(0)
  }

  const offsets: number[] = []
  for (const f of files) {
    offsets.push(p)
    u32(0x04034b50); common(f); bytes(f.name); bytes(f.data)
  }
  const start = p
  files.forEach((f, i) => {
    u32(0x02014b50); u16(20); common(f)
    u16(0); u16(0); u16(0); u32(0); u32(offsets[i]); bytes(f.name)
  })
  const length = p - start
  u32(0x06054b50); u16(0); u16(0); u16(files.length); u16(files.length); u32(length); u32(start); u16(0)
  return out
}
