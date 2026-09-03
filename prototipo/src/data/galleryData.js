import FLOWER01 from '@/assets/flower-01.webp'
import FLOWER02 from '@/assets/flower-02.webp'
import FLOWER03 from '@/assets/flower-03.webp'
import FLOWER04 from '@/assets/flower-04.webp'
import FLOWER05 from '@/assets/flower-05.webp'

const galleryPlaneData = [
  {
    fallbackColor: '#feca4f',
    accentColor: '#feca4f',
    textureSrc: FLOWER01,
    position: { x: -0.9, y: 0 },
    backgroundColor: '#fffaf0',
    blob1Color: '#ffdf94',
    blob2Color: '#fce7c4',
    label: {
      word: 'golden',
      pms: 'PMS 135 C',
      color: '#2e2e2e',
    },
  },
  {
    fallbackColor: '#80455a',
    accentColor: '#80455a',
    textureSrc: FLOWER02,
    position: { x: 0.8, y: 0 },
    backgroundColor: '#fffaf0',
    blob1Color: '#d29a41',
    blob2Color: '#bb96af',
    label: {
      word: 'violet',
      pms: 'PMS 4985 C',
      color: '#2e2e2e',
    },
  },
  {
    fallbackColor: '#fa7b71',
    accentColor: '#fa7b71',
    textureSrc: FLOWER03,
    position: { x: -0.7, y: 0 },
    backgroundColor: '#5f81ab',
    blob1Color: '#f88b8d',
    blob2Color: '#cfbbdd',
    label: {
      word: 'afterglow',
      pms: 'PMS 170 C',
      color: '#f4f4f4',
    },
  },
  {
    fallbackColor: '#3c72c6',
    accentColor: '#3c72c6',
    textureSrc: FLOWER04,
    position: { x: 1, y: 0 },
    backgroundColor: '#5b9bc2',
    blob1Color: '#ffaa00',
    blob2Color: '#00e1ff',
    label: {
      word: 'cobalt',
      pms: 'PMS 660 C',
      color: '#f4f4f4',
    },
  },
  {
    fallbackColor: '#fdd895',
    accentColor: '#fdd895',
    textureSrc: FLOWER05,
    position: { x: -0.7, y: 0 },
    backgroundColor: '#7d936e',
    blob1Color: '#fdd895',
    blob2Color: '#a5b599',
    label: {
      word: 'meadow',
      pms: 'PMS 7507 C',
      color: '#f4f4f4',
    },
  },
]

export { galleryPlaneData }

/** Las posiciones y el ritmo de los planos del demo, para repetir en las fotos reales. */
const RITMO = galleryPlaneData.map((plane) => plane.position)


/**
 * Reemplaza las flores de muestra por las fotos que subieron los invitados.
 * Si todavia no hay ninguna (o la API no contesta) se queda con las flores:
 * la galeria nunca aparece vacia.
 */
export async function cargarFotosReales(slug) {
  try {
    const respuesta = await fetch(`/api/fotos?slug=${encodeURIComponent(slug)}`)
    if (!respuesta.ok) throw new Error(`la API contesto ${respuesta.status}`)

    const { fotos } = await respuesta.json()
    if (!fotos?.length) return false

    const planos = fotos.map((foto, i) => ({
      // los colores los pisa aplicarMoodAutomatico con los de la propia foto
      fallbackColor: '#d9c9b4',
      accentColor: '#d9c9b4',
      textureSrc: foto.web,
      position: RITMO[i % RITMO.length],
      backgroundColor: '#fffaf0',
      blob1Color: '#f0e0c8',
      blob2Color: '#e4d3bd',
      label: {
        word: foto.mesa ?? 'boda',
        pms: new Date(foto.cuando).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
        color: '#2e2e2e',
      },
    }))

    // se muta el array en su lugar: Gallery.js ya se quedo con esta referencia
    galleryPlaneData.splice(0, galleryPlaneData.length, ...planos)
    return true
  } catch (error) {
    console.error('No se pudieron traer las fotos, queda la galeria de muestra', error)
    return false
  }
}
