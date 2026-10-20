const fs = require('fs')
const path = require('path')

/**
 * Cria um arquivo .ICO a partir de um array de Buffers PNG.
 * Estrutura padrão ICO (Microsoft Windows Icon Format):
 * - ICONDIR (6 bytes)
 * - N * ICONDIRENTRY (16 bytes cada)
 * - N * PNG Data
 */
function createIcoFromPngs(pngBuffers) {
  const count = pngBuffers.length
  const headerSize = 6 + count * 16

  let offset = headerSize
  const entries = []
  for (let i = 0; i < count; i++) {
    const buf = pngBuffers[i]
    const w = buf.readUInt32BE(16)
    const h = buf.readUInt32BE(20)

    entries.push({
      width: w >= 256 ? 0 : w,
      height: h >= 256 ? 0 : h,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      bytesInRes: buf.length,
      imageOffset: offset,
      data: buf
    })
    offset += buf.length
  }

  const out = Buffer.alloc(offset)
  // ICONDIR
  out.writeUInt16LE(0, 0) // Reserved
  out.writeUInt16LE(1, 2) // Type: 1 = Icon
  out.writeUInt16LE(count, 4) // Count

  // ICONDIRENTRY
  let entryPos = 6
  for (const entry of entries) {
    out.writeUInt8(entry.width, entryPos + 0)
    out.writeUInt8(entry.height, entryPos + 1)
    out.writeUInt8(entry.colorCount, entryPos + 2)
    out.writeUInt8(entry.reserved, entryPos + 3)
    out.writeUInt16LE(entry.planes, entryPos + 4)
    out.writeUInt16LE(entry.bitCount, entryPos + 6)
    out.writeUInt32LE(entry.bytesInRes, entryPos + 8)
    out.writeUInt32LE(entry.imageOffset, entryPos + 12)
    entry.data.copy(out, entry.imageOffset)
    entryPos += 16
  }

  return out
}

module.exports = { createIcoFromPngs }
