/**
 * Deriva la paleta de una foto: fondo + los dos blobs del shader + acento.
 * ponytail: histograma de tono en un canvas de 24x24. Alcanza para fotos de fiesta;
 * si alguna queda fea, el techo es un k-means sobre los pixeles (o colores a mano).
 */

const MUESTRA = 24
const TONOS = 12

function rgbToHsl(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return [0, 0, l]

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6

  return [h, s, l]
}

function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function leerPixeles(image) {
  const canvas = document.createElement('canvas')
  canvas.width = MUESTRA
  canvas.height = MUESTRA

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudo abrir un canvas 2d para leer la foto')

  context.drawImage(image, 0, 0, MUESTRA, MUESTRA)
  return context.getImageData(0, 0, MUESTRA, MUESTRA).data
}

export function deriveMood(image) {
  const data = leerPixeles(image)

  // un bucket por tono, pesado por saturacion: los grises no votan
  const buckets = Array.from({ length: TONOS }, () => ({ peso: 0, h: 0, s: 0, l: 0 }))
  let luminanciaTotal = 0
  let cantidad = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue

    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
    luminanciaTotal += l
    cantidad += 1

    // los casi negros y casi blancos no dicen nada del tono
    if (l < 0.12 || l > 0.94) continue

    const peso = s * s
    const bucket = buckets[Math.min(Math.floor(h * TONOS), TONOS - 1)]
    bucket.peso += peso
    bucket.h += h * peso
    bucket.s += s * peso
    bucket.l += l * peso
  }

  const luminanciaMedia = cantidad > 0 ? luminanciaTotal / cantidad : 0.5
  const dominantes = buckets
    .filter((bucket) => bucket.peso > 0)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 2)
    .map((bucket) => ({
      h: bucket.h / bucket.peso,
      s: bucket.s / bucket.peso,
      l: bucket.l / bucket.peso,
    }))

  // foto sin color (blanco y negro, contraluz): se cae a un neutro cálido
  const principal = dominantes[0] ?? { h: 0.08, s: 0.12, l: 0.6 }
  const secundario = dominantes[1] ?? { h: (principal.h + 0.5) % 1, s: principal.s, l: principal.l }

  const esClara = luminanciaMedia > 0.5

  return {
    accentColor: hslToHex(principal.h, Math.min(principal.s * 1.15, 0.9), 0.55),
    fallbackColor: hslToHex(principal.h, Math.min(principal.s * 1.15, 0.9), 0.55),
    backgroundColor: esClara
      ? hslToHex(principal.h, Math.min(principal.s, 0.3), 0.96)
      : hslToHex(principal.h, Math.min(principal.s, 0.42), 0.42),
    blob1Color: hslToHex(principal.h, Math.min(principal.s * 1.1, 0.85), esClara ? 0.76 : 0.62),
    blob2Color: hslToHex(secundario.h, Math.min(secundario.s * 1.1, 0.8), esClara ? 0.82 : 0.68),
    labelColor: esClara ? '#2e2e2e' : '#f4f4f4',
  }
}

export function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    image.src = src
  })
}

/** Reemplaza los colores fijos de cada plano por los de su propia foto. */
export async function aplicarMoodAutomatico(planes) {
  await Promise.all(
    planes.map(async (plane) => {
      try {
        const image = await cargarImagen(plane.textureSrc)
        const mood = deriveMood(image)

        plane.accentColor = mood.accentColor
        plane.fallbackColor = mood.fallbackColor
        plane.backgroundColor = mood.backgroundColor
        plane.blob1Color = mood.blob1Color
        plane.blob2Color = mood.blob2Color
        if (plane.label) plane.label.color = mood.labelColor
      } catch (error) {
        // si una foto falla se queda con los colores que ya traía, no rompe la galería
        console.error('No se pudo derivar la paleta de una foto', error)
      }
    }),
  )
}
