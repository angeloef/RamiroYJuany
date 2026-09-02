import '@/css/base.css'
import '@/css/canvas.css'

import { Engine } from '@/Experience/Engine'
import { galleryPlaneData } from '@/data/galleryData'
import { aplicarMoodAutomatico } from '@/data/mood'

/**
 * Arranca la galería 3D. Se importa aparte del hero a propósito: three.js pesa
 * ~200 KB gzip y no hace falta ninguno de esos bytes para pintar la portada.
 */
export async function bootGallery(canvas) {
  const engine = new Engine(canvas)

  // el fullscreen shader del fondo es caro por pixel: en telefonos se renderiza
  // a 1.5x en vez de 2x, que es lo que hacia sentir la galeria pesada
  const esChico = window.innerWidth < 900
  engine.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, esChico ? 1.5 : 2))

  // la paleta de cada plano sale de su propia foto, no de colores escritos a mano
  await aplicarMoodAutomatico(galleryPlaneData)
  await engine.init()

  return engine
}
