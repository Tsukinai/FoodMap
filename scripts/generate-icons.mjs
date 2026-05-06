import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public/icons')

await mkdir(outDir, { recursive: true })

// SVG: orange background, white map pin
const svgTemplate = (size) => {
  const r = size * 0.12
  const pinCx = size / 2
  const pinTopY = size * 0.22
  const pinBodyH = size * 0.32
  const pinR = size * 0.16
  const dotR = size * 0.07
  const dotY = pinTopY + pinR
  const tailTipY = pinTopY + pinBodyH + pinR
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#d96b2c"/>
  <g fill="white">
    <path d="
      M ${pinCx} ${pinTopY}
      a ${pinR} ${pinR} 0 0 1 ${pinR} ${pinR}
      v ${pinBodyH}
      L ${pinCx} ${tailTipY}
      L ${pinCx - pinR} ${pinTopY + pinR + pinBodyH}
      v -${pinBodyH}
      a ${pinR} ${pinR} 0 0 1 ${pinR} -${pinR}
      Z
    "/>
    <circle cx="${pinCx}" cy="${dotY}" r="${dotR}" fill="#d96b2c"/>
  </g>
</svg>`
}

for (const size of [192, 512]) {
  const svg = Buffer.from(svgTemplate(size))
  await sharp(svg).png().toFile(resolve(outDir, `icon-${size}.png`))
  console.log(`Generated icon-${size}.png`)
}
