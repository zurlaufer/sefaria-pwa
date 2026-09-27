/**
 * Generates the PWA / favicon raster assets from scratch with no image deps.
 * Run with: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(out, { recursive: true })

const BRAND = [15, 118, 110] // #0f766e, matches theme_color
const PARCHMENT = [250, 247, 242] // #faf7f2
const GOLD = [216, 173, 76] // #d8ad4c

/** CRC32, needed for PNG chunk framing. */
const table = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Encode an RGBA pixel buffer as a PNG. */
function png(width, height, rgba) {
  const stride = width * 4
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)))

/**
 * Draws the mark: a parchment page with a teal header band, three text lines
 * and a gold bookmark ribbon. Rendered with 3x3 supersampled coverage so the
 * edges are smooth without pulling in a rasteriser.
 */
function draw(size, { padding }) {
  const rgba = Buffer.alloc(size * size * 4)
  const S = 3
  const inner = size * (1 - padding * 2)
  const ox = size * padding
  const oy = size * padding
  const radius = inner * 0.16

  const bandH = inner * 0.2
  const lineH = inner * 0.055
  const lineGap = inner * 0.115
  const lineW = inner * 0.52
  const ribbonW = inner * 0.15
  const ribbonH = inner * 0.44

  const put = (x, y, [r, g, b], a) => {
    const i = (y * size + x) * 4
    const inv = 1 - a
    rgba[i] = clamp255(rgba[i] * inv + r * a)
    rgba[i + 1] = clamp255(rgba[i + 1] * inv + g * a)
    rgba[i + 2] = clamp255(rgba[i + 2] * inv + b * a)
    rgba[i + 3] = clamp255(rgba[i + 3] * inv + 255 * a)
  }

  /** Rounded-rect signed test in icon-local coordinates. */
  const inRound = (px, py, x, y, w, h, r) => {
    const cx = Math.max(x + r, Math.min(px, x + w - r))
    const cy = Math.max(y + r, Math.min(py, y + h - r))
    const dx = px - cx
    const dy = py - cy
    if (px < x || px > x + w || py < y || py > y + h) return false
    return dx * dx + dy * dy <= r * r
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let cov = 0
      let bandCov = 0
      let ribbonCov = 0

      for (let sy = 0; sy < S; sy += 1) {
        for (let sx = 0; sx < S; sx += 1) {
          const px = x + (sx + 0.5) / S
          const py = y + (sy + 0.5) / S
          if (inRound(px, py, ox, oy, inner, inner, radius)) cov += 1 / (S * S)
          if (inRound(px, py, ox, oy, inner, bandH, radius * 0.5)) bandCov += 1 / (S * S)
          const rx = ox + inner - ribbonW - inner * 0.14
          if (inRound(px, py, rx, oy + bandH * 0.7, ribbonW, ribbonH, ribbonW * 0.3))
            ribbonCov += 1 / (S * S)
        }
      }

      if (cov <= 0) continue
      put(x, y, PARCHMENT, cov)

      if (bandCov > 0) put(x, y, BRAND, bandCov)

      // Three text lines under the band.
      const lineTop = oy + bandH + inner * 0.12
      for (let i = 0; i < 3; i += 1) {
        const ly = lineTop + i * lineGap
        const w = i === 2 ? lineW * 0.62 : lineW
        if (inRound(x, y, ox + inner * 0.14, ly, w, lineH, lineH / 2)) {
          put(x, y, BRAND, 0.32)
          break
        }
      }

      if (ribbonCov > 0) put(x, y, GOLD, ribbonCov)
    }
  }
  return rgba
}

const targets = [
  { name: 'icon-192.png', size: 192, padding: 0 },
  { name: 'icon-512.png', size: 512, padding: 0 },
  // Maskable icons must keep art inside the safe zone, so the page is inset.
  { name: 'icon-512-maskable.png', size: 512, padding: 0.12 },
  { name: 'apple-touch-icon.png', size: 180, padding: 0 },
]

for (const { name, size, padding } of targets) {
  writeFileSync(join(out, name), png(size, size, draw(size, { padding })))
  console.log('wrote', name, `${size}x${size}`)
}

// favicon.ico: a 32x32 PNG wrapped in an ICO container (supported since Vista).
const icon32 = png(32, 32, draw(32, { padding: 0 }))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // one image
const entry = Buffer.alloc(16)
entry[0] = 32 // width
entry[1] = 32 // height
entry[2] = 0 // palette
entry[3] = 0 // reserved
entry.writeUInt16LE(1, 4) // colour planes
entry.writeUInt16LE(32, 6) // bits per pixel
entry.writeUInt32LE(icon32.length, 8)
entry.writeUInt32LE(header.length + entry.length, 12) // offset
writeFileSync(join(out, 'favicon.ico'), Buffer.concat([header, entry, icon32]))
console.log('wrote favicon.ico 32x32')
